#!/bin/bash

# 给 scripts 目录下的脚本添加可执行权限
chmod +x /workspace/projects/scripts/restart.sh /workspace/projects/scripts/start.sh /workspace/projects/scripts/stop.sh

set -e

# 安装插件依赖
echo "Installing plugin dependencies..."
for dir in /workspace/projects/extensions/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "  Installing deps in $dir"
    (cd "$dir" && npm install --omit=dev --silent)
  fi
done

# 安装 hooks 依赖
echo "Installing hook dependencies..."
for dir in /workspace/projects/hooks/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "  Installing deps in $dir"
    (cd "$dir" && npm install --omit=dev --silent)
  fi
done

echo "Done!"
