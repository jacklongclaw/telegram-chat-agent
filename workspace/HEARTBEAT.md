# HEARTBEAT.md - 定期任务

## 价格监控任务

### ASTER/USDT 价格监控 ✅
- **目标**: 监控 https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT
- **阈值**: 0.6981 USDT
- **操作**: 价格高于阈值时发送 Telegram 通知
- **频率**: 每 5 分钟检查一次
- **状态**: ✅ 运行中 (PID: 10109)
- **Telegram**: ✅ 已配置 (Chat ID: 7722263190)

**监控脚本**: `scripts/monitor_daemon.js`

**日志位置**:
- 实时监控: `tail -f logs/aster_daemon.log`
- 价格历史: `logs/aster_price_history.json`
- 警报记录: `logs/aster_telegram_alert_pending.json`

**最后检查**: 2026/3/30 21:42:32 - 监控已重启 (PID: 28935)

