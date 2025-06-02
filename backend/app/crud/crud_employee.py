from datetime import datetime

from sqlmodel import Session, select, col
from typing import List, Optional
import os # For file operations
from fastapi import UploadFile
import shutil # For saving files

from app.models.employee import EmployeeProfile, Department, EmployeeDocument
from app.models.user import User
from app.schemas.employee import (
    EmployeeProfileCreate, EmployeeProfileUpdate,
    DepartmentCreate, DepartmentUpdate,
    EmployeeDocumentCreate # EmployeeDocumentRead is not directly used in CRUD creation
)
from app.core.config import settings # If you have an UPLOAD_DIRECTORY setting

# UPLOAD_DIRECTORY = "uploads/employee_documents" # Define this or get from settings
UPLOAD_DIRECTORY = os.path.join("uploads", "employee_documents") # Define this or get from settings
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)


# --- Department CRUD (from previous code, ensure it's here) ---
def get_department(db: Session, department_id: int) -> Department | None:
    return db.get(Department, department_id)

def get_department_by_name(db: Session, name: str) -> Department | None:
    statement = select(Department).where(Department.name == name)
    return db.exec(statement).first()

def get_departments(db: Session, skip: int = 0, limit: int = 100) -> List[Department]:
    statement = select(Department).offset(skip).limit(limit)
    return db.exec(statement).all()

def create_department(db: Session, department: DepartmentCreate) -> Department:
    db_department = Department.model_validate(department)
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department

def update_department(db: Session, db_department: Department, department_in: DepartmentUpdate) -> Department:
    department_data = department_in.model_dump(exclude_unset=True)
    for key, value in department_data.items():
        setattr(db_department, key, value)
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department

def delete_department(db: Session, department_id: int) -> Department | None:
    department = db.get(Department, department_id)
    if department:
        db.delete(department)
        db.commit()
    return department


# --- EmployeeProfile CRUD (from previous code, ensure it's here and updated) ---
def get_employee_profile(db: Session, employee_id: int) -> EmployeeProfile | None:
    return db.get(EmployeeProfile, employee_id)

def get_employee_profile_by_user_id(db: Session, user_id: int) -> EmployeeProfile | None:
    statement = select(EmployeeProfile).where(EmployeeProfile.user_id == user_id)
    return db.exec(statement).first()

def get_employee_profiles(db: Session, skip: int = 0, limit: int = 100, manager_id: Optional[int] = None) -> List[EmployeeProfile]:
    statement = select(EmployeeProfile)
    if manager_id:
        # This gets direct reports. For all subordinates, you'd need a recursive query or CTE.
        statement = statement.where(EmployeeProfile.manager_id == manager_id)
    statement = statement.offset(skip).limit(limit)
    return db.exec(statement).all()

def create_employee_profile(db: Session, employee_in: EmployeeProfileCreate) -> EmployeeProfile:
    user = db.get(User, employee_in.user_id)
    if not user:
        raise ValueError(f"User with id {employee_in.user_id} not found.")
    existing_profile = get_employee_profile_by_user_id(db, employee_in.user_id)
    if existing_profile:
        raise ValueError(f"Employee profile already exists for user_id {employee_in.user_id}.")

    db_employee = EmployeeProfile.model_validate(employee_in)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

def update_employee_profile(
    db: Session, db_employee: EmployeeProfile, employee_in: EmployeeProfileUpdate
) -> EmployeeProfile:
    employee_data = employee_in.model_dump(exclude_unset=True)
    for key, value in employee_data.items():
        setattr(db_employee, key, value)
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

def delete_employee_profile(db: Session, employee_id: int) -> EmployeeProfile | None:
    employee = db.get(EmployeeProfile, employee_id)
    if employee:
        # Delete associated documents from filesystem
        for doc in employee.documents:
            try:
                if os.path.exists(doc.file_path):
                    os.remove(doc.file_path)
            except Exception as e:
                print(f"Error deleting file {doc.file_path}: {e}")
            # db.delete(doc) # Documents will be cascade deleted if relationship is set up for it
        db.delete(employee)
        db.commit()
    return employee

# --- EmployeeDocument CRUD ---
def create_employee_document(
    db: Session,
    employee_id: int,
    doc_meta_data: EmployeeDocumentCreate, # Use the Pydantic schema for metadata
    file_to_upload: UploadFile # The actual file object from FastAPI
) -> EmployeeDocument:
    """
    Saves an uploaded file to the filesystem and its metadata to the database.
    """
    employee_profile = get_employee_profile(db, employee_id=employee_id)
    if not employee_profile:
        raise ValueError(f"Employee profile with id {employee_id} not found.")

    # Sanitize original filename and create a unique name for storage
    # to prevent path traversal and overwrites.
    original_filename = file_to_upload.filename if file_to_upload.filename else "untitled"
    # Basic sanitization: replace spaces, remove leading/trailing dots/slashes, limit length
    safe_original_filename = "".join(c if c.isalnum() or c in ['.', '_', '-'] else '_' for c in original_filename)
    safe_original_filename = safe_original_filename[:100] # Limit length

    timestamp_str = str(int(datetime.utcnow().timestamp()))
    # Example: 1_1678886400_passport_scan.pdf
    unique_disk_filename = f"{employee_id}_{timestamp_str}_{safe_original_filename}"
    file_path_on_disk = os.path.join(UPLOAD_DIRECTORY, unique_disk_filename)

    try:
        # Save the uploaded file to the UPLOAD_DIRECTORY
        with open(file_path_on_disk, "wb") as buffer: # Use 'wb' for binary write
            shutil.copyfileobj(file_to_upload.file, buffer)
    except IOError as e:
        # Log the error, clean up partial file if necessary
        print(f"ERROR: File I/O error while saving document: {e}")
        # if os.path.exists(file_path_on_disk):
        #     os.remove(file_path_on_disk) # Attempt cleanup
        raise IOError(f"Could not save uploaded file to disk. Server error.") # Re-raise or raise custom
    finally:
        file_to_upload.file.close() # Important to close the temp file

    # Create the database record for the document
    db_document_entry = EmployeeDocument(
        employee_id=employee_id,
        document_type=doc_meta_data.document_type, # From Pydantic schema
        description=doc_meta_data.description,     # From Pydantic schema
        file_name=original_filename,               # Store the original filename for user reference
        file_path=file_path_on_disk,               # Store the path to the file on server's disk
        # upload_date is set by default_factory in the model
    )

    db.add(db_document_entry)
    db.commit()
    db.refresh(db_document_entry)
    return db_document_entry


def get_employee_document(db: Session, document_id: int) -> EmployeeDocument | None:
    return db.get(EmployeeDocument, document_id)

def get_employee_documents(db: Session, employee_id: int) -> List[EmployeeDocument]:
    statement = select(EmployeeDocument).where(EmployeeDocument.employee_id == employee_id)
    return db.exec(statement).all()

def delete_employee_document(db: Session, document_id: int) -> EmployeeDocument | None:
    document = db.get(EmployeeDocument, document_id)
    if document:
        try:
            if os.path.exists(document.file_path):
                os.remove(document.file_path)
        except Exception as e:
            print(f"Error deleting file {document.file_path}: {e}")
        db.delete(document)
        db.commit()
    return document