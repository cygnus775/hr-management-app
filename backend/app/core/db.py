# hr_software/app/core/db.py
from sqlmodel import create_engine, SQLModel, Session
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=True)


def create_db_and_tables():
    print("Importing all models for table creation...")
    # Enums are not tables, so no need to import from app.models.enums here for table creation

    # --- User Module ---
    from app.models.user import User  # noqa: F401

    # --- Employee Module ---
    from app.models.employee import Department  # noqa: F401
    from app.models.employee import EmployeeProfile  # noqa: F401
    from app.models.employee import EmployeeDocument  # noqa: F401

    # --- Workflow Module ---
    from app.models.workflow import WorkflowTemplate  # noqa: F401
    from app.models.workflow import WorkflowStepTemplate  # noqa: F401
    from app.models.workflow import EmployeeWorkflow  # noqa: F401
    from app.models.workflow import EmployeeWorkflowStep  # noqa: F401

    # --- Leave & Attendance Module ---
    from app.models.leave import LeaveType  # noqa: F401
    from app.models.leave import LeaveBalance  # noqa: F401
    from app.models.leave import LeaveRequest  # noqa: F401
    from app.models.leave import Holiday  # noqa: F401

    # --- Payroll Module ---
    from app.models.payroll import SalaryComponent  # noqa: F401
    from app.models.payroll import EmployeeSalaryStructure  # noqa: F401
    from app.models.payroll import PayrollRun  # noqa: F401
    from app.models.payroll import Payslip  # noqa: F401

    # --- Performance Management Module ---
    from app.models.performance import Goal  # noqa: F401
    from app.models.performance import AppraisalCycle  # noqa: F401
    from app.models.performance import PerformanceReview  # noqa: F401

    print("Creating all database tables via SQLModel.metadata.create_all()...")
    SQLModel.metadata.create_all(engine)
    print("Database tables created (or already exist).")


def get_db():
    with Session(engine) as session:
        yield session