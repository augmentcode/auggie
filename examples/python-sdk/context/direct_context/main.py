"""
Sample: Direct Context - API-based indexing with import/export state

This sample demonstrates:
- Creating a Direct Context instance
- Adding files to the index
- Searching the indexed files
- Using Generation API to ask questions about indexed code
- Generating documentation from indexed code
- Exporting state to a file
- Importing state from a file
"""

import json
import sys

from auggie_sdk.context import DirectContext, File


def main():
    print("=== Direct Context Sample ===\n")

    # Create a Direct Context instance
    # Authentication is automatic via:
    # 1. AUGMENT_API_TOKEN / AUGMENT_API_URL env vars, or
    # 2. ~/.augment/session.json (created by `auggie login`)
    print("Creating Direct Context...")
    context = DirectContext.create(debug=True)

    # Add some sample files to the index
    print("\nAdding files to index...")
    # Using realistic, detailed code examples for better search results
    files = [
        {
            "path": "src/utils/string_helpers.py",
            "contents": '''"""
String utility functions for text processing and formatting
"""


def format_number(num: float, locale: str = "en-US") -> str:
    """
    Format a number with thousands separators

    Args:
        num: Number to format
        locale: Locale for formatting (default: 'en-US')

    Returns:
        Formatted number string
    """
    return f"{num:,.2f}"


def is_even(num: int) -> bool:
    """
    Check if a number is even

    Args:
        num: Number to check

    Returns:
        True if number is even, false otherwise
    """
    return num % 2 == 0


def is_odd(num: int) -> bool:
    """
    Check if a number is odd

    Args:
        num: Number to check

    Returns:
        True if number is odd, false otherwise
    """
    return num % 2 != 0


def clamp(value: float, min_val: float, max_val: float) -> float:
    """
    Clamp a value between min and max bounds

    Args:
        value: Value to clamp
        min_val: Minimum allowed value
        max_val: Maximum allowed value

    Returns:
        Clamped value
    """
    return min(max(value, min_val), max_val)


def capitalize(s: str) -> str:
    """
    Capitalize the first letter of a string

    Args:
        s: String to capitalize

    Returns:
        String with first letter capitalized
    """
    if not s:
        return s
    return s[0].upper() + s[1:].lower()


def to_title_case(s: str) -> str:
    """
    Convert string to title case

    Args:
        s: String to convert

    Returns:
        String in title case
    """
    return " ".join(capitalize(word) for word in s.split(" "))


def truncate(s: str, max_length: int) -> str:
    """
    Truncate string to specified length with ellipsis

    Args:
        s: String to truncate
        max_length: Maximum length

    Returns:
        Truncated string
    """
    if len(s) <= max_length:
        return s
    return s[: max_length - 3] + "..."
''',
        },
        {
            "path": "src/data/user_service.py",
            "contents": '''"""
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
''',
        },
        {
            "path": "src/api/http_client.py",
            "contents": '''"""
HTTP client for making API requests with error handling and retries
"""

from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional, TypeVar, Generic
import json
import urllib.request
import urllib.error


@dataclass
class RequestConfig:
    method: Literal["GET", "POST", "PUT", "DELETE"]
    url: str
    headers: Optional[Dict[str, str]] = None
    body: Optional[Any] = None
    timeout: Optional[int] = None


T = TypeVar("T")


@dataclass
class ApiResponse(Generic[T]):
    data: T
    status: int
    headers: Dict[str, str]


class HttpClient:
    """HTTP client class for making API requests"""

    def __init__(self, base_url: str, default_headers: Optional[Dict[str, str]] = None):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}

    async def get(self, url: str, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        """
        Make a GET request

        Args:
            url: Request URL
            headers: Optional headers

        Returns:
            Promise with response data
        """
        return await self._request(RequestConfig(method="GET", url=url, headers=headers))

    async def post(
        self, url: str, body: Optional[Any] = None, headers: Optional[Dict[str, str]] = None
    ) -> ApiResponse:
        """
        Make a POST request

        Args:
            url: Request URL
            body: Request body
            headers: Optional headers

        Returns:
            Promise with response data
        """
        return await self._request(RequestConfig(method="POST", url=url, body=body, headers=headers))

    async def put(
        self, url: str, body: Optional[Any] = None, headers: Optional[Dict[str, str]] = None
    ) -> ApiResponse:
        """
        Make a PUT request

        Args:
            url: Request URL
            body: Request body
            headers: Optional headers

        Returns:
            Promise with response data
        """
        return await self._request(RequestConfig(method="PUT", url=url, body=body, headers=headers))

    async def delete(self, url: str, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        """
        Make a DELETE request

        Args:
            url: Request URL
            headers: Optional headers

        Returns:
            Promise with response data
        """
        return await self._request(RequestConfig(method="DELETE", url=url, headers=headers))

    async def _request(self, config: RequestConfig) -> ApiResponse:
        """
        Make a generic HTTP request

        Args:
            config: Request configuration

        Returns:
            Promise with response data
        """
        url = config.url if config.url.startswith("http") else f"{self.base_url}{config.url}"

        headers = {
            "Content-Type": "application/json",
            **self.default_headers,
            **(config.headers or {}),
        }

        data = json.dumps(config.body).encode() if config.body else None

        req = urllib.request.Request(url, data=data, headers=headers, method=config.method)

        try:
            with urllib.request.urlopen(req) as response:
                response_data = json.loads(response.read().decode())
                return ApiResponse(
                    data=response_data,
                    status=response.status,
                    headers=dict(response.headers),
                )
        except urllib.error.HTTPError as e:
            raise Exception(f"HTTP {e.code}: {e.reason}")
''',
        },
    ]

    # Convert dict-based files to File objects
    file_objects = [File(path=f["path"], contents=f["contents"]) for f in files]
    result = context.add_to_index(file_objects)
    print("\nIndexing result:")
    print(f"  Newly uploaded: {result.newly_uploaded}")
    print(f"  Already uploaded: {result.already_uploaded}")

    # Search the codebase - returns formatted string ready for LLM use or display
    # Using queries that work well with our realistic content
    print("\n--- Search 1: Find string utility functions ---")
    results1 = context.search("string utility functions for text formatting")
    print("Search results:")
    print(results1)

    print("\n--- Search 2: Find user management service ---")
    results2 = context.search("user management service with CRUD operations")
    print("Search results:")
    print(results2)

    print("\n--- Search 3: Find HTTP client for API requests ---")
    http_results = context.search("HTTP client for making API requests")
    print("Search results:")
    print(http_results)

    # Use search_and_ask to ask questions about the indexed code
    print("\n--- search_and_ask Example 1: Ask questions about the code ---")
    question = "How does the UserService class handle user creation and validation?"
    print(f"Question: {question}")

    answer = context.search_and_ask(
        "user creation and validation in UserService",
        question,
    )

    print(f"\nAnswer: {answer}")

    # Use search_and_ask to generate documentation
    print("\n--- search_and_ask Example 2: Generate documentation ---")
    documentation = context.search_and_ask(
        "string utility functions",
        "Generate API documentation in markdown format for the string utility functions",
    )

    print("\nGenerated Documentation:")
    print(documentation)

    # Use search_and_ask to explain code patterns
    print("\n--- search_and_ask Example 3: Explain code patterns ---")
    explanation = context.search_and_ask(
        "utility functions",
        "Explain what these utility functions do and when they would be useful",
    )

    print(f"\nExplanation: {explanation}")

    # Export state to a file
    state_file = "/tmp/direct-context-state.json"
    print(f"\nExporting state to {state_file}...")
    context.export_to_file(state_file)
    print("State exported successfully")

    # Show the exported state
    with open(state_file, "r") as f:
        exported_state = json.load(f)
    print("\nExported state:")
    print(json.dumps(exported_state, indent=2))

    # Import state in a new context
    print("\n--- Testing state import ---")
    context2 = DirectContext.import_from_file(state_file, debug=False)
    print("State imported successfully")

    # Verify we can still search
    results3 = context2.search("string utility functions")
    print("\nSearch after importing state:")
    print(results3)

    print("\n=== Sample Complete ===")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Error: {error}")
        sys.exit(1)

