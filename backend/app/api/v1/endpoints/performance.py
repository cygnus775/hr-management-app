from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel import Session
from typing import List, Optional

from app.core.db import get_db
from app.api import deps
from app.models.user import User, UserRole
from app.models.employee import EmployeeProfile
from app.models.performance import GoalStatus, AppraisalCycleStatus  # Import enums
from app.schemas.performance import (
    GoalCreate, GoalRead, GoalUpdate,
    AppraisalCycleCreate, AppraisalCycleRead, AppraisalCycleUpdate,
    PerformanceReviewCreatePayload, PerformanceReviewRead,
    SelfEvaluationSubmit, ManagerFeedbackSubmit
)
from app.crud import crud_performance, crud_employee  # crud_employee needed to get manager info
from app.crud.crud_user import get_user  # To get names

router = APIRouter()


# --- Goal Endpoints ---
@router.post("/goals/employee/{employee_id}", response_model=GoalRead)
def create_employee_goal_api(
        employee_id: int,
        goal_in: GoalCreate,  # appraisal_cycle_id is in GoalCreate and optional
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_admin_or_manager)  # Admin or Manager can set goals
):
    emp_profile = crud_employee.get_employee_profile(db, employee_id)
    if not emp_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    # Authorization: Admin can set for anyone. Manager for their direct reports.
    if current_user.role == UserRole.MANAGER:
        if not current_user.employee_profile or emp_profile.manager_id != current_user.employee_profile.id:
            raise HTTPException(status_code=403, detail="Manager can only set goals for their direct reports.")

    if goal_in.appraisal_cycle_id:
        cycle = crud_performance.get_appraisal_cycle(db, goal_in.appraisal_cycle_id)
        if not cycle:
            raise HTTPException(status_code=404, detail="Appraisal cycle not found.")
        if cycle.status not in [AppraisalCycleStatus.ACTIVE, AppraisalCycleStatus.DRAFT]:  # Or other relevant statuses
            raise HTTPException(status_code=400, detail=f"Cannot add goals to a cycle with status {cycle.status.value}")

    # goal_in doesn't have employee_id, it's passed from path
    # The GoalCreate schema includes appraisal_cycle_id
    created_goal = crud_performance.create_goal(db, goal_in=goal_in, employee_id=employee_id)
    return created_goal


@router.get("/goals/my", response_model=List[GoalRead])
def get_my_goals_api(
        cycle_id: Optional[int] = Query(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found for current user.")
    return crud_performance.get_goals_by_employee(db, current_user.employee_profile.id, cycle_id)


@router.get("/goals/employee/{employee_id}", response_model=List[GoalRead])
def get_employee_goals_api(
        employee_id: int,
        cycle_id: Optional[int] = Query(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_admin_or_manager)
):
    emp_profile = crud_employee.get_employee_profile(db, employee_id)
    if not emp_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found.")

    if current_user.role == UserRole.MANAGER:
        if not current_user.employee_profile or emp_profile.manager_id != current_user.employee_profile.id:
            raise HTTPException(status_code=403, detail="Manager can only view goals of their direct reports.")

    return crud_performance.get_goals_by_employee(db, employee_id, cycle_id)


@router.get("/goals/team", response_model=List[GoalRead], dependencies=[Depends(deps.allow_manager_only)])
def get_team_goals_api(  # Manager views goals of their team
        cycle_id: Optional[int] = Query(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_manager_only)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=403, detail="Manager profile not found.")
    return crud_performance.get_goals_for_manager_team(db, current_user.employee_profile.id, cycle_id)


@router.put("/goals/{goal_id}", response_model=GoalRead)
def update_goal_api(
        goal_id: int,
        goal_in: GoalUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
        # Employee can update own, Manager/Admin can update others
):
    db_goal = crud_performance.get_goal(db, goal_id)
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found.")

    # Authorization
    is_own_goal = current_user.employee_profile and db_goal.employee_id == current_user.employee_profile.id

    emp_profile_of_goal_owner = crud_employee.get_employee_profile(db, db_goal.employee_id)
    is_manager_of_goal_owner = (current_user.role == UserRole.MANAGER and
                                current_user.employee_profile and
                                emp_profile_of_goal_owner and
                                emp_profile_of_goal_owner.manager_id == current_user.employee_profile.id)

    if not (is_own_goal or is_manager_of_goal_owner or current_user.role == UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized to update this goal.")

    # Prevent changing employee_id or appraisal_cycle_id via this update if needed
    # if goal_in.employee_id or goal_in.appraisal_cycle_id: # Not in GoalUpdate schema

    return crud_performance.update_goal(db, db_goal, goal_in)


# --- AppraisalCycle Endpoints (Admin only) ---
@router.post("/cycles/", response_model=AppraisalCycleRead, dependencies=[Depends(deps.allow_admin_only)])
def create_appraisal_cycle_api(cycle_in: AppraisalCycleCreate, db: Session = Depends(get_db)):
    existing = crud_performance.get_appraisal_cycle_by_name(db, cycle_in.name)
    if existing:
        raise HTTPException(status_code=400, detail="Appraisal cycle with this name already exists.")
    return crud_performance.create_appraisal_cycle(db, cycle_in)


@router.get("/cycles/", response_model=List[AppraisalCycleRead], dependencies=[Depends(deps.allow_all_authenticated)])
def read_appraisal_cycles_api(
        status: Optional[AppraisalCycleStatus] = Query(None),
        db: Session = Depends(get_db),
        skip: int = 0, limit: int = 100
):
    return crud_performance.get_appraisal_cycles(db, status, skip, limit)


@router.get("/cycles/{cycle_id}", response_model=AppraisalCycleRead,
            dependencies=[Depends(deps.allow_all_authenticated)])
def read_appraisal_cycle_api(cycle_id: int, db: Session = Depends(get_db)):
    cycle = crud_performance.get_appraisal_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Appraisal cycle not found.")
    return cycle


@router.put("/cycles/{cycle_id}", response_model=AppraisalCycleRead, dependencies=[Depends(deps.allow_admin_only)])
def update_appraisal_cycle_api(cycle_id: int, cycle_in: AppraisalCycleUpdate, db: Session = Depends(get_db)):
    db_cycle = crud_performance.get_appraisal_cycle(db, cycle_id)
    if not db_cycle:
        raise HTTPException(status_code=404, detail="Appraisal cycle not found.")
    return crud_performance.update_appraisal_cycle(db, db_cycle, cycle_in)


# --- PerformanceReview Endpoints ---
@router.post("/cycles/{cycle_id}/initiate-reviews", status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(deps.allow_admin_only)])
def initiate_performance_reviews_api(
        cycle_id: int,
        payload: PerformanceReviewCreatePayload,
        db: Session = Depends(get_db)
):
    cycle = crud_performance.get_appraisal_cycle(db, cycle_id)
    if not cycle:
        raise HTTPException(status_code=404, detail="Appraisal cycle not found.")
    if cycle.status != AppraisalCycleStatus.ACTIVE:  # Or some other prerequisite status
        raise HTTPException(status_code=400,
                            detail=f"Cannot initiate reviews for cycle with status {cycle.status.value}.")

    created_reviews_count = 0
    for emp_id in payload.employee_ids:
        emp_profile = crud_employee.get_employee_profile(db, emp_id)
        if not emp_profile or not emp_profile.manager_id:
            print(f"Skipping review for employee {emp_id}: profile or manager not found.")
            continue

        # Check if manager exists
        manager_profile = crud_employee.get_employee_profile(db, emp_profile.manager_id)
        if not manager_profile:
            print(f"Skipping review for employee {emp_id}: manager profile (ID: {emp_profile.manager_id}) not found.")
            continue

        crud_performance.create_performance_review_entry(db, cycle_id, emp_id, emp_profile.manager_id)
        created_reviews_count += 1
    return {"message": f"Initiated {created_reviews_count} performance reviews for cycle '{cycle.name}'."}


@router.get("/reviews/my/cycle/{cycle_id}", response_model=PerformanceReviewRead)
def get_my_performance_review_api(
        cycle_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=404, detail="Employee profile not found for current user.")
    review = crud_performance.get_performance_review_for_employee_cycle(db, current_user.employee_profile.id, cycle_id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found for you in this cycle.")

    # Populate names for readability
    cycle = review.appraisal_cycle
    emp_user = review.employee.user
    manager_user = review.manager.user
    return PerformanceReviewRead(
        **review.model_dump(),
        employee_name=f"{emp_user.first_name} {emp_user.last_name}" if emp_user else "N/A",
        manager_name=f"{manager_user.first_name} {manager_user.last_name}" if manager_user else "N/A",
        appraisal_cycle_name=cycle.name if cycle else "N/A"
    )


@router.put("/reviews/{review_id}/self-evaluation", response_model=PerformanceReviewRead)
def submit_my_self_evaluation_api(
        review_id: int,
        evaluation_in: SelfEvaluationSubmit,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)
):
    review = crud_performance.get_performance_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found.")
    if not current_user.employee_profile or review.employee_id != current_user.employee_profile.id:
        raise HTTPException(status_code=403, detail="Not authorized to submit self-evaluation for this review.")
    if review.review_status != "pending_self_evaluation":  # Or other allowed statuses
        raise HTTPException(status_code=400,
                            detail=f"Cannot submit self-evaluation when review status is {review.review_status}")

    updated_review = crud_performance.submit_self_evaluation(
        db, review, evaluation_in.self_evaluation_text, evaluation_in.self_evaluation_rating
    )
    # Populate names
    cycle = updated_review.appraisal_cycle
    emp_user = updated_review.employee.user
    manager_user = updated_review.manager.user
    return PerformanceReviewRead(
        **updated_review.model_dump(),
        employee_name=f"{emp_user.first_name} {emp_user.last_name}" if emp_user else "N/A",
        manager_name=f"{manager_user.first_name} {manager_user.last_name}" if manager_user else "N/A",
        appraisal_cycle_name=cycle.name if cycle else "N/A"
    )


@router.get("/reviews/team/cycle/{cycle_id}", response_model=List[PerformanceReviewRead],
            dependencies=[Depends(deps.allow_manager_only)])
def get_team_performance_reviews_api(  # Manager views reviews of their team
        cycle_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_manager_only)
):
    if not current_user.employee_profile:
        raise HTTPException(status_code=403, detail="Manager profile not found.")

    reviews = crud_performance.get_reviews_for_manager_cycle(db, current_user.employee_profile.id, cycle_id)
    response = []
    for r in reviews:
        cycle = r.appraisal_cycle
        emp_user = r.employee.user
        manager_user = r.manager.user  # Should be current_user
        response.append(PerformanceReviewRead(
            **r.model_dump(),
            employee_name=f"{emp_user.first_name} {emp_user.last_name}" if emp_user else "N/A",
            manager_name=f"{manager_user.first_name} {manager_user.last_name}" if manager_user else "N/A",
            appraisal_cycle_name=cycle.name if cycle else "N/A"
        ))
    return response


@router.put("/reviews/{review_id}/manager-feedback", response_model=PerformanceReviewRead,
            dependencies=[Depends(deps.allow_manager_only)])
def submit_manager_feedback_api(
        review_id: int,
        feedback_in: ManagerFeedbackSubmit,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_manager_only)
):
    review = crud_performance.get_performance_review(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Performance review not found.")
    if not current_user.employee_profile or review.manager_id != current_user.employee_profile.id:
        raise HTTPException(status_code=403, detail="Not authorized to submit manager feedback for this review.")
    if review.review_status != "pending_manager_feedback":  # Or other allowed statuses
        raise HTTPException(status_code=400,
                            detail=f"Cannot submit manager feedback when review status is {review.review_status}")

    updated_review = crud_performance.submit_manager_feedback(
        db, review, feedback_in.manager_feedback_text, feedback_in.manager_rating
    )
    # Populate names
    cycle = updated_review.appraisal_cycle
    emp_user = updated_review.employee.user
    manager_user = updated_review.manager.user
    return PerformanceReviewRead(
        **updated_review.model_dump(),
        employee_name=f"{emp_user.first_name} {emp_user.last_name}" if emp_user else "N/A",
        manager_name=f"{manager_user.first_name} {manager_user.last_name}" if manager_user else "N/A",
        appraisal_cycle_name=cycle.name if cycle else "N/A"
    )