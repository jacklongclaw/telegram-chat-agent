#!/usr/bin/env node
/**
 * Telegram 消息发送器（带代理支持）
 * 
 * 使用方法:
 *   node tg_sender.js <chat_id> <message>
 *   或
 *   node tg_sender.js --test    # 发送测试消息
 */

const { exec } = require('child_process');
const fs = require('fs');

const TOKEN_FILE = '/workspace/projects/workspace/config/.bot_token';
const CONFIG_FILE = '/workspace/projects/workspace/config/telegram_bot.json';

function getConfig() {
    try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return config;
    } catch (e) {
        return { enabled: false };
    }
}

function sendTelegramMessage(chatId, message, proxyUrl) {
    return new Promise((resolve, reject) => {
        // 读取 token
        let token;
        try {
            token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        } catch (e) {
            reject(new Error('Token 未配置'));
            return;
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const data = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        };

        // 构建 curl 命令
        let proxyOption = '';
        if (proxyUrl) {
            proxyOption = `-x "${proxyUrl}"`;
        }

        const cmd = `curl -s ${proxyOption} -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(data)}' --max-time 15`;

        console.log(`发送消息到 Chat ID: ${chatId}`);
        if (proxyUrl) {
            console.log(`使用代理: ${proxyUrl}`);
        }
        console.log('');

        exec(cmd, { timeout: 20000 }, (error, stdout) => {
            if (error) {
                reject(new Error(`请求失败: ${error.message}`));
                return;
            }

            try {
                const response = JSON.parse(stdout);
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(`API 错误: ${response.description}`));
                }
            } catch (e) {
                reject(new Error(`解析响应失败: ${e.message}\n原始输出: ${stdout}`));
            }
        });
    });
}

async function main() {
    const args = process.argv.slice(2);
    const config = getConfig();

    // 获取代理设置
    const proxyUrl = config.proxy && config.proxy.enabled ? config.proxy.http_proxy : null;

    // 测试模式
    if (args.includes('--test') || args.includes('-t')) {
        if (!config.enabled || !config.chat_id) {
            console.log('❌ Telegram 未配置');
            process.exit(1);
        }

        const testMessage = `🧪 <b>测试消息</b>

这是来自 ASTER 价格监控机器人的测试消息。

⏰ ${new Date().toLocaleString('zh-CN')}

如果收到这条消息，说明代理配置成功！✅`;

        try {
            const result = await sendTelegramMessage(config.chat_id, testMessage, proxyUrl);
            console.log('✅ 测试消息发送成功！');
            console.log('消息 ID:', result.result?.message_id);
        } catch (e) {
            console.error('❌ 发送失败:', e.message);
            process.exit(1);
        }
        return;
    }

    // 自定义消息模式
    if (args.length < 2) {
        console.log('用法:');
        console.log('  node tg_sender.js --test           # 发送测试消息');
        console.log('  node tg_sender.js <chat_id> <msg>  # 发送自定义消息');
        console.log('');
        console.log('当前配置:');
        console.log(`  Chat ID: ${config.chat_id || '未配置'}`);
        console.log(`  代理: ${proxyUrl || '未启用'}`);
        process.exit(1);
    }

    const chatId = args[0];
    const message = args.slice(1).join(' ');

    try {
        const result = await sendTelegramMessage(chatId, message, proxyUrl);
        console.log('✅ 发送成功！');
        console.log('消息 ID:', result.result?.message_id);
    } catch (e) {
        console.error('❌ 发送失败:', e.message);
        process.exit(1);
    }
}

main();
