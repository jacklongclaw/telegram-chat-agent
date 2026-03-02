#!/bin/bash

echo "=== 正在启动openclaw ==="
nohup openclaw gateway run --port 5000 > /app/work/logs/bypass/dev.log 2>&1 &