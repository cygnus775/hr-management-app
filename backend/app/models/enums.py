# hr_software/app/models/enums.py
from enum import Enum as PythonBaseEnum

# --- User Enums ---
class UserRole(str, PythonBaseEnum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

# --- Employee Enums ---
class EmploymentStatus(str, PythonBaseEnum):
    ACTIVE = "active"
    RESIGNED = "resigned"
    TERMINATED = "terminated"
    ON_NOTICE = "on_notice"
    ONBOARDING = "onboarding"

class DocumentType(str, PythonBaseEnum):
    ID_PROOF = "id_proof"
    OFFER_LETTER = "offer_letter"
    CONTRACT = "contract"
    POLICY_ACKNOWLEDGEMENT = "policy_acknowledgement"
    OTHER = "other"

# --- Workflow Enums ---
class WorkflowType(str, PythonBaseEnum):
    ONBOARDING = "onboarding"
    OFFBOARDING = "offboarding"
    OTHER = "other"

class EmployeeWorkflowStatus(str, PythonBaseEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class EmployeeWorkflowStepStatus(str, PythonBaseEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    SKIPPED = "skipped"

# --- Leave Enums ---
class LeaveTypeName(str, PythonBaseEnum):
    ANNUAL = "annual"
    SICK = "sick"
    CASUAL = "casual"
    UNPAID = "unpaid"
    MATERNITY = "maternity"
    PATERNITY = "paternity"
    OTHER = "other"

class LeaveRequestStatus(str, PythonBaseEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

# --- Payroll Enums ---
class SalaryComponentType(str, PythonBaseEnum):
    EARNING_FIXED = "earning_fixed"
    EARNING_VARIABLE = "earning_variable"
    DEDUCTION_FIXED = "deduction_fixed"
    DEDUCTION_VARIABLE = "deduction_variable"
    STATUTORY_DEDUCTION = "statutory_deduction"

class PayrollRunStatus(str, PythonBaseEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    PROCESSED = "processed"
    PAID = "paid"
    REJECTED = "rejected"

# --- Performance Enums ---
class GoalStatus(str, PythonBaseEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"

class AppraisalCycleStatus(str, PythonBaseEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    FEEDBACK_COLLECTION = "feedback_collection"
    REVIEW_MEETING = "review_meeting"
    CLOSED = "closed"
    ARCHIVED = "archived"