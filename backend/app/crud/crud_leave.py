# hr_software/app/crud/crud_leave.py

from sqlmodel import Session, select, and_, func
from typing import List, Optional
from datetime import date, datetime

# Import ORM Models
from app.models.leave import LeaveType, LeaveBalance, LeaveRequest, Holiday
from app.models.employee import EmployeeProfile
from app.models.user import User  # For type hinting completed_by_user_id context if needed

# Import Enums (used for type hints and default values in some cases)
from app.models.enums import LeaveTypeName, LeaveRequestStatus, EmployeeWorkflowStatus

# Import Schemas (primarily for what the API layer might pass if creating directly from schema,
# but for create_leave_request, we're now taking individual args)
from app.schemas.leave import (
    LeaveTypeCreate,  # Used if API passes a schema object to a CRUD create function
    # LeaveTypeUpdate, # Schema used for update payloads from API
    HolidayCreate,
    # HolidayUpdate
)


# --- LeaveType CRUD ---
def get_leave_type(db: Session, leave_type_id: int) -> LeaveType | None:
    return db.get(LeaveType, leave_type_id)


def get_leave_type_by_name(db: Session, name: LeaveTypeName) -> LeaveType | None:  # Expect Enum member
    statement = select(LeaveType).where(LeaveType.name == name)
    return db.exec(statement).first()


def get_leave_types(db: Session, skip: int = 0, limit: int = 100) -> List[LeaveType]:
    statement = select(LeaveType).order_by(LeaveType.name).offset(skip).limit(limit)
    return db.exec(statement).all()


def create_leave_type(db: Session, leave_type_in: LeaveTypeCreate) -> LeaveType:
    # leave_type_in is a Pydantic schema (e.g., from API request body)
    # SQLModel can validate and create an ORM instance from it
    db_leave_type = LeaveType.model_validate(leave_type_in)
    db.add(db_leave_type)
    db.commit()
    db.refresh(db_leave_type)
    return db_leave_type


def update_leave_type(db: Session, db_leave_type: LeaveType, leave_type_in_data: dict) -> LeaveType:
    # leave_type_in_data is a dictionary, e.g., from leave_type_update_schema.model_dump(exclude_unset=True)
    for key, value in leave_type_in_data.items():
        setattr(db_leave_type, key, value)
    db.add(db_leave_type)
    db.commit()
    db.refresh(db_leave_type)
    return db_leave_type


def delete_leave_type(db: Session, leave_type_id: int) -> LeaveType | None:
    leave_type = db.get(LeaveType, leave_type_id)
    if leave_type:
        # Consider if there are dependent LeaveRequests or LeaveBalances before deleting
        # For now, simple delete. Production might require soft delete or checks.
        db.delete(leave_type)
        db.commit()
    return leave_type


# --- LeaveBalance CRUD ---
def get_leave_balance(db: Session, employee_id: int, leave_type_id: int, year: int) -> LeaveBalance | None:
    statement = select(LeaveBalance).where(
        LeaveBalance.employee_id == employee_id,
        LeaveBalance.leave_type_id == leave_type_id,
        LeaveBalance.year == year
    )
    return db.exec(statement).first()


def get_employee_leave_balances(db: Session, employee_id: int, year: Optional[int] = None) -> List[LeaveBalance]:
    statement = select(LeaveBalance).where(LeaveBalance.employee_id == employee_id)
    if year:
        statement = statement.where(LeaveBalance.year == year)
    statement = statement.order_by(LeaveBalance.leave_type_id)  # Consistent ordering
    return db.exec(statement).all()


def create_or_update_leave_balance(
        db: Session,
        employee_id: int,
        leave_type_id: int,
        year: int,
        allocated_days_override: Optional[float] = None,  # To set/override total allocated
        taken_days_delta: Optional[float] = None,  # To increment/decrement taken days
        set_taken_days: Optional[float] = None  # To set absolute taken days
) -> LeaveBalance:
    balance = get_leave_balance(db, employee_id, leave_type_id, year)

    if not balance:
        # If balance doesn't exist, create it
        leave_type = get_leave_type(db, leave_type_id)
        if not leave_type:
            raise ValueError(f"LeaveType with id {leave_type_id} not found. Cannot create balance.")

        initial_allocated = allocated_days_override if allocated_days_override is not None else (
                    leave_type.default_days_annually or 0.0)
        initial_taken = 0.0
        if set_taken_days is not None:
            initial_taken = set_taken_days
        elif taken_days_delta is not None:  # Should not happen if balance doesn't exist, but for completeness
            initial_taken = taken_days_delta

        balance = LeaveBalance(
            employee_id=employee_id,
            leave_type_id=leave_type_id,
            year=year,
            allocated_days=initial_allocated,
            taken_days=max(0, initial_taken)  # Ensure taken_days is not negative
        )
    else:
        # If balance exists, update it
        if allocated_days_override is not None:
            balance.allocated_days = allocated_days_override

        if set_taken_days is not None:
            balance.taken_days = max(0, set_taken_days)
        elif taken_days_delta is not None:
            balance.taken_days = max(0, balance.taken_days + taken_days_delta)

    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


# --- LeaveRequest CRUD ---
def get_leave_request(db: Session, leave_request_id: int) -> LeaveRequest | None:
    # Eager load related objects if frequently accessed together
    # statement = select(LeaveRequest).options(selectinload(LeaveRequest.leave_type), selectinload(LeaveRequest.employee).selectinload(EmployeeProfile.user))
    # db_leave_request = db.exec(statement.where(LeaveRequest.id == leave_request_id)).first()
    # return db_leave_request
    return db.get(LeaveRequest, leave_request_id)


def get_leave_requests_by_employee(
        db: Session, employee_id: int, skip: int = 0, limit: int = 100,
        status: Optional[LeaveRequestStatus] = None
) -> List[LeaveRequest]:
    statement = select(LeaveRequest).where(LeaveRequest.employee_id == employee_id)
    if status:
        statement = statement.where(LeaveRequest.status == status)
    statement = statement.order_by(LeaveRequest.applied_on.desc()).offset(skip).limit(limit)
    return db.exec(statement).all()


def get_pending_leave_requests_for_manager(db: Session, manager_profile_id: int, skip: int = 0, limit: int = 100) -> \
List[LeaveRequest]:
    statement = (
        select(LeaveRequest)
        .join(EmployeeProfile, LeaveRequest.employee_id == EmployeeProfile.id)
        .where(EmployeeProfile.manager_id == manager_profile_id)
        .where(LeaveRequest.status == LeaveRequestStatus.PENDING)
        .order_by(LeaveRequest.applied_on.asc())
        .offset(skip).limit(limit)
    )
    return db.exec(statement).all()


def create_leave_request(
        db: Session,
        employee_id: int,
        leave_type_id: int,
        start_date: date,
        end_date: date,
        reason: Optional[str],
        status: LeaveRequestStatus,
        calculated_number_of_days: float  # Explicitly pass the calculated days
) -> LeaveRequest:
    if calculated_number_of_days <= 0:
        raise ValueError("Number of leave days must be positive.")

    db_leave_request_orm_instance = LeaveRequest(
        employee_id=employee_id,
        leave_type_id=leave_type_id,
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        status=status,
        number_of_days=calculated_number_of_days,
        applied_on=datetime.utcnow()  # Explicitly set or rely on default_factory
        # manager_remarks, approved_or_rejected_by_id, approved_or_rejected_on are for later updates
    )
    db.add(db_leave_request_orm_instance)
    db.commit()
    db.refresh(db_leave_request_orm_instance)
    return db_leave_request_orm_instance


def update_leave_request_status(
        db: Session,
        db_leave_request_orm: LeaveRequest,  # Pass the ORM instance fetched by the API layer
        new_status: LeaveRequestStatus,
        manager_remarks: Optional[str] = None,
        action_by_user_id: Optional[int] = None  # User.id of the approver/rejecter/canceller
) -> LeaveRequest:
    if not db_leave_request_orm:
        raise ValueError("LeaveRequest instance to update cannot be None.")

    db_leave_request_orm.status = new_status
    db_leave_request_orm.manager_remarks = manager_remarks  # Will be None if not provided

    if action_by_user_id:  # If action is taken by someone
        db_leave_request_orm.approved_or_rejected_by_id = action_by_user_id

    db_leave_request_orm.approved_or_rejected_on = datetime.utcnow()  # Timestamp of the action

    db.add(db_leave_request_orm)
    db.commit()
    db.refresh(db_leave_request_orm)
    return db_leave_request_orm


# --- Holiday CRUD ---
def get_holiday(db: Session, holiday_id: int) -> Holiday | None:
    return db.get(Holiday, holiday_id)


def get_holidays_by_year(db: Session, year: int, country_code: Optional[str] = "IN") -> List[Holiday]:
    statement = select(Holiday).where(
        # Extract year from date column for comparison
        # This might vary slightly depending on DB (e.g., func.strftime('%Y', Holiday.date) for SQLite)
        # For PostgreSQL, func.extract('year', Holiday.date) is correct.
        func.extract('year', Holiday.date) == year
    )
    if country_code:
        statement = statement.where(Holiday.country_code == country_code)
    return db.exec(statement.order_by(Holiday.date.asc())).all()


def create_holiday(db: Session, holiday_in: HolidayCreate) -> Holiday:
    # holiday_in is a Pydantic schema
    db_holiday = Holiday.model_validate(holiday_in)
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday


def update_holiday(db: Session, db_holiday: Holiday, holiday_in_data: dict) -> Holiday:
    # holiday_in_data is a dictionary from schema.model_dump(exclude_unset=True)
    for key, value in holiday_in_data.items():
        setattr(db_holiday, key, value)
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday


def delete_holiday(db: Session, holiday_id: int) -> Holiday | None:
    holiday = db.get(Holiday, holiday_id)
    if holiday:
        db.delete(holiday)
        db.commit()
    return holiday