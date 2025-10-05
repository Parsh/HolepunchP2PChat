#!/bin/bash

# TypeScript Migration Cleanup Script
# This script removes old JavaScript files that have been migrated to TypeScript
# Run this AFTER verifying that the TypeScript migration works correctly

echo "🧹 TypeScript Migration Cleanup"
echo "================================"
echo ""
echo "This script will remove the following old JavaScript files:"
echo ""

# List files to be removed
OLD_JS_FILES=(
  "src/crypto/CryptoManager.js"
  "src/rooms/RoomManager.js"
  "src/network/NetworkManager.js"
  "src/storage/StorageManager.js"
  "src/chat/ChatClient.js"
  "screens/WelcomeScreen.js"
  "screens/CreateRoomScreen.js"
  "screens/JoinRoomScreen.js"
  "screens/ChatScreen.js"
  "backend/ChatRootPeer.js"
  "backend/server.js"
)

for file in "${OLD_JS_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ❌ $file"
  fi
done

echo ""
echo "⚠️  WARNING: This action cannot be easily undone!"
echo "⚠️  Make sure you have:"
echo "   1. Committed all TypeScript changes"
echo "   2. Tested the application"
echo "   3. Verified TypeScript compilation (npx tsc --noEmit)"
echo ""

read -p "Do you want to proceed? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "❌ Cleanup cancelled"
  exit 0
fi

echo "🗑️  Removing old JavaScript files..."
echo ""

for file in "${OLD_JS_FILES[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "  ✅ Removed $file"
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify the app still works: npm start"
echo "  2. Commit the changes: git add -A && git commit -m 'chore: remove old JS files after TS migration'"
echo ""
