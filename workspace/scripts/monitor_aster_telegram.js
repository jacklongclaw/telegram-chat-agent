#!/usr/bin/env node
/**
 * ASTER/USDT 价格监控脚本 - Telegram 通知版本
 * 当价格高于 0.6981 时发送 Telegram 消息
 */

const THRESHOLD = 0.6981;
const COIN_ID = "aster";
const LOG_FILE = '/workspace/projects/workspace/logs/aster_monitor.log';
const ALERT_HISTORY_FILE = '/workspace/projects/workspace/logs/aster_alert_history.json';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 加载历史记录
let alertHistory = { lastAlertPrice: null, lastAlertTime: null, alertCount: 0 };
try {
    if (fs.existsSync(ALERT_HISTORY_FILE)) {
        alertHistory = JSON.parse(fs.readFileSync(ALERT_HISTORY_FILE, 'utf8'));
    }
} catch (e) {
    // 忽略错误
}

function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// 从 CoinGecko 获取价格
async function getPriceFromCoinGecko() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=aster&vs_currencies=usd&include_24hr_change=true');
        const data = await response.json();
        if (data.aster && data.aster.usd) {
            return {
                price: parseFloat(data.aster.usd),
                change24h: data.aster.usd_24h_change || 0
            };
        }
    } catch (e) {
        log(`CoinGecko API 错误: ${e.message}`);
    }
    return null;
}

// 通过 OpenClaw message 工具发送 Telegram 消息
async function sendTelegramAlert(price, change24h) {
    const changeEmoji = change24h >= 0 ? '📈' : '📉';
    const changeText = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;
    
    const message = `🚨 <b>ASTER 价格警报</b>

💰 当前价格: <b>${price.toFixed(6)} USDT</b>
📊 24h 变化: ${changeEmoji} ${changeText}
🎯 阈值: ${THRESHOLD} USDT
📈 高于阈值: +${((price - THRESHOLD) / THRESHOLD * 100).toFixed(2)}%

⏰ ${new Date().toLocaleString('zh-CN')}

🔗 <a href="https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT">前往交易</a>`;

    log(`发送 Telegram 警报...`);
    
    // 使用 OpenClaw 的 sessions_send 功能通知主会话
    // 或者通过 message 工具直接发送
    const alertData = {
        type: 'price_alert',
        coin: 'ASTER',
        price: price,
        threshold: THRESHOLD,
        change24h: change24h,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    // 保存警报信息供主程序读取
    const alertFile = '/workspace/projects/workspace/logs/aster_telegram_alert_pending.json';
    fs.writeFileSync(alertFile, JSON.stringify(alertData, null, 2));
    
    // 更新历史记录
    alertHistory.lastAlertPrice = price;
    alertHistory.lastAlertTime = new Date().toISOString();
    alertHistory.alertCount++;
    fs.writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(alertHistory, null, 2));
    
    log('Telegram 警报已保存，等待发送');
    return true;
}

// 使用 coze-web-search 获取价格（备用方案）
async function getPriceFromSearch() {
    return new Promise((resolve) => {
        const cmd = `cd /workspace/projects/workspace/skills/coze-web-search && npx ts-node scripts/search.ts -q "ASTER price USDT today" --count 1 --format text 2>&1`;
        
        exec(cmd, { timeout: 30000 }, (error, stdout) => {
            if (error) {
                log(`搜索错误: ${error.message}`);
                resolve(null);
                return;
            }
            
            // 尝试从输出中提取价格
            const lines = stdout.split('\n');
            for (const line of lines) {
                // 匹配价格模式，如 "$0.65" 或 "0.65 USDT"
                const match = line.match(/\$?([0-9]+\.?[0-9]*)\s*(?:USDT|USD)/i);
                if (match) {
                    const price = parseFloat(match[1]);
                    if (price > 0 && price < 100) {  // 合理的 ASTER 价格范围
                        resolve({ price, change24h: 0, source: 'search' });
                        return;
                    }
                }
            }
            resolve(null);
        });
    });
}

// 主函数
async function main() {
    log('========== ASTER 价格监控开始 ==========');
    log(`阈值: ${THRESHOLD} USDT`);
    
    let priceData = null;
    
    // 尝试从 CoinGecko 获取价格
    priceData = await getPriceFromCoinGecko();
    
    // 如果失败，使用搜索作为备用
    if (!priceData) {
        log('CoinGecko 失败，尝试搜索获取价格...');
        priceData = await getPriceFromSearch();
    }
    
    if (!priceData) {
        log('无法获取价格数据');
        process.exit(1);
    }
    
    const { price, change24h, source = 'coingecko' } = priceData;
    log(`当前 ASTER 价格: ${price} USDT (来源: ${source})`);
    
    // 保存价格历史
    const priceHistory = {
        timestamp: new Date().toISOString(),
        price: price,
        change24h: change24h,
        source: source
    };
    
    const historyFile = '/workspace/projects/workspace/logs/aster_price_history.json';
    let history = [];
    try {
        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        }
    } catch (e) {}
    history.push(priceHistory);
    // 只保留最近 100 条记录
    if (history.length > 100) history = history.slice(-100);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    // 检查是否超过阈值
    if (price > THRESHOLD) {
        log(`⚠️ 价格高于阈值 ${THRESHOLD}！`);
        
        // 检查是否已经发送过类似价格的警报（避免重复通知）
        const lastAlertTime = alertHistory.lastAlertTime ? new Date(alertHistory.lastAlertTime) : null;
        const now = new Date();
        const hoursSinceLastAlert = lastAlertTime ? (now - lastAlertTime) / (1000 * 60 * 60) : 999;
        
        // 如果距离上次警报超过 1 小时，或者价格变化超过 5%，则发送新警报
        const priceChangeSinceLastAlert = alertHistory.lastAlertPrice ? 
            Math.abs((price - alertHistory.lastAlertPrice) / alertHistory.lastAlertPrice) : 1;
        
        if (hoursSinceLastAlert >= 1 || priceChangeSinceLastAlert >= 0.05) {
            await sendTelegramAlert(price, change24h);
            log('已触发警报');
        } else {
            log(`跳过重复警报 (上次: ${hoursSinceLastAlert.toFixed(1)}小时前, 价格变化: ${(priceChangeSinceLastAlert * 100).toFixed(2)}%)`);
        }
    } else {
        log(`✅ 价格正常，低于阈值 ${THRESHOLD}`);
    }
    
    log('========== 监控结束 ==========\n');
}

main().catch(e => {
    log(`脚本错误: ${e.message}`);
    process.exit(1);
});
