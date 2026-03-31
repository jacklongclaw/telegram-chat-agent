# 测试指南

## 快速测试

### 1. 测试分类算法

```bash
cd workspace/skills/telegram-classifier

# 测试问题咨询
npx tsx scripts/classify-cli.ts -c "请问这个产品怎么使用？" --format json

# 测试投诉（负面情感 + 紧急）
npx tsx scripts/classify-cli.ts -c "太差了！我要投诉！马上退款！！！" --format json

# 测试否定词检测
npx tsx scripts/classify-cli.ts -c "不错，很满意，没什么问题" --format json

# 测试表情符号
npx tsx scripts/classify-cli.ts -c "这个产品太棒了！😊👍 非常满意" --format json
```

### 2. 测试 Bot 监听器（需要配置 TELEGRAM_BOT_TOKEN）

```bash
# 设置环境变量
export TELEGRAM_BOT_TOKEN="your-bot-token"
export LOG_LEVEL="debug"

# 启动 Bot
npx tsx scripts/telegram-listener.ts
```

发送以下测试消息到你的 Bot：
- "你好，在吗？" → 应该分类为"闲聊"
- "订单什么时候发货？" → 应该分类为"订单相关"
- "紧急！系统崩溃了！" → 应该标记为"紧急"
- "谢谢你们，服务很好😊" → 应该是"正面"情感

### 3. 测试仪表盘

```bash
# 启动服务器
./start.sh
# 或者
npx tsx scripts/server.ts
```

然后访问:
- 仪表盘: http://localhost:3100
- 消息API: http://localhost:3100/api/messages?page=1&limit=10
- 统计API: http://localhost:3100/api/stats

测试功能：
- ✅ 页面自动刷新（30秒）
- ✅ 查看最后更新时间
- ✅ 点击刷新按钮（按钮应该禁用并显示"加载中"）
- ✅ 筛选不同分类
- ✅ 搜索消息内容
- ✅ 点击消息查看详情

## 验证优化效果

### 算法准确性测试

创建测试文件 `test-cases.txt`:
```
请问怎么使用这个功能？
我想投诉！这个产品太差了！
订单号123456的物流信息
建议增加夜间模式
你好，在吗？
系统报错500，无法登录
非常满意😊谢谢！
不好用，很失望
```

批量测试：
```bash
while IFS= read -r line; do
  echo "测试: $line"
  npx tsx scripts/classify-cli.ts -c "$line" --format json | jq '.category.id, .sentiment.label, .urgency.level'
  echo "---"
done < test-cases.txt
```

### 性能测试

```bash
# 测试 API 响应时间
time curl -s "http://localhost:3100/api/messages?page=1&limit=50" > /dev/null

# 测试缓存效果（第二次应该更快）
time curl -s "http://localhost:3100/api/messages?page=1&limit=50" > /dev/null

# 测试大数据量
time curl -s "http://localhost:3100/api/messages?page=1&limit=1000" > /dev/null
```

### 日志验证

```bash
# 启动 Bot 并查看结构化日志
export LOG_LEVEL="debug"
npx tsx scripts/telegram-listener.ts 2>&1 | jq '.'
```

应该看到类似的 JSON 格式日志：
```json
{
  "level": "info",
  "timestamp": "2026-03-31T10:00:00.000Z",
  "message": "Processing new message",
  "userId": "123456",
  "username": "test_user",
  "messageId": 789,
  "contentLength": 25
}
```

## 预期结果

### ✅ 算法改进
- 否定词检测: "不好" → 负面情感 ✓
- 表情符号: "😊" → 正面情感 ✓  
- 多个感叹号: "!!!" → 提高紧急度 ✓
- 关键词频率: 多次提到"投诉" → 更高置信度 ✓

### ✅ 性能优化
- 首次API调用: ~50-100ms
- 缓存API调用: ~5-10ms
- 大数据量(1000条): <500ms
- 内存使用: 稳定在 100MB 以下

### ✅ 可靠性
- 单条消息失败不影响其他消息
- 网络错误自动重试（指数退避）
- 所有错误都有日志记录
- 文件保存失败不会崩溃

## 故障排查

### Bot 无法启动
```bash
# 检查配置
npx tsx scripts/telegram-listener.ts 2>&1 | grep -i error

# 常见问题：
# 1. Token 格式错误
# 2. 网络连接问题（尝试配置代理）
# 3. 权限问题（检查 data 目录）
```

### 仪表盘无数据
```bash
# 检查数据文件
ls -lh workspace/skills/telegram-classifier/data/

# 检查 API
curl http://localhost:3100/api/messages | jq '.data | length'

# 检查日志
export LOG_LEVEL="debug"
npx tsx scripts/server.ts
```

### 分类不准确
```bash
# 调整关键词配置
vi config/categories.json

# 测试特定消息
npx tsx scripts/classify-cli.ts -c "你的测试消息" --format json | jq '.'
```
