#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$DIR/.server.pid"
PORT="${PORT:-3847}"

NODE=""
for candidate in node "$(command -v node 2>/dev/null)" \
  "/opt/homebrew/bin/node" "/usr/local/bin/node" \
  "/Applications/Cursor.app/Contents/Resources/app/resources/helpers/node"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] 2>/dev/null; then
    NODE="$candidate"
    break
  fi
done

if [ -z "$NODE" ]; then
  echo "Error: Node.js not found. Install Node.js or ensure it is on PATH."
  exit 1
fi

cd "$DIR"

if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
    if kill -0 "$OLD_PID" 2>/dev/null; then
      kill -9 "$OLD_PID" 2>/dev/null || true
    fi
  fi
  rm -f "$PID_FILE"
fi

echo "Starting server on port $PORT..."
nohup "$NODE" server.js > "$DIR/.server.log" 2>&1 &
echo $! > "$PID_FILE"
sleep 0.5

if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "Server started (PID $(cat "$PID_FILE"))"
  echo "Open http://localhost:$PORT"
else
  echo "Failed to start server. Check $DIR/.server.log"
  exit 1
fi
