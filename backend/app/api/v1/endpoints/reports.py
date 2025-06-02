# hr_software/app/api/v1/endpoints/reports.py

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlmodel import Session, select, func, and_, or_  # Ensure func is imported
from typing import List, Dict, Any, Optional
from datetime import date, timedelta, datetime
from pydantic import BaseModel

from app.core.db import get_db
from app.api import deps
from app.models.user import User
from app.models.enums import UserRole, EmploymentStatus, LeaveRequestStatus, LeaveTypeName, PayrollRunStatus
from app.models.employee import EmployeeProfile, Department
from app.models.leave import LeaveRequest, LeaveType
from app.models.payroll import Payslip, PayrollRun

router = APIRouter()


# --- Headcount Reports ---
class HeadcountByDepartment(BaseModel):
    department_id: Optional[int] = None
    department_name: str
    headcount: int


@router.get("/headcount/active", response_model=Dict[str, Any], dependencies=[Depends(deps.allow_admin_or_manager)])
def get_active_headcount_report(db: Session = Depends(get_db)):
    # --- CORRECTED ---
    total_active_query = select(func.count(EmployeeProfile.id)).where(
        EmployeeProfile.employment_status == EmploymentStatus.ACTIVE
    )
    # db.exec() for a query like select(func.count()) often returns the scalar directly
    # or a ScalarResult that can be treated as the value if there's one result.
    # The most robust way to get a single scalar or None:
    total_active = db.scalar(total_active_query) or 0
    # --- END CORRECTED ---

    departments = db.exec(select(Department)).all()
    by_department_list: List[HeadcountByDepartment] = []
    for dept in departments:
        # --- CORRECTED ---
        count_query = select(func.count(EmployeeProfile.id)).where(
            EmployeeProfile.department_id == dept.id,
            EmployeeProfile.employment_status == EmploymentStatus.ACTIVE
        )
        count = db.scalar(count_query) or 0
        # --- END CORRECTED ---
        by_department_list.append(
            HeadcountByDepartment(department_id=dept.id, department_name=dept.name, headcount=count))

    # --- CORRECTED ---
    no_dept_count_query = select(func.count(EmployeeProfile.id)).where(
        EmployeeProfile.department_id == None,
        EmployeeProfile.employment_status == EmploymentStatus.ACTIVE
    )
    no_dept_count = db.scalar(no_dept_count_query) or 0
    # --- END CORRECTED ---
    if no_dept_count > 0:
        by_department_list.append(HeadcountByDepartment(department_name="Unassigned", headcount=no_dept_count))

    return {"total_active_headcount": total_active, "by_department": by_department_list}


# --- Attrition Report ---
class AttritionReport(BaseModel):
    period_start: date
    period_end: date
    starting_headcount: int
    ending_headcount: int
    separations: int
    attrition_rate_percentage: float


@router.get("/attrition", response_model=AttritionReport, dependencies=[Depends(deps.allow_admin_only)])
def get_attrition_report(
        start_date_str: str = Query(..., description="Start date in YYYY-MM-DD format", examples=["2023-01-01"]),
        end_date_str: str = Query(..., description="End date in YYYY-MM-DD format", examples=["2023-12-31"]),
        db: Session = Depends(get_db)
):
    try:
        period_start = date.fromisoformat(start_date_str)
        period_end = date.fromisoformat(end_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if period_start >= period_end:
        raise HTTPException(status_code=400, detail="Start date must be before end date.")

    # --- CORRECTED for all scalar queries ---
    starting_headcount_query = (
        select(func.count(EmployeeProfile.id))
        .where(EmployeeProfile.hire_date < period_start)
        .where(or_(EmployeeProfile.resignation_date == None, EmployeeProfile.resignation_date >= period_start))
        .where(or_(EmployeeProfile.termination_date == None, EmployeeProfile.termination_date >= period_start))
    )
    starting_headcount = db.scalar(starting_headcount_query) or 0

    separations_query = (
        select(func.count(EmployeeProfile.id))
        .where(
            or_(
                and_(EmployeeProfile.resignation_date != None, EmployeeProfile.resignation_date >= period_start,
                     EmployeeProfile.resignation_date <= period_end),
                and_(EmployeeProfile.termination_date != None, EmployeeProfile.termination_date >= period_start,
                     EmployeeProfile.termination_date <= period_end)
            )
        )
    )
    separations = db.scalar(separations_query) or 0

    ending_headcount_query = (
        select(func.count(EmployeeProfile.id))
        .where(EmployeeProfile.hire_date <= period_end)
        .where(or_(EmployeeProfile.resignation_date == None, EmployeeProfile.resignation_date > period_end))
        .where(or_(EmployeeProfile.termination_date == None, EmployeeProfile.termination_date > period_end))
    )
    ending_headcount = db.scalar(ending_headcount_query) or 0
    # --- END CORRECTED ---

    avg_headcount = (starting_headcount + ending_headcount) / 2.0 if (
                                                                                 starting_headcount + ending_headcount) > 0 else 1.0
    attrition_rate = (float(separations) / avg_headcount) * 100.0 if avg_headcount > 0 else 0.0

    return AttritionReport(
        period_start=period_start,
        period_end=period_end,
        starting_headcount=starting_headcount,
        ending_headcount=ending_headcount,
        separations=separations,
        attrition_rate_percentage=round(attrition_rate, 2)
    )


# --- Leave Trends (This part was likely correct as it deals with .all() which returns Rows) ---
class LeaveTrendItem(BaseModel):
    leave_type_id: int
    leave_type_name: str
    total_days_approved: float
    number_of_requests: int


@router.get("/leave-trends", response_model=List[LeaveTrendItem], dependencies=[Depends(deps.allow_admin_or_manager)])
def get_leave_trends(
        start_date_str: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
        end_date_str: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
        db: Session = Depends(get_db)
):
    query = (
        select(
            LeaveRequest.leave_type_id,
            LeaveType.name.label("leave_type_name_enum"),
            func.sum(LeaveRequest.number_of_days).label("total_days"),
            func.count(LeaveRequest.id).label("request_count")
        )
        .join(LeaveType, LeaveRequest.leave_type_id == LeaveType.id)
        .where(LeaveRequest.status == LeaveRequestStatus.APPROVED)
    )

    if start_date_str:
        try:
            s_date = date.fromisoformat(start_date_str); query = query.where(LeaveRequest.start_date >= s_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format.")
    if end_date_str:
        try:
            e_date = date.fromisoformat(end_date_str); query = query.where(LeaveRequest.end_date <= e_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format.")

    query = query.group_by(LeaveRequest.leave_type_id, LeaveType.name).order_by(
        func.sum(LeaveRequest.number_of_days).desc())

    results = db.exec(query).all()
    return [
        LeaveTrendItem(
            leave_type_id=row.leave_type_id,
            leave_type_name=row.leave_type_name_enum.value if row.leave_type_name_enum else "Unknown",
            total_days_approved=float(row.total_days or 0.0),
            number_of_requests=int(row.request_count or 0)
        ) for row in results
    ]


# --- Salary and Expense Reports (This part was likely correct) ---
class MonthlySalaryExpense(BaseModel):
    year: int
    month: int
    total_net_salary_paid: float
    total_gross_salary: float
    employee_count: int


@router.get("/salary-expense/monthly", response_model=List[MonthlySalaryExpense],
            dependencies=[Depends(deps.allow_admin_only)])
def get_monthly_salary_expense_report(
        limit_months: int = Query(12, description="Number of past months to report on", ge=1, le=60),
        db: Session = Depends(get_db)
):
    query = (
        select(
            PayrollRun.year, PayrollRun.month,
            func.sum(Payslip.net_salary).label("total_net"),
            func.sum(Payslip.gross_earnings).label("total_gross"),
            func.count(Payslip.id).label("emp_count")
        )
        .join(Payslip, PayrollRun.id == Payslip.payroll_run_id)
        .where(PayrollRun.status.in_([PayrollRunStatus.PAID, PayrollRunStatus.PROCESSED]))
        .group_by(PayrollRun.year, PayrollRun.month)
        .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        .limit(limit_months)
    )
    results = db.exec(query).all()
    return [
        MonthlySalaryExpense(
            year=row.year, month=row.month,
            total_net_salary_paid=round(float(row.total_net or 0.0), 2),
            total_gross_salary=round(float(row.total_gross or 0.0), 2),
            employee_count=int(row.emp_count or 0)
        ) for row in results
    ]


@router.get("/custom-report", dependencies=[Depends(deps.allow_admin_only)])
async def get_custom_report_placeholder():
    return {"message": "Custom report builder endpoint (not yet implemented)."}