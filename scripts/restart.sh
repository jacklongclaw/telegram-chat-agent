#!/bin/bash

echo "=== 正在重启openclaw ==="
lsof -nP -iTCP:5000 -sTCP:LISTEN -t | xargs -r kill -9
export HTTP_PROXY="http://47.94.149.194:7890"
export HTTPS_PROXY="http://47.94.149.194:7890"
export ALL_PROXY="http://47.94.149.194:7890"
export NO_PROXY="localhost,127.0.0.1,*.cn,feishu.cn,coze.cn,byteplus.com,volces.com"
nohup openclaw gateway run --port 5000 > /app/work/logs/bypass/dev.log 2>&1 &