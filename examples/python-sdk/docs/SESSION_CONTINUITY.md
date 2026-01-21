# Session Continuity: Agent vs ACP Client

## Key Insight

**The ACP client does NOT need session resume functionality** because it maintains a **long-running process with a single persistent session**. All messages automatically share context.

## Architecture Comparison

### Agent Library (Subprocess-Based)

```
┌─────────────────────────────────────────────────────────────┐
│ Agent Library                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  agent.run("Create a function")                            │
│    ↓                                                        │
│  ┌──────────────────────────────────┐                      │
│  │ Spawn CLI Process                │                      │
│  │ Session ID: abc123               │                      │
│  │ Execute → Return → Exit          │                      │
│  └──────────────────────────────────┘                      │
│                                                             │
│  agent.run("Test it")                                      │
│    ↓                                                        │
│  ┌──────────────────────────────────┐                      │
│  │ Spawn NEW CLI Process            │                      │
│  │ Session ID: xyz789  ← NEW!       │                      │
│  │ Execute → Return → Exit          │                      │
│  └──────────────────────────────────┘                      │
│                                                             │
│  ❌ NO CONTEXT - Different sessions!                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Solution:** Explicit session management

```python
with agent.session() as session:
    session.run("Create a function")  # Session: abc123
    session.run("Test it")             # Session: abc123 (resumed)
    # ✅ HAS CONTEXT - Same session!
```

### ACP Client (Long-Running)

```
┌─────────────────────────────────────────────────────────────┐
│ ACP Client                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  client.start()                                             │
│    ↓                                                        │
│  ┌──────────────────────────────────┐                      │
│  │ Spawn CLI Process (ACP mode)     │                      │
│  │ Session ID: abc123               │                      │
│  │                                  │                      │
│  │ ┌──────────────────────────────┐ │                      │
│  │ │ RUNNING...                   │ │                      │
│  │ │                              │ │                      │
│  │ │ client.send_message(...)     │ │  Session: abc123    │
│  │ │   → Response                 │ │                      │
│  │ │                              │ │                      │
│  │ │ client.send_message(...)     │ │  Session: abc123    │
│  │ │   → Response                 │ │                      │
│  │ │                              │ │                      │
│  │ │ client.send_message(...)     │ │  Session: abc123    │
│  │ │   → Response                 │ │                      │
│  │ │                              │ │                      │
│  │ └──────────────────────────────┘ │                      │
│  │                                  │                      │
│  └──────────────────────────────────┘                      │
│    ↓                                                        │
│  client.stop()                                              │
│                                                             │
│  ✅ AUTOMATIC CONTEXT - Same session throughout!           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**No session management needed!** All messages go to the same session automatically.

## Code Examples

### Agent Library - Requires Session Management

```python
from auggie_sdk import Auggie

agent = Auggie()

# ❌ NO CONTEXT - Each call is independent
agent.run("Create a function called add_numbers")
agent.run("Test that function")  # Doesn't know about add_numbers!

# ✅ WITH CONTEXT - Explicit session
with agent.session() as session:
    session.run("Create a function called add_numbers")
    session.run("Test that function")  # Knows about add_numbers!
```

### ACP Client - Automatic Session Continuity

```python
from auggie_sdk.acp import AuggieACPClient

client = AuggieACPClient()
client.start()

# ✅ AUTOMATIC CONTEXT - All messages share session
client.send_message("Create a function called add_numbers")
client.send_message("Test that function")  # Automatically knows about add_numbers!

client.stop()
```

## Why This Matters

### Performance

**Agent Library:**
- Spawns new process per request: ~500ms overhead
- 10 requests = 10 processes = ~5 seconds overhead

**ACP Client:**
- One process for all requests: ~500ms overhead once
- 10 requests = 1 process = ~500ms overhead total
- **10x faster for multiple requests!**

### User Experience

**Agent Library:**
```python
# User must remember to use session context
with agent.session() as session:  # Easy to forget!
    session.run("Step 1")
    session.run("Step 2")
```

**ACP Client:**
```python
# Session continuity is automatic
client.start()
client.send_message("Step 1")
client.send_message("Step 2")  # Just works!
client.stop()
```

### Real-Time Feedback

**Agent Library:**
- Waits for entire response before returning
- No progress updates

**ACP Client:**
- Streams responses in real-time
- Can show tool calls, thinking process, etc.
- Better UX for long-running operations

```python
from auggie_sdk.acp import AuggieACPClient, AgentEventListener

class MyListener(AgentEventListener):
    def on_agent_message_chunk(self, text: str):
        print(text, end="", flush=True)  # Real-time output!

    def on_tool_call(self, tool_name: str, tool_input: dict):
        print(f"\n[Using tool: {tool_name}]")

client = AuggieACPClient(listener=MyListener())
client.start()
client.send_message("Create a complex function")  # See progress in real-time!
client.stop()
```

## When to Use Each

### Use Agent Library When:

- ✅ Simple one-off requests
- ✅ Don't need session continuity
- ✅ Want simplest possible API
- ✅ Don't need real-time streaming

```python
from auggie_sdk import Auggie

agent = Auggie()
result = agent.run("What is 2 + 2?", return_type=int)
print(result)  # 4
```

### Use ACP Client When:

- ✅ Multiple related requests
- ✅ Need automatic session continuity
- ✅ Want real-time streaming
- ✅ Need better performance
- ✅ Want event-driven architecture

```python
from auggie_sdk.acp import AuggieACPClient

client = AuggieACPClient(model="claude-3-5-sonnet-latest")
client.start()

# All these share context automatically
client.send_message("Create a function")
client.send_message("Test it")
client.send_message("Now optimize it")

client.stop()
```

## Migration Path

If you're using `Agent` with sessions:

```python
# Before (Agent with session)
from auggie_sdk import Auggie

agent = Auggie(workspace_root="/path/to/workspace", model="claude-3-5-sonnet-latest")

with agent.session() as session:
    session.run("Create a function")
    session.run("Test it")
    session.run("Optimize it")
```

Migrate to ACP client:

```python
# After (ACP client - simpler!)
from auggie_sdk.acp import AuggieACPClient

client = AuggieACPClient(
    workspace_root="/path/to/workspace",
    model="claude-3-5-sonnet-latest"
)

client.start()
client.send_message("Create a function")
client.send_message("Test it")
client.send_message("Optimize it")
client.stop()

# Or use context manager
with AuggieACPClient(workspace_root="/path/to/workspace") as client:
    client.send_message("Create a function")
    client.send_message("Test it")
    client.send_message("Optimize it")
```

## Summary

| Feature | Agent Library | ACP Client |
|---------|--------------|------------|
| **Session Continuity** | Manual (with `session()`) | Automatic |
| **Process Model** | New process per request | Long-running process |
| **Performance** | ~500ms overhead per request | ~500ms overhead once |
| **Real-time Streaming** | ❌ No | ✅ Yes |
| **Event Listeners** | ❌ No | ✅ Yes |
| **API Complexity** | Simple for one-off, complex for sessions | Consistent |
| **Best For** | One-off requests | Multiple related requests |

**Key Takeaway:** The ACP client's long-running architecture makes session resume unnecessary - it's a feature, not a bug! 🎉

## See Also

- [Agent Event Listener](./AGENT_EVENT_LISTENER.md)
- [Claude Code Client](./CLAUDE_CODE_CLIENT.md)
- [Prompt to Code](./PROMPT_TO_CODE.md)
