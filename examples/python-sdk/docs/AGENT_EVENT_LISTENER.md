# AgentEventListener Interface Explained

The `AgentEventListener` interface allows you to receive real-time notifications about what the agent is doing while it processes your request. This is useful for:
- Building UIs that show progress
- Logging agent activity
- Debugging agent behavior
- Providing user feedback during long-running operations

## Overview

When you send a message to the agent (e.g., "Create a function to add two numbers"), the agent goes through several steps:

1. **Thinking** - The agent reasons about what to do
2. **Tool Calls** - The agent uses tools (read files, write files, run commands, etc.)
3. **Responding** - The agent sends back a message with the results

The `AgentEventListener` lets you observe all of these steps in real-time as they happen.

## The Five Event Types

### 1. `on_agent_message_chunk(text: str)`

**What it is:** Chunks of the agent's response message as it's being streamed.

**When it's called:** Multiple times as the agent streams its response text to you.

**Example scenario:**
```
You ask: "What is 2 + 2?"

The agent responds: "The answer is 4."

Your listener receives:
  on_agent_message_chunk("The ")
  on_agent_message_chunk("answer ")
  on_agent_message_chunk("is ")
  on_agent_message_chunk("4.")
  on_agent_message("The answer is 4.")  # Complete message at the end
```

**Why it's chunked:** The agent streams its response in real-time rather than waiting to generate the entire message. This allows you to show progress to users immediately.

**Use cases:**
- Display the agent's response as it's being typed (like ChatGPT)
- Show a progress indicator while waiting for the full response
- Build up the complete message incrementally

### 2. `on_agent_thought(text: str)`

**What it is:** The agent's internal reasoning/thinking process.

**When it's called:** When the agent is thinking about what to do next, before it takes action.

**Example scenario:**
```
You ask: "Read the README file and summarize it"

Your listener receives:
  on_agent_thought("I need to first read the README.md file using the view tool")
  on_agent_thought("Then I'll analyze the content and create a summary")
```

**Why it's useful:** Helps you understand the agent's decision-making process. This is like seeing the agent "think out loud."

**Use cases:**
- Debug why the agent chose a particular approach
- Show users what the agent is planning to do
- Log the agent's reasoning for audit purposes

### 3. `on_tool_call(tool_call_id, title, kind, status)`

**What it is:** Notification that the agent is making a tool call.

**When it's called:** When the agent begins executing a tool (reading a file, editing code, running a command, etc.)

**Parameters:**
- `tool_call_id`: Unique ID for this specific tool call (e.g., "tc_123")
- `title`: Human-readable description (e.g., "view", "str-replace-editor", "launch-process")
- `kind`: Category of tool (e.g., "read", "edit", "delete", "execute")
- `status`: Current status (e.g., "pending", "in_progress")

**Example scenario:**
```
You ask: "Read the file test.py and fix any errors"

Your listener receives:
  on_tool_call(
    tool_call_id="tc_001",
    title="view",
    kind="read",
    status="pending"
  )
```

**Use cases:**
- Show "Reading file..." or "Editing file..." messages to users
- Track which tools the agent is using
- Display a progress indicator for long-running operations

### 4. `on_tool_response(tool_call_id, status, content)`

**What it is:** Response from a tool call.

**When it's called:** When a tool responds with results.

**Parameters:**
- `tool_call_id`: The ID from the corresponding `on_tool_call`
- `status`: Response status (e.g., "completed", "failed")
- `content`: Results or additional information from the tool

**Example scenario:**
```
Continuing from above...

Your listener receives:
  on_tool_response(
    tool_call_id="tc_001",
    status="completed",
    content={"file_content": "def test():\n    pass"}
  )
```

**Use cases:**
- Update progress indicators
- Show tool results to users
- Detect when operations complete or fail

### 5. `on_agent_message(message: str)`

**What it is:** The complete agent message after all chunks have been sent.

**When it's called:** Once, after the agent finishes streaming its complete response.

**Example scenario:**
```
After receiving all the chunks:
  on_agent_message_chunk("The ")
  on_agent_message_chunk("answer ")
  on_agent_message_chunk("is ")
  on_agent_message_chunk("4.")

You receive:
  on_agent_message("The answer is 4.")
```

**Use cases:**
- Log the complete message
- Process the full response (e.g., parse it, save it)
- Update UI with final message
- Trigger actions based on complete response

## Complete Example

Here's a complete example showing all events in action:

```python
from auggie_sdk import Auggie
from auggie_sdk.acp import AgentEventListener

class MyListener(AgentEventListener):
    def on_agent_message_chunk(self, text: str) -> None:
        print(f"[CHUNK] {text}", end="", flush=True)

    def on_agent_message(self, message: str) -> None:
        print(f"\n[COMPLETE MESSAGE] {message}")

    def on_tool_call(self, tool_call_id: str, title: str,
                    kind: str = None, status: str = None) -> None:
        print(f"\n[TOOL CALL] {title} (kind={kind}, status={status})")

    def on_tool_response(self, tool_call_id: str,
                        status: str = None, content: Any = None) -> None:
        print(f"[TOOL RESPONSE] status={status}")

    def on_agent_thought(self, text: str) -> None:
        print(f"[THINKING] {text}")

# Use the listener
listener = MyListener()
agent = Auggie(listener=listener)

response = agent.run("Read the file test.py and count the lines")
```

**Output might look like:**
```
[THINKING] I need to read the test.py file first
[TOOL CALL] view (kind=read, status=pending)
[TOOL RESPONSE] status=completed
[CHUNK] The file test.py has
[CHUNK] 42 lines
[CHUNK] .
[COMPLETE MESSAGE] The file test.py has 42 lines.
```

## Event Flow Diagram

```
User sends message: "Create a function"
         ↓
[THINKING] "I'll create a new file..."
         ↓
[TOOL CALL] save-file (kind=create)
         ↓
[TOOL RESPONSE] status=completed
         ↓
[AGENT MESSAGE CHUNK] "I've created "
[AGENT MESSAGE CHUNK] "the function "
[AGENT MESSAGE CHUNK] "for you."
         ↓
[AGENT MESSAGE] "I've created the function for you."
```

## Important Notes

1. **Chunks vs Complete Messages**: `on_agent_message_chunk` is called multiple times with small chunks. `on_agent_message` is called once with the complete message at the end.

2. **Optional Methods**: `on_agent_thought` and `on_agent_message` are NOT abstract, so you don't have to implement them if you don't need them.

3. **Tool Call Pairing**: Each `on_tool_call` will have one or more corresponding `on_tool_response` calls with the same `tool_call_id`.

4. **Thread Safety**: If you're updating a UI, make sure your listener methods are thread-safe.

5. **Performance**: Keep your listener methods fast - they're called synchronously and will block the agent if they take too long.

## Common Patterns

### Pattern 1: Accumulate Full Message
```python
class MessageAccumulator(AgentEventListener):
    def __init__(self):
        self.message_chunks = []

    def on_agent_message_chunk(self, text: str) -> None:
        self.message_chunks.append(text)

    def on_agent_message(self, message: str) -> None:
        # Or just use the complete message directly!
        print(f"Complete message: {message}")

    # ... implement other required methods ...
```

### Pattern 2: Track Tool Usage
```python
class ToolTracker(AgentEventListener):
    def __init__(self):
        self.tools_used = []

    def on_tool_call(self, tool_call_id, title, kind=None, status=None):
        self.tools_used.append({
            "id": tool_call_id,
            "name": title,
            "kind": kind,
            "start_time": time.time()
        })

    # ... implement other required methods ...
```

### Pattern 3: Progress UI
```python
class ProgressListener(AgentEventListener):
    def on_tool_call(self, tool_call_id, title, kind=None, status=None):
        print(f"⏳ {title}...")

    def on_tool_response(self, tool_call_id, status=None, content=None):
        if status == "completed":
            print(f"✅ Done!")
        elif status == "failed":
            print(f"❌ Failed!")

    # ... implement other required methods ...
```

## Quick Reference Table

| Event | When Called | How Many Times | Purpose |
|-------|-------------|----------------|---------|
| `on_agent_message_chunk` | Agent is streaming response | Many (chunks) | Get response text in real-time |
| `on_agent_message` | Agent finishes response | Once | Get complete message |
| `on_agent_thought` | Agent is thinking | 0 or more | See agent's reasoning |
| `on_tool_call` | Agent makes a tool call | Once per tool | Know what tool is being used |
| `on_tool_response` | Tool responds | 1+ per tool | Get tool results |

## See Also

- `examples/event_listener_demo.py` - Interactive demo showing all events
- `examples/` directory for more working examples
- `augment/acp/test_client_e2e.py` for test examples using listeners

