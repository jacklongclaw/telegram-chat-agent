# Telegram 消息分类系统

一个完整的 Telegram Bot 消息分类解决方案，包含自动分类、情感分析和可视化仪表盘。

## 功能特性

- 🤖 **智能消息分类**: 7 种预设分类（问题咨询、投诉反馈、订单相关、建议反馈、闲聊、技术问题、其他）
  - 加权关键词匹配
  - 位置和频率分析
  - 高准确度分类
- 😊 **高级情感分析**: 正面/中性/负面
  - 否定词检测
  - 表情符号识别
  - 标点符号分析
- ⚡ **紧急程度检测**: 紧急/普通/低
  - 多模式识别
  - 上下文感知
- 📊 **可视化仪表盘**: 实时数据展示
  - 自动刷新（30秒）
  - 分页支持
  - 实时统计
- 💾 **数据持久化**: JSONL 格式存储
- 📝 **结构化日志**: JSON 格式日志，便于调试和监控
- 🔒 **错误处理**: 完善的异常处理和重试机制
- ⚡ **性能优化**: 
  - 数据缓存（5秒TTL）
  - 分页查询
  - 限制数据量

## 快速开始

### 1. 配置环境变量

```bash
# 必需：Telegram Bot Token
export TELEGRAM_BOT_TOKEN="your-bot-token"

# 可选：日志级别 (debug, info, warn, error)
export LOG_LEVEL="info"

# 可选：HTTP 代理
export HTTPS_PROXY="http://proxy-server:port"
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

## 优化亮点 ✨

### 算法改进
- **智能关键词匹配**: 考虑关键词位置、频率和权重
- **否定词检测**: 准确识别"不好"、"没问题"等否定表达
- **表情符号分析**: 识别😊😡等表情符号辅助判断情感
- **频率加权**: 多次出现的关键词获得更高权重

### 性能优化
- **数据缓存**: 5秒TTL缓存，减少文件读取
- **分页支持**: `/api/messages?page=1&limit=50` 避免大数据量问题
- **数据限制**: 最多读取最近7天、1000条消息
- **流式处理**: 逐行解析JSONL，避免内存溢出

### 可靠性提升
- **结构化日志**: JSON格式日志，便于日志分析工具处理
- **错误重试**: 指数退避策略，最多重试10次
- **配置验证**: 启动前验证环境变量和配置格式
- **错误隔离**: 单条消息处理失败不影响其他消息

### 用户体验
- **自动刷新**: 仪表盘每30秒自动更新数据
- **加载状态**: 明确的加载提示和按钮禁用
- **最后更新时间**: 显示数据最后刷新时间
- **响应式设计**: 适配各种屏幕尺寸

### 代码质量
- **TypeScript严格模式**: 完整的类型定义
- **模块化设计**: 清晰的职责分离
- **使用现代库**: undici替代curl，更稳定可靠
- **文档完善**: 详细的注释和文档

## 注意事项

- 确保 Bot Token 安全，不要提交到版本控制
- 建议设置 LOG_LEVEL=info 用于生产环境
- 定期清理旧数据文件（保留最近7-30天即可）
- 如遇网络问题，可配置 HTTPS_PROXY 使用代理
