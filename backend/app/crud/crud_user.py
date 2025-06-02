# hr_software/app/crud/crud_user.py

from sqlmodel import Session, select
from app.models.user import User, UserRole  # UserRole might be needed for updates if role is updatable
from app.schemas.user import UserCreate, UserUpdate  # Ensure UserUpdate is imported if you plan to use it
from app.core.security import get_password_hash, verify_password


def get_user(db: Session, user_id: int) -> User | None:  # <--- ENSURE THIS FUNCTION IS PRESENT
    """
    Get a user by their ID.
    """
    return db.get(User, user_id)


def get_user_by_email(db: Session, email: str) -> User | None:
    """
    Get a user by their email address.
    """
    statement = select(User).where(User.email == email)
    return db.exec(statement).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    """
    Create a new user in the database.
    """
    hashed_password = get_password_hash(user_in.password)
    # Create a dictionary from user_in, excluding password, then add hashed_password
    user_data = user_in.model_dump(exclude={"password"})  # Exclude password from direct model creation
    user_data["hashed_password"] = hashed_password  # Add the hashed password

    # Use .model_validate for robust creation from dictionary
    db_user = User.model_validate(user_data)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """
    Authenticate a user by email and password.
    Returns the user object if authentication is successful, None otherwise.
    """
    user = get_user_by_email(db, email=email)
    if not user:
        return None
    if not user.is_active:  # Check if user is active
        # Depending on policy, you might raise an HTTPException here or just return None
        # For example: raise HTTPException(status_code=400, detail="Inactive user")
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# Optional: A general update user function
def update_user(db: Session, db_user: User, user_in: UserUpdate) -> User:
    """
    Update an existing user.
    `db_user` is the user object fetched from the database.
    `user_in` is a Pydantic schema with fields to update.
    """
    user_data = user_in.model_dump(exclude_unset=True)  # Only include fields that are set in the input

    for key, value in user_data.items():
        if key == "password" and value:  # If password is being updated
            hashed_password = get_password_hash(value)
            setattr(db_user, "hashed_password", hashed_password)
        elif hasattr(db_user, key):
            setattr(db_user, key, value)

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user