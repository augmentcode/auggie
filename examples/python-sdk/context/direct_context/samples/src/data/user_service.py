"""
User service for managing user data and authentication
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Literal, Optional
import random
import string


@dataclass
class User:
    id: str
    email: str
    name: str
    role: Literal["admin", "user", "guest"]
    created_at: datetime
    last_login_at: Optional[datetime] = None


@dataclass
class CreateUserRequest:
    email: str
    name: str
    password: str
    role: Literal["user", "guest"] = "user"


class UserService:
    """Service class for user management operations"""

    def __init__(self):
        self._users: Dict[str, User] = {}

    async def create_user(self, request: CreateUserRequest) -> User:
        """
        Create a new user account

        Args:
            request: User creation request

        Returns:
            Created user (without password)
        """
        user_id = self._generate_user_id()
        user = User(
            id=user_id,
            email=request.email,
            name=request.name,
            role=request.role,
            created_at=datetime.now(),
        )

        self._users[user_id] = user
        return user

    async def find_user_by_id(self, user_id: str) -> Optional[User]:
        """
        Find user by ID

        Args:
            user_id: User ID

        Returns:
            User if found, None otherwise
        """
        return self._users.get(user_id)

    async def find_user_by_email(self, email: str) -> Optional[User]:
        """
        Find user by email address

        Args:
            email: Email address

        Returns:
            User if found, None otherwise
        """
        for user in self._users.values():
            if user.email == email:
                return user
        return None

    async def update_last_login(self, user_id: str) -> None:
        """
        Update user's last login timestamp

        Args:
            user_id: User ID
        """
        user = self._users.get(user_id)
        if user:
            user.last_login_at = datetime.now()

    async def get_users(self, role: Optional[str] = None) -> List[User]:
        """
        Get all users with optional role filter

        Args:
            role: Optional role filter

        Returns:
            List of users
        """
        all_users = list(self._users.values())
        if role:
            return [user for user in all_users if user.role == role]
        return all_users

    async def delete_user(self, user_id: str) -> bool:
        """
        Delete user by ID

        Args:
            user_id: User ID

        Returns:
            True if user was deleted, False if not found
        """
        if user_id in self._users:
            del self._users[user_id]
            return True
        return False

    def _generate_user_id(self) -> str:
        return "user_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=9))

