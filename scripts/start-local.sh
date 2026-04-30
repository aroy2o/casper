#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking MongoDB..."
if command -v mongosh >/dev/null 2>&1; then
  if ! mongosh --eval "db.runCommand({ping:1})" --quiet >/dev/null 2>&1; then
    echo "MongoDB is not running. Start it first:"
    echo "  sudo systemctl start mongod"
    echo "  or brew services start mongodb-community"
    exit 1
  fi
else
  if ! ss -ltn | grep -q "127.0.0.1:27017"; then
    echo "MongoDB is not running on 127.0.0.1:27017. Start it first:"
    echo "  /path/to/mongod --dbpath /path/to/db --bind_ip 127.0.0.1 --port 27017 --fork --logpath /tmp/mongod.log"
    exit 1
  fi
fi

echo "Checking Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
  echo "Redis is not running. Start it first:"
  echo "  sudo systemctl start redis"
  echo "  or redis-server --daemonize yes"
  exit 1
fi

echo "Checking Ollama models..."
if ! curl -s http://127.0.0.1:11434/api/tags | grep -q "qwen2.5-coder:7b"; then
  echo "qwen2.5-coder:7b not found in Ollama. Pulling model..."
  ollama pull qwen2.5-coder:7b
fi

echo "Starting ML service..."
cd "$ROOT_DIR/ml-service" || exit 1
uvicorn main:app --host 0.0.0.0 --port 8000 --reload >/tmp/casper-ml.log 2>&1 &
ML_PID=$!
echo "ML service PID: $ML_PID"

sleep 3

echo "Starting backend..."
cd "$ROOT_DIR/backend" || exit 1
npm run dev >/tmp/casper-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 5

cd "$ROOT_DIR" || exit 1
bash scripts/verify.sh

echo "Logs: use 'tail -f /tmp/casper-*.log' to watch services"