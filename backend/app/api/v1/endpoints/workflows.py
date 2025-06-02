# hr_software/app/api/v1/endpoints/workflows.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlmodel import Session, select  # Ensure select is imported if used directly in this file
from typing import List, Optional
from datetime import datetime

from app.core.db import get_db
from app.api import deps
from app.models.user import User
from app.models.enums import UserRole, WorkflowType, EmployeeWorkflowStatus, EmployeeWorkflowStepStatus
from app.models.employee import EmployeeProfile
from app.models.workflow import WorkflowTemplate, WorkflowStepTemplate, EmployeeWorkflow, EmployeeWorkflowStep
from app.crud import crud_workflow, crud_employee, crud_user
from app.schemas.workflow import (
    WorkflowTemplateCreate, WorkflowTemplateRead, WorkflowTemplateUpdate,
    WorkflowStepTemplateRead,  # WorkflowStepTemplateCreate used by WorkflowTemplateCreate
    # WorkflowStepTemplateUpdate might be needed if you have separate step update endpoints
    EmployeeWorkflowRead, EmployeeWorkflowStepUpdatePayload, EmployeeWorkflowStepRead
)

router = APIRouter()


# --- Helper to build response models ---
def _build_workflow_template_read(template_orm: WorkflowTemplate) -> WorkflowTemplateRead:
    steps_read_list: List[WorkflowStepTemplateRead] = []
    if template_orm.steps:  # Ensure steps relationship is loaded
        for step_orm_instance in template_orm.steps:
            # --- CORRECTED LINE ---
            step_dict = step_orm_instance.model_dump()
            steps_read_list.append(WorkflowStepTemplateRead.model_validate(step_dict))
            # --- END CORRECTION ---
            # Alternative if WorkflowStepTemplateRead directly maps to WorkflowStepTemplate ORM model fields:
            # steps_read_list.append(WorkflowStepTemplateRead(**step_orm_instance.model_dump()))

    return WorkflowTemplateRead(
        id=template_orm.id,
        name=template_orm.name,
        description=template_orm.description,
        workflow_type=template_orm.workflow_type,
        is_active=template_orm.is_active,
        auto_assign_on_status=template_orm.auto_assign_on_status,
        created_at=template_orm.created_at,
        updated_at=template_orm.updated_at,
        steps=steps_read_list
    )


def _build_employee_workflow_read(db: Session, ew_orm: EmployeeWorkflow) -> EmployeeWorkflowRead:
    # ... (This helper should also use .model_dump() if converting step_instance_orm to EmployeeWorkflowStepRead) ...
    steps_read_list: List[EmployeeWorkflowStepRead] = []
    if ew_orm.steps:
        for step_instance_orm in ew_orm.steps:
            template_step = step_instance_orm.step_template
            completed_by_user = crud_user.get_user(db,
                                                   step_instance_orm.completed_by_user_id) if step_instance_orm.completed_by_user_id else None

            step_template_data = {}
            if template_step:  # Check if template_step is not None
                step_template_data = template_step.model_dump()

            # Combine data from step_instance_orm and its template for the response schema
            step_read_data = {
                **step_instance_orm.model_dump(exclude={'step_template'}),  # Exclude the ORM relationship object
                "step_template_id": template_step.id if template_step else 0,
                # Ensure this is handled if template_step is None
                "step_name": template_step.name if template_step else "Unknown Step",
                "step_description": template_step.description if template_step else None,
                "step_order": template_step.order if template_step else 999,
                "is_mandatory": template_step.is_mandatory if template_step else True,
                # Default if template somehow missing
                "completed_by_user_email": completed_by_user.email if completed_by_user else None,
            }
            steps_read_list.append(EmployeeWorkflowStepRead.model_validate(step_read_data))

    template_name = ew_orm.template.name if ew_orm.template else "Unknown Template"
    template_type = ew_orm.template.workflow_type if ew_orm.template else WorkflowType.OTHER

    return EmployeeWorkflowRead(
        id=ew_orm.id,
        employee_id=ew_orm.employee_id,
        workflow_template_id=ew_orm.workflow_template_id,
        workflow_template_name=template_name,
        workflow_type=template_type,
        assigned_on=ew_orm.assigned_on,
        due_date=ew_orm.due_date,
        status=ew_orm.status,
        steps=steps_read_list
    )


# --- WorkflowTemplate Endpoints (Admin) ---
@router.post("/templates/", response_model=WorkflowTemplateRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(deps.allow_admin_only)])
def create_workflow_template_api(
        template_in: WorkflowTemplateCreate,
        db: Session = Depends(get_db)
):
    existing_template = db.exec(select(WorkflowTemplate).where(WorkflowTemplate.name == template_in.name)).first()
    if existing_template:
        raise HTTPException(status_code=400, detail=f"Workflow template with name '{template_in.name}' already exists.")
    created_template_orm = crud_workflow.create_workflow_template(db, template_in)
    # Ensure relationships are loaded if create_workflow_template doesn't do it sufficiently for _build
    db.refresh(created_template_orm, with_for_update=True)  # Eagerly load steps
    for step in created_template_orm.steps:  # Ensure nested relations are also loaded
        db.refresh(step, with_for_update=True)

    return _build_workflow_template_read(created_template_orm)


@router.get("/templates/", response_model=List[WorkflowTemplateRead], dependencies=[Depends(deps.allow_admin_only)])
def read_workflow_templates_api(
        workflow_type: Optional[WorkflowType] = Query(None),
        is_active: Optional[bool] = Query(None),
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1),
        db: Session = Depends(get_db)
):
    templates_orm = crud_workflow.get_workflow_templates(db, workflow_type, is_active, skip, limit)
    # Eager load steps for each template if not already done by CRUD
    for t_orm in templates_orm:
        #db.refresh(t_orm, with_for_update=True, relationships=["steps"])
        db.refresh(t_orm)
        for step in t_orm.steps:
            db.refresh(step, with_for_update=True)
    return [_build_workflow_template_read(t) for t in templates_orm]


@router.get("/templates/{template_id}", response_model=WorkflowTemplateRead,
            dependencies=[Depends(deps.allow_admin_only)])
def read_workflow_template_api(template_id: int, db: Session = Depends(get_db)):
    template_orm = crud_workflow.get_workflow_template(db, template_id)
    if not template_orm:
        raise HTTPException(status_code=404, detail="Workflow template not found")
    db.refresh(template_orm, with_for_update=True)  # Eager load
    for step in template_orm.steps:
        db.refresh(step, with_for_update=True)
    return _build_workflow_template_read(template_orm)


@router.put("/templates/{template_id}", response_model=WorkflowTemplateRead,
            dependencies=[Depends(deps.allow_admin_only)])
def update_workflow_template_api(
        template_id: int,
        template_in: WorkflowTemplateUpdate,
        db: Session = Depends(get_db)
):
    db_template_orm = crud_workflow.get_workflow_template(db, template_id)
    if not db_template_orm:
        raise HTTPException(status_code=404, detail="Workflow template not found")

    update_data_dict = template_in.model_dump(exclude_unset=True)
    if not update_data_dict:
        db.refresh(db_template_orm, with_for_update=True)
        for step in db_template_orm.steps: db.refresh(step)
        return _build_workflow_template_read(db_template_orm)

    updated_template_orm = crud_workflow.update_workflow_template(db, db_template_orm, update_data_dict)
    db.refresh(updated_template_orm, with_for_update=True)
    for step in updated_template_orm.steps: db.refresh(step)
    return _build_workflow_template_read(updated_template_orm)


# --- EmployeeWorkflow Endpoints ( 그대로 유지, just ensure _build_employee_workflow_read is correct ) ---
@router.get("/employee/{employee_id}/workflows/", response_model=List[EmployeeWorkflowRead])
def get_employee_workflows_api(
        employee_id: int,
        status_filter: Optional[EmployeeWorkflowStatus] = Query(None, alias="status"),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    employee_profile = crud_employee.get_employee_profile(db, employee_id)
    if not employee_profile:
        raise HTTPException(status_code=404, detail="Employee not found")

    # ... (Authorization logic from previous full code response) ...
    current_emp_profile = current_user.employee_profile
    if isinstance(current_emp_profile, list): current_emp_profile = current_emp_profile[
        0] if current_emp_profile else None
    is_own = current_emp_profile and isinstance(current_emp_profile,
                                                EmployeeProfile) and current_emp_profile.id == employee_id
    is_manager_of = (current_user.role == UserRole.MANAGER and
                     current_emp_profile and isinstance(current_emp_profile, EmployeeProfile) and
                     employee_profile.manager_id == current_emp_profile.id)
    if not (is_own or is_manager_of or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized to view these workflows")

    emp_workflows_orm = crud_workflow.get_employee_workflows_by_employee_id(db, employee_id, status_filter)

    # Eager load necessary relationships for each workflow before passing to _build
    for ew_orm in emp_workflows_orm:
        db.refresh(ew_orm, with_for_update=True)
        if ew_orm.steps:
            for step_instance in ew_orm.steps:
                db.refresh(step_instance, with_for_update=True)

    return [_build_employee_workflow_read(db, ew) for ew in emp_workflows_orm]


@router.put("/employee-step/{emp_step_id}/update", response_model=EmployeeWorkflowStepRead)
def update_employee_workflow_step_api(
        emp_step_id: int,
        payload: EmployeeWorkflowStepUpdatePayload,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    emp_step_orm = crud_workflow.get_employee_workflow_step(db, emp_step_id)
    if not emp_step_orm:
        raise HTTPException(status_code=404, detail="Workflow step instance not found")

    # Eager load for authorization and response building
    db.refresh(emp_step_orm, with_for_update=True)
    if not emp_step_orm.employee_workflow or not emp_step_orm.employee_workflow.employee:
        raise HTTPException(status_code=500, detail="Workflow or employee data missing for step.")
    if not emp_step_orm.step_template:
        raise HTTPException(status_code=500, detail="Step template data missing for step.")

    employee_profile = emp_step_orm.employee_workflow.employee

    # ... (Authorization logic from previous full code response) ...
    current_emp_profile = current_user.employee_profile
    if isinstance(current_emp_profile, list): current_emp_profile = current_emp_profile[
        0] if current_emp_profile else None
    is_own_step_employee = (current_emp_profile and isinstance(current_emp_profile, EmployeeProfile) and
                            employee_profile and employee_profile.id == current_emp_profile.id)
    is_manager_of_step_owner = (current_user.role == UserRole.MANAGER and
                                current_emp_profile and isinstance(current_emp_profile, EmployeeProfile) and
                                employee_profile and employee_profile.manager_id == current_emp_profile.id)
    if not (is_own_step_employee or is_manager_of_step_owner or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized to update this workflow step")

    updated_step_orm = crud_workflow.update_employee_workflow_step(
        db, emp_step_id, payload.status, payload.notes, current_user.id
    )
    if not updated_step_orm:  # Should be caught by the get_employee_workflow_step above
        raise HTTPException(status_code=500, detail="Failed to update step after initial fetch.")

    # Re-fetch/refresh to ensure all data is current for the response
    db.refresh(updated_step_orm, with_for_update=True)
    template_step = updated_step_orm.step_template
    completed_by_user = crud_user.get_user(db,
                                           updated_step_orm.completed_by_user_id) if updated_step_orm.completed_by_user_id else None

    if not template_step:
        raise HTTPException(status_code=500, detail="Step template data became missing after update.")

    return EmployeeWorkflowStepRead(
        id=updated_step_orm.id,
        step_template_id=template_step.id,
        step_name=template_step.name,
        step_description=template_step.description,
        step_order=template_step.order,
        is_mandatory=template_step.is_mandatory,
        status=updated_step_orm.status,
        completed_on=updated_step_orm.completed_on,
        completed_by_user_email=completed_by_user.email if completed_by_user else None,
        notes=updated_step_orm.notes
    )


@router.post("/employee/{employee_id}/assign-workflow/{template_id}", response_model=EmployeeWorkflowRead,
             dependencies=[Depends(deps.allow_admin_only)])
def assign_workflow_manually_api(
        employee_id: int,
        template_id: int,
        db: Session = Depends(get_db)
):
    assigned_workflow_orm = crud_workflow.assign_workflow_to_employee(db, employee_id, template_id)
    if not assigned_workflow_orm:
        raise HTTPException(status_code=404,
                            detail="Employee or Workflow Template not found, or assignment failed (e.g., already active).")

    db.refresh(assigned_workflow_orm, with_for_update=True)
    if assigned_workflow_orm.steps:
        for step_instance in assigned_workflow_orm.steps:
            db.refresh(step_instance, with_for_update=True)

    return _build_employee_workflow_read(db, assigned_workflow_orm)