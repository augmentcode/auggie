# Auggie

![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-brightgreen?style=flat-square) [![npm](https://img.shields.io/npm/v/@augmentcode/auggie.svg?style=flat-square)](https://www.npmjs.com/package/@augmentcode/auggie)

Auggie is Augment’s agentic coding CLI that runs in your terminal. It understands your codebase and helps you ship faster by analyzing code, making safe edits, and automating routine tasks — all via natural language.

Learn more in the Augment Docs:

- Overview: [Introducing Auggie CLI](https://docs.augmentcode.com/cli/overview)
- Custom Commands Examples: [Custom Slash Commands Examples](https://docs.augmentcode.com/cli/custom-commands-examples)

## Quick start

1. Install Auggie (Node 22+ required):

```sh
npm install -g @augmentcode/auggie@latest
```

2. Login:

```sh
auggie login
```

3. Run Auggie in your project directory:

```sh
cd /path/to/your/project
auggie "optional initial prompt"
```

- Use `auggie --print "your instruction"` to run once and print to stdout (great for CI)
- Add `--quiet` to return only the final output

## Common flags

| Flag | Description |
| :--- | :---------- |
| `-p, --print` | Run one instruction and print to stdout (non-interactive) |
| `-q, --quiet` | Show only the final assistant message |
| `-a, --ask` | Ask mode — retrieval and non-editing tools only |
| `-m, --model <id>` | Select the model to use (`auggie model list` to see options) |
| `-c, --continue` | Resume the most recent conversation |
| `-r, --resume [id]` | Resume a specific session by ID or pick interactively |
| `--rules <path>` | Additional rules file to append to workspace guidelines |
| `--mcp-config <cfg>` | Path to MCP server configuration JSON |

See the full [CLI reference](https://docs.augmentcode.com/cli/reference) for all flags and commands.

## Custom slash commands

Store reusable prompts in `.augment/commands/` as markdown files with frontmatter. Once added, they’re available as slash commands (e.g., `/code-review path/to/file`).

Example structure:

```
your-project/
├─ .augment/
│  └─ commands/
│     ├─ code-review.md
│     ├─ bug-fix.md
│     ├─ security-review.md
│     └─ performance-optimization.md
└─ ...
```

See example command templates in `.augment/commands/` and the docs page linked above.

## GitHub Actions for PRs

Use our official GitHub Actions to improve PR quality automatically:

- Augment Agent: [augmentcode/augment-agent](https://github.com/augmentcode/augment-agent)
- Review PR: [augmentcode/review-pr](https://github.com/augmentcode/review-pr)
- Describe PR: [augmentcode/describe-pr](https://github.com/augmentcode/describe-pr)

Examples:

- Review PR workflow example: [example usage](https://github.com/augmentcode/review-pr#example-usage)
- Describe PR workflow example: [example usage](https://github.com/augmentcode/describe-pr#example-usage)

Add the workflows under `.github/workflows/` in your repository.

## Feedback and bug reports

- In Auggie or the IDE agent, use `/feedback` to send feedback or report bugs directly with helpful context.
- Alternatively, open a GitHub issue using our templates (Bug report / Feature request) in the [Github Issues](https://github.com/augmentcode/auggie/issues) tab.

## Community

- Support: [Support Portal](https://support.augmentcode.com/)
- Reddit: https://www.reddit.com/r/AugmentCodeAI/

## Privacy and data usage

See Augment’s policies at [augmentcode.com/legal](https://augmentcode.com/legal) and product docs for latest details.
