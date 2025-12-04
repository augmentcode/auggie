#!/bin/bash
set -e

# Change to the directory where this script is located
cd "$(dirname "$0")"

echo "=========================================="
echo "Running User Examples from USER_README.md"
echo "=========================================="
echo ""

for script in *.py; do
    if [ -f "$script" ]; then
        echo "=========================================="
        echo "Running: $script"
        echo "=========================================="
        python "$script"
        echo ""
        echo "✅ $script completed successfully"
        echo ""
    fi
done

echo "=========================================="
echo "All examples completed successfully! ✅"
echo "=========================================="
