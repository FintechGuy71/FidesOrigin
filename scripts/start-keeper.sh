#!/bin/bash
# FidesOrigin Quarantine Keeper 启动脚本
# 用法: ./start-keeper.sh [start|stop|status|logs]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDFILE="/tmp/fidesorigin-keeper.pid"
LOGFILE="/tmp/fidesorigin-keeper.log"
KEEPER_SCRIPT="$SCRIPT_DIR/../scripts/quarantine-keeper.js"

check_node() {
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
  fi
}

start() {
  check_node
  if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
    echo "⚠️ Keeper already running (PID: $(cat $PIDFILE))"
    exit 0
  fi

  echo "🚀 Starting FidesOrigin Quarantine Keeper..."
  echo "   Script: $KEEPER_SCRIPT"
  echo "   Log: $LOGFILE"

  nohup node "$KEEPER_SCRIPT" > "$LOGFILE" 2>&1 &
  echo $! > "$PIDFILE"
  echo "✅ Keeper started (PID: $!)"
  echo "   View logs: tail -f $LOGFILE"
}

stop() {
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    if kill -0 "$PID" 2>/dev/null; then
      echo "🛑 Stopping Keeper (PID: $PID)..."
      kill "$PID"
      rm "$PIDFILE"
      echo "✅ Keeper stopped"
    else
      echo "⚠️ Keeper not running"
      rm "$PIDFILE"
    fi
  else
    echo "⚠️ No PID file found"
  fi
}

status() {
  if [ -f "$PIDFILE" ] && kill -0 $(cat "$PIDFILE") 2>/dev/null; then
    echo "✅ Keeper running (PID: $(cat $PIDFILE))"
    echo "📊 Recent activity:"
    tail -n 20 "$LOGFILE" 2>/dev/null || echo "   No logs yet"
  else
    echo "❌ Keeper not running"
  fi
}

logs() {
  if [ -f "$LOGFILE" ]; then
    tail -f "$LOGFILE"
  else
    echo "❌ Log file not found"
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  logs) logs ;;
  restart) stop; sleep 2; start ;;
  *) echo "Usage: $0 [start|stop|status|logs|restart]" ;;
esac
