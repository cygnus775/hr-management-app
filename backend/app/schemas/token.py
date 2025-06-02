from pydantic import BaseModel
from app.models.user import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None
    role: UserRole | None = None

class TokenResponse(Token): # Extends Token
    role: UserRole
    email: str
    first_name: str
    last_name: str
    user_id: int