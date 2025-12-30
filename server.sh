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

server_url() {
  printf 'http://localhost:%s/bf_foot_dashboard' "$PORT"
}

open_in_browser() {
  local url
  url=$(server_url)
  # If user set NO_OPEN=1, do not attempt to open a browser
  if [ "${NO_OPEN:-0}" = "1" ]; then
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url" || true
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
    return 0
  fi

  # Fallback to python webbrowser module if available
  if command -v python3 >/dev/null 2>&1; then
    python3 -m webbrowser -t "$url" >/dev/null 2>&1 || true
    return 0
  fi

  return 1
}

port_in_use() {
  # Return 0 if something is listening on the port, 1 otherwise.
  if command -v lsof >/dev/null 2>&1; then
    # Check both IPv4 and IPv6
    if lsof -i :"$PORT" 2>/dev/null | grep LISTEN >/dev/null 2>&1; then
      return 0
    fi
    return 1
  fi

  # Fallback to netstat
  if command -v netstat >/dev/null 2>&1; then
    if netstat -an | grep -E "\.\b$PORT\b" | grep LISTEN >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

port_owner_info() {
  # Print process info for the process owning the listening socket on the port
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P
    return 0
  fi
  if command -v netstat >/dev/null 2>&1 && command -v ps >/dev/null 2>&1; then
    netstat -anp tcp | grep ".$PORT" | grep LISTEN || true
  fi
  return 0
}

start_server() {
  if is_running; then
    echo "Server already started (PID $(cat "$PIDFILE"))"
    echo "URL: $(server_url)"
    return 0
  fi

  if port_in_use; then
    echo "Port $PORT already in use — another server is listening."
    port_owner_info
    echo "URL: $(server_url)"
    return 0
  fi

  echo "Starting static server serving '$ROOT_DIR' on port $PORT"
  # start in background and save PID
  (cd "$ROOT_DIR" && nohup python3 -m http.server "$PORT" >/dev/null 2>&1 & echo $! > "$PIDFILE")

  # short wait and verify the port is now listening
  sleep 0.3
  if port_in_use; then
    # If port is in use but our PID file points to a dead process, try to find the listening PID
    echo "Started (PID $(cat "$PIDFILE" 2>/dev/null || echo 'unknown'))"
    echo "URL: $(server_url)"
    open_in_browser || echo "(Could not open browser automatically)"
  else
    rm -f "$PIDFILE" 2>/dev/null || true
    echo "Failed to start server: nothing is listening on port $PORT" >&2
    exit 1
  fi
}

stop_server() {
  if is_running; then
    pid=$(cat "$PIDFILE")
    echo "Stopping server (PID $pid) — attempting graceful shutdown"
    # Try graceful termination first
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
      echo "Process did not exit after TERM; forcing kill (SIGKILL)"
      kill -9 "$pid" 2>/dev/null || true
      # give a moment for kernel to reap
      sleep 0.1
    fi

    rm -f "$PIDFILE" 2>/dev/null || true
    echo "Stopped"
    return 0
  fi

  # If no PID file or process not running, check if port is still in use
  if port_in_use; then
    echo "No server started by this script, but port $PORT is still in use. Attempting to kill any process on this port."
    # Try to kill all processes listening on the port
    if command -v lsof >/dev/null 2>&1; then
      pids=$(lsof -t -i :"$PORT" -sTCP:LISTEN)
      if [ -n "$pids" ]; then
        echo "Killing PIDs: $pids"
        kill $pids 2>/dev/null || true
        sleep 0.2
        # If still running, force kill
        for pid in $pids; do
          if kill -0 "$pid" 2>/dev/null; then
            echo "Force killing PID $pid"
            kill -9 "$pid" 2>/dev/null || true
          fi
        done
      fi
    fi
    # Check if port is now free
    if port_in_use; then
      echo "Failed to free port $PORT. Manual intervention may be required."
      port_owner_info
      return 1
    else
      echo "Port $PORT is now free."
      return 0
    fi
  else
    echo "Server not running"
    return 0
  fi
}

status_server() {
  if is_running; then
    echo "Running (PID $(cat "$PIDFILE"))"
    echo "URL: $(server_url)"
  else
    echo "No server started by this script"
    if port_in_use; then
      echo "However, port $PORT is in use by another process:"
      port_owner_info
      echo "URL: $(server_url)"
    fi
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
