"""Function Tools Example from user_guide.md"""

from auggie_sdk import Auggie
import datetime


def get_current_weather(location: str, unit: str = "celsius") -> dict:
    """
    Gets the weather for a given location.

    Args:
        location: The city and state, e.g. San Francisco, CA
        unit: Temperature unit ('celsius' or 'fahrenheit')
    """
    # In a real app, you'd call a weather API here
    return {"temp": 72, "unit": unit, "forecast": "sunny"}


def get_time() -> str:
    """Returns the current time."""
    return datetime.datetime.now().strftime("%H:%M")


agent = Auggie()

# The agent will call the appropriate function(s) to answer the question
response = agent.run(
    "What's the weather like in NYC right now, and what time is it there?",
    functions=[get_current_weather, get_time],
)

print(response)
