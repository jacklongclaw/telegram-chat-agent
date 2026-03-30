#!/bin/bash
# Telegram 消息分类仪表盘启动脚本

cd "$(dirname "$0")"

echo "🚀 启动 Telegram 消息分类仪表盘..."
echo ""

# 检查是否有数据文件
if [ ! -d "data" ]; then
    mkdir -p data
    echo "📁 创建数据目录: data/"
fi

# 启动服务器
exec npx tsx scripts/server.ts
