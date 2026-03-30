#!/usr/bin/env node
/**
 * 发送 Telegram 消息 - ASTER 价格警报
 * 
 * 使用方法:
 *   node scripts/send_telegram.js "消息内容"
 *   node scripts/send_telegram.js --alert  # 发送待处理的警报
 */

const fs = require('fs');
const { exec } = require('child_process');

const CONFIG_FILE = '/workspace/projects/workspace/config/telegram_bot.json';
const ALERT_FILE = '/workspace/projects/workspace/logs/aster_telegram_alert_pending.json';
const LOG_FILE = '/workspace/projects/workspace/logs/telegram_sender.log';

// 从环境变量或配置文件获取 Token
function getBotToken() {
    // 优先从环境变量获取
    if (process.env.TELEGRAM_BOT_TOKEN) {
        return process.env.TELEGRAM_BOT_TOKEN;
    }
    
    // 否则从配置文件读取（如果已配置）
    try {
        const tokenFile = '/workspace/projects/workspace/config/.bot_token';
        if (fs.existsSync(tokenFile)) {
            return fs.readFileSync(tokenFile, 'utf8').trim();
        }
    } catch (e) {}
    
    return null;
}

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// 发送消息
async function sendMessage(chatId, message, parseMode = 'HTML') {
    const token = getBotToken();
    if (!token) {
        throw new Error('Bot Token 未配置');
    }
    
    if (!chatId) {
        throw new Error('Chat ID 未配置');
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const data = {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: false
    };
    
    return new Promise((resolve, reject) => {
        const cmd = `curl -s -X POST "${url}" \
            -H "Content-Type: application/json" \
            -d '${JSON.stringify(data)}'`;
        
        exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`请求失败: ${error.message}`));
                return;
            }
            
            try {
                const response = JSON.parse(stdout);
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(`Telegram API 错误: ${response.description}`));
                }
            } catch (e) {
                reject(new Error(`解析响应失败: ${e.message}`));
            }
        });
    });
}

// 发送待处理的警报
async function sendPendingAlert() {
    if (!fs.existsSync(ALERT_FILE)) {
        console.log('没有待发送的警报');
        return;
    }
    
    const alertData = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    if (!config.enabled || !config.chat_id) {
        console.log('Telegram 未配置或未启用');
        console.log('请先完成配置：提供 Chat ID 并启用通知');
        return;
    }
    
    try {
        log(`发送警报到 Chat ID: ${config.chat_id}`);
        await sendMessage(config.chat_id, alertData.message);
        log('消息发送成功！');
        
        // 删除已发送的警报文件
        fs.unlinkSync(ALERT_FILE);
        
        // 记录发送历史
        const historyFile = '/workspace/projects/workspace/logs/telegram_sent_history.json';
        let history = [];
        try {
            if (fs.existsSync(historyFile)) {
                history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
            }
        } catch (e) {}
        
        history.push({
            timestamp: new Date().toISOString(),
            price: alertData.price,
            chat_id: config.chat_id
        });
        
        if (history.length > 100) history = history.slice(-100);
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
        
    } catch (e) {
        log(`发送失败: ${e.message}`);
        console.error(`发送失败: ${e.message}`);
    }
}

// 测试发送
async function testSend() {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    if (!config.enabled || !config.chat_id) {
        console.log('❌ Telegram 未配置');
        console.log('请先运行: node scripts/setup_telegram.js');
        return;
    }
    
    const testMessage = `🧪 <b>测试消息</b>

这是来自 ASTER 价格监控机器人的测试消息。

⏰ ${new Date().toLocaleString('zh-CN')}

如果收到这条消息，说明配置成功！✅`;
    
    try {
        log('发送测试消息...');
        await sendMessage(config.chat_id, testMessage);
        log('测试消息发送成功！');
        console.log('✅ 测试消息已发送！请检查 Telegram');
    } catch (e) {
        log(`测试发送失败: ${e.message}`);
        console.error(`❌ 发送失败: ${e.message}`);
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--alert') || args.includes('-a')) {
        await sendPendingAlert();
    } else if (args.includes('--test') || args.includes('-t')) {
        await testSend();
    } else if (args.length > 0) {
        // 发送自定义消息
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (!config.enabled || !config.chat_id) {
            console.log('❌ Telegram 未配置');
            return;
        }
        const message = args.join(' ');
        await sendMessage(config.chat_id, message);
        console.log('✅ 消息已发送');
    } else {
        console.log('用法:');
        console.log('  node send_telegram.js --alert    # 发送待处理的警报');
        console.log('  node send_telegram.js --test     # 发送测试消息');
        console.log('  node send_telegram.js "消息"     # 发送自定义消息');
    }
}

main().catch(e => {
    log(`错误: ${e.message}`);
    console.error(`错误: ${e.message}`);
    process.exit(1);
});
