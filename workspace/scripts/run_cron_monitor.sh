#!/bin/bash
# ASTER 价格监控定时任务
# 这个脚本由 cron 调用，每 5 分钟运行一次

cd /workspace/projects/workspace

# 设置日志
LOG_FILE="logs/cron_monitor.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 开始监控 ==========" >> "$LOG_FILE"

# 运行价格监控脚本
node scripts/monitor_aster_telegram.js >> "$LOG_FILE" 2>&1
MONITOR_EXIT=$?

# 检查是否有警报需要发送
if [ -f "logs/aster_telegram_alert_pending.json" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 发现待发送警报" >> "$LOG_FILE"
    
    # 提取警报信息
    ALERT_DATA=$(cat logs/aster_telegram_alert_pending.json)
    PRICE=$(echo "$ALERT_DATA" | grep -o '"price":[0-9.]*' | cut -d':' -f2)
    MESSAGE=$(echo "$ALERT_DATA" | grep -o '"message":"[^"]*"' | sed 's/"message":"//' | sed 's/"$//')
    
    # 记录警报
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 价格警报: ASTER = $PRICE USDT" >> "$LOG_FILE"
    
    # 处理警报（标记为已发送）
    node scripts/send_telegram_alert.js >> "$LOG_FILE" 2>&1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 监控结束 (退出码: $MONITOR_EXIT) ==========" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $MONITOR_EXIT
