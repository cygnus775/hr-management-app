# hr_software/app/models/user.py
from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List, TYPE_CHECKING

from .enums import UserRole # Import from the new enums.py

if TYPE_CHECKING:
    from .employee import EmployeeProfile # For relationship type hint

class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    first_name: str
    last_name: str
    is_active: bool = Field(default=True)
    role: UserRole = Field(default=UserRole.EMPLOYEE) # Uses UserRole from enums.py

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str

    # Relationship: A user can be an employee
    employee_profile: Optional["EmployeeProfile"] = Relationship(back_populates="user")

# --- Model Rebuild Section ---
# This needs to be at the VERY END of the file.
from .employee import EmployeeProfile # Import for resolving the string forward reference
User.model_rebuild()