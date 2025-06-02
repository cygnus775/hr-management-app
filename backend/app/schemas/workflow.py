# app/schemas/workflow.py
from pydantic import BaseModel, Field as PydanticField
from typing import Optional, List
from datetime import datetime, date # Added date

from app.models.workflow import WorkflowType, EmployeeWorkflowStatus, EmployeeWorkflowStepStatus # Import enums
from app.models.employee import EmploymentStatus # For auto_assign_on_status


# --- WorkflowStepTemplate Schemas ---
class WorkflowStepTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    order: int
    is_mandatory: bool = True

class WorkflowStepTemplateRead(WorkflowStepTemplateCreate):
    id: int
    workflow_template_id: int

class WorkflowStepTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_mandatory: Optional[bool] = None


# --- WorkflowTemplate Schemas ---
class WorkflowTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    workflow_type: WorkflowType
    is_active: bool = True
    auto_assign_on_status: Optional[EmploymentStatus] = None # Which status change triggers this
    steps: List[WorkflowStepTemplateCreate] = [] # Allow creating steps along with template

class WorkflowTemplateRead(WorkflowTemplateCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    steps: List[WorkflowStepTemplateRead] # Return full step details

class WorkflowTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    workflow_type: Optional[WorkflowType] = None
    is_active: Optional[bool] = None
    auto_assign_on_status: Optional[EmploymentStatus] = None
    # Updating steps here is complex: usually handled by separate step endpoints or a more complex payload.
    # For simplicity, we might not allow direct step updates via this schema.


# --- EmployeeWorkflow Schemas ---
class EmployeeWorkflowStepRead(BaseModel): # Read-only for employee/manager view
    id: int
    step_template_id: int
    step_name: str # Denormalized for easy display
    step_description: Optional[str] = None
    step_order: int
    status: EmployeeWorkflowStepStatus
    completed_on: Optional[datetime] = None
    completed_by_user_email: Optional[str] = None # Denormalized
    notes: Optional[str] = None
    is_mandatory: bool


class EmployeeWorkflowRead(BaseModel): # Read-only for employee/manager view
    id: int
    employee_id: int
    workflow_template_id: int
    workflow_template_name: str # Denormalized
    workflow_type: WorkflowType
    assigned_on: datetime
    due_date: Optional[datetime] = None
    status: EmployeeWorkflowStatus
    steps: List[EmployeeWorkflowStepRead]


# --- Schemas for Actions ---
class EmployeeWorkflowStepUpdatePayload(BaseModel): # For employee/manager to update a step
    status: EmployeeWorkflowStepStatus # e.g., COMPLETED, SKIPPED
    notes: Optional[str] = None