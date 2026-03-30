#!/bin/bash
# ASTER 价格监控定时任务
# 由 cron 或手动调用

cd /workspace/projects/workspace

# 设置日志
LOG_FILE="logs/cron_monitor.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 开始监控 ==========" >> "$LOG_FILE"

# 运行价格监控脚本
node scripts/monitor_daemon.js check >> "$LOG_FILE" 2>&1
MONITOR_EXIT=$?

# 检查是否有警报需要发送
if [ -f "logs/aster_telegram_alert_pending.json" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 发现待发送警报，正在处理..." >> "$LOG_FILE"
    node scripts/process_alert.js >> "$LOG_FILE" 2>&1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ========== 监控结束 (退出码: $MONITOR_EXIT) ==========" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $MONITOR_EXIT
