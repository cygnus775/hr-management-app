# hr_software/app/core/security.py

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.models.user import User, UserRole  # User model for type hints
from app.schemas.token import TokenData  # Pydantic schema for token data
# DO NOT IMPORT crud_user AT THE TOP LEVEL HERE
from sqlmodel import Session  # For type hinting db dependency
from app.core.db import get_db  # Database session dependency

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")  # Path to your token endpoint in auth.py


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a plain password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
        db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    Decodes JWT token, validates credentials, and returns the current user.
    Raises HTTPException if authentication fails.
    """
    # Import crud_user HERE, inside the function, to break the circular import
    from app.crud import crud_user  # <--- THIS IS THE CRITICAL FIX

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str | None = payload.get("sub")
        role_str: str | None = payload.get("role")

        if email is None or role_str is None:
            raise credentials_exception

        try:
            role = UserRole(role_str)  # Convert role string from token back to UserRole enum
        except ValueError:
            raise credentials_exception  # Invalid role string in token

        token_data = TokenData(email=email, role=role)

    except JWTError:  # Covers various JWT errors like expiration, invalid signature
        raise credentials_exception

    user = crud_user.get_user_by_email(db, email=token_data.email)  # Now crud_user is imported and available
    if user is None:
        raise credentials_exception

    # Optional: Verify if the user's role in DB matches the token if that's a security concern.
    # if user.role != token_data.role:
    #     raise credentials_exception

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that gets the current user and checks if they are active.
    Raises HTTPException if the user is inactive.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user