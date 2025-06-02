from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import date, datetime
from app.models.leave import LeaveTypeName, LeaveRequestStatus, LeaveTypeBase, LeaveBalanceBase, LeaveRequestBase, HolidayBase

# --- LeaveType Schemas ---
class LeaveTypeCreate(LeaveTypeBase):
    pass

class LeaveTypeRead(LeaveTypeBase):
    id: int

class LeaveTypeUpdate(BaseModel):
    name: Optional[LeaveTypeName] = None
    description: Optional[str] = None
    default_days_annually: Optional[float] = None
    is_paid: Optional[bool] = None
    requires_approval: Optional[bool] = None


# --- LeaveBalance Schemas ---
class LeaveBalanceRead(LeaveBalanceBase):
    id: int
    leave_type_name: LeaveTypeName # For easier display
    balance_days: float # Calculated property to be added by service/endpoint

class LeaveBalanceUpdate(BaseModel): # For admin adjustments
    allocated_days: Optional[float] = None
    taken_days: Optional[float] = None


# --- LeaveRequest Schemas ---
class LeaveRequestCreate(BaseModel): # This is what the API endpoint receives
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None

    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be on or after start date')
        return v

class LeaveRequestRead(LeaveRequestBase):
    id: int
    employee_first_name: str # For display
    employee_last_name: str  # For display
    leave_type_name: LeaveTypeName # For display
    # approver_name: Optional[str] = None (if linking to User for approver)

class LeaveRequestUpdateByManager(BaseModel):
    status: LeaveRequestStatus # Manager can only approve/reject
    manager_remarks: Optional[str] = None

    @validator('status')
    def can_only_approve_or_reject(cls, v):
        if v not in [LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED]:
            raise ValueError("Manager can only set status to APPROVED or REJECTED")
        return v

class LeaveRequestUpdateByEmployee(BaseModel): # Employee might cancel pending
    status: LeaveRequestStatus
    reason: Optional[str] = None # If updating reason for a pending request

    @validator('status')
    def can_only_cancel(cls, v):
        if v != LeaveRequestStatus.CANCELLED:
            raise ValueError("Employee can only set status to CANCELLED for their pending requests")
        return v


# --- Holiday Schemas ---
class HolidayCreate(HolidayBase):
    pass

class HolidayRead(HolidayBase):
    id: int

class HolidayUpdate(BaseModel):
    name: Optional[str] = None
    date: Optional[date] = None
    is_optional: Optional[bool] = None
    country_code: Optional[str] = None