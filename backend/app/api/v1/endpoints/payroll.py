from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Response
from sqlmodel import Session
from typing import List, Optional
from datetime import date, datetime
import csv  # For bank advice
from io import StringIO  # For CSV in memory

from app.core.db import get_db
from app.api import deps
from app.models.user import User, UserRole
from app.models.payroll import PayrollRunStatus, SalaryComponentType
from app.schemas.payroll import (
    SalaryComponentCreate, SalaryComponentRead, SalaryComponentUpdate,
    EmployeeSalaryStructureCreate, EmployeeSalaryStructureRead, EmployeeSalaryStructureUpdate,
    PayrollRunCreate, PayrollRunRead, PayrollRunUpdate,
    PayslipRead, BankAdviceReportItem
)
from app.crud import crud_payroll, crud_employee, crud_user
from app.services.payroll_service import PayrollCalculationService

router = APIRouter()


def get_payroll_service(db: Session = Depends(get_db)) -> PayrollCalculationService:
    return PayrollCalculationService(db)


# --- Salary Component Endpoints (Admin only) ---
@router.post("/components/", response_model=SalaryComponentRead, dependencies=[Depends(deps.allow_admin_only)])
def create_salary_component_api(component_in: SalaryComponentCreate, db: Session = Depends(get_db)):
    existing = crud_payroll.get_salary_component_by_name(db, name=component_in.name)
    if existing:
        raise HTTPException(status_code=400, detail="Salary component with this name already exists.")
    return crud_payroll.create_salary_component(db, component_in)


@router.get("/components/", response_model=List[SalaryComponentRead], dependencies=[Depends(deps.allow_admin_only)])
def read_salary_components_api(db: Session = Depends(get_db), skip: int = 0, limit: int = 100):
    return crud_payroll.get_salary_components(db, skip, limit)


# --- Employee Salary Structure Endpoints (Admin or Manager with specific perms) ---
@router.post("/employee-structure/", response_model=EmployeeSalaryStructureRead,
             dependencies=[Depends(deps.allow_admin_only)])
def add_employee_salary_component_api(
        structure_in: EmployeeSalaryStructureCreate,
        db: Session = Depends(get_db)
):
    emp = crud_employee.get_employee_profile(db, structure_in.employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    comp = crud_payroll.get_salary_component(db, structure_in.component_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Salary component not found.")

    # Add logic to end previous component of same type if effective_from overlaps
    # For simplicity, this is not implemented here. Assume admin handles this manually or structure_in.effective_to is used.

    created_structure = crud_payroll.add_employee_salary_component(db, structure_in)
    return EmployeeSalaryStructureRead(
        **created_structure.model_dump(),
        component_name=comp.name,
        component_type=comp.type
    )


@router.get("/employee-structure/{employee_id}", response_model=List[EmployeeSalaryStructureRead])
def get_employee_salary_structure_api(
        employee_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_admin_or_manager)  # Or stricter permission
):
    emp = crud_employee.get_employee_profile(db, employee_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    # Authorization: Admin can see anyone, Manager their team (if applicable to salary info)
    if current_user.role == UserRole.MANAGER:
        if not current_user.employee_profile or emp.manager_id != current_user.employee_profile.id:
            # Company policy: Managers might not see full salary structure.
            # For now, let's assume they can if they are the manager.
            pass  # If allowed. Otherwise, raise 403.

    structures = crud_payroll.get_employee_salary_structures(db, employee_id)
    response = []
    for s in structures:
        comp = s.component
        response.append(EmployeeSalaryStructureRead(
            **s.model_dump(),
            component_name=comp.name,
            component_type=comp.type
        ))
    return response


# --- Payroll Run Endpoints (Admin usually) ---
@router.post("/runs/", response_model=PayrollRunRead, status_code=status.HTTP_201_CREATED)
async def create_and_process_payroll_run_api(
        payroll_run_in: PayrollRunCreate,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_admin_only),
        payroll_service: PayrollCalculationService = Depends(get_payroll_service)
):
    existing_run = crud_payroll.get_payroll_run_by_month_year(db, payroll_run_in.month, payroll_run_in.year)
    if existing_run and existing_run.status not in [PayrollRunStatus.DRAFT,
                                                    PayrollRunStatus.REJECTED]:  # Allow re-processing DRAFT/REJECTED
        raise HTTPException(status_code=400,
                            detail=f"Payroll for {payroll_run_in.month}/{payroll_run_in.year} already exists with status {existing_run.status.value}.")

    if not existing_run:
        db_payroll_run = crud_payroll.create_payroll_run(db, payroll_run_in.month, payroll_run_in.year, current_user.id)
    else:  # Re-processing DRAFT or REJECTED
        db_payroll_run = existing_run
        db_payroll_run.processed_by_user_id = current_user.id  # Update who is processing it now
        db_payroll_run.status = PayrollRunStatus.DRAFT  # Reset to DRAFT before processing
        db.add(db_payroll_run)
        db.commit()
        db.refresh(db_payroll_run)

    # Run calculation in background as it can be time-consuming
    background_tasks.add_task(payroll_service.process_payroll_run, db_payroll_run, payroll_run_in.employee_ids)

    processed_by_user = crud_user.get_user(db,
                                           db_payroll_run.processed_by_user_id) if db_payroll_run.processed_by_user_id else None
    return PayrollRunRead(
        **db_payroll_run.model_dump(),
        processed_by_user_email=processed_by_user.email if processed_by_user else None,
        # Note: Status will be DRAFT initially, background task updates it.
        # Client should poll or use websockets for status updates.
    )


@router.get("/runs/", response_model=List[PayrollRunRead], dependencies=[Depends(deps.allow_admin_only)])
def get_payroll_runs_api(db: Session = Depends(get_db), skip: int = 0, limit: int = 10):
    runs = crud_payroll.get_payroll_runs(db, skip, limit)
    response = []
    for run in runs:
        user = crud_user.get_user(db, run.processed_by_user_id) if run.processed_by_user_id else None
        response.append(PayrollRunRead(
            **run.model_dump(),
            processed_by_user_email=user.email if user else None
        ))
    return response


@router.get("/runs/{payroll_run_id}", response_model=PayrollRunRead, dependencies=[Depends(deps.allow_admin_only)])
def get_payroll_run_details_api(payroll_run_id: int, db: Session = Depends(get_db)):
    run = crud_payroll.get_payroll_run(db, payroll_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    user = crud_user.get_user(db, run.processed_by_user_id) if run.processed_by_user_id else None
    return PayrollRunRead(
        **run.model_dump(),
        processed_by_user_email=user.email if user else None
    )


@router.put("/runs/{payroll_run_id}/status", response_model=PayrollRunRead,
            dependencies=[Depends(deps.allow_admin_only)])
def update_payroll_run_status_api(
        payroll_run_id: int,
        status_update: PayrollRunUpdate,  # Schema containing new status and optional notes
        db: Session = Depends(get_db)
):
    run = crud_payroll.get_payroll_run(db, payroll_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")

    # Add validation for status transitions if needed
    # e.g., cannot go from PAID back to DRAFT easily

    updated_run = crud_payroll.update_payroll_run_status(db, run, status_update.status, status_update.notes)
    user = crud_user.get_user(db, updated_run.processed_by_user_id) if updated_run.processed_by_user_id else None
    return PayrollRunRead(
        **updated_run.model_dump(),
        processed_by_user_email=user.email if user else None
    )


# --- Payslip Endpoints ---
@router.get("/runs/{payroll_run_id}/payslips", response_model=List[PayslipRead],
            dependencies=[Depends(deps.allow_admin_only)])
def get_payslips_for_run_api(payroll_run_id: int, db: Session = Depends(get_db)):
    run = crud_payroll.get_payroll_run(db, payroll_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")

    payslips = crud_payroll.get_payslips_for_run(db, payroll_run_id)
    response = []
    for ps in payslips:
        emp_profile = ps.employee
        user = emp_profile.user if emp_profile else None
        response.append(PayslipRead(
            **ps.model_dump(),
            employee_first_name=user.first_name if user else "N/A",
            employee_last_name=user.last_name if user else "N/A",
            employee_email=user.email if user else "N/A",
            month=run.month,
            year=run.year
        ))
    return response


@router.get("/payslips/me", response_model=List[PayslipRead])
def get_my_payslips_api(
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated),
        skip: int = 0, limit: int = Query(default=12, ge=1, le=50)  # Default to last 12 months
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    payslips = crud_payroll.get_employee_payslips(db, current_user.employee_profile.id, skip, limit)
    response = []
    for ps in payslips:
        run = ps.payroll_run  # SQLModel relationship
        response.append(PayslipRead(
            **ps.model_dump(),
            employee_first_name=current_user.first_name,
            employee_last_name=current_user.last_name,
            employee_email=current_user.email,
            month=run.month if run else 0,
            year=run.year if run else 0
        ))
    return response


@router.get("/payslips/{payslip_id}", response_model=PayslipRead)
def get_payslip_details_api(
        payslip_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    payslip = crud_payroll.get_payslip(db, payslip_id)
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found.")

    # Authorization: Employee can see their own, Admin can see anyone.
    # Managers might see their team's payslips based on policy (not implemented here for direct view).
    is_own_payslip = current_user.employee_profile and payslip.employee_id == current_user.employee_profile.id
    if not (current_user.role == UserRole.ADMIN or is_own_payslip):
        raise HTTPException(status_code=403, detail="Not authorized to view this payslip.")

    emp_profile = payslip.employee
    user = emp_profile.user if emp_profile else None
    run = payslip.payroll_run
    return PayslipRead(
        **payslip.model_dump(),
        employee_first_name=user.first_name if user else "N/A",
        employee_last_name=user.last_name if user else "N/A",
        employee_email=user.email if user else "N/A",
        month=run.month if run else 0,
        year=run.year if run else 0
    )


@router.get("/runs/{payroll_run_id}/bank-advice", response_class=Response,
            dependencies=[Depends(deps.allow_admin_only)])
async def generate_bank_advice_report_api(payroll_run_id: int, db: Session = Depends(get_db)):
    run = crud_payroll.get_payroll_run(db, payroll_run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found.")
    if run.status not in [PayrollRunStatus.APPROVED, PayrollRunStatus.PROCESSED, PayrollRunStatus.PAID]:
        raise HTTPException(status_code=400,
                            detail=f"Bank advice can only be generated for Approved/Processed/Paid runs. Current status: {run.status.value}")

    payslips = crud_payroll.get_payslips_for_run(db, payroll_run_id)
    if not payslips:
        return Response(content="No payslips found for this run.", media_type="text/plain", status_code=200)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Employee ID", "Employee Name", "Bank Account Number", "IFSC Code", "Net Salary"])

    report_items: List[BankAdviceReportItem] = []
    for ps in payslips:
        emp = ps.employee
        user = emp.user if emp else None
        if emp and user:
            writer.writerow([
                emp.id,
                f"{user.first_name} {user.last_name}",
                emp.bank_account_number or "N/A",
                emp.bank_ifsc_code or "N/A",
                ps.net_salary
            ])

    csv_data = output.getvalue()
    output.close()

    filename = f"bank_advice_{run.year}_{run.month:02d}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# TODO: Payslip PDF Generation endpoint (would use a library like ReportLab or WeasyPrint)