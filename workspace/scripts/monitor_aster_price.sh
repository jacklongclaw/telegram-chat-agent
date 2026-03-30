#!/bin/bash

# ASTER/USDT 价格监控脚本
# 当价格高于 0.6981 时发送微信消息

THRESHOLD=0.6981
COIN_ID="aster"  # CoinGecko ID

# 获取当前价格（使用 CoinGecko API）
PRICE_DATA=$(curl -s "https://api.coingecko.com/api/v3/simple/price?ids=${COIN_ID}&vs_currencies=usd" 2>/dev/null)

if [ -z "$PRICE_DATA" ] || [ "$PRICE_DATA" = "null" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 无法获取价格数据"
    exit 1
fi

# 提取价格
CURRENT_PRICE=$(echo "$PRICE_DATA" | grep -o '"usd":[0-9.]*' | cut -d':' -f2)

if [ -z "$CURRENT_PRICE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 解析价格失败"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 当前 ASTER 价格: $CURRENT_PRICE USDT"

# 比较价格
if (( $(echo "$CURRENT_PRICE > $THRESHOLD" | bc -l) )); then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ 价格高于阈值 $THRESHOLD！当前: $CURRENT_PRICE"
    
    # 发送微信消息 (使用 webhook 或企业微信)
    # 这里需要配置你的微信 webhook URL
    WECHAT_WEBHOOK_URL="${WECHAT_WEBHOOK_URL:-}"
    
    if [ -n "$WECHAT_WEBHOOK_URL" ]; then
        MESSAGE="🚨 ASTER 价格警报！\n当前价格: $CURRENT_PRICE USDT\n阈值: $THRESHOLD USDT\n时间: $(date '+%Y-%m-%d %H:%M:%S')"
        
        curl -s -X POST "$WECHAT_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{\"msgtype\": \"text\", \"text\": {\"content\": \"$MESSAGE\"}}" > /dev/null
        
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 微信消息已发送"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 未配置微信 Webhook，跳过发送"
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 价格正常，低于阈值 $THRESHOLD"
fi
