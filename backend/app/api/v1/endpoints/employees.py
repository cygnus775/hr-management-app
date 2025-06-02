# hr_software/app/api/v1/endpoints/employees.py

from fastapi import (
    APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
)
from fastapi.responses import FileResponse
from sqlmodel import Session
from typing import List, Optional, Any
import os
import json
import pydantic
from datetime import date, datetime  # Ensure datetime is imported

from app.crud import crud_employee, crud_user, crud_workflow  # Added crud_workflow
from app.schemas.employee import (
    EmployeeProfileCreate, EmployeeProfileRead, EmployeeProfileUpdate,
    EmployeeProfileReadWithUser,
    DepartmentCreate, DepartmentRead, DepartmentUpdate,
    EmployeeDocumentCreate, EmployeeDocumentRead,
    OnboardingCompletionRequest, OffboardingInitiationRequest
)
from app.models.user import User
from app.models.enums import UserRole, EmploymentStatus, DocumentType  # Using enums.py
from app.models.employee import EmployeeProfile, Department, EmployeeDocument
from app.core.db import get_db
from app.api import deps

router = APIRouter()


# --- Helper function to build EmployeeProfileReadWithUser ---
def _build_employee_profile_read_with_user(db: Session, profile_orm: EmployeeProfile) -> EmployeeProfileReadWithUser:
    user_model_instance = profile_orm.user
    manager_email_str: Optional[str] = None

    if profile_orm.manager_id:
        manager_profile_temp = crud_employee.get_employee_profile(db, profile_orm.manager_id)
        if manager_profile_temp and manager_profile_temp.user:
            manager_email_str = manager_profile_temp.user.email

    validated_documents_list: List[EmployeeDocumentRead] = []
    if profile_orm.documents:
        for doc_orm_instance in profile_orm.documents:
            validated_documents_list.append(EmployeeDocumentRead.model_validate(doc_orm_instance.model_dump()))

    if not user_model_instance:
        # This should be a rare case if data integrity is maintained
        raise HTTPException(status_code=500,
                            detail=f"Data integrity issue: User not found for EmployeeProfile ID {profile_orm.id}")

    return EmployeeProfileReadWithUser(
        **profile_orm.model_dump(),
        user_email=user_model_instance.email,
        user_first_name=user_model_instance.first_name,
        user_last_name=user_model_instance.last_name,
        user_role=user_model_instance.role.value,
        manager_email=manager_email_str,
        documents=validated_documents_list
    )


# --- Department Endpoints ( 그대로 유지 ) ---
@router.post("/departments/", response_model=DepartmentRead, dependencies=[Depends(deps.allow_admin_only)])
def create_department_api(*, db: Session = Depends(get_db), department_in: DepartmentCreate):
    existing_dept = crud_employee.get_department_by_name(db, name=department_in.name)
    if existing_dept:
        raise HTTPException(status_code=400, detail="Department with this name already exists")
    return crud_employee.create_department(db=db, department=department_in)


@router.get("/departments/", response_model=List[DepartmentRead], dependencies=[Depends(deps.allow_all_authenticated)])
def read_departments_api(db: Session = Depends(get_db), skip: int = Query(0, ge=0),
                         limit: int = Query(default=100, ge=1, le=200)):
    return crud_employee.get_departments(db, skip=skip, limit=limit)


@router.get("/departments/{department_id}", response_model=DepartmentRead,
            dependencies=[Depends(deps.allow_all_authenticated)])
def read_department_api(department_id: int, db: Session = Depends(get_db)):
    db_department = crud_employee.get_department(db, department_id=department_id)
    if db_department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    return db_department


@router.put("/departments/{department_id}", response_model=DepartmentRead,
            dependencies=[Depends(deps.allow_admin_only)])
def update_department_api(department_id: int, department_in: DepartmentUpdate, db: Session = Depends(get_db)):
    db_department = crud_employee.get_department(db, department_id=department_id)
    if db_department is None:
        raise HTTPException(status_code=404, detail="Department not found")
    return crud_employee.update_department(db=db, db_department=db_department, department_in=department_in)


# --- EmployeeProfile Endpoints ---
@router.post("/", response_model=EmployeeProfileReadWithUser, dependencies=[Depends(deps.allow_admin_only)])
def create_employee_profile_api(*, db: Session = Depends(get_db), profile_in: EmployeeProfileCreate):
    user = db.get(User, profile_in.user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User with ID {profile_in.user_id} not found.")
    try:
        profile_orm = crud_employee.create_employee_profile(db=db, employee_in=profile_in)

        # --- Auto-assign workflow on profile creation if status triggers it ---
        if profile_orm and profile_orm.employment_status:
            template_to_assign = crud_workflow.get_workflow_template_by_trigger_status(db,
                                                                                       profile_orm.employment_status)
            if template_to_assign:
                crud_workflow.assign_workflow_to_employee(db, profile_orm.id, template_to_assign.id)
                print(
                    f"Auto-assigned workflow '{template_to_assign.name}' to employee {profile_orm.id} for status {profile_orm.employment_status.value}")
        # --- End auto-assign ---
        return _build_employee_profile_read_with_user(db, profile_orm)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[EmployeeProfileReadWithUser])
def read_employee_profiles_api(
        db: Session = Depends(get_db),
        skip: int = Query(0, ge=0),
        limit: int = Query(default=100, ge=1, le=200),
        current_user: User = Depends(deps.allow_admin_or_manager)
):
    profiles_orm_list: List[EmployeeProfile] = []
    if current_user.role == UserRole.MANAGER:
        if not current_user.employee_profile:
            raise HTTPException(status_code=403, detail="Manager does not have an associated employee profile.")
        profiles_orm_list = crud_employee.get_employee_profiles(db, skip=skip, limit=limit,
                                                                manager_id=current_user.employee_profile.id)
    elif current_user.role == UserRole.ADMIN:
        profiles_orm_list = crud_employee.get_employee_profiles(db, skip=skip, limit=limit)
    else:
        raise HTTPException(status_code=403, detail="User role not authorized.")
    return [_build_employee_profile_read_with_user(db, p) for p in profiles_orm_list]


@router.get("/{employee_id}", response_model=EmployeeProfileReadWithUser)
def read_employee_profile_api(employee_id: int, db: Session = Depends(get_db),
                              current_user: User = Depends(deps.allow_all_authenticated)):
    db_employee_orm = crud_employee.get_employee_profile(db, employee_id=employee_id)
    if db_employee_orm is None:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    # ... (Authorization logic from previous full code) ...
    is_own_profile = (current_user.employee_profile and current_user.employee_profile.id == employee_id)
    is_manager_of_employee = (current_user.role == UserRole.MANAGER and
                              current_user.employee_profile and
                              db_employee_orm.manager_id == current_user.employee_profile.id)
    if not (current_user.role == UserRole.ADMIN or is_own_profile or is_manager_of_employee):
        raise HTTPException(status_code=403, detail="Not authorized to view this profile")
    return _build_employee_profile_read_with_user(db, db_employee_orm)


@router.put("/{employee_id}", response_model=EmployeeProfileReadWithUser)
def update_employee_profile_api(
        employee_id: int,
        profile_in: EmployeeProfileUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.get_current_active_user)

):
    db_employee_orm = crud_employee.get_employee_profile(db, employee_id=employee_id)
    if db_employee_orm is None:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    old_status = db_employee_orm.employment_status  # Store old status

    # ... (Authorization logic from previous full code) ...
    """is_manager_of_employee = (current_user.role == UserRole.MANAGER and
                              current_user.employee_profile and
                              db_employee_orm.manager_id == current_user.employee_profile.id)
    if not (current_user.role == UserRole.ADMIN or is_manager_of_employee):
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")"""

    updated_profile_orm = crud_employee.update_employee_profile(db=db, db_employee=db_employee_orm,
                                                                employee_in=profile_in)

    new_status = updated_profile_orm.employment_status
    if old_status != new_status:
        template_to_assign = crud_workflow.get_workflow_template_by_trigger_status(db, new_status)
        if template_to_assign:
            assigned = crud_workflow.assign_workflow_to_employee(db, updated_profile_orm.id, template_to_assign.id)
            if assigned:
                print(
                    f"Auto-assigned workflow '{template_to_assign.name}' to employee {updated_profile_orm.id} due to status change from {old_status.value} to {new_status.value}")
            else:
                print(
                    f"Failed or duplicate auto-assign workflow for {updated_profile_orm.id} and status {new_status.value}")

    return _build_employee_profile_read_with_user(db, updated_profile_orm)


@router.get("/me/profile", response_model=EmployeeProfileReadWithUser)
async def read_my_employee_profile_api(db: Session = Depends(get_db),
                                       current_user: User = Depends(deps.allow_all_authenticated)):
    profile_orm = current_user.employee_profile
    if isinstance(profile_orm, list): profile_orm = profile_orm[0] if profile_orm else None  # Handle potential list
    if not profile_orm:
        profile_orm = crud_employee.get_employee_profile_by_user_id(db, user_id=current_user.id)
        if not profile_orm:
            raise HTTPException(status_code=404, detail="No employee profile found.")
    return _build_employee_profile_read_with_user(db, profile_orm)


# --- Employee Document Endpoints ( 그대로 유지, use _build_employee_profile_read_with_user if returning full profile) ---
@router.post("/{employee_id}/documents/", response_model=EmployeeDocumentRead)
async def upload_employee_document_api(
        employee_id: int,  # This is the EmployeeProfile.id for whom the doc is being uploaded
        doc_data_json: str = File(..., description="JSON string of EmployeeDocumentCreate"),
        #doc_data_json: str,
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: User = Depends(deps.allow_all_authenticated)  # Ensures user is logged in
):
    # Fetch the EmployeeProfile for whom the document is being uploaded
    db_employee_orm_target = crud_employee.get_employee_profile(db, employee_id=employee_id)
    if not db_employee_orm_target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target employee profile not found")

    # --- MODIFIED AUTHORIZATION LOGIC ---
    can_upload = True

    """# 1. Admins can upload for anyone
    if current_user.role == UserRole.ADMIN:
        can_upload = True
        print(f"AUTH_INFO: User {current_user.email} (ADMIN) is uploading for EmployeeProfile ID {employee_id}.")

    # 2. Managers can upload for their direct reports
    elif current_user.role == UserRole.MANAGER:
        manager_profile = current_user.employee_profile
        # Ensure manager_profile is the EmployeeProfile object, not a list
        if isinstance(manager_profile, list) and manager_profile: manager_profile = manager_profile[0]

        if manager_profile and isinstance(manager_profile, EmployeeProfile):
            if db_employee_orm_target.manager_id == manager_profile.id:
                can_upload = True
                print(
                    f"AUTH_INFO: User {current_user.email} (MANAGER ID: {manager_profile.id}) is uploading for their direct report EmployeeProfile ID {employee_id}.")
            else:
                print(
                    f"AUTH_DENIED: User {current_user.email} (MANAGER ID: {manager_profile.id}) is NOT the manager of EmployeeProfile ID {employee_id} (Manager ID: {db_employee_orm_target.manager_id}).")
        else:
            print(f"AUTH_DENIED: Manager User {current_user.email} does not have a valid employee profile.")

    # 3. Employees can upload documents for THEMSELVES
    elif current_user.role == UserRole.EMPLOYEE:
        employee_own_profile = current_user.employee_profile
        # Ensure employee_own_profile is the EmployeeProfile object
        if isinstance(employee_own_profile, list) and employee_own_profile: employee_own_profile = employee_own_profile[
            0]

        if employee_own_profile and isinstance(employee_own_profile, EmployeeProfile):
            if employee_own_profile.id == employee_id:  # Check if target employee_id matches their own profile ID
                can_upload = True
                print(
                    f"AUTH_INFO: User {current_user.email} (EMPLOYEE ID: {employee_own_profile.id}) is uploading for themselves (Target EmployeeProfile ID {employee_id}).")
            else:
                print(
                    f"AUTH_DENIED: User {current_user.email} (EMPLOYEE) attempting to upload for another employee (Target ID: {employee_id}, Own ID: {employee_own_profile.id}).")
        else:
            print(f"AUTH_DENIED: Employee User {current_user.email} does not have a valid employee profile.")"""

    if not can_upload:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User {current_user.email} (Role: {current_user.role.value}) is not authorized to upload documents for EmployeeProfile ID {employee_id}."
        )
    # --- END MODIFIED AUTHORIZATION LOGIC ---

    try:
        doc_meta_data = EmployeeDocumentCreate.model_validate_json(doc_data_json)
    except pydantic.ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors())
    except json.JSONDecodeError:  # Fallback if model_validate_json itself fails at basic JSON parsing
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Malformed JSON string for document metadata.")

    try:
        document = crud_employee.create_employee_document(
            db=db,
            employee_id=employee_id,  # This is EmployeeProfile.id of the target
            doc_meta_data=doc_meta_data,
            file_to_upload=file
        )
        return document
    except ValueError as ve:  # e.g., from CRUD if employee_id was somehow re-validated and not found
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except IOError as ioe:
        print(f"SERVER_ERROR: Failed to save document to disk: {ioe}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Could not save document due to a server storage issue.")
    except Exception as e:
        # Log the full error for debugging
        import traceback
        print(f"SERVER_ERROR: Unexpected error during document upload: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="An unexpected error occurred while uploading the document.")


@router.get("/{employee_id}/documents/", response_model=List[EmployeeDocumentRead])
def list_employee_documents_api(employee_id: int, db: Session = Depends(get_db),
                                current_user: User = Depends(deps.allow_all_authenticated)):
    db_employee_orm = crud_employee.get_employee_profile(db, employee_id=employee_id)
    if not db_employee_orm: raise HTTPException(status_code=404, detail="Employee not found")
    is_own = (current_user.employee_profile and current_user.employee_profile.id == employee_id)
    is_manager = (
                current_user.role == UserRole.MANAGER and current_user.employee_profile and db_employee_orm.manager_id == current_user.employee_profile.id)
    if not (current_user.role == UserRole.ADMIN or is_own or is_manager):
        raise HTTPException(status_code=403, detail="Not authorized.")
    return crud_employee.get_employee_documents(db, employee_id=employee_id)


@router.get("/documents/{document_id}/download", response_class=FileResponse)
async def download_employee_document_api(document_id: int, db: Session = Depends(get_db),
                                         current_user: User = Depends(deps.allow_all_authenticated)):
    doc = crud_employee.get_employee_document(db, document_id=document_id)
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    emp = crud_employee.get_employee_profile(db, employee_id=doc.employee_id)
    is_own = (current_user.employee_profile and current_user.employee_profile.id == doc.employee_id)
    is_manager = (
                current_user.role == UserRole.MANAGER and current_user.employee_profile and emp and emp.manager_id == current_user.employee_profile.id)
    if not (current_user.role == UserRole.ADMIN or is_own or is_manager):
        raise HTTPException(status_code=403, detail="Not authorized.")
    if not os.path.exists(doc.file_path): raise HTTPException(status_code=404, detail="File not found on server.")
    return FileResponse(path=doc.file_path, filename=doc.file_name, media_type='application/octet-stream')


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee_document_api(document_id: int, db: Session = Depends(get_db),
                                       current_user: User = Depends(deps.allow_admin_or_manager)):
    doc = crud_employee.get_employee_document(db, document_id=document_id)
    if not doc: raise HTTPException(status_code=404, detail="Document not found")
    emp = crud_employee.get_employee_profile(db, employee_id=doc.employee_id)
    is_manager = (
                current_user.role == UserRole.MANAGER and current_user.employee_profile and emp and emp.manager_id == current_user.employee_profile.id)
    if not (current_user.role == UserRole.ADMIN or is_manager):
        raise HTTPException(status_code=403, detail="Not authorized.")
    if not crud_employee.delete_employee_document(db, document_id=document_id):
        raise HTTPException(status_code=404, detail="Document not found or deletion failed.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Onboarding/Offboarding Workflow Triggers ---
@router.post("/onboarding/complete", response_model=dict,
             dependencies=[Depends(deps.allow_admin_or_manager)])  # Changed response model
async def complete_onboarding_api(request: OnboardingCompletionRequest, db: Session = Depends(get_db),
                                  current_user: User = Depends(deps.allow_admin_or_manager)):
    employee_orm = crud_employee.get_employee_profile(db, request.employee_id)
    if not employee_orm:
        raise HTTPException(status_code=404, detail="Employee not found")
    # TODO: Authorization: Ensure current_user (manager/admin) can complete onboarding for this employee

    if employee_orm.employment_status == EmploymentStatus.ONBOARDING:
        old_status = employee_orm.employment_status
        new_status = EmploymentStatus.ACTIVE
        hire_date_to_set = employee_orm.hire_date if employee_orm.hire_date else date.today()

        updated_profile_orm = crud_employee.update_employee_profile(
            db, employee_orm, EmployeeProfileUpdate(employment_status=new_status, hire_date=hire_date_to_set)
        )

        if old_status != new_status:  # Trigger workflow assignment
            template_to_assign = crud_workflow.get_workflow_template_by_trigger_status(db, new_status)
            if template_to_assign:
                assigned = crud_workflow.assign_workflow_to_employee(db, updated_profile_orm.id, template_to_assign.id)
                if assigned: print(f"Auto-assigned workflow '{template_to_assign.name}' for status {new_status.value}")

        return {"message": f"Onboarding completed. Status set to {new_status.value}."}
    elif employee_orm.employment_status == EmploymentStatus.ACTIVE:
        return {"message": f"Employee {employee_orm.id} is already ACTIVE."}
    else:
        return {
            "message": f"Employee {employee_orm.id} is not in ONBOARDING status ({employee_orm.employment_status.value}). Cannot complete onboarding."}


@router.post("/offboarding/initiate", response_model=dict,
             dependencies=[Depends(deps.allow_admin_or_manager)])  # Changed response model
async def initiate_offboarding_api(request: OffboardingInitiationRequest, db: Session = Depends(get_db),
                                   current_user: User = Depends(deps.allow_admin_or_manager)):
    employee_orm = crud_employee.get_employee_profile(db, request.employee_id)
    if not employee_orm:
        raise HTTPException(status_code=404, detail="Employee not found")
    # TODO: Authorization

    old_status = employee_orm.employment_status

    # Determine the new status. Typically, from ACTIVE to ON_NOTICE or directly RESIGNED/TERMINATED.
    # For this example, let's assume if resignation_date or termination_date is provided, status changes.
    new_status = old_status
    if request.resignation_date or request.termination_date:
        if employee_orm.employment_status == EmploymentStatus.ACTIVE:  # Can only offboard active employees
            new_status = EmploymentStatus.ON_NOTICE  # Or directly to RESIGNED/TERMINATED
            # based on whether LWD is past or future.
            if request.termination_date:
                new_status = EmploymentStatus.TERMINATED  # If direct termination
            elif request.resignation_date:
                new_status = EmploymentStatus.RESIGNED  # If resignation (could also be ON_NOTICE first)

    update_data = {
        "resignation_date": request.resignation_date,
        "termination_date": request.termination_date,
        "last_working_day": request.last_working_day
    }
    if new_status != old_status:
        update_data["employment_status"] = new_status

    filtered_update_data = {k: v for k, v in update_data.items() if
                            v is not None or k == "employment_status"}  # Keep employment_status if it's being changed

    if not filtered_update_data and new_status == old_status:  # No actual changes other than potentially LWD
        if request.last_working_day and employee_orm.last_working_day != request.last_working_day:
            updated_profile_orm = crud_employee.update_employee_profile(db, employee_orm, EmployeeProfileUpdate(
                last_working_day=request.last_working_day))
            return {"message": f"Last working day updated for employee {employee_orm.id}."}
        return {"message": "No changes to apply for offboarding."}

    update_schema = EmployeeProfileUpdate(**filtered_update_data)
    updated_profile_orm = crud_employee.update_employee_profile(db, employee_orm, update_schema)

    if old_status != new_status and new_status is not None:  # Trigger workflow assignment
        template_to_assign = crud_workflow.get_workflow_template_by_trigger_status(db, new_status)
        if template_to_assign:
            assigned = crud_workflow.assign_workflow_to_employee(db, updated_profile_orm.id, template_to_assign.id)
            if assigned: print(f"Auto-assigned workflow '{template_to_assign.name}' for status {new_status.value}")

    return {
        "message": f"Offboarding process updated/initiated for employee {employee_orm.id}. Status: {updated_profile_orm.employment_status.value}"}