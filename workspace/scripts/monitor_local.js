#!/usr/bin/env node
/**
 * ASTER 价格监控 - 本地运行版本（定时报告版）
 * 每5分钟发送一次价格报告，超过阈值时突出显示
 * 
 * 使用方法:
 *   1. 保存这个文件到你的电脑
 *   2. 确保代理已启动
 *   3. 运行: node monitor_local.js
 */

const { exec } = require('child_process');

// ========== 配置 ==========
const CONFIG = {
    coin: 'ASTER',
    threshold: 0.6981,
    checkInterval: 5 * 60 * 1000, // 5 分钟
    chatId: '7722263190',
    botToken: '8598944981:AAHIRnEOh5OBj8y1hb06gzZp561H8Kf-YWY',
    // 代理设置
    proxy: process.env.https_proxy || process.env.http_proxy || 'http://127.0.0.1:7890'
};

// 控制台颜色
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bold: '\x1b[1m'
};

// ========== 发送 Telegram 消息 ==========
function sendTelegram(message) {
    return new Promise((resolve, reject) => {
        const proxyOption = CONFIG.proxy ? `-x "${CONFIG.proxy}"` : '';
        const url = `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;
        const data = {
            chat_id: CONFIG.chatId,
            text: message,
            parse_mode: 'HTML'
        };

        const cmd = `curl -s ${proxyOption} -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(data)}' --max-time 15`;

        exec(cmd, { timeout: 20000 }, (error, stdout) => {
            if (error) {
                reject(error);
                return;
            }

            try {
                const response = JSON.parse(stdout);
                if (response.ok) {
                    resolve(response);
                } else {
                    reject(new Error(response.description));
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}

// ========== 获取价格 ==========
function getPrice() {
    return new Promise((resolve) => {
        const proxyOption = CONFIG.proxy ? `-x "${CONFIG.proxy}"` : '';
        const cmd = `curl -s ${proxyOption} "https://api.coingecko.com/api/v3/simple/price?ids=aster&vs_currencies=usd&include_24hr_change=true" --max-time 15`;

        exec(cmd, { timeout: 20000 }, (error, stdout) => {
            if (error) {
                console.log('获取价格失败:', error.message);
                resolve(null);
                return;
            }

            try {
                const data = JSON.parse(stdout);
                if (data.aster && data.aster.usd) {
                    resolve({
                        price: parseFloat(data.aster.usd),
                        change24h: data.aster.usd_24h_change || 0
                    });
                } else {
                    resolve(null);
                }
            } catch (e) {
                resolve(null);
            }
        });
    });
}

// ========== 生成报告消息 ==========
function generateReport(price, change24h, isAlert) {
    const changeEmoji = change24h >= 0 ? '📈' : '📉';
    const changeText = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;
    const now = new Date().toLocaleString('zh-CN');
    
    if (isAlert) {
        // 超过阈值 - 红色警告样式
        const aboveThreshold = ((price - CONFIG.threshold) / CONFIG.threshold * 100).toFixed(2);
        return `🚨 <b>ASTER 价格警报</b>

⚠️ <b>价格已超过阈值！</b>

💰 当前价格: <b>${price.toFixed(6)} USDT</b>
📊 24h 变化: ${changeEmoji} ${changeText}
🎯 阈值: ${CONFIG.threshold} USDT
📈 高于阈值: <b>+${aboveThreshold}%</b>

⏰ ${now}

🔗 <a href="https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT">前往交易</a>`;
    } else {
        // 正常价格 - 普通报告
        const belowThreshold = ((CONFIG.threshold - price) / CONFIG.threshold * 100).toFixed(2);
        return `📊 <b>ASTER 价格报告</b>

💰 当前价格: ${price.toFixed(6)} USDT
📊 24h 变化: ${changeEmoji} ${changeText}
🎯 阈值: ${CONFIG.threshold} USDT
📉 低于阈值: ${belowThreshold}%

⏰ ${now}

✅ 价格正常，无需操作`;
    }
}

// ========== 主函数 ==========
async function checkAndNotify() {
    const now = new Date().toLocaleString('zh-CN');
    console.log(`\n${COLORS.cyan}[${now}]${COLORS.reset} 检查价格...`);

    const priceData = await getPrice();

    if (!priceData) {
        console.log(`${COLORS.red}❌ 无法获取价格${COLORS.reset}`);
        return;
    }

    const { price, change24h } = priceData;
    const isAlert = price > CONFIG.threshold;
    
    // 控制台输出 - 带颜色
    if (isAlert) {
        console.log(`${COLORS.bgRed}${COLORS.bold} 🚨 价格警报！${COLORS.reset}`);
        console.log(`${COLORS.red}💰 当前价格: ${price} USDT${COLORS.reset}`);
        console.log(`${COLORS.red}📈 高于阈值: ${CONFIG.threshold} USDT${COLORS.reset}`);
    } else {
        console.log(`${COLORS.green}💰 当前价格: ${price} USDT${COLORS.reset}`);
        console.log(`${COLORS.green}✅ 价格正常，低于阈值 ${CONFIG.threshold}${COLORS.reset}`);
    }
    
    console.log(`${COLORS.yellow}📊 24h变化: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%${COLORS.reset}`);

    // 生成报告并发送
    const message = generateReport(price, change24h, isAlert);
    
    try {
        await sendTelegram(message);
        console.log(`${COLORS.green}✅ Telegram 报告已发送${COLORS.reset}`);
    } catch (e) {
        console.error(`${COLORS.red}❌ Telegram 发送失败: ${e.message}${COLORS.reset}`);
    }
}

// ========== 启动 ==========
async function main() {
    console.log(`${COLORS.cyan}========================================${COLORS.reset}`);
    console.log(`${COLORS.cyan}  ASTER 价格监控 - 定时报告版${COLORS.reset}`);
    console.log(`${COLORS.cyan}========================================${COLORS.reset}`);
    console.log('');
    console.log('配置:');
    console.log(`  阈值: ${COLORS.yellow}${CONFIG.threshold} USDT${COLORS.reset}`);
    console.log(`  检查间隔: ${COLORS.yellow}${CONFIG.checkInterval / 1000 / 60} 分钟${COLORS.reset}`);
    console.log(`  代理: ${COLORS.yellow}${CONFIG.proxy}${COLORS.reset}`);
    console.log(`  Chat ID: ${COLORS.yellow}${CONFIG.chatId}${COLORS.reset}`);
    console.log('');
    console.log(`${COLORS.magenta}📢 每5分钟会发送价格报告到 Telegram${COLORS.reset}`);
    console.log(`${COLORS.magenta}⚠️  超过阈值时会以红色警告显示${COLORS.reset}`);
    console.log('');

    // 测试发送
    console.log('测试 Telegram 连接...');
    try {
        await sendTelegram(`🧪 <b>ASTER 监控启动测试</b>\n\n⏰ ${new Date().toLocaleString('zh-CN')}\n\n✅ 监控已启动，每5分钟发送报告`);
        console.log(`${COLORS.green}✅ Telegram 连接成功！${COLORS.reset}`);
    } catch (e) {
        console.error(`${COLORS.red}❌ Telegram 连接失败: ${e.message}${COLORS.reset}`);
        console.log('请检查代理设置');
        process.exit(1);
    }

    console.log('');
    console.log(`${COLORS.green}开始监控...${COLORS.reset}`);
    console.log(`${COLORS.yellow}按 Ctrl+C 停止${COLORS.reset}`);
    console.log('');

    // 立即检查一次
    await checkAndNotify();

    // 定时检查
    setInterval(checkAndNotify, CONFIG.checkInterval);
}

main().catch(e => {
    console.error(`${COLORS.red}错误: ${e.message}${COLORS.reset}`);
    process.exit(1);
});
