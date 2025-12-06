#!/usr/bin/env bash
# Simple start/stop/status helper for a local static server
# Serves the parent directory of this script (the `bf_foot` workspace)
#
# Usage:
#   ./server.sh start   # start server (default port: 8080)
#   ./server.sh stop    # stop server
#   ./server.sh status  # show running status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$SCRIPT_DIR/.server.pid"
PORT="${PORT:-8080}"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  echo "Usage: $0 {start|stop|status}" >&2
  exit 2
}

is_running() {
  if [ -f "$PIDFILE" ]; then
    pid=$(cat "$PIDFILE")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

start_server() {
  if is_running; then
    echo "Server already running (PID $(cat "$PIDFILE"))"
    return 0
  fi

  echo "Starting static server serving '$ROOT_DIR' on port $PORT"
  # start in background and save PID
  (cd "$ROOT_DIR" && nohup python3 -m http.server "$PORT" >/dev/null 2>&1 & echo $! > "$PIDFILE")

  # short wait and verify
  sleep 0.2
  if is_running; then
    echo "Started (PID $(cat "$PIDFILE"))"
  else
    echo "Failed to start server" >&2
    exit 1
  fi
}

stop_server() {
  if ! is_running; then
    echo "Server not running"
    return 0
  fi
  pid=$(cat "$PIDFILE")
  echo "Stopping server (PID $pid)"
  kill "$pid" 2>/dev/null || true

  # wait a short time for process to exit
  for i in 1 2 3 4 5; do
    if kill -0 "$pid" 2>/dev/null; then
      sleep 0.2
    else
      break
    fi
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "Server did not exit, sending SIGKILL"
    kill -9 "$pid" 2>/dev/null || true
  fi

  rm -f "$PIDFILE"
  echo "Stopped"
}

status_server() {
  if is_running; then
    echo "Running (PID $(cat "$PIDFILE"))"
  else
    echo "Not running"
  fi
}

if [ $# -ne 1 ]; then
  usage
fi

case "$1" in
  start) start_server ;;
  stop) stop_server ;;
  status) status_server ;;
  *) usage ;;
esac
