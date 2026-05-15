# Changelog

### 0.27.2

#### Improvements
- **Network Reliability**: CLI network requests now use a consistent HTTP client for more reliable shutdown and connection cleanup.

### 0.27.0

#### New Features
- **Cosmos Handoff**: Added a `/cosmos` command for handing a session off to Cosmos.
- **Warp Integration**: Added Warp detection and an `/install-warp` command.
- **Webhooks**: Added GitHub webhook support, custom webhook capabilities, multi-line descriptions, and webhook updates.
- **Plugin Marketplaces**: Plugin marketplaces can now be added from a specific branch or tag.
- **Hooks**: Added PromptSubmit hooks and support for updating input from PreToolUse hooks.
- **Subagents**: Subagents can now report when they finish work.
- **Daemon Pool Status**: Added commands to view daemon pool slot usage and per-daemon status.
- **Session History**: ACP integrations can now access CLI session history.

#### Improvements
- **Session Picker**: The session picker shows more sessions, supports scrolling, and filters out subagent sessions.
- **Pasted Text**: Long pasted content now collapses into expandable paste blocks.
- **Cloud Agent Resources**: Cloud agents can load skills, commands, MCP servers, and extra agent directories from shared file storage.
- **Connection Reliability**: Longer chat stream timeouts and improved daemon liveness checks reduce false reconnects.
- **Tool Output Handling**: Large tool results are truncated more safely in cloud sessions.
- **Shared Sessions**: CLI shared session listings now better match organization access controls.
- **Environment Management**: Environment snapshots are materialized on creation, and apply conflicts are easier to understand.
- **Expert Configuration**: Expert bundles preserve idle cleanup settings, and triggers warn when required capabilities are missing.
- **Workspace Shortcut**: `run-as-agent` now accepts `-w` as a shortcut for `--workspace`.
- **Terminology**: User-facing messages now consistently use Cosmos terminology.

#### Bug Fixes
- Fixed webhook CLI route handling.
- Fixed custom webhook subscriptions and event source filtering.
- Fixed header-auth MCP secrets in daemon mode.
- Fixed unnecessary empty session creation after connection failures and in MCP mode.
- Fixed muted background colors and summary text appearing in stream anchors.
- Fixed expert include render failures so agents degrade gracefully.

### 0.25.1

#### New Features
- **Transcript Persistence**: New `keepTranscriptOnNewSession` setting preserves conversation history when starting a new TUI session.
- **Non-Interactive Login**: Added `--no-tui` flag to `auggie login` for headless and scripted environments.

#### Bug Fixes
- Fixed TUI flickering during indexing, typing, and sub-agent work.
- Fixed stale agent state persisting after starting a new session with `/new`.
- Fixed `rebuild` command failing when script file paths were passed instead of file contents.
- Fixed queued request IDs not being preserved across retries.

### 0.25.0

#### Improvements
- **Model Defaults**: Default models updated to Claude 4.5/4.6.
- **Image Paste**: Cmd+V is now accepted as an image paste shortcut in addition to the existing binding.
- **Shell Support**: Shell tools now support `sh`, and the TUI uses your configured shell for async commands.
- **Billing Summary**: Account display now shows a billing summary with credits and cost breakdown including sub-agent rollup.
- **MCP Environment Variables**: MCP servers support environment variable expansion and working directory injection.
- **Indexing Visibility**: Improved status visibility when codebase indexing gets stuck.
- **Session List Pagination**: Large session lists are now paginated to avoid timeouts.

#### Bug Fixes
- Fixed ESC key behavior in Enhance mode and slash command menus no longer interrupting the agent.
- Fixed image attachments not passing through the TUI message queue.
- Fixed tool-call blocks disappearing in cloud-connect TUI history.
- Fixed `session delete` failing when workspace ID is missing.
- Fixed duplicate rows appearing in the CLI transcript queue.
- Fixed API retry error messages appearing raw in TUI and headless output.
- Fixed session errors not being surfaced to users.
- Removed spurious "Logging configured" message on CLI startup.
- Fixed `/stats` message count accuracy by excluding tool-result continuations.
- Fixed `/web` fallback link formatting.
- Fixed `view_range` display for end-of-file ranges in tool call titles.

### 0.24.0

#### New Features
- **Image Support**: The view tool now supports displaying image files (PNG, JPG, GIF, WEBP).
- **Context Stats**: Added `auggie context stats` command to display context and token usage information.
- **JSON Output**: `auggie account status` now supports a `--json` flag for machine-readable output.
- **Terminal Title Control**: Added option to prevent the CLI from updating the terminal title.

#### Improvements
- **Upgrade Handling**: `auggie upgrade` now correctly handles non-global npm installations.
- **Conversation Memory**: Improved memory calculation to account for full agent state.

#### Bug Fixes
- Fixed OAuth secrets not being cleaned up when an MCP server is removed.
- Fixed duplicate MCP servers appearing in `/mcp list`.
- Fixed TUI display glitches when resizing the terminal window.

### 0.23.0

#### New Features
- **Git-Based Plugins**: Marketplace plugins can now be sourced directly from Git repositories.

#### Improvements
- **Login Connectivity Check**: The CLI now tests connectivity to Augment before completing the login flow, providing earlier feedback on connection issues.
- **Unsupported Plugin Hooks**: Unsupported plugin hooks now show a compact informational message instead of verbose warnings.
- **Tool Search**: Improved tool search UX and reliability.
- **About Command**: `/about` now displays the active runtime (Node or Bun).

### 0.22.0

#### New Features
- **Fork Session**: Added `/fork` slash command to fork the current session into a new one.
- **Custom Themes**: Users can now override the default TUI theme.

#### Improvements
- **Summarization Status**: Conversation summarization indicator is now only shown when summarization is actively happening.
- **Help Menu**: The `--wait-for-indexing` and `--plugin-dir` flags are now visible in `auggie --help` output.
- **Plugin Auto-Enable**: Plugins loaded via `--plugin-dir` are now automatically enabled for skills and commands.
- **Tool Permission Feedback**: Denying a tool permission request now provides clearer feedback.
- **Error Details**: Fetch errors now surface more detailed cause information.

#### Bug Fixes
- Fixed excessive summarization calls within a single agent turn.
- Fixed Tab-only navigation for multi-question prompts in the TUI.
- Fixed MCP server initialization timing in ACP mode.
- Fixed queue message rejection handling for enqueued messages.

### 0.21.0

#### New Features
- **Automatic Marketplace Updates**: Installed plugin marketplaces are now automatically updated in the background, with a prompt for workspace-recommended marketplaces.
- **MCP OAuth Paste Fallback**: Added a fallback option to paste the authentication code during MCP OAuth flows, simplifying setup in remote SSH environments.

#### Improvements
- **Plan Mode**: The chat transcript now remains visible when transitioning from plan mode to implementation.
- **Plan Mode Sub-Agent**: Optimized execution by eliminating redundant output operations.
- **`auggie command list`**: Output now consistently displays help text.
- **Startup Login Screen**: Updated the message for new users.
- **Terminal Bell**: Now correctly rings when the agent is waiting for user input.

#### Bug Fixes
- Fixed a bug where indexing could fail on extremely large repositories by falling back to a native Git approach.
- Fixed an issue preventing custom plugin commands from being properly invoked via `auggie command`.
- Fixed a visual bug where "Indexing complete" could incorrectly display multiple times at startup.
- Fixed an issue where CLI initialization could hang if connecting to an MCP server became stuck.

### 0.20.0

#### New Features
- **@ Context Picker**: Type `@` in the input to browse and attach agents and rules files to your prompt
- **Marketplace Auto-Update**: Installed marketplace repos are automatically updated in the background on startup; toggle in marketplace settings.
- **Recommended Marketplaces**: Projects can declare recommended marketplaces in `.augment/settings.json` that prompt installation on first open. These must be in the project level settings.json file
- **MCP OAuth Paste Mode**: When authenticating MCP servers over SSH, you can now paste the auth code or redirect URL directly instead of relying on localhost redirect
- **Enter Plan Mode Tool**: The agent can now enter plan mode mid-conversation when appropriate

#### Deprecated
- **Deprecated various flags for auth** - ENV variables AUGMENT_API_TOKEN, AUGMENT_API_URL and flags `--augment-token-file` and `--api-url` are no longer supported
- Use `AUGMENT_SESSION_AUTH` and `--augment-session-json` instead

#### Improvements
- **Parallel Tool Execution**: The CLI agent loop now executes independent tools in parallel for faster responses
- **Plan Mode**: Plans are now saved to `~/.augment/plans/` and plan mode enforces strict read-only access
- **Notification Bell on Ask-User**: Terminal bell now rings when the agent prompts for user input (when `notificationMode` is set to `bell`)
- **Custom Command History**: Custom slash commands are now saved to input history for easy recall with the up arrow
- **Models List**: `auggie models list` now shows full model information
- **`--help` Output**: Added `--queue`, `--show-credits`, and `--mcp` to the CLI help text
- **`--augment-session-json` Flag**: Now accepts both inline JSON and file paths (e.g., `--augment-session-json ~/.augment/session.json`)
- **Conversation Retrieval**: Improved relevance ranking and caching for the conversation retrieval tool
- **Terminal Tool**: Better detection of commands that block waiting for stdin input
- **Jira/Confluence Errors**: Validation errors from Jira and Confluence are now surfaced in chat instead of showing a generic failure message

#### Bug Fixes
- Fixed `/mcp` toggle not actually enabling/disabling MCP servers
- Fixed cursor position after the `/clear` command
- Fixed file write/delete silently failing in multi-folder workspaces
- Fixed queue display showing duplicate messages
- Fixed auggie command [name] syntax for executing custom commands

### 0.19.0

#### New Features
- Multi-workspace support: work with multiple folders simultaneously via `--add-workspace` flag or `/add-workspace` slash command
- Skills as slash commands: trigger skills deterministically via `/` commands instead of relying on agent auto-detection
- Multiple settings files: choose which settings file to save to when multiple exist, with 🔒 indicators for organization-managed settings
- MCP OAuth scopes: MCP server authentication now supports configuring OAuth scopes

#### Improvements
- Ask-user tool: replaced custom text input with a "Chat about this" option for more natural conversational clarification
- Ask-user shortcuts: press number keys (1–9) to directly select options
 servers
- Session picker: added keyboard shortcuts for faster navigation
- Processing duration: now displays minutes and hours instead of only seconds
- Input history: navigating history no longer opens the slash command menu
- Pasting: pasting text no longer auto-switches to ask mode
- Upgrade notification: now tells you to restart the CLI after upgrading
- Session resume: resuming a session now preserves your originally selected model
- Tool permissions: default to denylist mode to prevent accidental lockout from all tools

#### Bug Fixes
- Fixed CLI crash on startup caused by logger initialization order
- Fixed stuck queued messages in cloud mode
- Fixed apply_patch writing corrupted files when the model produced malformed output
- Fixed slow CLI exit on macOS/Windows (improved from ~27s to ~200ms)

### 0.18.0

#### New Features
- **Model Picker Badges**: Model picker now shows cost tier indicators and server-controlled badges (e.g. "Free", "New")
- **Ask Mode Enhancements**: Slash commands (`/`) and external editor (`Ctrl+O`) now work in Ask mode
- **Single-Click Login**: Streamlined browser-based authentication flow
- **/context**: `/context` to see context window usage

#### Improvements
- **Sub-agents Credit Usage**: Add support for subagents credit usage via non interactive mode for enterprise customers and /stats for all users
- **Faster Tool Execution**: Reduced tool execution delays in large workspaces by caching enumeration state and parallelizing rule file reads
- **Incremental Session Saving**: Agent progress is now saved after each LLM exchange, preventing loss of work if the process crashes mid-turn
- **Message Queue Persistence**: Queued messages are now saved to the session file, so they survive CLI restarts
- **Smarter Input Modes**: Pasting or recalling history entries with a prefix (`/`, `!`, `#`) now automatically enters the corresponding input mode
- **Slash Command Ordering**: Exact alias matches (e.g. `/q` → `queue`) are now prioritized over fuzzy matches
- **Stash/Recall Hints**: Added Ctrl+S (stash) and Ctrl+T (recall) to help screens for easier discovery
- **Task Tool Performance**: Parallelized task tool operations to prevent occasional hanging
- **Chat History Truncation**: Improved content-aware truncation measurement with a higher default limit, preventing premature history loss in long sessions
- **Network Resilience**: Improved error messages and circuit breakers for unstable network connections

### 0.17.0

#### New Features
- Ask mode improvements: Slash commands and Ctrl+O (external editor) now work in ask mode
- Ctrl+R history search: Persistent reverse history search across sessions
- Selective session deletion: Delete individual sessions from the session picker
- Message queue editing: Up arrow key opens the queue popover, with a hint shown in the message placeholder
- Custom slash commands in --queue: Queued messages now resolve custom slash commands (e.g., `--queue "/my-command"`)
- --queue support in non-interactive mode: Queue multiple prompts in `--print` mode for chained workflows

#### Improvements
- Indexing denylist: Permanently decline indexing for specific workspaces with a "Never index this workspace" option
- Incremental session saving: Agent progress is now saved after each LLM exchange, preventing work loss on crashes
- Task management: Task system now auto-recovers if the task list is missing, and task names are shown in update displays
- Sub-agents now have access to MCP tools from their parent agent
- Session auto-rename now triggers correctly for messages with tool calls
- Config wizard: All options now visible without scrolling
- Session list ordering: Newest sessions appear first
- User message display: Improved formatting with full row highlight and brighter text
- Improved summarization with incremental updates and backend-driven token counting
- Remote history sync: Better conflict resolution for synced sessions
- Memory improvement during git indexing
- MCP OAuth: Better handling of non-conformant server responses for dynamic client registration
- TUI rendering flickering improvements

### 0.16.0

#### New Features
- Localhost OAuth login: local sessions now authenticate via browser-based OAuth flow instead of JSON paste
- Session naming: name of sessions via `/rename` command is now displayed to the user
- Model picker search: Option+M hotkey opens the model picker, which now supports search/filter
- Prompt stashing: press Ctrl+S while typing to stash your prompt and recall it later
- `/stats` command: view session billing and usage details
- MCP server toggling: enable/disable individual MCP servers from the MCP popover
- MCP log streaming: MCP server logs are now visible in the TUI for easier debugging
- MCP token variable: `${augmentToken}` variable expansion available for MCP server headers
- `.agents` directory: added support for `.agents` directory for skill and agent discovery
- History summarization indicator: visual indicator shown when conversation history is being summarized
- Hierarchical rules indicator: visual indicator showing active AGENTS.md rules

#### Improvements
- Auth flags: added `--augment-session-json` flag and `AUGMENT_SESSION_AUTH` env var as recommended auth methods (old flags deprecated but still work)
- MCP compatibility: improved compatibility with non-standard MCP server JSON schemas (e.g., mcp-server-terminal)
- View tool display: correctly shows "read directory" with entry count instead of "read file" with "0 lines"
- Image attachment indicator moved closer to the input textbox
- Removed distracting "Your queue is done!" popup
- Removed misleading "To see what's new" message after upgrade

#### Bug Fixes
- Fixed Ctrl+C not exiting the CLI on macOS (no longer requires `kill -9`)
- Fixed crash on exit on Windows (UV_HANDLE_CLOSING assertion)
- Fixed crash when pasting text or using Ctrl+P prompt enhancement
- Fixed `/logout` requiring two attempts to fully log out
- Fixed built-in subagents (explore, plan) disappearing after config changes
- Fixed sub-agents hanging indefinitely during codebase retrieval
- Fixed interleaved/garbled streaming output when sending messages rapidly
- Fixed Option+Backspace word deletion in kitty protocol terminals
- Fixed Ctrl+W word deletion not treating newlines as word boundaries
- Fixed verbose mode truncating the first line of bash command output
- Fixed `--quiet` flag not suppressing MCP server initialization messages
- Fixed MCP server OAuth authentication not responding to Enter key
- Fixed session resume failing after workspace switch
- Fixed `/new` command in cloud agent mode not creating a new session
- Fixed message queue stalling until a new message was sent
- Fixed spurious warnings when settings.json is empty
- Fixed prompt hint color changing when text wraps to a new line
- Fixed custom command parameter hint not disappearing after typing a space
- Fixed text wrapping issues at narrow terminal widths
- Fixed `auggie tools remove` not showing an error for non-existent tools
- Fixed sub-agent failures showing "Done in 0s" instead of error details
- Fixed numpad keys not working correctly
- Improved error messages when resuming sessions

### 0.15.0

#### New Features
- **Agent Skills Support**: Added support for loading specialized domain knowledge from SKILL.md files following the agentskills.io specification
- **Skills Viewer**: Added `/skills` command to display currently loaded skills and approximate token usage
- **Prompt Enhancement**: Added `--enhance-prompt` flag for non-interactive mode to improve prompts before sending to agent

#### Improvements
- **Session State Preservation**: Workspace settings (guidelines, rules, memories) are now preserved when using `/new` command or `--continue` flag
- **Hook Message Display**: Hook messages now appear inline after each tool result instead of being batched at the bottom for better context
- **Session Picker Ordering**: Session picker now displays most recent sessions at the top of the list
- **Bash Mode Display**: Bash mode output now appears muted while running and displays in full when complete
- **Exit Shortcuts**: Improved exit shortcuts (Ctrl+C, Ctrl+D, Escape) to work consistently from any popover state
- **Custom Command Model Override**: Custom command model overrides now only apply to the next response instead of all follow-up responses
- **Chat History Display**: Chat history now only shows user message entries for actual user input, not system-generated content

#### Bug Fixes
- **Session Resumption**: Fixed tool results (ViewTool, EditTool) not rendering when resuming sessions via `--resume` or `/sessions` command
- **Keyboard Navigation**: Fixed keyboard shortcuts not responding while in mention mode
- **Popover Input Handling**: Fixed keyboard input handling in popover states
- **Input Focus Characters**: Fixed issue with focus characters appearing in input

#### UI Updates
- **Queue Mode Shortcuts**: Updated queue mode keyboard shortcuts - X now deletes items, D moves items down


### 0.14.0

#### New Features
- MCP dynamic workspace discovery: MCP mode now supports on-the-fly workspace indexing with --mcp-auto-workspace flag, allowing codebase-retrieval to search different directories without restarting

#### Improvements
- Session management: Most recent sessions now appear at the top of the session picker list
- Chat history: Chat history display fixed on --continue
- Custom commands: Custom command model overrides now only apply to the next response instead of all follow-up responses
- Banner: Updated banner with left-to-right gradient and all caps text

#### Bug Fixes
- Settings management: Settings updates now preserve comments and invalid/unknown fields in settings.json
- Session persistence: Workspace settings (guidelines, rules, memories) are now preserved when using /new command or --continue flag
- Fixed keyboard shortcuts not responding while in mention mode
- Fixed issue with focus characters appearing in input
- Fixed rules not being applied when starting a new session with /new or --continue
- Fixed MCP server orphan processes when parent process terminates
- Onboarding: Updated prompt enhancer onboarding text to clarify credit usage

### 0.13.0

- Terminal title updates: Terminal window title now automatically updates based on conversation context
- Process lifecycle management: Background processes launched via shell tools and launch-process are now tracked in /bash viewer and automatically cleaned up on exit
- Login improvements: Login flow now preserves existing session if authentication fails, and browser opening has a timeout to prevent hanging on remote machines
- Terminal-aware session resumption: Using -c flag now prefers the most recent session from the current terminal
- Model selection: CLI now automatically selects the default model when no model is configured
- Print mode enhancements: Print mode now outputs request ID for easier debugging and support
- Session display consistency: Session display format is now consistent between /sessions list and session picker
- Subagent visibility: Subagent output now includes thinking summary for better visibility into agent reasoning
- Configuration options: Added auto-update configuration option to /config menu
- Rules interface: Improved rules popover interface with better navigation and display

### 0.12.0
- /about command: View user information and debugging details with a new slash command
- Keyboard navigation: Improved navigation with consistent arrow key and j/k shortcuts across all TUI components

### 0.11.1
- Task list UI: Fix uncaught exception that resulted in the agent being unable to add to the tasklist

### 0.11.0

#### MCP Mode Improvements
- **MCP Logging**: Added --log-file option for MCP mode to enable error logging (default: /tmp/augment-log.txt)
- **MCP Performance**: Improved MCP mode startup performance with asynchronous workspace initialization

#### TUI Improvements
- **Thinking Display**: Improved visual styling for thinking entries with better readability and less intrusive appearance
- **Bash Mode**: Bash mode is now available, trigger by pressing !
- **Input History**: Fixed input history navigation state after submitting commands and queued messages now properly added to history

#### Bug Fixes
- **Tool Interruption**: Fixed crash when interrupting tool execution with escape key
- **Parallel Interrupts**: Improved interrupt handling to properly cancel all running parallel sub-agents
- **Exit Message**: Fixed typo in exit tip message

### 0.10.0

#### TUI Features
- **Session Switching**: Added `/sessions` command to switch between sessions without restarting CLI
- **Shell Configuration**: Added `/config` command to configure default shell and startup script
- **Keyboard Shortcuts**: Added Ctrl+/ for undo and Ctrl+Y for redo in normal edit mode
- **Verbose Thinking**: Added verbose output mode for thinking summaries to show full agent reasoning
- **Terminal Focus Tracking**: Added focus detection to hide cursor when terminal window loses focus

#### Session Management
- Show session ID when closing sessions with command to resume by ID
- Support resuming sessions by ID prefix (unambiguous matches)
- Added `-f` flag to filter session list to current workspace only
- Reversed session list order to show newest sessions first

#### UI Improvements
- Fixed text wrapping in tool result summaries
- Truncate web fetch results to 150 characters for better readability
- Increased max length for thinking summary titles to reduce truncation
- Truncate large file views to prevent excessive memory usage

#### Bug Fixes
- Fixed escape key behavior in ask mode (now properly exits to normal mode)
- Fixed race condition in terminal focus tracking that caused escape sequences to leak
- Fixed ACP login flow path identification
- Removed duplicate error messages in output
- Suppressed verbose npm output during auto-upgrade failures for cleaner error messages

### 0.9.1
- Fixed issue with extraneous git processes spawning after indexing

### 0.9.0

#### New Features
- **Session Sharing**: New `/share` command in TUI and `augment session share` CLI command to generate shareable links for chat sessions
- **Auto-Update Control**: New `autoUpdate` setting in settings.json to control automatic updates

#### Improvements
- **ACP Mode**: Now fully released (no longer experimental) with non-interactive chat mode and thinking summaries for better visibility
- **TUI Performance**: Improved rendering performance with Ink 6.5.0 incremental rendering
- **Session Resumption**: Chat history now displays when resuming sessions with `--continue` or `--resume` flags
- **Agent Capabilities**: Enhanced apply_patch tool with more robust patch parsing for better file editing reliability
- **Error Messages**: Improved error messages when file editing operations fail

### 0.8.0

#### New Features
- **Shell Configuration**: Added automatic shell detection and startup script support with `--shell` and `--startup-script` options
- **Windows Support**: Fixed PowerShell execution on Windows for better cross-platform compatibility
- **Terminal Authentication**: Added terminal authentication support for ACP mode
- **ACP Mode**: Made `--acp` flag publicly available for Agent Communication Protocol support
- **Queue Management**: Enabled message queue when agent is busy

#### Improvements
- **Rules Management**: Improved rules filtering and status display for better visibility of manual and dynamic rules

#### Bug Fixes
- **Chat Summarization**: Fixed chat history summarization

### 0.7.0
#### New Features
- **Agent Client Protocol (ACP) Support**: Added comprehensive support for the Agent Client Protocol with terminal authentication, model selection, and indexing control via new `--acp` and `--allow-indexing` flags
- **Thinking Summaries**: Display GPT-5 model thinking process summaries with collapsible sections in the TUI
- **MCP Server Support**: Extended support for HTTP and SSE-based Model Context Protocol servers in addition to stdio servers

#### Improvements
- **CLI is now GA**: Removed beta label from the CLI banner
- **Model Selection**: Simplified model selection with short names (e.g., 'sonnet4.5' instead of full model IDs)
- **File Mentions**: Fixed file mentions to not include @ symbol in prompts

#### Bug Fixes
- **Content Handling**: Improved stability when handling undefined content to prevent crashes

### 0.6.0

#### New Features
- **Parallel Tool Calls**: Added support for models calling multiple tools simultaneously
- **Agent Client Protocol (ACP)**: Added experimental support for external editor integration via `--acp` flag, including file mentions and image support
- **User Rules**: Added support for user-specific rules in `~/.augment/rules` directory for custom agent behavior
- **Tool Management**: Added `--disable-tool` flag and settings configuration to disable specific tools from the agent's toolset

#### Improvements
- **Vim Mode**: Added 'e' keybind for moving to the end of a word, matching standard vim behavior
- **Session Picker**: Improved UI with dynamic column resizing for better readability
- **Settings Validation**: Enhanced error handling to gracefully handle invalid configuration fields

#### Commands & Utilities
- **Request ID**: Added `/request-id` command to display request IDs for debugging and support

### 0.5.10
- **Commands**: Added `/request-id` command to display request IDs for debugging
- **UI**: Improved session picker with dynamic column resizing
- **UI**: Added modified time to session list display
- **UI**: Fixed credit usage display to round down for accuracy
- **Settings**: Improved settings validation to handle invalid fields gracefully
- **Errors**: Added request IDs to API error messages for better debugging
- **Stability**: Fixed crash when using @ with large codebases (150,000+ files)
- **MCP**: Fixed MCP server configuration validation to prevent crashes
- **Performance**: Fixed file picker performance issue that caused UI lag

### 0.5.9
- **Image support**: Attach images to prompts using `--image` flag or the new `/image` command with drag-and-drop and paste support
- **Enhanced clipboard**: Fixed clipboard copying in SSH sessions and terminal multiplexers (tmux/screen) using OSC 52 protocol
- **Session improvements**: Session list now shows last modified time and request IDs for better debugging
- **OAuth improvements**: Display authentication URL when browser fails to open (useful for SSH connections)
- **Simplified commands**: Consolidated `/new` and `/clear` commands for starting fresh conversations

### 0.5.8
- Added `/copy` command to copy request ID or response text to clipboard
- Added OAuth authentication support for MCP (Model Context Protocol) servers
- Added interactive session picker when using `--resume` without specifying a session ID
- Improved help command readability with better formatting and organization
- Added fuzzy search for slash commands, making them easier to discover
- Improved file picker performance with better fuzzy search algorithm for large codebases
- Enhanced tool permission system reliability with improved regex matching
- Fixed extra blank lines appearing at the beginning of agent responses

### 0.5.7
- **MCP Support**: Added `mcp add-json` command for importing MCP servers via JSON configuration
- **MCP Reliability**: Improved MCP server validation to continue loading valid servers even when some configurations are invalid
- **Version Management**: Enhanced upgrade system with semantic versioning support and better handling of prerelease versions
- **TUI Navigation**: Improved input mode switching with history-based navigation for more natural mode transitions
- **File Picker**: Fixed double @ symbol display issue in file picker mode
- **Select Menus**: Fixed arrow key handling in TUI select menus for smoother navigation
- **Non-Interactive Mode**: Agent now runs without stopping for user input when in non-interactive mode
- **Tool Execution**: Fixed regex command execution bug that was causing incorrect string formatting
- **Tool Permissions**: Improved consistency in tool permission settings format
- **Feedback**: Added GitHub repository link to the feedback command for easier issue reporting

### 0.5.6
- New `auggie rules list` command: Display workspace rules and guidelines directly from the CLI
- Enhanced `/rules` command: View workspace rules with improved colored formatting in the TUI
- Smarter TUI mode switching: Exit modes now return to the previous mode instead of always going back to Normal mode, enabling better workflows with FilePicker and Ask modes
- Session continuation tip: See a helpful reminder about using `auggie session continue` when exiting the TUI
- Better error messages: Reduced duplicate warnings and improved error tracking for cleaner output
- Fixed Ctrl+C handling: Properly interrupt the agent when Ctrl+C is pressed while the agent is running
- Fixed Option+Delete: Keyboard shortcut now correctly deletes words backward instead of forward
- Fixed issue where rules were not being attached to the agent request

### 0.5.5

- Ask Mode: a streamlined prompt-first interaction mode with improved transcript rendering.
- New session commands: `auggie session list` and `auggie session resume` to manage and continue sessions.
- MCP quality-of-life: simpler `mcp add` syntax, automatic migration of legacy settings, and a `/status` check.
- Add Ask Mode for CLI/TUI, with formatting and input history improvements.
- Add `auggie session list` and `auggie session resume` commands.
- Add `--permission` flag to configure tool permissions at runtime.
- Support compressed syntax for `mcp add` and auto-migrate legacy MCP settings.json format.
- Add `/status` command to check MCP and rules status.
- Add `--max-turns` to cap agent iterations in print mode.
- Add basic JSON output mode.
- Improve keyboard handling: Ctrl+C to clear input, Ctrl+D forward delete; fix Delete key acting as Backspace.
- Improve non-interactive error messages when auth is missing.
- Fix crash when denying indexing by properly initializing status messaging.
- Fix markdown list indentation in TUI output.
- Fixed issue where rules were dropped when combined content was too long.
- MCP settings now use a record-based schema; legacy formats auto-migrate on run.

### 0.5.4

- Manage Model Context Protocol (MCP) servers with `auggie mcp add|list|remove`
- Configure MCP servers in your settings file (`~/.augment/settings.json`) or via a config file passed with `--mcp-config`
- Skip waiting for indexing to complete before codebase retrieval executes in TUI mode
- If API requests are retried, the CLI shows a clear message so you know what's happening
- Interrupting an operation now cleans up any partial output to keep the screen tidy
- Custom slash command help text now shows the selected model; logging and parsing are consistent in both interactive and non‑interactive modes
- Session tracking is more reliable between the CLI and the API
- Authentication works correctly when you provide both an API token and an API URL
- On Windows, home‑directory detection across different drives has been fixed to avoid incorrect indexing

### 0.5.3

- Non-interactive slash command syntax: Run custom commands directly from the shell with `auggie /<command> ...` (e.g., `auggie "/joke robot" -p`)
- Indexing is now enabled by default in print mode, with a safety guard that disables indexing when running from your home directory to avoid accidentally uploading your entire home folder

### 0.5.2

- Custom commands can now specify which AI model to use in their frontmatter configuration
- Slash commands can be run directly from the command line (e.g., `auggie /help`)
- Improved paste functionality on Windows and support for Chinese character input
- Enhanced feedback submission with proper handling of bracketed paste
- Quiet mode (`--quiet`) now automatically defaults to text output mode
- Empty agent responses are no longer displayed in the CLI interface
- CLI continues gracefully when settings fail to load instead of crashing
- Invalid MCP configuration no longer causes crashes
- Added workspace size limits to prevent indexing excessively large directories
- Fixed typo: "enchance" → "enhance" in prompt enhancer

### 0.5.1

- Added ability to edit existing tool permission rules without recreating them (press 'e' to edit)
- Improved tool permissions UI with better visual hierarchy and clearer permission types display
- Simplified permissions management
- Added long help text that can be toggled with '?' in Normal mode
- Fixed Ctrl+C and double escape shortcuts to work properly in vim mode
- Automatically enter INSERT mode when typing `/vim` command
- Cleaned up vim mode help text for better clarity
- Added slash commands to the history manager for easier command recall
- Fixed command exit behavior - commands like `model list`, `tokens print`, and `session delete` now properly exit after completion
- Prevented indexing when running CLI from home directory to avoid performance issues
- Fixed git worktree detection
- Limited @ file cache size to prevent performance degradation when opened in large directories
- Display default model in brackets when no model is explicitly selected
- Updated onboarding messages and tips for better user experience

### 0.5.0

- Added `/editor` command to compose prompts in your preferred external editor (VS Code, vim, nano, etc.)
- Added `Ctrl+O` keyboard shortcut for quick access to external editor
- Added current AI model name display in the status line footer
- Added `j/k` keyboard navigation support for all menus (Task List, Model Picker, GitHub workflow)
- Improved popover heights for better visibility on smaller screens
- Fixed footer wrapping issues on narrow terminal widths
- Added `/verbose` command to toggle between compact and detailed transcript views
- Fixed verbose command toggle to properly apply changes in the current session
- Improved help text with dynamic command listing and better keyboard shortcut documentation
- Enhanced onboarding experience with clearer feature descriptions
- Implemented comprehensive theme-based system across markdown, tool formatters, and status indicators
- Reduced flicker in iTerm when opening/closing popovers
- Added smart git update events with file tracking for better performance
- Improved error handling in str-replace-editor tool to detect when old and new strings are the same
- Enhanced settings management with structured return types and better error handling
- Fixed double @ appearing in file picker mode
- Fixed indexing confirmation to wait before initializing runtime
- Fixed tool permission type display for "ask-user" permissions
- Corrected typos and improved help text clarity
- Fixed clipboard functionality with proper feedback and error handling
- Enhanced scrollable list components for better handling of long item lists

### 0.4.0

- Added support for custom slash commands (`/<command>`) in interactive mode and `--command` flag in non-interactive mode
- Support for nested custom commands using colon separator (e.g., `nested:command`)
- Custom commands can be defined in `.augment/commands` or `~/.augment/commands` directories
- Added tab completion for slash commands in interactive mode
- Custom commands from Claude Code are now automatically detected and imported
- Added detailed help section for `--command` flag with `auggie --command --help`
- Added shorthand flags for common options: `-i` (input), `-if` (input-file), `-p` (prompt), `-q` (query), `-lm` (list-models), `-m` (model), `-cm` (command)
- Added user settings support via `~/.augment/settings.json` for persistent model preferences
- Support for CLAUDE.md and AGENTS.md configuration files in addition to .augment/guidelines.md
- Settings are validated with schema and gracefully handle malformed JSON
- Added prompt enhancement via Ctrl+P in interactive mode to improve prompts using AI
- Improved navigation in input box with Option+Left/Right for word navigation
- Enhanced multi-line prompt navigation with up/down arrows
- Added repository and branch information badges to agent cards
- Improved select menu system with better modularity and pagination support
- Fixed regression in input history and cursor movement in interactive mode
- Fixed extraneous border display on successful side effects with green border
