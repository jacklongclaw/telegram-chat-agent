#!/usr/bin/env node
/**
 * 飞书机器人消息发送器
 * 飞书在国内访问稳定
 * 
 * 使用方法:
 * 1. 在飞书群中添加自定义机器人
 * 2. 获取 webhook URL
 * 3. 运行: node feishu_sender.js <webhook_url> <message>
 */

const https = require('https');
const http = require('http');
const url = require('url');

function sendFeishuMessage(webhookUrl, message) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(webhookUrl);
        const data = JSON.stringify({
            msg_type: 'text',
            content: {
                text: message
            }
        });

        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 10000
        };

        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (parsed.code === 0) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`飞书 API 错误: ${parsed.msg}`));
                    }
                } catch (e) {
                    resolve({ success: true, raw: responseData });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('用法: node feishu_sender.js <webhook_url> <message>');
        console.log('');
        console.log('获取 webhook URL 步骤:');
        console.log('1. 在飞书群设置中添加「自定义机器人」');
        console.log('2. 复制 webhook 地址');
        console.log('3. 运行: node feishu_sender.js "https://open.feishu.cn/open-apis/bot/v2/hook/xxx" "测试消息"');
        process.exit(1);
    }

    const webhookUrl = args[0];
    const message = args.slice(1).join(' ');

    console.log('发送消息到飞书...');

    try {
        await sendFeishuMessage(webhookUrl, message);
        console.log('✅ 发送成功！');
    } catch (e) {
        console.error('❌ 发送失败:', e.message);
        process.exit(1);
    }
}

main();
