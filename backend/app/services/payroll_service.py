# hr_software/app/services/payroll_service.py

from sqlmodel import Session
from datetime import date, datetime, timedelta
import calendar
from typing import List, Dict, Any, Optional

from app.crud import crud_payroll, crud_employee, crud_leave
from app.models.employee import EmployeeProfile
from app.models.payroll import (
    SalaryComponentType, EmployeeSalaryStructure,
    PayrollRun, Payslip, PayrollRunStatus
)
from app.models.enums import EmploymentStatus, \
    SalaryComponentType as SalaryComponentTypeEnum  # Using the enum for type hints where appropriate
from app.models.leave import LeaveRequest, LeaveRequestStatus, LeaveType


class PayrollCalculationService:
    def __init__(self, db: Session):
        self.db = db

    def _get_days_in_month(self, year: int, month: int) -> int:
        return calendar.monthrange(year, month)[1]

    def _calculate_leave_days_in_period(self, leave_start: date, leave_end: date, period_start: date,
                                        period_end: date) -> float:
        """
        Calculates the number of calendar days a leave request overlaps with a given period.
        """
        overlap_start = max(leave_start, period_start)
        overlap_end = min(leave_end, period_end)
        days = 0.0
        if overlap_start <= overlap_end:
            current_d = overlap_start
            while current_d <= overlap_end:
                days += 1.0
                current_d += timedelta(days=1)
        return days

    def _get_leave_days_for_month_by_type(self, employee_id: int, year: int, month: int, is_paid_leave: bool) -> float:
        print(
            f"SVC_PAYROLL_LEAVE_CALC: Checking {'paid' if is_paid_leave else 'unpaid'} leave for EmpID: {employee_id}, Period: {month:02d}/{year}")
        month_start_date = date(year, month, 1)
        month_end_date = date(year, month, self._get_days_in_month(year, month))

        total_leave_days_in_month = 0.0
        approved_leave_requests: List[LeaveRequest] = crud_leave.get_leave_requests_by_employee(
            self.db, employee_id, status=LeaveRequestStatus.APPROVED
        )

        for lr in approved_leave_requests:
            # Ensure relationships are loaded, especially lr.leave_type
            if not lr.leave_type:  # If lazy loaded and session closed, or relationship missing
                self.db.refresh(lr, with_for_update=False, relationships=["leave_type"])  # Attempt to load

            leave_type_obj = lr.leave_type
            if not leave_type_obj:
                print(
                    f"SVC_PAYROLL_LEAVE_CALC: Warning - LeaveRequest ID {lr.id} has no associated leave_type. Skipping.")
                continue

            if leave_type_obj.is_paid == is_paid_leave:
                days_this_month = self._calculate_leave_days_in_period(
                    lr.start_date, lr.end_date, month_start_date, month_end_date
                )
                total_leave_days_in_month += days_this_month
                print(
                    f"SVC_PAYROLL_LEAVE_CALC: EmpID {employee_id} - ReqID {lr.id} ({leave_type_obj.name.value}), TypePaid: {leave_type_obj.is_paid}, Start: {lr.start_date}, End: {lr.end_date}, NumDaysStored: {lr.number_of_days}, CalculatedDaysInMonth: {days_this_month}")

        print(
            f"SVC_PAYROLL_LEAVE_CALC: Total {'paid' if is_paid_leave else 'unpaid'} days for EmpID {employee_id} in {month:02d}/{year}: {total_leave_days_in_month}")
        return total_leave_days_in_month

    def calculate_employee_payroll(
            self, employee: EmployeeProfile, payroll_month: int, payroll_year: int, payroll_run_id: int
    ) -> Payslip | None:

        print(
            f"SVC_PAYROLL_CALC: ==> Attempting for EmpID: {employee.id}, UserID: {employee.user_id} for {payroll_month:02d}/{payroll_year}")

        if employee.employment_status != EmploymentStatus.ACTIVE:
            print(
                f"SVC_PAYROLL_CALC: EmpID {employee.id} is not ACTIVE (status: {employee.employment_status.value}). Skipping payslip.")
            return None

        for_date = date(payroll_year, payroll_month, 1)
        active_salary_structure: List[EmployeeSalaryStructure] = crud_payroll.get_active_employee_salary_structure(
            self.db, employee.id, for_date
        )

        if not active_salary_structure:
            print(
                f"SVC_PAYROLL_CALC: WARNING - No active salary structure for EmpID: {employee.id} for {for_date}. Skipping payslip.")
            return None

        print(
            f"SVC_PAYROLL_CALC: EmpID {employee.id} - Active structure found with {len(active_salary_structure)} components.")
        # for item in active_salary_structure: print(f"  - Comp: {item.component.name}, Amt: {item.amount}")

        earnings: List[Dict[str, Any]] = []
        deductions: List[Dict[str, Any]] = []
        gross_earnings_total = 0.0
        fixed_deductions_total = 0.0
        base_for_variable_calc: Dict[str, float] = {}

        for item in active_salary_structure:
            component = item.component
            if not component:  # Should not happen with correct DB relations
                print(
                    f"SVC_PAYROLL_CALC: Warning - Salary structure item ID {item.id} for EmpID {employee.id} missing component link. Skipping item.")
                continue

            if component.type == SalaryComponentTypeEnum.EARNING_FIXED:
                earnings.append({"name": component.name, "amount": item.amount, "type": component.type.value})
                gross_earnings_total += item.amount
                base_for_variable_calc[component.name.upper().replace(" ", "_")] = item.amount
                print(f"SVC_PAYROLL_CALC: EmpID {employee.id} - Added Earning: {component.name}, Amount: {item.amount}")
            elif component.type == SalaryComponentTypeEnum.DEDUCTION_FIXED:
                deductions.append({"name": component.name, "amount": item.amount, "type": component.type.value})
                fixed_deductions_total += item.amount
                print(
                    f"SVC_PAYROLL_CALC: EmpID {employee.id} - Added Fixed Deduction: {component.name}, Amount: {item.amount}")

        current_total_deductions = fixed_deductions_total
        print(
            f"SVC_PAYROLL_CALC: EmpID {employee.id} - Initial Gross: {gross_earnings_total}, Initial Fixed Deductions: {fixed_deductions_total}")

        paid_leave_days_this_month = self._get_leave_days_for_month_by_type(employee.id, payroll_year, payroll_month,
                                                                            is_paid_leave=True)
        unpaid_leave_days_this_month = self._get_leave_days_for_month_by_type(employee.id, payroll_year, payroll_month,
                                                                              is_paid_leave=False)

        total_calendar_days_in_month = float(self._get_days_in_month(payroll_year, payroll_month))
        lop_calculation_base_days = total_calendar_days_in_month

        lop_deduction_amount = 0.0
        # Define LOP base salary (e.g., sum of specific earning components like Basic, or entire fixed gross)
        lop_base_salary_for_calc = sum(
            item.amount for item in active_salary_structure
            if item.component and item.component.type == SalaryComponentTypeEnum.EARNING_FIXED
            # and item.component.name in ["BASIC", "Basic Salary (PyScript)"] # Add specific component names if LOP is on subset
        )
        print(f"SVC_PAYROLL_CALC: EmpID {employee.id} - LOP Base Salary for Calc: {lop_base_salary_for_calc}")

        if unpaid_leave_days_this_month > 0 and lop_base_salary_for_calc > 0 and lop_calculation_base_days > 0:
            per_day_lop_salary = lop_base_salary_for_calc / lop_calculation_base_days
            lop_deduction_amount = round(per_day_lop_salary * unpaid_leave_days_this_month, 2)
            if lop_deduction_amount > 0:
                deductions.append({
                    "name": "Loss of Pay", "amount": lop_deduction_amount,
                    "type": SalaryComponentTypeEnum.DEDUCTION_VARIABLE.value,
                    "meta": {"unpaid_days": unpaid_leave_days_this_month}
                })
                current_total_deductions += lop_deduction_amount
        print(
            f"SVC_PAYROLL_CALC: EmpID {employee.id} - Paid Leaves: {paid_leave_days_this_month}, Unpaid Leaves: {unpaid_leave_days_this_month}, LOP Deduction: {lop_deduction_amount}")

        # Variable Earnings (after LOP if LOP reduces the base for variable pay)
        for item in active_salary_structure:
            component = item.component
            if component and component.type == SalaryComponentTypeEnum.EARNING_VARIABLE:
                variable_amount = item.amount  # Assuming item.amount is the direct variable pay value
                earnings.append({"name": component.name, "amount": variable_amount, "type": component.type.value})
                gross_earnings_total += variable_amount
                print(
                    f"SVC_PAYROLL_CALC: EmpID {employee.id} - Added Variable Earning: {component.name}, Amount: {variable_amount}")

        # Statutory Deductions
        # effective_gross_for_statutory = gross_earnings_total # Or gross_earnings_total - lop_deduction_amount depending on rules
        # For PF, often based on Basic (+DA). Let's use the 'base_for_variable_calc'
        pf_employee_contribution = 0.0
        basic_salary_key_for_pf = "BASIC_SALARY_(PYSCRIPT)"  # Ensure this matches your component name EXACTLY
        basic_salary_value = base_for_variable_calc.get(basic_salary_key_for_pf, 0.0)

        if basic_salary_value > 0:  # And employee is eligible for PF (add eligibility check if needed)
            pf_rate = 0.12
            pf_statutory_ceiling = 15000.00
            pf_base = min(basic_salary_value, pf_statutory_ceiling)
            pf_employee_contribution = round(pf_base * pf_rate, 2)
            if pf_employee_contribution > 0:
                deductions.append({
                    "name": "Provident Fund (PF)", "amount": pf_employee_contribution,
                    "type": SalaryComponentTypeEnum.STATUTORY_DEDUCTION.value
                })
                current_total_deductions += pf_employee_contribution
                print(
                    f"SVC_PAYROLL_CALC: EmpID {employee.id} - PF: {pf_employee_contribution} (Base: {basic_salary_value}, Statutory Base for PF: {pf_base})")

        # Placeholder for ESI, TDS (these would have their own complex logic)
        # ...

        net_salary = round(gross_earnings_total - current_total_deductions, 2)
        print(
            f"SVC_PAYROLL_CALC: EmpID {employee.id} - Final Gross: {gross_earnings_total}, Final Total Deductions: {current_total_deductions}, Net Salary: {net_salary}")

        days_present_actual = total_calendar_days_in_month - unpaid_leave_days_this_month - paid_leave_days_this_month

        payslip_data_obj = Payslip(
            employee_id=employee.id,
            payroll_run_id=payroll_run_id,
            gross_earnings=round(gross_earnings_total, 2),
            total_deductions=round(current_total_deductions, 2),
            net_salary=net_salary,
            salary_details={"earnings": earnings, "deductions": deductions},
            total_working_days_in_month=total_calendar_days_in_month,  # Or actual working days based on policy
            days_present=max(0, days_present_actual),  # Ensure not negative
            paid_leave_days=paid_leave_days_this_month,
            unpaid_leave_days=unpaid_leave_days_this_month,
            loss_of_pay_deduction=lop_deduction_amount,
        )

        try:
            print(f"SVC_PAYROLL_CALC: Attempting to save payslip for EmpID {employee.id}")
            created_payslip = crud_payroll.create_payslip(self.db,
                                                          payslip_data_obj)  # create_payslip takes the Payslip object
            print(f"SVC_PAYROLL_CALC: SUCCESS - Payslip ID {created_payslip.id} created for EmpID {employee.id}")
            return created_payslip
        except Exception as e:
            print(f"SVC_PAYROLL_CALC: ERROR - Failed to save payslip for EmpID {employee.id}: {e}")
            import traceback
            traceback.print_exc()  # Print full traceback for DB errors
            return None

    def process_payroll_run(self, payroll_run: PayrollRun, employee_ids: Optional[List[int]] = None):
        print(
            f"SVC_PAYROLL_PROCESS: ==> Processing Payroll Run ID: {payroll_run.id} for Month: {payroll_run.month:02d}/{payroll_run.year}")
        if payroll_run.status not in [PayrollRunStatus.DRAFT, PayrollRunStatus.REJECTED]:
            print(f"SVC_PAYROLL_PROCESS: Cannot process payroll run with status {payroll_run.status.value}. Skipping.")
            return

        existing_payslips = crud_payroll.get_payslips_for_run(self.db, payroll_run.id)
        if existing_payslips:
            print(
                f"SVC_PAYROLL_PROCESS: Deleting {len(existing_payslips)} existing payslips for re-processing Run ID {payroll_run.id}")
            for ps in existing_payslips:
                self.db.delete(ps)
            self.db.commit()

        if employee_ids:
            print(f"SVC_PAYROLL_PROCESS: Processing for specific employee IDs: {employee_ids}")
            employees_to_process_raw = [crud_employee.get_employee_profile(self.db, eid) for eid in employee_ids]
            employees_to_process = [emp for emp in employees_to_process_raw if emp]
        else:
            print(f"SVC_PAYROLL_PROCESS: Processing for all active employees.")
            all_profiles = crud_employee.get_employee_profiles(self.db, limit=10000)  # Adjust limit as needed
            employees_to_process = [emp for emp in all_profiles if emp.employment_status == EmploymentStatus.ACTIVE]

        if not employees_to_process:
            print("SVC_PAYROLL_PROCESS: No employees found to process for this run.")
            crud_payroll.update_payroll_run_status(self.db, payroll_run, PayrollRunStatus.DRAFT,
                                                   notes="No employees found/eligible for processing.")
            return

        print(
            f"SVC_PAYROLL_PROCESS: Will process payroll for {len(employees_to_process)} employee(s): {[e.id for e in employees_to_process]}")
        payslips_created_count = 0
        for emp_profile_to_process in employees_to_process:
            if not emp_profile_to_process:  # Should have been filtered by 'if emp' above, but defensive
                continue
            # Crucially, pass the ORM object emp_profile_to_process
            payslip = self.calculate_employee_payroll(emp_profile_to_process, payroll_run.month, payroll_run.year,
                                                      payroll_run.id)
            if payslip:
                payslips_created_count += 1

        print(
            f"SVC_PAYROLL_PROCESS: Finished calculations. Total payslips successfully created: {payslips_created_count} out of {len(employees_to_process)} considered.")

        if payslips_created_count > 0:
            crud_payroll.update_payroll_run_status(self.db, payroll_run, PayrollRunStatus.PENDING_APPROVAL,
                                                   notes=f"{payslips_created_count} payslips generated.")
        else:
            crud_payroll.update_payroll_run_status(self.db, payroll_run, PayrollRunStatus.DRAFT,
                                                   notes="No payslips were generated (e.g., no active structure, not active, or calculation error).")
        print(f"SVC_PAYROLL_PROCESS: Payroll Run ID: {payroll_run.id} status updated to {payroll_run.status.value}")