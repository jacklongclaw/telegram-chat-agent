#!/bin/bash

echo "=== 正在终止openclaw ==="
lsof -nP -iTCP:5000 -sTCP:LISTEN -t | xargs -r kill -9