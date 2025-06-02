from pydantic import BaseModel, validator, Field as PydanticField
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.models.payroll import (
    SalaryComponentType, SalaryComponentBase,
    EmployeeSalaryStructureBase,
    PayrollRunStatus, PayrollRunBase,
    PayslipBase
)

# --- SalaryComponent Schemas ---
class SalaryComponentCreate(SalaryComponentBase):
    pass

class SalaryComponentRead(SalaryComponentBase):
    id: int

class SalaryComponentUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[SalaryComponentType] = None
    description: Optional[str] = None
    is_taxable: Optional[bool] = None
    calculation_formula: Optional[str] = None


# --- EmployeeSalaryStructure Schemas ---
class EmployeeSalaryStructureCreate(EmployeeSalaryStructureBase):
    pass

class EmployeeSalaryStructureRead(EmployeeSalaryStructureBase):
    id: int
    component_name: str # For display
    component_type: SalaryComponentType # For display

class EmployeeSalaryStructureUpdate(BaseModel):
    amount: Optional[float] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None # Use this to end a component's validity


# --- PayrollRun Schemas ---
class PayrollRunCreate(BaseModel):
    month: int = PydanticField(..., ge=1, le=12)
    year: int = PydanticField(..., ge=datetime.now().year - 10, le=datetime.now().year + 1) # Reasonable range
    employee_ids: Optional[List[int]] = None # Process for specific employees, or all if None

class PayrollRunRead(PayrollRunBase):
    id: int
    processed_by_user_email: Optional[str] = None # For display

class PayrollRunUpdate(BaseModel): # For updating status, notes
    status: Optional[PayrollRunStatus] = None
    notes: Optional[str] = None


# --- Payslip Schemas ---
class PayslipRead(PayslipBase):
    id: int
    employee_first_name: str
    employee_last_name: str
    employee_email: str # For identification
    month: int # From PayrollRun
    year: int # From PayrollRun

class BankAdviceReportItem(BaseModel):
    employee_id: int
    employee_name: str
    bank_account_number: Optional[str] # Assume this is in EmployeeProfile (needs to be added)
    bank_ifsc_code: Optional[str]      # Assume this is in EmployeeProfile
    net_salary: float