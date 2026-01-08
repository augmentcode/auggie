# Changelog

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
