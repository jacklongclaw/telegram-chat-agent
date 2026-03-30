#!/usr/bin/env node
/**
 * Telegram Bot 配置向导
 * 
 * 使用方法:
 *   node scripts/setup_telegram.js
 * 
 * 这个脚本会:
 *   1. 安全地保存 Bot Token
 *   2. 获取 Chat ID
 *   3. 测试发送消息
 */

const fs = require('fs');
const readline = require('readline');
const { exec } = require('child_process');

const CONFIG_FILE = '/workspace/projects/workspace/config/telegram_bot.json';
const TOKEN_FILE = '/workspace/projects/workspace/config/.bot_token';
const LOG_FILE = '/workspace/projects/workspace/logs/setup_telegram.log';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer.trim());
        });
    });
}

// 保存 Bot Token
function saveBotToken(token) {
    fs.writeFileSync(TOKEN_FILE, token);
    fs.chmodSync(TOKEN_FILE, 0o600); // 只允许所有者读写
    log('Bot Token 已安全保存');
}

// 从 API 获取 Chat ID
async function getChatIdFromApi(token) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${token}/getUpdates`;
        const cmd = `curl -s "${url}"`;
        
        exec(cmd, { timeout: 30000 }, (error, stdout) => {
            if (error) {
                reject(new Error('无法访问 Telegram API'));
                return;
            }
            
            try {
                const data = JSON.parse(stdout);
                if (data.ok && data.result && data.result.length > 0) {
                    // 获取最后一个消息的 chat id
                    const lastUpdate = data.result[data.result.length - 1];
                    const chatId = lastUpdate.message?.chat?.id || 
                                   lastUpdate.callback_query?.message?.chat?.id;
                    if (chatId) {
                        resolve(chatId);
                    } else {
                        reject(new Error('无法从更新中解析 Chat ID'));
                    }
                } else {
                    reject(new Error('没有收到消息，请先给机器人发送一条消息'));
                }
            } catch (e) {
                reject(new Error('解析 API 响应失败'));
            }
        });
    });
}

// 测试发送消息
async function testSend(token, chatId) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const message = `🎉 <b>配置成功！</b>\n\n你的 ASTER 价格监控机器人已激活。\n\n⏰ ${new Date().toLocaleString('zh-CN')}`;
        
        const data = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        };
        
        const cmd = `curl -s -X POST "${url}" \
            -H "Content-Type: application/json" \
            -d '${JSON.stringify(data)}'`;
        
        exec(cmd, { timeout: 30000 }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }
            
            try {
                const response = JSON.parse(stdout);
                if (response.ok) {
                    resolve(true);
                } else {
                    reject(new Error(response.description));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// 主流程
async function main() {
    console.log('\n========================================');
    console.log('  Telegram Bot 配置向导');
    console.log('========================================\n');
    
    // 1. 获取 Bot Token
    console.log('第 1 步: 配置 Bot Token');
    console.log('你的 Bot Token 是: 8598944981:AAHIRnEOh5OBj8y1hb06gzZp561H8Kf-YWY');
    const useExisting = await question('使用这个 Token? (yes/no): ');
    
    let token;
    if (useExisting.toLowerCase() === 'yes' || useExisting.toLowerCase() === 'y') {
        token = '8598944981:AAHIRnEOh5OBj8y1hb06gzZp561H8Kf-YWY';
    } else {
        token = await question('请输入你的 Bot Token: ');
    }
    
    // 保存 Token
    saveBotToken(token);
    console.log('✅ Token 已保存\n');
    
    // 2. 获取 Chat ID
    console.log('第 2 步: 获取 Chat ID');
    console.log('请先在 Telegram 中给你的机器人 (@aster_bitcoin_price_monitor_bot) 发送一条消息');
    await question('完成后按 Enter 继续...');
    
    let chatId;
    try {
        chatId = await getChatIdFromApi(token);
        console.log(`✅ 找到 Chat ID: ${chatId}\n`);
    } catch (e) {
        console.log(`❌ 自动获取失败: ${e.message}`);
        const manualChatId = await question('请手动输入 Chat ID: ');
        chatId = manualChatId;
    }
    
    // 3. 保存配置
    const config = {
        _comment: "Telegram Bot 配置 - 由 OpenClaw 管理",
        bot_name: "aster_bitcoin_price_monitor_bot",
        bot_username: "@aster_bitcoin_price_monitor_bot",
        enabled: true,
        chat_id: chatId,
        last_test: null
    };
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    log('配置已保存');
    console.log('✅ 配置已保存\n');
    
    // 4. 测试发送
    console.log('第 3 步: 测试发送');
    console.log('正在发送测试消息...');
    
    try {
        await testSend(token, chatId);
        console.log('✅ 测试消息已发送！请检查 Telegram\n');
        
        // 更新配置
        config.last_test = new Date().toISOString();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        
    } catch (e) {
        console.log(`❌ 测试发送失败: ${e.message}\n`);
    }
    
    console.log('========================================');
    console.log('配置完成！');
    console.log('========================================');
    console.log('\n你现在可以：');
    console.log('  - 使用 node scripts/send_telegram.js --test 测试发送');
    console.log('  - 使用 node scripts/send_telegram.js --alert 发送待处理警报');
    console.log('  - 监控会自动在价格超过阈值时发送通知');
    console.log('');
    
    rl.close();
}

main().catch(e => {
    log(`错误: ${e.message}`);
    console.error(`错误: ${e.message}`);
    rl.close();
    process.exit(1);
});
