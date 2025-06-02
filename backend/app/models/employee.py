# hr_software/app/models/employee.py
from sqlmodel import Field, SQLModel, Relationship, Column, TEXT
from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime

# Import Enums from the new centralized file
from .enums import DocumentType, EmploymentStatus

if TYPE_CHECKING:
    from .user import User
    from .workflow import EmployeeWorkflow  # For relationship type hints


# --- Department Model ---
class DepartmentBase(SQLModel):
    name: str = Field(unique=True, index=True)
    description: Optional[str] = Field(default=None)


class Department(DepartmentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employees: List["EmployeeProfile"] = Relationship(back_populates="department")


# --- Employee Document Model ---
class EmployeeDocumentBase(SQLModel):
    document_type: DocumentType  # Uses enum from enums.py
    file_name: str
    file_path: str
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = Field(default=None, sa_column=Column(TEXT))
    employee_id: int = Field(foreign_key="employeeprofile.id")


class EmployeeDocument(EmployeeDocumentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship(back_populates="documents")


# --- Employee Profile Model ---
class EmployeeProfileBase(SQLModel):
    job_title: Optional[str] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    hire_date: Optional[date] = Field(default=None)
    employment_status: EmploymentStatus = Field(default=EmploymentStatus.ONBOARDING)  # Uses enum from enums.py
    resignation_date: Optional[date] = Field(default=None)
    termination_date: Optional[date] = Field(default=None)
    last_working_day: Optional[date] = Field(default=None)
    bank_account_number: Optional[str] = Field(default=None)
    bank_ifsc_code: Optional[str] = Field(default=None)
    department_id: Optional[int] = Field(default=None, foreign_key="department.id")
    user_id: int = Field(foreign_key="user.id", unique=True)


class EmployeeProfile(EmployeeProfileBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    department: Optional[Department] = Relationship(back_populates="employees")
    user: "User" = Relationship(back_populates="employee_profile")
    documents: List[EmployeeDocument] = Relationship(back_populates="employee")

    assigned_workflows: List["EmployeeWorkflow"] = Relationship(
        back_populates="employee",
        sa_relationship_kwargs={'lazy': 'selectin'}  # Example loading strategy
    )

    manager_id: Optional[int] = Field(default=None, foreign_key="employeeprofile.id")
    manager: Optional["EmployeeProfile"] = Relationship(
        back_populates="direct_reports",
        sa_relationship_kwargs=dict(remote_side="EmployeeProfile.id")  # Correct for self-referential
    )
    direct_reports: List["EmployeeProfile"] = Relationship(back_populates="manager")


# --- Model Rebuild Section ---
# At the VERY END of the file.
from .user import User  # For resolving "User"
from .workflow import EmployeeWorkflow  # For resolving "EmployeeWorkflow"

Department.model_rebuild()  # If Department had any forward refs to EmployeeProfile
EmployeeDocument.model_rebuild()  # If EmployeeDocument had forward refs
EmployeeProfile.model_rebuild()  # Critical for its relationships