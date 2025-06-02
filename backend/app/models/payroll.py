# hr_software/app/models/payroll.py
from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from sqlalchemy import Enum as SQLAlchemyEnum # Added
from typing import Optional, List, Dict, Any, TYPE_CHECKING
from datetime import date, datetime

# Import Enums from the new centralized file
from .enums import SalaryComponentType, PayrollRunStatus

if TYPE_CHECKING:
    from .employee import EmployeeProfile
    from .user import User # For processed_by_user_id relationship if added

class SalaryComponentBase(SQLModel):
    name: str = Field(unique=True)
    type: SalaryComponentType # Uses enum from enums.py
    description: Optional[str] = Field(default=None)
    is_taxable: bool = Field(default=True)
    calculation_formula: Optional[str] = Field(default=None)

class SalaryComponent(SalaryComponentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    # Explicit sa_column for enum
    type: SalaryComponentType = Field(sa_column=Column(SQLAlchemyEnum(SalaryComponentType, name="salary_comp_type_enum", create_constraint=True)))
    employee_structures: List["EmployeeSalaryStructure"] = Relationship(back_populates="component")

class EmployeeSalaryStructureBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    component_id: int = Field(foreign_key="salarycomponent.id")
    amount: float
    effective_from: date
    effective_to: Optional[date] = Field(default=None, nullable=True)

class EmployeeSalaryStructure(EmployeeSalaryStructureBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship()
    component: SalaryComponent = Relationship(back_populates="employee_structures") # Direct type

class PayrollRunBase(SQLModel):
    month: int
    year: int
    status: PayrollRunStatus = Field( # Uses enum from enums.py
        default=PayrollRunStatus.DRAFT,
        sa_column=Column(SQLAlchemyEnum(PayrollRunStatus, name="payroll_run_status_enum", create_constraint=True))
    )
    run_date: datetime = Field(default_factory=datetime.utcnow)
    processed_by_user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=True)
    notes: Optional[str] = Field(default=None)

class PayrollRun(PayrollRunBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    payslips: List["Payslip"] = Relationship(back_populates="payroll_run")
    # processed_by: Optional["User"] = Relationship() # If User relationship is added

class PayslipBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    payroll_run_id: int = Field(foreign_key="payrollrun.id")
    gross_earnings: float = Field(default=0.0)
    total_deductions: float = Field(default=0.0)
    net_salary: float = Field(default=0.0)
    salary_details: Dict[str, Any] = Field(sa_column=Column(JSON), default_factory=dict)
    total_working_days_in_month: float = Field(default=0.0)
    days_present: float = Field(default=0.0)
    paid_leave_days: float = Field(default=0.0)
    unpaid_leave_days: float = Field(default=0.0)
    loss_of_pay_deduction: float = Field(default=0.0)
    generated_at: datetime = Field(default_factory=datetime.utcnow)

class Payslip(PayslipBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship()
    payroll_run: PayrollRun = Relationship(back_populates="payslips") # Direct type

# --- Model Rebuild Section ---
from .employee import EmployeeProfile
from .user import User # If processed_by relationship is added to PayrollRun

SalaryComponent.model_rebuild()
EmployeeSalaryStructure.model_rebuild()
PayrollRun.model_rebuild()
Payslip.model_rebuild()