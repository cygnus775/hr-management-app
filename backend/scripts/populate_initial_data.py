# hr_software/scripts/populate_initial_data.py
import asyncio
from sqlmodel import Session, SQLModel, create_engine, select # <--- IMPORT select HERE
from app.core.config import settings
from app.core.db import engine as main_engine
from app.core.security import get_password_hash

# Import necessary models
from app.models.user import User, UserRole
from app.models.employee import Department, EmployeeProfile, EmploymentStatus

from datetime import date, timedelta

def create_department_if_not_exists(db: Session, name: str, description: str) -> Department:
    # Use sqlmodel.select() function
    statement = select(Department).where(Department.name == name) # <--- CORRECTED
    dept = db.exec(statement).first()
    if not dept:
        dept = Department(name=name, description=description)
        db.add(dept)
        db.commit()
        db.refresh(dept)
        print(f"Department '{name}' created.")
    else:
        print(f"Department '{name}' already exists.")
    return dept

def create_user_with_profile_if_not_exists(
    db: Session,
    email: str,
    first_name: str,
    last_name: str,
    password: str,
    role: UserRole,
    job_title: str,
    department: Department,
    manager_profile_id: int | None = None,
    hire_date_offset_days: int = 30
) -> tuple[User | None, EmployeeProfile | None]:
    # Use sqlmodel.select() function
    user_statement = select(User).where(User.email == email) # <--- CORRECTED
    user = db.exec(user_statement).first()
    profile = None
    if not user:
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            hashed_password=get_password_hash(password),
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"User '{email}' ({role.value}) created.")

        if user and department:
            profile = EmployeeProfile(
                user_id=user.id,
                job_title=job_title,
                employment_status=EmploymentStatus.ACTIVE,
                hire_date=date.today() - timedelta(days=hire_date_offset_days),
                department_id=department.id,
                manager_id=manager_profile_id
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            print(f"Employee profile for '{email}' created.")
    else:
        print(f"User '{email}' already exists.")
        # If user exists, try to get their profile.
        # SQLModel relationships usually load related objects, but if it's a simple script, explicit fetch might be needed.
        # For one-to-one, user.employee_profile should work if relationship is set up correctly.
        if user: # Check if user object is not None
            # Accessing via relationship (preferred if setup correctly)
            related_profile = user.employee_profile
            if isinstance(related_profile, list) and related_profile:
                profile = related_profile[0]
            elif isinstance(related_profile, EmployeeProfile): # Direct one-to-one object
                profile = related_profile
            else: # Fallback if relationship isn't loaded or setup as one-to-one as expected by this logic
                 profile_statement = select(EmployeeProfile).where(EmployeeProfile.user_id == user.id)
                 profile = db.exec(profile_statement).first()

    return user, profile


def populate_core_users(db: Session):
    print("Populating core users and departments...")

    # 1. Create Departments
    hr_dept = create_department_if_not_exists(db, "Human Resources", "Handles all HR functions")
    eng_dept = create_department_if_not_exists(db, "Engineering", "Software development and R&D")
    sales_dept = create_department_if_not_exists(db, "Sales", "Client acquisition and revenue")

    # 2. Create Admin User
    admin_user, admin_profile = create_user_with_profile_if_not_exists( # Capture profile
        db,
        email="admin@hrflow.com",
        first_name="App",
        last_name="Admin",
        password="AdminPa$$wOrd!",
        role=UserRole.ADMIN,
        job_title="System Administrator",
        department=hr_dept,
        hire_date_offset_days=90
    )

    # 3. Create Manager User
    manager_user, manager_profile = create_user_with_profile_if_not_exists(
        db,
        email="manager.eng@hrflow.com",
        first_name="Eng",
        last_name="Manager",
        password="ManagerPa$$wOrd!",
        role=UserRole.MANAGER,
        job_title="Engineering Manager",
        department=eng_dept,
        hire_date_offset_days=60
    )

    # 4. Create Employee Users
    # Ensure manager_profile is not None before trying to access its id
    manager_profile_actual_id = manager_profile.id if manager_profile else None

    if manager_profile_actual_id: # Only create direct report if manager profile exists and has an ID
        emp1_user, _ = create_user_with_profile_if_not_exists(
            db,
            email="dev.one@hrflow.com",
            first_name="Dev",
            last_name="One",
            password="DevPa$$wOrd!",
            role=UserRole.EMPLOYEE,
            job_title="Software Engineer",
            department=eng_dept,
            manager_profile_id=manager_profile_actual_id, # Assign manager
            hire_date_offset_days=30
        )

    emp2_user, _ = create_user_with_profile_if_not_exists(
        db,
        email="sales.rep@hrflow.com",
        first_name="Sales",
        last_name="Rep",
        password="SalesPa$$wOrd!",
        role=UserRole.EMPLOYEE,
        job_title="Sales Representative",
        department=sales_dept,
        hire_date_offset_days=15
    )

    print("Core user and department population complete.")


async def main():
    print(f"Connecting to database: {settings.DATABASE_URL}")
    SQLModel.metadata.create_all(main_engine)

    with Session(main_engine) as session:
        populate_core_users(session)

if __name__ == "__main__":
    asyncio.run(main())