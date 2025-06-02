# hr_software/app/models/workflow.py
from sqlmodel import Field, SQLModel, Relationship, Column, TEXT
from sqlalchemy import Enum as SQLAlchemyEnum
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime

# Import Enums from the new centralized file
from .enums import WorkflowType, EmploymentStatus, EmployeeWorkflowStatus, EmployeeWorkflowStepStatus

if TYPE_CHECKING:
    from .employee import EmployeeProfile
    from .user import User

class WorkflowTemplateBase(SQLModel):
    name: str = Field(unique=True)
    description: Optional[str] = Field(sa_column=Column(TEXT), default=None)
    workflow_type: WorkflowType
    is_active: bool = Field(default=True)
    auto_assign_on_status: Optional[EmploymentStatus] = Field(
        default=None,
        # nullable=True, # <--- REMOVE THIS from Field() arguments
        sa_column=Column(SQLAlchemyEnum(EmploymentStatus, name="employment_status_enum_wf_trigger", create_constraint=True), nullable=True) # Nullability defined here
    )

class WorkflowTemplate(WorkflowTemplateBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})
    steps: List["WorkflowStepTemplate"] = Relationship(back_populates="workflow_template")
    assigned_workflows: List["EmployeeWorkflow"] = Relationship(back_populates="template")

class WorkflowStepTemplateBase(SQLModel):
    workflow_template_id: int = Field(foreign_key="workflowtemplate.id")
    name: str
    description: Optional[str] = Field(sa_column=Column(TEXT), default=None)
    order: int
    is_mandatory: bool = Field(default=True)

class WorkflowStepTemplate(WorkflowStepTemplateBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    workflow_template: WorkflowTemplate = Relationship(back_populates="steps")
    assigned_step_instances: List["EmployeeWorkflowStep"] = Relationship(back_populates="step_template")

class EmployeeWorkflowBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    workflow_template_id: int = Field(foreign_key="workflowtemplate.id")
    assigned_on: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = Field(default=None, nullable=True) # No sa_column here, so nullable in Field() is fine
    status: EmployeeWorkflowStatus = Field(
        default=EmployeeWorkflowStatus.PENDING,
        sa_column=Column(SQLAlchemyEnum(EmployeeWorkflowStatus, name="emp_workflow_status_enum", create_constraint=True))
    )

class EmployeeWorkflow(EmployeeWorkflowBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship(back_populates="assigned_workflows")
    template: WorkflowTemplate = Relationship(back_populates="assigned_workflows")
    steps: List["EmployeeWorkflowStep"] = Relationship(back_populates="employee_workflow")

class EmployeeWorkflowStepBase(SQLModel):
    employee_workflow_id: int = Field(foreign_key="employeeworkflow.id")
    step_template_id: int = Field(foreign_key="workflowsteptemplate.id")
    status: EmployeeWorkflowStepStatus = Field(
        default=EmployeeWorkflowStepStatus.PENDING,
        sa_column=Column(SQLAlchemyEnum(EmployeeWorkflowStepStatus, name="emp_step_status_enum", create_constraint=True))
    )
    completed_on: Optional[datetime] = Field(default=None, nullable=True) # No sa_column, nullable in Field() is fine
    completed_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=True) # No sa_column, nullable in Field() is fine
    notes: Optional[str] = Field(sa_column=Column(TEXT), default=None)

class EmployeeWorkflowStep(EmployeeWorkflowStepBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee_workflow: EmployeeWorkflow = Relationship(back_populates="steps")
    step_template: WorkflowStepTemplate = Relationship(back_populates="assigned_step_instances")
    # completed_by: Optional["User"] = Relationship()

# --- Model Rebuild Section ---
from .employee import EmployeeProfile
from .user import User

WorkflowTemplate.model_rebuild()
WorkflowStepTemplate.model_rebuild()
EmployeeWorkflow.model_rebuild()
EmployeeWorkflowStep.model_rebuild()