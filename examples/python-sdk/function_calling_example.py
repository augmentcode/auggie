#!/usr/bin/env python3
"""
Example demonstrating function calling with the Augment Agent SDK.

This example shows how to provide Python functions that the agent can call
during execution to accomplish tasks.
"""

from auggie_sdk import Auggie


def get_weather(location: str, unit: str = "celsius") -> dict:
    """
    Get the current weather for a location.

    Args:
        location: City name or coordinates
        unit: Temperature unit - either 'celsius' or 'fahrenheit'

    Returns:
        Dictionary with weather information
    """
    # In a real implementation, this would call a weather API
    # For demo purposes, return mock data
    return {
        "location": location,
        "temperature": 22 if unit == "celsius" else 72,
        "unit": unit,
        "condition": "sunny",
        "humidity": 65,
    }


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two coordinates in kilometers.

    Args:
        lat1: Latitude of first point
        lon1: Longitude of first point
        lat2: Latitude of second point
        lon2: Longitude of second point

    Returns:
        Distance in kilometers
    """
    # Simplified calculation for demo
    import math

    # Haversine formula
    R = 6371  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))

    return R * c


def run_tests(test_file: str) -> dict:
    """
    Run tests from a test file.

    Args:
        test_file: Path to the test file

    Returns:
        Dictionary with test results
    """
    # Mock test results for demo
    return {
        "file": test_file,
        "total": 15,
        "passed": 13,
        "failed": 2,
        "skipped": 0,
        "duration": 2.5,
    }


def main():
    """Demonstrate function calling with various examples."""

    agent = Auggie()

    print("🔧 Function Calling Examples")
    print("=" * 50)

    # Example 1: Single function call
    print("\n1. Weather Query:")
    result = agent.run(
        "What's the weather in San Francisco? Use the get_weather function.",
        return_type=dict,
        functions=[get_weather],
    )
    print(f"   Result: {result}")

    # Example 2: Function with calculations
    print("\n2. Distance Calculation:")
    result = agent.run(
        "Calculate the distance between New York (40.7128, -74.0060) and "
        "Los Angeles (34.0522, -118.2437) using the calculate_distance function.",
        return_type=float,
        functions=[calculate_distance],
    )
    print(f"   Distance: {result:.2f} km")

    # Example 3: Multiple functions
    print("\n3. Multiple Functions:")
    result = agent.run(
        "First, get the weather in London. Then calculate the distance from "
        "London (51.5074, -0.1278) to Paris (48.8566, 2.3522).",
        return_type=str,
        functions=[get_weather, calculate_distance],
    )
    print(f"   Result: {result}")

    # Example 4: Test runner
    print("\n4. Running Tests:")
    result = agent.run(
        "Run the tests in 'test_auth.py' and tell me if they passed.",
        return_type=dict,
        functions=[run_tests],
    )
    print(f"   Test Results: {result}")

    # Example 5: Complex workflow
    print("\n5. Complex Workflow:")

    def fetch_data(source: str) -> list:
        """Fetch data from a source."""
        return [{"id": 1, "value": 100}, {"id": 2, "value": 200}]

    def process_data(data: list) -> dict:
        """Process the fetched data."""
        total = sum(item["value"] for item in data)
        return {"count": len(data), "total": total, "average": total / len(data)}

    result = agent.run(
        "Fetch data from 'api' and then process it to get statistics.",
        return_type=dict,
        functions=[fetch_data, process_data],
    )
    print(f"   Statistics: {result}")

    print("\n✅ All examples completed!")


if __name__ == "__main__":
    main()
