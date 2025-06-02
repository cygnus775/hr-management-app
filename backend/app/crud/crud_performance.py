from sqlmodel import Session, select, and_
from typing import List, Optional
from datetime import date, datetime

from app.models.performance import Goal, GoalStatus, AppraisalCycle, AppraisalCycleStatus, PerformanceReview
from app.models.employee import EmployeeProfile # For joins/filters

from app.schemas.performance import (
    GoalCreate, GoalUpdate,
    AppraisalCycleCreate, AppraisalCycleUpdate,
    # PerformanceReviewCreate is not directly used, reviews are created by service
)

# --- Goal CRUD ---
def get_goal(db: Session, goal_id: int) -> Goal | None:
    return db.get(Goal, goal_id)

def get_goals_by_employee(db: Session, employee_id: int, cycle_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[Goal]:
    statement = select(Goal).where(Goal.employee_id == employee_id)
    if cycle_id:
        statement = statement.where(Goal.appraisal_cycle_id == cycle_id)
    statement = statement.order_by(Goal.due_date.asc(), Goal.id.asc()).offset(skip).limit(limit)
    return db.exec(statement).all()

def get_goals_for_manager_team(db: Session, manager_id: int, cycle_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[Goal]:
    # Assuming EmployeeProfile has manager_id correctly set
    statement = (
        select(Goal)
        .join(EmployeeProfile, Goal.employee_id == EmployeeProfile.id)
        .where(EmployeeProfile.manager_id == manager_id)
    )
    if cycle_id:
        statement = statement.where(Goal.appraisal_cycle_id == cycle_id)
    statement = statement.order_by(EmployeeProfile.id, Goal.due_date.asc()).offset(skip).limit(limit)
    return db.exec(statement).all()


def create_goal(db: Session, goal_in: GoalCreate, employee_id: int) -> Goal:
    # goal_in might not have employee_id if it's part of URL path
    db_goal = Goal.model_validate(goal_in, update={"employee_id": employee_id})
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

def update_goal(db: Session, db_goal: Goal, goal_in: GoalUpdate) -> Goal:
    update_data = goal_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_goal, key, value)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

def delete_goal(db: Session, goal_id: int) -> Goal | None:
    goal = db.get(Goal, goal_id)
    if goal:
        db.delete(goal)
        db.commit()
    return goal

# --- AppraisalCycle CRUD ---
def get_appraisal_cycle(db: Session, cycle_id: int) -> AppraisalCycle | None:
    return db.get(AppraisalCycle, cycle_id)

def get_appraisal_cycle_by_name(db: Session, name: str) -> AppraisalCycle | None:
    return db.exec(select(AppraisalCycle).where(AppraisalCycle.name == name)).first()

def get_appraisal_cycles(db: Session, status: Optional[AppraisalCycleStatus] = None, skip: int = 0, limit: int = 100) -> List[AppraisalCycle]:
    statement = select(AppraisalCycle)
    if status:
        statement = statement.where(AppraisalCycle.status == status)
    statement = statement.order_by(AppraisalCycle.start_date.desc()).offset(skip).limit(limit)
    return db.exec(statement).all()

def create_appraisal_cycle(db: Session, cycle_in: AppraisalCycleCreate) -> AppraisalCycle:
    db_cycle = AppraisalCycle.model_validate(cycle_in)
    db.add(db_cycle)
    db.commit()
    db.refresh(db_cycle)
    return db_cycle

def update_appraisal_cycle(db: Session, db_cycle: AppraisalCycle, cycle_in: AppraisalCycleUpdate) -> AppraisalCycle:
    update_data = cycle_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_cycle, key, value)
    db.add(db_cycle)
    db.commit()
    db.refresh(db_cycle)
    return db_cycle

# --- PerformanceReview CRUD ---
def get_performance_review(db: Session, review_id: int) -> PerformanceReview | None:
    return db.get(PerformanceReview, review_id)

def get_performance_review_for_employee_cycle(db: Session, employee_id: int, cycle_id: int) -> PerformanceReview | None:
    statement = select(PerformanceReview).where(
        PerformanceReview.employee_id == employee_id,
        PerformanceReview.appraisal_cycle_id == cycle_id
    )
    return db.exec(statement).first()

def get_reviews_for_cycle(db: Session, cycle_id: int, skip: int = 0, limit: int = 100) -> List[PerformanceReview]:
    statement = select(PerformanceReview).where(PerformanceReview.appraisal_cycle_id == cycle_id).offset(skip).limit(limit)
    return db.exec(statement).all()

def get_reviews_for_manager_cycle(db: Session, manager_id: int, cycle_id: int, skip: int = 0, limit: int = 100) -> List[PerformanceReview]:
    statement = select(PerformanceReview).where(
        PerformanceReview.manager_id == manager_id, # Manager is the one conducting the review
        PerformanceReview.appraisal_cycle_id == cycle_id
    ).offset(skip).limit(limit)
    return db.exec(statement).all()

def create_performance_review_entry(db: Session, cycle_id: int, employee_id: int, manager_id: int) -> PerformanceReview:
    # Check if one already exists
    existing = get_performance_review_for_employee_cycle(db, employee_id, cycle_id)
    if existing:
        return existing # Or raise error if re-creation is not allowed

    db_review = PerformanceReview(
        appraisal_cycle_id=cycle_id,
        employee_id=employee_id,
        manager_id=manager_id,
        review_status="pending_self_evaluation" # Initial status
    )
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def submit_self_evaluation(db: Session, db_review: PerformanceReview, self_eval_text: Optional[str], self_eval_rating: Optional[float]) -> PerformanceReview:
    db_review.self_evaluation_text = self_eval_text
    db_review.self_evaluation_rating = self_eval_rating
    db_review.self_evaluation_submitted_on = datetime.utcnow()
    db_review.review_status = "pending_manager_feedback" # Next step
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def submit_manager_feedback(db: Session, db_review: PerformanceReview, manager_feedback_text: Optional[str], manager_rating: Optional[float]) -> PerformanceReview:
    db_review.manager_feedback_text = manager_feedback_text
    db_review.manager_rating = manager_rating
    db_review.manager_feedback_submitted_on = datetime.utcnow()
    db_review.review_status = "pending_discussion" # Or "completed" if no discussion phase
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review

def update_review_status(db: Session, db_review: PerformanceReview, new_status: str) -> PerformanceReview:
    # Add validation for allowed status transitions
    db_review.review_status = new_status
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review