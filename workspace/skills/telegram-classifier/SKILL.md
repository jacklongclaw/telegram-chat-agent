---
name: telegram-classifier
description: Connect to Telegram Bot and classify incoming messages. Supports topic classification, sentiment analysis, and urgency detection.
homepage: https://docs.coze.cn/tutorial/openclaw
metadata: { "openclaw": { "emoji": "🤖", "requires": { "bins": ["npx"], "env": ["TELEGRAM_BOT_TOKEN"] } } }
---

# Telegram Message Classifier

Connect to a Telegram Bot and automatically classify incoming messages with topic categorization, sentiment analysis, and urgency detection.

## Features

- **Topic Classification**: Automatically categorize messages into predefined categories
- **Sentiment Analysis**: Detect positive, neutral, or negative sentiment
- **Urgency Detection**: Identify urgent messages requiring immediate attention
- **Auto-Reply**: Send contextual responses based on classification
- **Statistics Tracking**: Monitor message patterns with `/stats` command
- **Data Persistence**: All classifications saved to JSONL files

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the instructions
3. Copy your bot token (looks like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Set Environment Variable

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token-here"
```

### 3. Start the Bot

```bash
npx ts-node {baseDir}/scripts/telegram-listener.ts
```

## Classification Categories

| Category | Description | Priority |
|----------|-------------|----------|
| `question` | User asking questions or seeking help | Normal |
| `complaint` | User complaints or dissatisfaction | High |
| `order` | Order, purchase, payment related | High |
| `suggestion` | User suggestions or feedback | Normal |
| `chitchat` | Casual conversation, greetings | Low |
| `technical` | Technical issues or bug reports | High |
| `other` | Uncategorized messages | Low |

## Sentiment Analysis

- **positive**: Happy, satisfied, thankful messages
- **neutral**: Factual or mixed sentiment
- **negative**: Complaints, frustration, anger

## Urgency Levels

- **urgent**: Immediate attention required
- **normal**: Standard priority
- **low**: Can be handled later

## Bot Commands

| Command | Description |
|---------|-------------|
| `/stats` | Display bot statistics and message counts |

## Standalone Classification

Test classification without connecting to Telegram:

```bash
# Basic classification
npx ts-node {baseDir}/scripts/classify.ts -c "请问这个产品怎么使用？"

# With user information
npx ts-node {baseDir}/scripts/classify.ts \
  -c "我想投诉订单问题" \
  --user-id "user123" \
  --username "张三"

# JSON output
npx ts-node {baseDir}/scripts/classify.ts \
  -c "非常满意这次服务！" \
  --format json
```

## Output Files

All classifications are saved to `{baseDir}/data/`:

| File | Description |
|------|-------------|
| `classifications_YYYY-MM-DD.jsonl` | Daily classification records |
| `stats.json` | Running statistics |

### Classification Record Format

```json
{
  "messageId": "msg_1234567890",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "userId": "user123",
  "username": "张三",
  "content": "请问这个产品怎么使用？",
  "category": {
    "id": "question",
    "name": "问题咨询",
    "confidence": 0.85
  },
  "sentiment": {
    "label": "neutral",
    "confidence": 0.7
  },
  "urgency": {
    "level": "normal",
    "confidence": 0.7
  },
  "keywords": ["产品", "使用"],
  "summary": "[问题咨询] 请问这个产品怎么使用？"
}
```

## Customization

### Modify Categories

Edit `{baseDir}/config/categories.json` to customize:

- Category names and descriptions
- Keywords for each category
- Priority levels

### Add New Category

```json
{
  "id": "feedback",
  "name": "产品反馈",
  "description": "User feedback about products",
  "keywords": ["反馈", "体验", "感受", "意见"],
  "priority": "normal"
}
```

## Integration with OpenClaw

To use with OpenClaw Agent:

1. Start the Telegram listener in background
2. Configure OpenClaw to use Telegram channel
3. Classification results are automatically saved

## Troubleshooting

### Bot Not Receiving Messages

1. Ensure bot token is correct
2. Start a conversation with your bot first
3. Check if bot is blocked by user

### Classification Accuracy

1. Add more keywords to categories in `config/categories.json`
2. Adjust priority levels based on your use case
3. Review saved classifications to identify patterns

## Security Notes

- Keep your bot token secure
- Don't commit token to version control
- Use environment variables or secure vaults
