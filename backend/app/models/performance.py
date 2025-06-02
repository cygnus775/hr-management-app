# hr_software/app/models/performance.py
from sqlmodel import Field, SQLModel, Relationship, Column, TEXT
from sqlalchemy import Enum as SQLAlchemyEnum # Added
from typing import Optional, List, TYPE_CHECKING
from datetime import date, datetime

# Import Enums from the new centralized file
from .enums import GoalStatus, AppraisalCycleStatus

if TYPE_CHECKING:
    from .employee import EmployeeProfile
    # from .user import User # If any direct user links other than via EmployeeProfile

class GoalBase(SQLModel):
    employee_id: int = Field(foreign_key="employeeprofile.id")
    appraisal_cycle_id: Optional[int] = Field(default=None, foreign_key="appraisalcycle.id", nullable=True)
    title: str
    description: Optional[str] = Field(sa_column=Column(TEXT), default=None)
    key_performance_indicator: Optional[str] = Field(default=None)
    target_value: Optional[str] = Field(default=None)
    start_date: Optional[date] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    status: GoalStatus = Field( # Uses enum from enums.py
        default=GoalStatus.NOT_STARTED,
        sa_column=Column(SQLAlchemyEnum(GoalStatus, name="goal_status_enum", create_constraint=True))
    )
    weightage: Optional[float] = Field(default=None, ge=0, le=100)

class Goal(GoalBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    employee: "EmployeeProfile" = Relationship()
    appraisal_cycle: Optional["AppraisalCycle"] = Relationship(back_populates="goals")

class AppraisalCycleBase(SQLModel):
    name: str = Field(unique=True)
    start_date: date
    end_date: date
    feedback_start_date: Optional[date] = Field(default=None)
    feedback_end_date: Optional[date] = Field(default=None)
    status: AppraisalCycleStatus = Field( # Uses enum from enums.py
        default=AppraisalCycleStatus.DRAFT,
        sa_column=Column(SQLAlchemyEnum(AppraisalCycleStatus, name="appraisal_cycle_status_enum", create_constraint=True))
    )
    description: Optional[str] = Field(sa_column=Column(TEXT), default=None)

class AppraisalCycle(AppraisalCycleBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    performance_reviews: List["PerformanceReview"] = Relationship(back_populates="appraisal_cycle")
    goals: List[Goal] = Relationship(back_populates="appraisal_cycle") # Direct type

class PerformanceReviewBase(SQLModel):
    appraisal_cycle_id: int = Field(foreign_key="appraisalcycle.id")
    employee_id: int = Field(foreign_key="employeeprofile.id")
    manager_id: int = Field(foreign_key="employeeprofile.id") # Manager conducting review
    self_evaluation_text: Optional[str] = Field(sa_column=Column(TEXT), default=None)
    self_evaluation_rating: Optional[float] = Field(default=None, ge=1, le=5)
    self_evaluation_submitted_on: Optional[datetime] = Field(default=None)
    manager_feedback_text: Optional[str] = Field(sa_column=Column(TEXT), default=None)
    manager_rating: Optional[float] = Field(default=None, ge=1, le=5)
    manager_feedback_submitted_on: Optional[datetime] = Field(default=None)
    review_status: str = Field(default="pending_self_evaluation") # Consider making this an Enum too

class PerformanceReview(PerformanceReviewBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    appraisal_cycle: AppraisalCycle = Relationship(back_populates="performance_reviews") # Direct type
    employee: "EmployeeProfile" = Relationship(sa_relationship_kwargs=dict(foreign_keys="PerformanceReview.employee_id"))
    manager: "EmployeeProfile" = Relationship(sa_relationship_kwargs=dict(foreign_keys="PerformanceReview.manager_id"))

# --- Model Rebuild Section ---
from .employee import EmployeeProfile

Goal.model_rebuild()
AppraisalCycle.model_rebuild()
PerformanceReview.model_rebuild()