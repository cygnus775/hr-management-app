# hr_software/app/models/leave.py
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy import Enum as SQLAlchemyEnum
from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime

# Import Enums from the new centralized file
from .enums import LeaveTypeName, LeaveRequestStatus  # These are your Python enums

if TYPE_CHECKING:
    from .employee import EmployeeProfile
    from .user import User  # If you add approver user relationship


class LeaveTypeBase(SQLModel):
    # 'name' will be defined in the table model 'LeaveType' with sa_column for DB Enum
    description: Optional[str] = Field(default=None)
    default_days_annually: Optional[float] = Field(default=0)
    is_paid: bool = Field(default=True)
    requires_approval: bool = Field(default=True)


class LeaveType(LeaveTypeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    # This 'name' field maps to the 'name' column in the DB.
    # It uses the LeaveTypeName Python enum for validation and type hinting.
    # SQLAlchemyEnum ensures it's stored as a proper ENUM type in PostgreSQL.
    name: LeaveTypeName = Field(
        sa_column=Column(SQLAlchemyEnum(LeaveTypeName, name="leave_type_name_enum_db", create_constraint=True),
                         unique=True, nullable=False)
    )
    # ** NO number_of_days field should be here **

    leave_requests: List["LeaveRequest"] = Relationship(back_populates="leave_type")
    leave_balances: List["LeaveBalance"] = Relationship(back_populates="leave_type")


class LeaveBalanceBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    leave_type_id: int = Field(foreign_key="leavetype.id")
    year: int = Field(default_factory=lambda: datetime.utcnow().year)
    allocated_days: float = Field(default=0)
    taken_days: float = Field(default=0)


class LeaveBalance(LeaveBalanceBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship()
    leave_type: LeaveType = Relationship(back_populates="leave_balances")  # Direct type


class LeaveRequestBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    leave_type_id: int = Field(foreign_key="leavetype.id")
    start_date: date
    end_date: date
    reason: Optional[str] = Field(default=None)
    status: LeaveRequestStatus = Field(
        default=LeaveRequestStatus.PENDING,
        sa_column=Column(
            SQLAlchemyEnum(LeaveRequestStatus, name="leave_request_status_enum_db", create_constraint=True))
    )
    number_of_days: float  # This is correct here, on the LeaveRequest
    applied_on: datetime = Field(default_factory=datetime.utcnow)
    manager_remarks: Optional[str] = Field(default=None)
    approved_or_rejected_by_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=True)
    approved_or_rejected_on: Optional[datetime] = Field(default=None, nullable=True)


class LeaveRequest(LeaveRequestBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship()
    leave_type: LeaveType = Relationship(back_populates="leave_requests")  # Direct type
    # approver: Optional["User"] = Relationship()


class HolidayBase(SQLModel):
    name: str
    date: date
    is_optional: bool = Field(default=False)
    country_code: Optional[str] = Field(default="IN")


class Holiday(HolidayBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


# --- Model Rebuild Section ---
# At the VERY END of the file.
from .employee import EmployeeProfile  # For "EmployeeProfile"
from .user import User  # For "User" (if used in LeaveRequest.approver)

LeaveType.model_rebuild()
LeaveBalance.model_rebuild()
LeaveRequest.model_rebuild()
# Holiday does not have forward refs in this setup