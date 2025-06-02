from sqlmodel import Session
from datetime import date, timedelta
from typing import List

from app.models.leave import Holiday, LeaveRequestStatus, LeaveType, LeaveBalance
from app.crud import crud_leave
from app.models.employee import EmployeeProfile

class LeaveCalculationService:
    def __init__(self, db: Session):
        self.db = db

    def _is_weekend(self, d: date) -> bool:
        # Standard Saturday/Sunday weekend
        return d.weekday() >= 5 # Monday is 0 and Sunday is 6

    def _get_holidays_in_range(self, start_date: date, end_date: date, country_code: str = "IN") -> List[date]:
        current_year = start_date.year
        holidays_dates = [h.date for h in crud_leave.get_holidays_by_year(self.db, current_year, country_code)]
        if end_date.year != current_year: # If leave spans across years
            holidays_dates.extend([h.date for h in crud_leave.get_holidays_by_year(self.db, end_date.year, country_code)])
        return [h for h in holidays_dates if start_date <= h <= end_date]

    def calculate_leave_days(self, start_date: date, end_date: date, include_weekends: bool = False, country_code: str = "IN") -> float:
        if start_date > end_date:
            return 0.0

        holidays = self._get_holidays_in_range(start_date, end_date, country_code)
        total_days = 0.0
        current_date = start_date
        while current_date <= end_date:
            is_workday = True
            if not include_weekends and self._is_weekend(current_date):
                is_workday = False
            if current_date in holidays:
                is_workday = False # Holidays are not counted as leave days

            if is_workday:
                total_days += 1.0
            current_date += timedelta(days=1)
        return total_days

    def check_leave_balance(self, employee_id: int, leave_type_id: int, leave_days_requested: float, year: int) -> bool:
        balance = crud_leave.get_leave_balance(self.db, employee_id, leave_type_id, year)
        if not balance:
            leave_type = crud_leave.get_leave_type(self.db, leave_type_id)
            if not leave_type: return False # Should not happen
            # If no balance record, check if default allocation is enough
            return leave_type.default_days_annually >= leave_days_requested

        # Calculate current available balance
        available_balance = balance.allocated_days - balance.taken_days
        return available_balance >= leave_days_requested

    def initialize_employee_balances_for_year(self, employee: EmployeeProfile, year: int):
        leave_types = crud_leave.get_leave_types(self.db)
        for lt in leave_types:
            existing_balance = crud_leave.get_leave_balance(self.db, employee.id, lt.id, year)
            if not existing_balance:
                crud_leave.create_or_update_leave_balance(
                    self.db,
                    employee_id=employee.id,
                    leave_type_id=lt.id,
                    year=year,
                    allocated_days_override=lt.default_days_annually
                )
        return crud_leave.get_employee_leave_balances(self.db, employee.id, year)

    def accrue_monthly_leave(self, employee_id: int, leave_type_id: int, monthly_accrual_days: float, year: int):
        # This is a simplified monthly accrual. Real systems might be more complex.
        balance = crud_leave.create_or_update_leave_balance(
            self.db, employee_id, leave_type_id, year
        ) # Ensure balance exists
        balance.allocated_days += monthly_accrual_days
        self.db.add(balance)
        self.db.commit()
        self.db.refresh(balance)
        return balance