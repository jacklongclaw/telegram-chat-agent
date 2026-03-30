# ASTER/USDT 价格监控指南

## 监控目标
- **交易对**: ASTER/USDT
- **交易所**: AsterDex
- **价格阈值**: 0.6981 USDT
- **触发条件**: 价格 > 0.6981

## 设置步骤

### 1. 配置微信通知（可选）

如果你想在微信收到价格警报，需要配置 webhook：

#### 方法一：企业微信机器人
1. 在企业微信群中添加群机器人
2. 复制 webhook URL
3. 设置环境变量:
   ```bash
   export WECHAT_WEBHOOK_URL="你的webhook地址"
   ```

#### 方法二：使用 OpenClaw Message 功能
如果你已经配置了 OpenClaw 的微信/飞书/钉钉集成，可以直接使用 message 工具发送。

### 2. 手动检查价格

在当前会话中发送消息：
```
检查 ASTER 价格
```

### 3. 自动监控设置

#### 使用 Cron（推荐）
编辑 crontab 添加定时任务：
```bash
# 每5分钟检查一次价格
*/5 * * * * cd /workspace/projects/workspace && node scripts/monitor_aster.js >> logs/cron.log 2>&1
```

#### 使用 OpenClaw Heartbeat
系统会每30分钟检查一次 HEARTBEAT.md 中的任务。

## 监控脚本说明

### 脚本位置
- `/workspace/projects/workspace/scripts/monitor_aster.js` - Node.js 版本（使用 API）
- `/workspace/projects/workspace/scripts/monitor_aster_browser.ts` - 浏览器自动化版本
- `/workspace/projects/workspace/scripts/check_aster_quick.sh` - 快速搜索版本

### 日志位置
- `/workspace/projects/workspace/logs/aster_price.log` - 价格检查日志
- `/workspace/projects/workspace/logs/aster_alerts.json` - 警报记录

## 当前限制

由于网络环境限制，直接访问加密货币交易所 API 可能会失败。当前解决方案：

1. **搜索工具方案**: 使用 coze-web-search 获取价格信息
2. **浏览器方案**: 使用 Playwright 自动化（需要安装依赖）
3. **手动检查**: 在当前会话中询问我检查价格

## 下一步操作

我已经为你设置好了监控框架。你可以选择：

1. **现在就检查一次价格** - 发送消息 "检查 ASTER 价格"
2. **设置自动监控** - 我会帮你配置定时任务
3. **配置微信通知** - 提供你的 webhook 地址

你想怎么继续？
