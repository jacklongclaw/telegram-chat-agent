# Telegram 消息分类系统

一个完整的 Telegram Bot 消息分类解决方案，包含自动分类、情感分析和可视化仪表盘。

## 功能特性

- 🤖 **自动消息分类**: 7 种预设分类（问题咨询、投诉反馈、订单相关、建议反馈、闲聊、技术问题、其他）
- 😊 **情感分析**: 正面/中性/负面
- ⚡ **紧急程度检测**: 紧急/普通/低
- 📊 **可视化仪表盘**: 实时数据展示
- 💾 **数据持久化**: JSONL 格式存储

## 快速开始

### 1. 配置 Bot Token

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
```

从 [@BotFather](https://t.me/BotFather) 获取 Bot Token。

### 2. 启动 Bot 监听

```bash
npx tsx scripts/telegram-listener.ts
```

### 3. 启动仪表盘

```bash
npx tsx scripts/server.ts
# 或
./start.sh
```

访问 http://localhost:3100 查看仪表盘。

## 目录结构

```
telegram-classifier/
├── config/
│   └── categories.json    # 分类配置
├── scripts/
│   ├── classify.ts        # 分类核心逻辑
│   ├── classify-cli.ts    # CLI 工具
│   ├── telegram-listener.ts # Bot 监听
│   └── server.ts          # 仪表盘服务器
├── ui/
│   └── dashboard.html     # 可视化界面
├── data/                  # 分类数据存储
│   └── classifications_*.jsonl
├── SKILL.md               # Skill 文档
└── README.md              # 本文档
```

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/messages` | GET | 获取所有分类消息 |
| `/api/stats` | GET | 获取统计数据 |

## 自定义分类

编辑 `config/categories.json` 添加新分类：

```json
{
  "id": "feedback",
  "name": "产品反馈",
  "description": "User feedback about products",
  "keywords": ["反馈", "体验", "感受"],
  "priority": "normal"
}
```

## CLI 使用

单独测试分类功能：

```bash
# 基本分类
npx tsx scripts/classify-cli.ts -c "请问这个产品怎么使用？"

# 带用户信息
npx tsx scripts/classify-cli.ts \
  -c "我想投诉订单问题" \
  --user-id "user123" \
  --username "张三"

# JSON 输出
npx tsx scripts/classify-cli.ts \
  -c "非常满意这次服务！" \
  --format json
```

## 仪表盘功能

- 📊 **概览统计**: 总消息数、各分类数量
- 📨 **消息列表**: 支持筛选和搜索
- 📈 **分布图表**: 分类、情感、紧急程度
- 🔍 **详情查看**: 点击消息查看完整分类信息

## 集成到 OpenClaw

本系统可以与 OpenClaw 集成：

```bash
# 配置 Telegram 渠道
openclaw config set channels.telegram.botToken "your-token"
openclaw config set channels.telegram.enabled true

# 重启 Gateway
./scripts/restart.sh
```

## 注意事项

- 确保 Bot Token 安全，不要提交到版本控制
- 在有外网访问的环境中运行
- 定期清理旧数据文件
