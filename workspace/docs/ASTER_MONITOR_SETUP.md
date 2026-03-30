# ASTER 价格监控 - 使用指南

## ✅ 监控已启动

你的 ASTER/USDT 价格监控已经成功启动！

### 当前状态
- **监控状态**: ✅ 运行中
- **检查间隔**: 每 5 分钟
- **价格阈值**: 0.6981 USDT
- **当前价格**: 4.92 USDT (已触发警报!)
- **日志文件**: `logs/aster_daemon.log`

## 🚀 快速开始

### 查看监控状态
```bash
cd /workspace/projects/workspace
node scripts/monitor_daemon.js status
```

### 停止监控
```bash
node scripts/monitor_daemon.js stop
```

### 重新启动监控
```bash
node scripts/monitor_daemon.js stop
node scripts/monitor_daemon.js start
```

### 立即检查一次价格
```bash
node scripts/monitor_daemon.js check
```

## 📱 Telegram 通知配置

### 方法一：使用 OpenClaw 消息通道（推荐）

如果你已经配置了 OpenClaw 的 Telegram 集成，警报会自动发送到你的 Telegram。

**配置步骤：**
1. 确保你的 OpenClaw 已配置 Telegram 通道
2. 监控脚本会自动通过 `message` 工具发送警报
3. 需要在 `scripts/send_telegram_alert.js` 中配置 target

**编辑配置文件：**
```bash
# 编辑警报发送脚本，添加你的 Telegram 用户 ID 或频道
nano scripts/send_telegram_alert.js
```

在文件中找到发送消息的代码，添加 target：
```javascript
// 添加 Telegram target
await message({
    action: 'send',
    target: 'YOUR_TELEGRAM_USER_ID',  // 替换为你的 Telegram ID
    message: alertData.message
});
```

### 方法二：使用 Telegram Bot API

**步骤 1: 创建 Telegram Bot**
1. 在 Telegram 中搜索 `@BotFather`
2. 发送 `/newbot` 创建新机器人
3. 按提示设置名称和用户名
4. 保存 API Token（例如：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

**步骤 2: 获取 Chat ID**
1. 给机器人发送一条消息
2. 访问 `https://api.telegram.org/bot<你的Token>/getUpdates`
3. 找到 `"chat":{"id":123456789` 这样的字段，数字就是 Chat ID

**步骤 3: 配置环境变量**
```bash
export TELEGRAM_BOT_TOKEN="你的Bot Token"
export TELEGRAM_CHAT_ID="你的Chat ID"
```

## 📊 查看监控数据

### 实时日志
```bash
# 查看最新日志
tail -f logs/aster_daemon.log

# 查看所有日志
cat logs/aster_daemon.log
```

### 价格历史
```bash
# 查看价格历史记录
cat logs/aster_price_history.json | jq '.[-10:]'  # 最近 10 条
```

### 警报历史
```bash
# 查看已发送的警报
cat logs/aster_alerts_sent.json
```

## 🔧 自定义配置

### 修改价格阈值
编辑 `scripts/monitor_daemon.js`：
```javascript
const THRESHOLD = 0.6981;  // 修改为你想要的阈值
```

### 修改检查间隔
```javascript
const CHECK_INTERVAL = 5 * 60 * 1000;  // 默认 5 分钟，单位毫秒
```

### 修改监控的交易对
```javascript
const COIN_ID = "aster";  // CoinGecko ID
const PAIR = "ASTERUSDT"; // 交易对
```

## 🐛 故障排除

### 监控无法获取价格
- 检查网络连接
- 查看日志 `logs/aster_daemon.log`
- 尝试手动运行检查：`node scripts/monitor_daemon.js check`

### Telegram 消息未发送
- 检查 Telegram Bot Token 是否正确
- 确保 Chat ID 正确
- 检查 `logs/aster_telegram_alert_pending.json` 是否存在
- 手动运行发送脚本：`node scripts/send_telegram_alert.js`

### 监控进程意外退出
- 检查系统资源使用情况
- 查看日志中的错误信息
- 重新启动监控：`node scripts/monitor_daemon.js start`

## 📁 文件结构

```
/workspace/projects/workspace/
├── scripts/
│   ├── monitor_daemon.js           # 主监控脚本
│   ├── monitor_aster_telegram.js   # Telegram 版本监控
│   └── send_telegram_alert.js      # 发送警报脚本
├── logs/
│   ├── aster_daemon.log            # 监控日志
│   ├── aster_price_history.json    # 价格历史
│   ├── aster_alerts_sent.json      # 已发送警报
│   └── aster_telegram_alert_pending.json  # 待发送警报
└── docs/
    └── ASTER_MONITOR_SETUP.md      # 本指南
```

## 🔔 当前警报

**刚刚触发的警报：**
- 时间: 2026/3/2 17:56:17
- 价格: 4.92 USDT
- 阈值: 0.6981 USDT
- 状态: 高于阈值 604.77%

**你需要配置 Telegram 才能收到通知！**

请告诉我你的 Telegram 配置信息，或者按照上面的方法配置后，我会帮你测试发送一条消息。
