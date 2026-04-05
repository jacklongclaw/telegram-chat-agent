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

---

## 群聊周报任务

### 周报生成 📊
- **目标**: 自动生成群聊周报并发送到飞书群
- **Chat ID**: oc_31f6ea603d43e02cfb3ed675d9dc37cb
- **频率**: 每周日 9:00 AM
- **状态**: ✅ 已配置

**功能**:
- ✅ 自动记录所有群消息（从 2026-04-05 开始）
- ✅ 智能分类：问题/任务/公告/会议/决策/调试/社交
- ✅ 统计活跃成员
- ✅ 提取本周关键讨论

**脚本位置**:
- 记录脚本: `scripts/conversation_logger.py`
- 周报脚本: `scripts/generate_weekly_report.sh`
- 数据存储: `data/conversations/`
- 报告存储: `reports/`

**手动生成周报**:
```bash
cd /workspace/projects/workspace && python3 scripts/conversation_logger.py report
```

