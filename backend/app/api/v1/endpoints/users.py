# hr_software/app/api/v1/endpoints/users.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List, Any  # Added List

from app.crud import crud_user, crud_employee, crud_workflow  # Added crud_workflow
from app.schemas.user import UserCreate, UserRead
from app.schemas.employee import EmployeeProfileCreate  # To create profile along with user
from app.models.user import User  # User ORM model
from app.models.enums import UserRole, EmploymentStatus  # Import Enums
from app.core.db import get_db
from app.api import deps

router = APIRouter()


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user_and_profile(
        *,
        db: Session = Depends(get_db),
        user_in: UserCreate,
        # current_user: User = Depends(deps.allow_admin_only) # Typically protected, uncomment for production
):
    """
    Create new user. If the role is EMPLOYEE or MANAGER, also create an
    associated EmployeeProfile and assign relevant workflows.
    """
    db_user_check = crud_user.get_user_by_email(db, email=user_in.email)
    if db_user_check:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    created_user_orm = crud_user.create_user(db=db, user_in=user_in)

    if created_user_orm.role in [UserRole.EMPLOYEE, UserRole.MANAGER]:
        # Define the initial status for new employee profiles
        initial_employment_status = EmploymentStatus.ONBOARDING

        profile_in_data = EmployeeProfileCreate(
            user_id=created_user_orm.id,
            employment_status=initial_employment_status
            # job_title, department_id, etc., can be set here or updated later
        )
        try:
            employee_profile_orm = crud_employee.create_employee_profile(db=db, employee_in=profile_in_data)
            print(
                f"Employee profile created for user: {created_user_orm.email} with status {employee_profile_orm.employment_status.value}")

            # --- Auto-assign workflow on initial profile creation ---
            if employee_profile_orm and employee_profile_orm.employment_status:
                template_to_assign = crud_workflow.get_workflow_template_by_trigger_status(db,
                                                                                           employee_profile_orm.employment_status)
                if template_to_assign:
                    assigned = crud_workflow.assign_workflow_to_employee(db, employee_profile_orm.id,
                                                                         template_to_assign.id)
                    if assigned:
                        print(
                            f"Auto-assigned workflow '{template_to_assign.name}' to new employee {employee_profile_orm.id} for status {employee_profile_orm.employment_status.value}")
                    else:
                        print(
                            f"Failed to auto-assign workflow for {employee_profile_orm.id} and status {employee_profile_orm.employment_status.value}")
            # --- End auto-assign ---

        except ValueError as e:
            # If profile creation fails (e.g., already exists, though less likely for a new user)
            # Consider if the user record should be rolled back or if this is just a warning
            print(f"Warning: Could not create employee profile for {created_user_orm.email}: {e}")
            # For now, we let the user be created, profile might need manual creation/linking.

    return created_user_orm