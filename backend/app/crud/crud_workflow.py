# hr_software/app/crud/crud_workflow.py
from sqlmodel import Session, select, and_
from typing import List, Optional
from datetime import datetime

from app.models.workflow import (
    WorkflowTemplate, WorkflowStepTemplate,
    EmployeeWorkflow, EmployeeWorkflowStep,
    # Enums are now in models.enums, but CRUDs use the model types
)
from app.models.enums import EmploymentStatus, EmployeeWorkflowStatus, EmployeeWorkflowStepStatus, WorkflowType
from app.models.employee import EmployeeProfile
from app.schemas.workflow import (  # Schemas for creating templates
    WorkflowTemplateCreate,
    WorkflowStepTemplateCreate,
)
from app.models.user import User  # For completed_by_user_id in steps


# --- WorkflowTemplate CRUD ---
def get_workflow_template(db: Session, template_id: int) -> WorkflowTemplate | None:
    return db.get(WorkflowTemplate, template_id)


def get_workflow_templates(db: Session, workflow_type: Optional[WorkflowType] = None, is_active: Optional[bool] = None,
                           skip: int = 0, limit: int = 100) -> List[WorkflowTemplate]:
    statement = select(WorkflowTemplate)
    if workflow_type:
        statement = statement.where(WorkflowTemplate.workflow_type == workflow_type)
    if is_active is not None:
        statement = statement.where(WorkflowTemplate.is_active == is_active)
    statement = statement.order_by(WorkflowTemplate.name).offset(skip).limit(limit)
    return db.exec(statement).all()


def get_workflow_template_by_trigger_status(db: Session, status: EmploymentStatus) -> WorkflowTemplate | None:
    """
    Finds an active workflow template that should be auto-assigned when an employee's
    status changes TO the given 'status'.
    """
    statement = select(WorkflowTemplate).where(
        WorkflowTemplate.auto_assign_on_status == status,
        WorkflowTemplate.is_active == True
    )
    return db.exec(statement).first()


def create_workflow_template(db: Session, template_in: WorkflowTemplateCreate) -> WorkflowTemplate:
    template_data = template_in.model_dump(exclude={"steps"})
    db_template = WorkflowTemplate.model_validate(template_data)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)

    for step_in in template_in.steps:
        create_workflow_step_template(db, step_in, db_template.id)

    db.refresh(db_template)
    return db_template


def update_workflow_template(db: Session, db_template: WorkflowTemplate,
                             template_in: dict) -> WorkflowTemplate:  # Assuming template_in is a dict now
    # template_in is from WorkflowTemplateUpdate.model_dump(exclude_unset=True)
    for key, value in template_in.items():
        setattr(db_template, key, value)
    db_template.updated_at = datetime.utcnow()
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


# --- WorkflowStepTemplate CRUD ---
def get_workflow_step_template(db: Session, step_template_id: int) -> WorkflowStepTemplate | None:
    return db.get(WorkflowStepTemplate, step_template_id)


def create_workflow_step_template(db: Session, step_in: WorkflowStepTemplateCreate,
                                  template_id: int) -> WorkflowStepTemplate:
    db_step = WorkflowStepTemplate.model_validate(step_in, update={"workflow_template_id": template_id})
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step


def update_workflow_step_template(db: Session, db_step: WorkflowStepTemplate,
                                  step_in: dict) -> WorkflowStepTemplate:  # Assuming dict
    for key, value in step_in.items():
        setattr(db_step, key, value)
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step


def delete_workflow_step_template(db: Session, step_template_id: int) -> WorkflowStepTemplate | None:
    step = db.get(WorkflowStepTemplate, step_template_id)
    if step:
        db.delete(step)
        db.commit()
    return step


# --- EmployeeWorkflow CRUD ---
def get_employee_workflow(db: Session, emp_workflow_id: int) -> EmployeeWorkflow | None:
    return db.get(EmployeeWorkflow, emp_workflow_id)


def get_employee_workflows_by_employee_id(db: Session, employee_id: int,
                                          status: Optional[EmployeeWorkflowStatus] = None) -> List[EmployeeWorkflow]:
    statement = select(EmployeeWorkflow).where(EmployeeWorkflow.employee_id == employee_id)
    if status:
        statement = statement.where(EmployeeWorkflow.status == status)
    statement = statement.order_by(EmployeeWorkflow.assigned_on.desc())
    return db.exec(statement).all()


def assign_workflow_to_employee(db: Session, employee_id: int, template_id: int) -> EmployeeWorkflow | None:
    template = get_workflow_template(db, template_id)
    employee_profile = db.get(EmployeeProfile, employee_id)

    if not template or not employee_profile:
        print(f"AssignWorkflow: Template (ID {template_id}) or Employee (ID {employee_id}) not found.")
        return None

    # Check if this specific workflow template is already assigned and active for this employee
    existing_assignment = db.exec(
        select(EmployeeWorkflow).where(
            EmployeeWorkflow.employee_id == employee_id,
            EmployeeWorkflow.workflow_template_id == template_id,
            EmployeeWorkflow.status.in_([EmployeeWorkflowStatus.PENDING, EmployeeWorkflowStatus.IN_PROGRESS])
        )
    ).first()

    if existing_assignment:
        print(
            f"Workflow '{template.name}' (Template ID: {template_id}) is already assigned and active (Status: {existing_assignment.status.value}) for employee {employee_id}.")
        return existing_assignment

    emp_workflow = EmployeeWorkflow(
        employee_id=employee_id,
        workflow_template_id=template_id,
        status=EmployeeWorkflowStatus.PENDING
    )
    db.add(emp_workflow)
    db.commit()
    db.refresh(emp_workflow)
    print(f"Assigned new workflow '{template.name}' (Instance ID: {emp_workflow.id}) to employee {employee_id}.")

    for step_template in template.steps:  # Ensure template.steps are loaded
        emp_step = EmployeeWorkflowStep(
            employee_workflow_id=emp_workflow.id,
            step_template_id=step_template.id,
            status=EmployeeWorkflowStepStatus.PENDING
        )
        db.add(emp_step)
    db.commit()
    db.refresh(emp_workflow)  # To get the steps loaded via relationship if accessed immediately
    return emp_workflow


# --- EmployeeWorkflowStep CRUD ---
def get_employee_workflow_step(db: Session, emp_step_id: int) -> EmployeeWorkflowStep | None:
    return db.get(EmployeeWorkflowStep, emp_step_id)


def update_employee_workflow_step(
        db: Session,
        emp_step_id: int,
        new_status: EmployeeWorkflowStepStatus,
        notes: Optional[str],
        completed_by_user_id: int
) -> EmployeeWorkflowStep | None:
    emp_step = db.get(EmployeeWorkflowStep, emp_step_id)
    if not emp_step:
        return None

    emp_step.status = new_status
    emp_step.notes = notes
    if new_status == EmployeeWorkflowStepStatus.COMPLETED:
        emp_step.completed_on = datetime.utcnow()
        emp_step.completed_by_user_id = completed_by_user_id
    else:
        emp_step.completed_on = None
        emp_step.completed_by_user_id = None

    db.add(emp_step)
    db.commit()
    db.refresh(emp_step)

    _check_and_update_parent_workflow_status(db, emp_step.employee_workflow_id)
    return emp_step


def _check_and_update_parent_workflow_status(db: Session, employee_workflow_id: int):
    emp_workflow = db.get(EmployeeWorkflow, employee_workflow_id)
    if not emp_workflow or emp_workflow.status == EmployeeWorkflowStatus.COMPLETED:
        return

    all_mandatory_completed = True
    if not emp_workflow.steps:  # Ensure steps are loaded or handle if empty
        db.refresh(emp_workflow, with_for_update=True)  # Attempt to reload with steps

    for step_instance in emp_workflow.steps:
        # Ensure step_template is loaded. If using lazy loading, it should auto-load.
        # If selectinload was used when emp_workflow was fetched, it's already there.
        step_template = step_instance.step_template
        if not step_template:  # Defensive: reload if not loaded
            db.refresh(step_instance, with_for_update=True)  # Reload step_instance to get step_template
            step_template = step_instance.step_template

        if step_template and step_template.is_mandatory:
            if step_instance.status != EmployeeWorkflowStepStatus.COMPLETED:
                all_mandatory_completed = False
                break

    current_parent_status = emp_workflow.status
    new_parent_status = current_parent_status

    if all_mandatory_completed:
        new_parent_status = EmployeeWorkflowStatus.COMPLETED
        # emp_workflow.completed_on = datetime.utcnow() # Consider adding this field
        print(f"All mandatory steps for EmployeeWorkflow ID {employee_workflow_id} completed.")
    elif current_parent_status == EmployeeWorkflowStatus.PENDING and any(
            s.status != EmployeeWorkflowStepStatus.PENDING for s in emp_workflow.steps):
        new_parent_status = EmployeeWorkflowStatus.IN_PROGRESS
        print(f"EmployeeWorkflow ID {employee_workflow_id} moved to IN_PROGRESS.")

    if new_parent_status != current_parent_status:
        emp_workflow.status = new_parent_status
        db.add(emp_workflow)
        db.commit()
        print(f"EmployeeWorkflow ID {employee_workflow_id} status updated to {new_parent_status.value}.")