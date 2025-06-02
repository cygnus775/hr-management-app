from app.models.user import UserBase, UserRole
from sqlmodel import SQLModel

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int

class UserUpdate(SQLModel): # Using SQLModel directly for partial updates
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool | None = None
    role: UserRole | None = None