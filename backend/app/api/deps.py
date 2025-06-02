# hr_software/app/api/deps.py

from fastapi import Depends, HTTPException, status
from app.models.user import User, UserRole # Ensure UserRole is imported
from app.core.security import get_current_active_user # Your primary function to get an active authenticated user

def role_checker(allowed_roles: list[UserRole]):
    """
    A factory for creating role-checking dependency functions.
    """
    async def get_current_user_with_role_check(
        current_user: User = Depends(get_current_active_user) # This dependency fetches the user
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role.value}' is not authorized for this action. Allowed: {[r.value for r in allowed_roles]}",
            )
        return current_user
    return get_current_user_with_role_check

# --- Define your specific role-based dependencies ---

# For actions only an ADMIN can perform
allow_admin_only = role_checker([UserRole.ADMIN])

# For actions either an ADMIN or a MANAGER can perform
allow_admin_or_manager = role_checker([UserRole.ADMIN, UserRole.MANAGER])

# For actions only a MANAGER can perform
allow_manager_only = role_checker([UserRole.MANAGER])

# For actions any authenticated and active user can perform (no specific role beyond 'active user')
# This can often just be a direct alias to your main active user fetching dependency.
allow_all_authenticated = get_current_active_user

# You could also define one for 'employee_only' if needed:
# allow_employee_only = role_checker([UserRole.EMPLOYEE])