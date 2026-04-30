#!/usr/bin/env bash

set -u

PASS_COUNT=0
TOTAL_CHECKS=5

if command -v mongosh >/dev/null 2>&1; then
  if mongosh --eval "db.runCommand({ping:1})" --quiet >/dev/null 2>&1; then
    echo "✓ MongoDB OK"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ MongoDB FAILED"
  fi
else
  if ss -ltn | grep -q "127.0.0.1:27017"; then
    echo "✓ MongoDB OK"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "✗ MongoDB FAILED"
  fi
fi

if redis-cli ping >/dev/null 2>&1; then
  echo "✓ Redis OK"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ Redis FAILED"
fi

if curl -s http://127.0.0.1:11434/api/tags | grep -q "qwen2.5-coder"; then
  echo "✓ Ollama OK (qwen2.5-coder:7b available)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ Ollama FAILED"
fi

if curl -sf http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo "✓ ML service OK"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ ML service FAILED"
  echo "Run: cd ml-service && uvicorn main:app --reload"
fi

if curl -sf http://127.0.0.1:4000/health >/dev/null 2>&1; then
  echo "✓ Backend OK"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "✗ Backend FAILED"
  echo "Run: cd backend && npm run dev"
fi

if [[ "$PASS_COUNT" -eq "$TOTAL_CHECKS" ]]; then
  echo "🟢 CASPER stack is ready for testing"
else
  echo "🔴 Fix above issues before testing"
fi