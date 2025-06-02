from pydantic import BaseModel, Field as PydanticField, validator
from typing import Optional, List
from datetime import date, datetime
from app.models.performance import GoalStatus, GoalBase, AppraisalCycleStatus, AppraisalCycleBase, PerformanceReviewBase

# --- Goal Schemas ---
class GoalCreate(GoalBase):
    # employee_id will be set based on context or path param
    # appraisal_cycle_id can be optional
    pass

class GoalRead(GoalBase):
    id: int
    # employee_name: Optional[str] = None (can be added in endpoint)
    # appraisal_cycle_name: Optional[str] = None (can be added in endpoint)

class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    key_performance_indicator: Optional[str] = None
    target_value: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    status: Optional[GoalStatus] = None
    weightage: Optional[float] = PydanticField(default=None, ge=0, le=100)


# --- AppraisalCycle Schemas ---
class AppraisalCycleCreate(AppraisalCycleBase):
    pass

class AppraisalCycleRead(AppraisalCycleBase):
    id: int

class AppraisalCycleUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    feedback_start_date: Optional[date] = None
    feedback_end_date: Optional[date] = None
    status: Optional[AppraisalCycleStatus] = None
    description: Optional[str] = None


# --- PerformanceReview Schemas ---
class PerformanceReviewCreatePayload(BaseModel): # For initiating reviews in a cycle
    employee_ids: List[int] # List of employees to include in this review cycle

class PerformanceReviewRead(PerformanceReviewBase):
    id: int
    employee_name: str
    manager_name: str
    appraisal_cycle_name: str

class SelfEvaluationSubmit(BaseModel):
    self_evaluation_text: Optional[str] = None
    self_evaluation_rating: Optional[float] = PydanticField(default=None, ge=1, le=5)

class ManagerFeedbackSubmit(BaseModel):
    manager_feedback_text: Optional[str] = None
    manager_rating: Optional[float] = PydanticField(default=None, ge=1, le=5)