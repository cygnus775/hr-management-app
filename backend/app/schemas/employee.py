# hr_software/app/schemas/employee.py

from pydantic import BaseModel # Ensure BaseModel is imported
from typing import Optional, List
from datetime import date, datetime

# Make sure these enums are accessible or defined here/imported
from app.models.employee import DocumentType, EmploymentStatus, DepartmentBase # Assuming these are in models

# --- Department Schemas (Ensure these are present) ---
class DepartmentCreate(DepartmentBase): # Assuming DepartmentBase is a SQLModel or Pydantic model
    pass

class DepartmentRead(DepartmentBase):
    id: int

class DepartmentUpdate(BaseModel): # Or SQLModel if you prefer partial updates via SQLModel
    name: Optional[str] = None
    description: Optional[str] = None

# --- EmployeeDocument Schemas ---
class EmployeeDocumentCreate(BaseModel): # Using Pydantic BaseModel for this specific input schema
    document_type: DocumentType         # This expects values like "id_proof", "offer_letter" etc.
    description: Optional[str] = None
    # 'file' part is handled by FastAPI's UploadFile in the endpoint, not in this schema

class EmployeeDocumentRead(BaseModel): # This is for response, should match model fields
    id: int
    document_type: DocumentType
    file_name: str
    file_path: str
    upload_date: datetime
    description: Optional[str] = None
    employee_id: int
    # Add any other fields from your EmployeeDocument model you want to return


# --- EmployeeProfile Schemas (Ensure these are present and updated) ---
# Assuming EmployeeProfileBase is a SQLModel or Pydantic model
class EmployeeProfileBase(BaseModel): # Or SQLModel
    job_title: Optional[str] = None
    phone_number: Optional[str] = None
    hire_date: Optional[date] = None
    employment_status: EmploymentStatus = EmploymentStatus.ONBOARDING
    resignation_date: Optional[date] = None
    termination_date: Optional[date] = None
    last_working_day: Optional[date] = None
    bank_account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    department_id: Optional[int] = None
    # user_id will be in EmployeeProfileCreate

class EmployeeProfileCreate(EmployeeProfileBase):
    user_id: int # This is crucial, linking to the User model

class EmployeeProfileRead(EmployeeProfileBase): # For reading individual or lists
    id: int
    user_id: int # Include user_id if it wasn't in base
    department: Optional[DepartmentRead] = None
    documents: List[EmployeeDocumentRead] = []

class EmployeeProfileReadWithUser(EmployeeProfileRead): # Often useful
    user_email: str
    user_first_name: str
    user_last_name: str
    user_role: str # from UserRole enum
    manager_email: Optional[str] = None

class EmployeeProfileUpdate(BaseModel): # Or SQLModel for partial updates
    job_title: Optional[str] = None
    phone_number: Optional[str] = None
    hire_date: Optional[date] = None
    employment_status: Optional[EmploymentStatus] = None
    resignation_date: Optional[date] = None
    termination_date: Optional[date] = None
    last_working_day: Optional[date] = None
    bank_account_number: Optional[str] = None
    bank_ifsc_code: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None

class OnboardingCompletionRequest(BaseModel):
    employee_id: int

class OffboardingInitiationRequest(BaseModel):
    employee_id: int
    resignation_date: Optional[date] = None
    termination_date: Optional[date] = None
    reason: Optional[str] = None
    last_working_day: Optional[date] = None