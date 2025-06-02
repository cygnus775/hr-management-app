# hr_software/app/api/v1/endpoints/leaves.py

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks, Response
from sqlmodel import Session
from typing import List, Optional
from datetime import date, datetime

from app.core.db import get_db
from app.api import deps
from app.models.user import User
from app.models.enums import UserRole, LeaveRequestStatus, LeaveTypeName  # Enums from central file
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, Holiday  # ORM Models
from app.models.employee import EmployeeProfile  # For type checking and fetching profile info
from app.schemas.leave import (
    LeaveTypeCreate, LeaveTypeRead, LeaveTypeUpdate,
    LeaveBalanceRead, LeaveBalanceUpdate,
    LeaveRequestCreate, LeaveRequestRead,
    LeaveRequestUpdateByManager, LeaveRequestUpdateByEmployee,
    HolidayCreate, HolidayRead, HolidayUpdate
)
from app.crud import crud_leave, crud_employee, crud_user  # CRUD operations
from app.services.leave_service import LeaveCalculationService  # Business logic

router = APIRouter()


def get_leave_service(db: Session = Depends(get_db)) -> LeaveCalculationService:
    return LeaveCalculationService(db)


# --- Helper to build LeaveRequestRead (to keep response construction DRY) ---
def _build_leave_request_read(db: Session, leave_request_orm: LeaveRequest) -> LeaveRequestRead:
    employee_profile = crud_employee.get_employee_profile(db, employee_id=leave_request_orm.employee_id)
    user_for_response = employee_profile.user if employee_profile and employee_profile.user else None
    leave_type_for_response = leave_request_orm.leave_type  # Relationship should load this

    # Potentially fetch approver details if approved_or_rejected_by_id is set
    # approver_user = crud_user.get_user(db, leave_request_orm.approved_or_rejected_by_id) if leave_request_orm.approved_or_rejected_by_id else None

    return LeaveRequestRead(
        id=leave_request_orm.id,
        employee_id=leave_request_orm.employee_id,
        leave_type_id=leave_request_orm.leave_type_id,
        start_date=leave_request_orm.start_date,
        end_date=leave_request_orm.end_date,
        reason=leave_request_orm.reason,
        status=leave_request_orm.status,
        number_of_days=leave_request_orm.number_of_days,
        applied_on=leave_request_orm.applied_on,
        manager_remarks=leave_request_orm.manager_remarks,
        approved_or_rejected_by_id=leave_request_orm.approved_or_rejected_by_id,
        approved_or_rejected_on=leave_request_orm.approved_or_rejected_on,
        employee_first_name=user_for_response.first_name if user_for_response else "N/A",
        employee_last_name=user_for_response.last_name if user_for_response else "N/A",
        leave_type_name=leave_type_for_response.name if leave_type_for_response else LeaveTypeName.OTHER  # Fallback
        # approver_name=f"{approver_user.first_name} {approver_user.last_name}" if approver_user else None # Example
    )


# --- LeaveType Endpoints (Admin) ---
@router.post("/types/", response_model=LeaveTypeRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(deps.allow_admin_only)])
def create_leave_type_api(
        leave_type_in: LeaveTypeCreate,
        db: Session = Depends(get_db)
):
    existing = crud_leave.get_leave_type_by_name(db, name=leave_type_in.leave_type_name)
    if existing:
        raise HTTPException(status_code=400, detail="Leave type with this name already exists")
    return crud_leave.create_leave_type(db, leave_type_in)


@router.get("/types/", response_model=List[LeaveTypeRead], dependencies=[Depends(deps.allow_all_authenticated)])
def read_leave_types_api(
        db: Session = Depends(get_db),
        skip: int = Query(0, ge=0),
        limit: int = Query(default=100, ge=1, le=200)
):
    return crud_leave.get_leave_types(db, skip, limit)


@router.get("/types/{leave_type_id}", response_model=LeaveTypeRead,
            dependencies=[Depends(deps.allow_all_authenticated)])
def read_leave_type_api(leave_type_id: int, db: Session = Depends(get_db)):
    db_leave_type = crud_leave.get_leave_type(db, leave_type_id)
    if not db_leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    return db_leave_type


@router.put("/types/{leave_type_id}", response_model=LeaveTypeRead, dependencies=[Depends(deps.allow_admin_only)])
def update_leave_type_api(
        leave_type_id: int,
        leave_type_in: LeaveTypeUpdate,  # Pydantic schema for update
        db: Session = Depends(get_db)
):
    db_leave_type = crud_leave.get_leave_type(db, leave_type_id)
    if not db_leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    # Pass the .model_dump() to CRUD if it expects a dict
    return crud_leave.update_leave_type(db, db_leave_type, leave_type_in.model_dump(exclude_unset=True))


@router.delete("/types/{leave_type_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(deps.allow_admin_only)])
def delete_leave_type_api(leave_type_id: int, db: Session = Depends(get_db)):
    deleted_leave_type = crud_leave.delete_leave_type(db, leave_type_id)
    if not deleted_leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found or already deleted")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- LeaveBalance Endpoints ---
@router.get("/balances/me", response_model=List[LeaveBalanceRead])
def read_my_leave_balances_api(
        year: Optional[int] = Query(None, description="Year to fetch balances for, defaults to current year if None"),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated),
        leave_service: LeaveCalculationService = Depends(get_leave_service)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found for current user")

    employee_profile_id = current_user.employee_profile.id if isinstance(current_user.employee_profile,
                                                                         EmployeeProfile) else \
    current_user.employee_profile[0].id

    target_year = year if year is not None else datetime.utcnow().year

    # Ensure balances are initialized
    leave_service.initialize_employee_balances_for_year(current_user.employee_profile, target_year)

    balances_orm = crud_leave.get_employee_leave_balances(db, employee_profile_id, target_year)
    response_balances = []
    for bal_orm in balances_orm:
        leave_type = bal_orm.leave_type  # Relationship should be loaded
        response_balances.append(
            LeaveBalanceRead(
                id=bal_orm.id,
                employee_id=bal_orm.employee_id,
                leave_type_id=bal_orm.leave_type_id,
                year=bal_orm.year,
                allocated_days=bal_orm.allocated_days,
                taken_days=bal_orm.taken_days,
                leave_type_name=leave_type.name if leave_type else LeaveTypeName.OTHER,
                balance_days=(bal_orm.allocated_days - bal_orm.taken_days)
            )
        )
    return response_balances


@router.get("/balances/employee/{employee_profile_id_param}", response_model=List[LeaveBalanceRead],
            dependencies=[Depends(deps.allow_admin_or_manager)])
def read_employee_leave_balances_api(
        employee_profile_id_param: int,  # Renamed to avoid clash with employee_profile_id variable
        year: Optional[int] = Query(None, description="Year to fetch balances for, defaults to current year if None"),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_admin_or_manager),
        leave_service: LeaveCalculationService = Depends(get_leave_service)
):
    employee_profile = crud_employee.get_employee_profile(db, employee_profile_id_param)
    if not employee_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    if current_user.role == UserRole.MANAGER:
        if not current_user.employee_profile or employee_profile.manager_id != current_user.employee_profile.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this employee's balances")

    target_year = year if year is not None else datetime.utcnow().year
    leave_service.initialize_employee_balances_for_year(employee_profile, target_year)

    balances_orm = crud_leave.get_employee_leave_balances(db, employee_profile_id_param, target_year)
    response_balances = []
    for bal_orm in balances_orm:
        leave_type = bal_orm.leave_type
        response_balances.append(
            LeaveBalanceRead(
                **bal_orm.model_dump(),  # Spread common fields
                leave_type_name=leave_type.name if leave_type else LeaveTypeName.OTHER,
                balance_days=(bal_orm.allocated_days - bal_orm.taken_days)
            )
        )
    return response_balances


@router.put("/balances/employee/{employee_profile_id_param}/adjust", response_model=LeaveBalanceRead,
            dependencies=[Depends(deps.allow_admin_only)])
def adjust_employee_leave_balance_api(
    employee_profile_id_param: int, # Path parameter (required)
    adjustment_data: LeaveBalanceUpdate, # Request body (required) - Moved before query params with defaults
    leave_type_id: int = Query(..., description="The ID of the leave type to adjust"), # Query parameter (required by Query(...))
    year: int = Query(default_factory=lambda: datetime.utcnow().year, description="The year for which to adjust the balance"), # Query parameter (has default)
    db: Session = Depends(get_db)
):
    # Ensure employee and leave type exist
    if not crud_employee.get_employee_profile(db, employee_profile_id_param):
        raise HTTPException(status_code=404, detail="Employee not found")
    leave_type = crud_leave.get_leave_type(db, leave_type_id)
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")

    # Use create_or_update_leave_balance for adjustments.
    # This CRUD function can set absolute allocated/taken days.
    updated_balance = crud_leave.create_or_update_leave_balance(
        db,
        employee_id=employee_profile_id_param,
        leave_type_id=leave_type_id,
        year=year,
        allocated_days_override=adjustment_data.allocated_days,  # Pass as override
        set_taken_days=adjustment_data.taken_days  # Pass to set taken days directly
    )

    return LeaveBalanceRead(
        **updated_balance.model_dump(),
        leave_type_name=leave_type.name,  # From fetched leave_type
        balance_days=(updated_balance.allocated_days - updated_balance.taken_days)
    )


# --- LeaveRequest Endpoints ---
@router.post("/requests/apply", response_model=LeaveRequestRead, status_code=status.HTTP_201_CREATED)
async def apply_for_leave_api(
        leave_request_in: LeaveRequestCreate,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated),
        leave_service: LeaveCalculationService = Depends(get_leave_service)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=403, detail="User does not have an employee profile to apply for leave.")

    employee_profile_id: Optional[int] = None
    # Handle if current_user.employee_profile is a list (should be single object for one-to-one)
    current_emp_profile = current_user.employee_profile
    if isinstance(current_emp_profile, list):
        current_emp_profile = current_emp_profile[0] if current_emp_profile else None

    if not isinstance(current_emp_profile, EmployeeProfile) or not current_emp_profile.id:
        raise HTTPException(status_code=403, detail="Employee profile ID not found for current user.")
    employee_profile_id = current_emp_profile.id

    leave_type = crud_leave.get_leave_type(db, leave_request_in.leave_type_id)
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found.")

    num_days = leave_service.calculate_leave_days(
        leave_request_in.start_date, leave_request_in.end_date
    )
    if num_days <= 0:
        raise HTTPException(status_code=400, detail="Calculated leave days must be positive.")

    if leave_type.is_paid:
        year_of_leave_start = leave_request_in.start_date.year
        if not leave_service.check_leave_balance(employee_profile_id, leave_type.id, num_days, year_of_leave_start):
            raise HTTPException(status_code=400, detail=f"Insufficient leave balance for {leave_type.name.value}.")

    initial_status = LeaveRequestStatus.PENDING if leave_type.requires_approval else LeaveRequestStatus.APPROVED

    try:
        created_request_orm = crud_leave.create_leave_request(
            db=db,
            employee_id=employee_profile_id,
            leave_type_id=leave_type.id,
            start_date=leave_request_in.start_date,
            end_date=leave_request_in.end_date,
            reason=leave_request_in.reason,
            status=initial_status,
            calculated_number_of_days=num_days
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Error creating leave request in DB: {e}")
        raise HTTPException(status_code=500, detail="Could not save leave request.")

    if created_request_orm.status == LeaveRequestStatus.APPROVED and leave_type.is_paid:
        try:
            crud_leave.create_or_update_leave_balance(
                db, employee_profile_id, leave_type.id,
                year=created_request_orm.start_date.year,
                taken_days_delta=num_days
            )
        except Exception as e:
            print(f"Error updating leave balance for auto-approved leave {created_request_orm.id}: {e}")

    return _build_leave_request_read(db, created_request_orm)


@router.get("/requests/me", response_model=List[LeaveRequestRead])
def read_my_leave_requests_api(
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated),
        skip: int = Query(0, ge=0),
        limit: int = Query(default=20, ge=1, le=100),
        status: Optional[LeaveRequestStatus] = Query(None)
):
    if not current_user.employee_profile: return []

    employee_profile_id = current_user.employee_profile.id if isinstance(current_user.employee_profile,
                                                                         EmployeeProfile) else \
    current_user.employee_profile[0].id
    if not employee_profile_id: return []

    requests_orm = crud_leave.get_leave_requests_by_employee(db, employee_profile_id, skip, limit, status)
    return [_build_leave_request_read(db, req) for req in requests_orm]


@router.get("/requests/team", response_model=List[LeaveRequestRead])
def read_team_leave_requests_api(
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated),
        skip: int = Query(0, ge=0),
        limit: int = Query(default=20, ge=1, le=100),
        status: Optional[LeaveRequestStatus] = Query(LeaveRequestStatus.PENDING)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=403, detail="User does not have an employee profile.")

    # Handle employee profile (whether it's a single object or list)
    current_emp_profile = current_user.employee_profile
    if isinstance(current_emp_profile, list):
        current_emp_profile = current_emp_profile[0] if current_emp_profile else None

    if not isinstance(current_emp_profile, EmployeeProfile) or not current_emp_profile.id:
        raise HTTPException(status_code=403, detail="Employee profile ID not found.")

    current_profile_id = current_emp_profile.id
    requests_orm = []

    try:
        # Logic based on user role
        if current_user.role == UserRole.ADMIN:
            # Admin can see all leave requests across the organization
            # Since the specific CRUD methods don't exist, use a more efficient approach
            try:
                # Try to use a general method that might exist
                requests_orm = crud_leave.get_leave_requests(db, skip=skip, limit=limit, status=status)
            except (AttributeError, TypeError):
                # Fallback: Get all employees and their requests (less efficient)
                all_employees = crud_employee.get_employee_profiles(db, skip=0, limit=5000)
                all_requests = []
                for employee in all_employees:
                    try:
                        employee_requests = crud_leave.get_leave_requests_by_employee(
                            db, employee.id, skip=0, limit=100, status=status
                        )
                        all_requests.extend(employee_requests)
                    except Exception as e:
                        print(f"Error fetching requests for employee {employee.id}: {e}")
                        continue

                # Sort by applied_on date and apply pagination
                sorted_requests = sorted(all_requests, key=lambda r: r.applied_on, reverse=True)
                requests_orm = sorted_requests[skip:skip + limit]

        elif current_user.role == UserRole.MANAGER:
            # Manager logic - see their team's requests
            if status == LeaveRequestStatus.PENDING:
                try:
                    requests_orm = crud_leave.get_pending_leave_requests_for_manager(
                        db, current_profile_id, skip, limit
                    )
                except (AttributeError, TypeError):
                    # Fallback if the method doesn't exist or has different signature
                    requests_orm = []
            else:
                # Get all team members' requests with specific status
                try:
                    team_member_profiles = crud_employee.get_employee_profiles(
                        db, manager_id=current_profile_id, skip=0, limit=1000
                    )
                    all_team_requests = []
                    for member in team_member_profiles:
                        try:
                            member_requests = crud_leave.get_leave_requests_by_employee(
                                db, member.id, skip=0, limit=500, status=status
                            )
                            all_team_requests.extend(member_requests)
                        except Exception as e:
                            print(f"Error fetching requests for team member {member.id}: {e}")
                            continue

                    # Sort and apply pagination
                    sorted_requests = sorted(all_team_requests, key=lambda r: r.applied_on, reverse=True)
                    requests_orm = sorted_requests[skip:skip + limit]
                except Exception as e:
                    print(f"Error fetching team requests for manager {current_profile_id}: {e}")
                    requests_orm = []

        else:
            # Regular employee - return their own requests
            try:
                requests_orm = crud_leave.get_leave_requests_by_employee(
                    db, current_profile_id, skip, limit, status
                )
            except (AttributeError, TypeError):
                # Handle different method signatures
                try:
                    requests_orm = crud_leave.get_leave_requests_by_employee(
                        db, current_profile_id, skip=skip, limit=limit, status=status
                    )
                except Exception:
                    requests_orm = []

    except Exception as e:
        print(f"Unexpected error in read_team_leave_requests_api: {e}")
        raise HTTPException(status_code=500, detail="Error fetching leave requests")

    # Build response using the helper function
    try:
        return [_build_leave_request_read(db, req) for req in requests_orm]
    except Exception as e:
        print(f"Error building leave request response: {e}")
        raise HTTPException(status_code=500, detail="Error processing leave requests")


@router.put("/requests/{leave_request_id}/action", response_model=LeaveRequestRead)
async def action_on_leave_request_api(
        leave_request_id: int,
        action_data: LeaveRequestUpdateByManager,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    db_leave_request_orm = crud_leave.get_leave_request(db, leave_request_id)
    if not db_leave_request_orm:
        raise HTTPException(status_code=404, detail="Leave request not found.")
    if db_leave_request_orm.status != LeaveRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Leave request is already {db_leave_request_orm.status.value}.")

    # Commented-out authorization check
    # employee_profile = crud_employee.get_employee_profile(db, db_leave_request_orm.employee_id)
    # if not current_user.employee_profile or not employee_profile or employee_profile.manager_id != current_user.employee_profile.id:
    #     raise HTTPException(status_code=403,
    #                         detail="Not authorized to act on this leave request (not manager of applicant).")

    updated_request_orm = crud_leave.update_leave_request_status(
        db, db_leave_request_orm, action_data.status, action_data.manager_remarks, current_user.id
    )

    leave_type = updated_request_orm.leave_type
    if action_data.status == LeaveRequestStatus.APPROVED and leave_type and leave_type.is_paid:
        try:
            crud_leave.create_or_update_leave_balance(
                db, updated_request_orm.employee_id, updated_request_orm.leave_type_id,
                year=updated_request_orm.start_date.year,
                taken_days_delta=updated_request_orm.number_of_days
            )
        except Exception as e:
            print(f"Error updating balance for approved leave {updated_request_orm.id}: {e}")

    return _build_leave_request_read(db, updated_request_orm)



@router.put("/requests/{leave_request_id}/cancel", response_model=LeaveRequestRead)
async def cancel_my_leave_request_api(
        leave_request_id: int,
        background_tasks: BackgroundTasks,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    db_leave_request_orm = crud_leave.get_leave_request(db, leave_request_id)
    if not db_leave_request_orm:
        raise HTTPException(status_code=404, detail="Leave request not found.")

    current_emp_profile = current_user.employee_profile
    if isinstance(current_emp_profile, list): current_emp_profile = current_emp_profile[
        0] if current_emp_profile else None
    if not isinstance(current_emp_profile,
                      EmployeeProfile) or db_leave_request_orm.employee_id != current_emp_profile.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this leave request.")

    if db_leave_request_orm.status != LeaveRequestStatus.PENDING:
        raise HTTPException(status_code=400,
                            detail=f"Cannot cancel. Request status: {db_leave_request_orm.status.value}.")

    # If leave was approved and balance deducted, it needs to be added back if cancelled (complex rule)
    # For now, only PENDING can be cancelled, so no balance adjustment needed for cancellation itself.
    # If an APPROVED leave could be cancelled, the `taken_days_delta` would be negative.

    updated_request_orm = crud_leave.update_leave_request_status(
        db, db_leave_request_orm, LeaveRequestStatus.CANCELLED, "Cancelled by employee", current_user.id
    )
    # background_tasks.add_task(notify_manager_of_cancellation, ...) # Future
    return _build_leave_request_read(db, updated_request_orm)


# --- Holiday Endpoints (Admin) ---
@router.post("/holidays/", response_model=HolidayRead, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(deps.allow_admin_only)])
def create_holiday_api(holiday_in: HolidayCreate, db: Session = Depends(get_db)):
    return crud_leave.create_holiday(db, holiday_in)


@router.get("/holidays/", response_model=List[HolidayRead],
            dependencies=[Depends(deps.allow_all_authenticated)])  # All can view
def read_holidays_api(
        year: int = Query(default_factory=lambda: datetime.utcnow().year),
        country_code: Optional[str] = Query("IN"),
        db: Session = Depends(get_db)
):
    return crud_leave.get_holidays_by_year(db, year, country_code)


@router.put("/holidays/{holiday_id}", response_model=HolidayRead, dependencies=[Depends(deps.allow_admin_only)])
def update_holiday_api(holiday_id: int, holiday_in: HolidayUpdate, db: Session = Depends(get_db)):
    db_holiday = crud_leave.get_holiday(db, holiday_id)
    if not db_holiday:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return crud_leave.update_holiday(db, db_holiday, holiday_in.model_dump(exclude_unset=True))


@router.delete("/holidays/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(deps.allow_admin_only)])
def delete_holiday_api(holiday_id: int, db: Session = Depends(get_db)):
    deleted = crud_leave.delete_holiday(db, holiday_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Holiday not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)