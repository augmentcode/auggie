# Augment Python SDK Architecture

## Overview

The Augment Python SDK is organized into two distinct layers:

1. **Protocol Layer** - Pure ACP (Agent Client Protocol) implementation
2. **SDK Layer** - Augment-specific convenience features and utilities

This separation ensures the protocol client remains reusable and spec-compliant, while the SDK layer provides user-friendly features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Code                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────┬─────────────────┐
                              ↓                 ↓                 ↓
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│      SDK Layer (Optional)        │  │    Protocol Layer (Core)         │
├──────────────────────────────────┤  ├──────────────────────────────────┤
│                                  │  │                                  │
│  Agent (subprocess-based)        │  │  AuggieACPClient                 │
│  - run(return_type=int)          │  │  - start()                       │
│  - Typed returns                 │  │  - send_message() → str          │
│  - Session management            │  │  - stop()                        │
│  - CLI subprocess spawning       │  │  - Pure ACP protocol             │
│                                  │  │  - Event listeners               │
│  AgentACP (future)               │  │  - Long-running process          │
│  - run(return_type=int)          │  │                                  │
│  - Typed returns                 │  │  Model/workspace config:         │
│  - Uses AuggieACPClient ────────────→│  - model parameter               │
│  - Agent-compatible API          │  │  - workspace_root parameter      │
│                                  │  │  - Passed as CLI args            │
└──────────────────────────────────┘  └──────────────────────────────────┘
                                                      │
                                                      ↓
                                      ┌──────────────────────────────────┐
                                      │   Augment CLI (ACP mode)         │
                                      │   - Runs with --acp flag         │
                                      │   - Implements ACP protocol      │
                                      │   - Long-running process         │
                                      └──────────────────────────────────┘
```

## Layer Responsibilities

### Protocol Layer: `AuggieACPClient`

**Purpose:** Pure implementation of the ACP (Agent Client Protocol) specification.

**Responsibilities:**
- ✅ Spawn CLI in ACP mode
- ✅ Implement ACP protocol (initialize, newSession, prompt, etc.)
- ✅ Handle bidirectional JSON-RPC communication
- ✅ Stream responses via event listeners
- ✅ Manage process lifecycle
- ✅ Pass configuration via CLI arguments (model, workspace_root)

**NOT Responsible For:**
- ❌ Typed return values (not in ACP spec)
- ❌ Augment-specific features
- ❌ Convenience wrappers
- ❌ Response parsing beyond protocol requirements

**API:**
```python
from auggie_sdk.acp import AuggieACPClient

client = AuggieACPClient(
    model="claude-3-5-sonnet-latest",      # CLI arg
    workspace_root="/path/to/workspace",   # CLI arg
    listener=MyEventListener()             # ACP feature
)

client.start()                             # ACP: initialize + newSession
response = client.send_message("...")      # ACP: prompt → returns str
client.clear_context()                     # ACP: clear
client.stop()                              # Cleanup
```

### SDK Layer: `Agent` and `AgentACP`

**Purpose:** User-friendly API with Augment-specific features.

**Responsibilities:**
- ✅ Typed return values (int, str, bool, list, dict, dataclass, enum)
- ✅ Convenient API for common use cases
- ✅ Session management (for subprocess-based `Agent`)
- ✅ Response parsing and validation
- ✅ Error handling and retries
- ✅ Augment-specific conventions

**Current Implementation:**

#### `Agent` (subprocess-based)
```python
from auggie_sdk import Auggie

agent = Auggie(
    workspace_root="/path/to/workspace",
    model="claude-3-5-sonnet-latest"
)

# Typed returns - SDK feature
result = agent.run("What is 2 + 2?", return_type=int)
print(result)  # 4 (int, not str)

# Session management - SDK feature
with agent.session() as session:
    session.run("Create a function")
    session.run("Test it")  # Remembers context
```

#### `AgentACP` (future - ACP-based)
```python
from auggie_sdk import AgentACP

agent = AgentACP(
    workspace_root="/path/to/workspace",
    model="claude-3-5-sonnet-latest"
)

# Same API as Agent, but uses ACP client internally
result = agent.run("What is 2 + 2?", return_type=int)
print(result)  # 4 (int, not str)

# No session management needed - automatic!
agent.run("Create a function")
agent.run("Test it")  # Automatically remembers context
```

## Feature Mapping

| Feature | Protocol Layer | SDK Layer | Notes |
|---------|---------------|-----------|-------|
| **Model selection** | ✅ CLI arg | ✅ Constructor param | Passed to CLI via `--model` |
| **Workspace root** | ✅ CLI arg | ✅ Constructor param | Passed to CLI via `--workspace-root` |
| **Send message** | ✅ `send_message()` | ✅ `run()` | Protocol returns str, SDK can parse |
| **Typed returns** | ❌ Not in spec | ✅ `run(return_type=T)` | SDK-level feature |
| **Event streaming** | ✅ Event listeners | ⚠️ Optional | Protocol feature, SDK can expose |
| **Session continuity** | ✅ Automatic | ✅ Automatic (ACP) / Manual (subprocess) | Long-running vs subprocess |
| **Context clearing** | ✅ `clear_context()` | ✅ Exposed | Protocol feature |
| **Timeout** | ✅ Per-message | ✅ Per-request | Both support |

## Design Principles

### 1. Separation of Concerns

**Protocol Layer:**
- Implements ACP specification exactly
- No Augment-specific features
- Reusable by other projects
- Minimal dependencies

**SDK Layer:**
- Augment-specific conveniences
- User-friendly API
- Can use protocol layer or subprocess
- Rich feature set

### 2. Configuration via CLI Arguments

The ACP client passes configuration to the CLI via command-line arguments rather than protocol messages:

```python
# Model and workspace are CLI arguments
cli_args = ["node", "augment.mjs", "--acp", "--model", "claude-3-5-sonnet-latest", "--workspace-root", "/path"]

# NOT protocol parameters
# NewSessionRequest only has: cwd, mcpServers
```

**Why:**
- Model selection happens at CLI initialization
- Workspace root affects CLI behavior globally
- Keeps protocol simple and focused
- Matches how CLI is designed

### 3. Long-Running Session Model

The ACP client maintains a single persistent session:

```python
client.start()              # Creates ONE session
client.send_message("A")    # Same session
client.send_message("B")    # Same session
client.send_message("C")    # Same session
client.stop()               # Ends session
```

**Benefits:**
- Automatic context continuity
- No session resume needed
- Better performance (no subprocess overhead)
- Real-time streaming

**Contrast with subprocess model:**
```python
agent.run("A")  # New process, new session
agent.run("B")  # New process, new session - NO CONTEXT

with agent.session() as session:
    session.run("A")  # Process with session ID
    session.run("B")  # New process, resumes session - HAS CONTEXT
```

## Migration Path

### Current State
- ✅ `Agent` - Subprocess-based, full-featured
- ✅ `AuggieACPClient` - Protocol layer, model/workspace support

### Future State
- ✅ `Agent` - Keep for simple use cases
- ✅ `AuggieACPClient` - Protocol layer (stable)
- 🔄 `AgentACP` - SDK wrapper using ACP client (to be implemented)

### When to Use Each

**Use `Agent` (subprocess) when:**
- Simple one-off requests
- Don't need real-time streaming
- Want simplest API
- Explicit session control preferred

**Use `AuggieACPClient` (protocol) when:**
- Building custom integrations
- Need full control over ACP protocol
- Want event-driven architecture
- Building tools/libraries

**Use `AgentACP` (future) when:**
- Multiple related requests
- Want typed returns + automatic sessions
- Need better performance than subprocess
- Want Agent-compatible API with ACP benefits

## Implementation Status

### ✅ Complete
- [x] `AuggieACPClient` with model and workspace_root parameters
- [x] CLI argument passing for configuration
- [x] Automatic session continuity
- [x] Event listener support
- [x] Documentation and examples

### 🔄 Future (Optional)
- [ ] `AgentACP` wrapper class
- [ ] Typed return values in SDK layer
- [ ] Migration guide from `Agent` to `AgentACP`
- [ ] Performance benchmarks

### ❌ Not Planned
- Typed returns in `AuggieACPClient` (belongs in SDK layer)
- Session resume in ACP client (not needed - long-running)
- Protocol extensions for Augment-specific features (use CLI args)

## Summary

The architecture cleanly separates protocol implementation from SDK conveniences:

- **`AuggieACPClient`** = Pure ACP protocol, reusable, spec-compliant
- **`Agent`/`AgentACP`** = User-friendly SDK with typed returns and conveniences

This design keeps the protocol layer clean while providing rich features in the SDK layer.
