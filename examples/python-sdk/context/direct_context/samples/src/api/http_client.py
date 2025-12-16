"""
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

