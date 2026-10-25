#!/bin/bash
# 開発サーバー(5175)が落ちたら起動し直す。起動した PID を /tmp/claude-0/vite23.pids に追記する
cd /home/user/BOM
while true; do
  if ! curl -s -o /dev/null --max-time 3 http://localhost:5175/; then
    nohup npx vite --config usertest/mid/r23/vite.r23.config.mjs --port 5175 --strictPort > /tmp/claude-0/vite23.log 2>&1 &
    echo "$! $(date +%T) restart" >> /tmp/claude-0/vite23.restarts
    sleep 6
    pgrep -f "vite --config usertest/mid/r23/vite.r23.config.mjs" >> /tmp/claude-0/vite23.pids
  fi
  sleep 3
done
