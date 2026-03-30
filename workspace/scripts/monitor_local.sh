#!/bin/bash
# ASTER 价格监控 - 本地运行版本（带代理）
# 使用方法：在你的本地机器上运行这个脚本

echo "========================================"
echo "  ASTER 价格监控 - 本地运行"
echo "========================================"
echo ""

# 检查代理
echo "检查代理设置..."
if [ -n "$https_proxy" ]; then
    echo "✅ 使用环境变量代理: $https_proxy"
    PROXY_OPTION="-x $https_proxy"
elif [ -n "$http_proxy" ]; then
    echo "✅ 使用环境变量代理: $http_proxy"
    PROXY_OPTION="-x $http_proxy"
else
    echo "⚠️  未设置代理环境变量，尝试使用默认代理..."
    PROXY_OPTION="-x http://127.0.0.1:7890"
fi

echo ""
echo "配置信息："
echo "  阈值: 0.6981 USDT"
echo "  Chat ID: 7722263190"
echo "  Bot: @aster_bitcoin_price_monitor_bot"
echo ""

# Bot Token
TOKEN="8598944981:AAHIRnEOh5OBj8y1hb06gzZp561H8Kf-YWY"

# 发送测试消息
echo "发送测试消息到 Telegram..."
RESULT=$(curl -s $PROXY_OPTION \
    -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    -H "Content-Type: application/json" \
    -d '{"chat_id":7722263190,"text":"🧪 ASTER 监控启动测试","parse_mode":"HTML"}' \
    --max-time 15)

if echo "$RESULT" | grep -q '"ok":true'; then
    echo "✅ Telegram 连接成功！"
else
    echo "❌ Telegram 连接失败"
    echo "错误: $RESULT"
    exit 1
fi

echo ""
echo "开始监控 ASTER 价格..."
echo "按 Ctrl+C 停止"
echo ""

# 主循环
while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$TIMESTAMP] 检查价格..."
    
    # 这里可以添加获取价格的逻辑
    # 现在先发送一条状态消息
    
    # 每 5 分钟检查一次
    sleep 300
done
