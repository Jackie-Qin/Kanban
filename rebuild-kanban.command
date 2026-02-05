#!/bin/bash
# Rebuild and launch Kanban app

cd "$(dirname "$0")"

echo "🔨 Building Kanban..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build complete! Launching app..."
    open release/mac-arm64/Kanban.app
else
    echo "❌ Build failed!"
    read -p "Press Enter to close..."
fi
