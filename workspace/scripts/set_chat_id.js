#!/usr/bin/env node
/**
 * 快速配置 Telegram Chat ID
 * 用法: node scripts/set_chat_id.js <chat_id>
 */

const fs = require('fs');

const CONFIG_FILE = '/workspace/projects/workspace/config/telegram_bot.json';

const chatId = process.argv[2];

if (!chatId) {
    console.log('用法: node scripts/set_chat_id.js <chat_id>');
    console.log('示例: node scripts/set_chat_id.js 123456789');
    process.exit(1);
}

// 读取现有配置
let config = {};
try {
    if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
} catch (e) {}

// 更新配置
config.bot_name = config.bot_name || "aster_bitcoin_price_monitor_bot";
config.bot_username = config.bot_username || "@aster_bitcoin_price_monitor_bot";
config.enabled = true;
config.chat_id = parseInt(chatId);
config.configured_at = new Date().toISOString();

fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

console.log('✅ Chat ID 已配置！');
console.log(`   Chat ID: ${config.chat_id}`);
console.log('');
console.log('现在你可以测试发送：');
console.log('  node scripts/send_telegram.js --test');
console.log('');
console.log('或者等待下次价格检查自动发送通知。');
