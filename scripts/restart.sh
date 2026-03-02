#!/bin/bash

echo "=== 正在重启openclaw ==="
lsof -nP -iTCP:5000 -sTCP:LISTEN -t | xargs -r kill -9; nohup openclaw gateway run --port 5000 > /app/work/logs/bypass/dev.log 2>&1 &