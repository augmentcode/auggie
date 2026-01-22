# Claude Code ACP Client

The `ClaudeCodeACPClient` provides a Python interface to interact with [Claude Code](https://www.anthropic.com/claude-code) via the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/).

This client uses Zed's open-source ACP adapter ([`@zed-industries/claude-code-acp`](https://github.com/zed-industries/claude-code-acp)) to communicate with Claude Code through the standardized ACP protocol.

## Prerequisites

### 1. Install the ACP Adapter

The adapter is a Node.js package that wraps the Claude Code SDK to speak ACP:

```bash
npm install -g @zed-industries/claude-code-acp
```

### 2. Set Your API Key

You need an Anthropic API key to use Claude Code:

```bash
export ANTHROPIC_API_KEY=...
```

You can get an API key from [Anthropic's Console](https://console.anthropic.com/).

## Basic Usage

### Simple Example

```python
from auggie_sdk.acp import ClaudeCodeACPClient

# Create client (uses ANTHROPIC_API_KEY from environment)
client = ClaudeCodeACPClient()

# Start the agent
client.start()

# Send a message
response = client.send_message("What is 2 + 2?")
print(response)

# Stop the agent
client.stop()
```

### With Context Manager

```python
from auggie_sdk.acp import ClaudeCodeACPClient

with ClaudeCodeACPClient() as client:
    response = client.send_message("Write a hello world function in Python")
    print(response)
```

### With Event Listener

```python
from auggie_sdk.acp import ClaudeCodeACPClient, AgentEventListener

class MyListener(AgentEventListener):
    def on_agent_message_chunk(self, text: str) -> None:
        print(text, end="", flush=True)

    def on_tool_call(self, tool_call_id: str, title: str, kind: str = None, status: str = None) -> None:
        print(f"\n[Tool: {title}]")

client = ClaudeCodeACPClient(listener=MyListener())
client.start()
response = client.send_message("Create a Python function to calculate fibonacci numbers")
client.stop()
```

## Configuration Options

### API Key

You can provide the API key in three ways:

1. **Environment variable** (recommended):
   ```bash
   export ANTHROPIC_API_KEY=...
   ```

2. **Constructor argument**:
   ```python
   client = ClaudeCodeACPClient(api_key="...")
   ```

3. **Programmatically**:
   ```python
   import os
   os.environ["ANTHROPIC_API_KEY"] = "..."
   client = ClaudeCodeACPClient()
   ```

### Model Selection

Specify which Claude model to use:

```python
client = ClaudeCodeACPClient(
    model="claude-3-5-sonnet-latest"
)
```

Available models:
- `claude-3-5-sonnet-latest` (default)
- `claude-3-opus-latest`
- `claude-3-haiku-latest`

### Workspace Root

Set the working directory for the agent:

```python
client = ClaudeCodeACPClient(
    workspace_root="/path/to/your/project"
)
```

### Custom Adapter Path

If you installed the adapter locally or want to use a specific version:

```python
client = ClaudeCodeACPClient(
    adapter_path="/path/to/claude-code-acp"
)
```

## Session Continuity

Messages sent to the same client instance share context automatically:

```python
client = ClaudeCodeACPClient()
client.start()

# First message
client.send_message("My favorite color is blue")

# Second message - remembers the context
response = client.send_message("What is my favorite color?")
print(response)  # Will mention "blue"

client.stop()
```

To clear the context and start fresh:

```python
client.clear_context()  # Restarts the agent with a new session
```

## Features Supported

The Claude Code ACP adapter supports all major Claude Code features:

- ✅ **Context @-mentions** - Reference files and code
- ✅ **Images** - Send images for analysis
- ✅ **Tool calls** - File operations, terminal commands, etc.
- ✅ **Permission requests** - Interactive approval for sensitive operations
- ✅ **Edit review** - Review and approve code changes
- ✅ **TODO lists** - Track tasks and progress
- ✅ **Interactive terminals** - Run commands and see output
- ✅ **Slash commands** - Custom commands for specialized tasks
- ✅ **MCP servers** - Connect to Model Context Protocol servers

## Error Handling

```python
from auggie_sdk.acp import ClaudeCodeACPClient

try:
    client = ClaudeCodeACPClient()
    client.start()
    response = client.send_message("Hello!")
    client.stop()
except ValueError as e:
    print(f"Configuration error: {e}")
except RuntimeError as e:
    print(f"Runtime error: {e}")
except TimeoutError as e:
    print(f"Timeout: {e}")
```

Common errors:

- **`ValueError: ANTHROPIC_API_KEY must be provided`** - Set your API key
- **`RuntimeError: npx not found`** - Install Node.js
- **`TimeoutError: Claude Code agent failed to start`** - Install the adapter with `npm install -g @zed-industries/claude-code-acp`

## Comparison with AuggieACPClient

| Feature | ClaudeCodeACPClient | AuggieACPClient |
|---------|---------------------|-----------------|
| Backend | Claude Code (Anthropic) | Augment CLI |
| API Key | Anthropic API key | Augment credentials |
| Installation | npm package | Built-in CLI |
| Models | Claude 3.x family | Multiple providers |
| Features | Full Claude Code features | Augment-specific features |

## Troubleshooting

### Adapter not found

```
RuntimeError: npx not found
```

**Solution**: Install Node.js from [nodejs.org](https://nodejs.org/)

### Agent fails to start

```
TimeoutError: Claude Code agent failed to start within 30 seconds
```

**Solution**: Install the adapter:
```bash
npm install -g @zed-industries/claude-code-acp
```

### API key errors

```
ValueError: ANTHROPIC_API_KEY must be provided
```

**Solution**: Set your API key:
```bash
export ANTHROPIC_API_KEY=...
```

### Process exits immediately

Check the error message for details. Common causes:
- Invalid API key
- Network issues
- Adapter version mismatch

## References

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Agent Client Protocol](https://agentclientprotocol.com/)
- [Zed's ACP Adapter](https://github.com/zed-industries/claude-code-acp)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk-python)
