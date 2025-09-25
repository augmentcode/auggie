# Augment Commands

Pre-built command templates for common development tasks. Use directly or customize for your needs.

## Installation

### Install All Commands
```bash
mkdir -p ~/.augment/commands
cd ~/.augment/commands
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/code-review.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/documentation.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/tests.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/bug-fix.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/performance-optimization.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/security-review.md
```

### Install Specific Commands
```bash
mkdir -p ~/.augment/commands
cd ~/.augment/commands
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/code-review.md
curl -O https://raw.githubusercontent.com/augmentcode/auggie/main/examples/commands/documentation.md
```

## Usage

```bash
auggie "/code-review src/main.py"
auggie "/documentation src/utils.py"
auggie "/tests src/api/"
```

## Available Commands

- `code-review.md` - Code quality checks
- `documentation.md` - Documentation generation
- `tests.md` - Test coverage
- `bug-fix.md` - Debugging assistance
- `performance-optimization.md` - Performance improvements
- `security-review.md` - Security analysis

## Customization

Edit the `.md` files to modify prompts, change models, or adjust behavior for your needs.