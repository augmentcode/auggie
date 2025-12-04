from typing import List

from auggie_sdk import Auggie

INTEGRATION_TOOLS = [
    "github-api",
    "linear",
    "notion",
    "glean",
    "supabase",
    "jira",
    "confluence",
    "slack",
]

agent = Auggie(removed_tools=INTEGRATION_TOOLS)

response = agent.run("What are the tools you have available?")

print(response)
