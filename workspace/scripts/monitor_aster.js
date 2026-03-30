#!/usr/bin/env node
/**
 * ASTER/USDT 价格监控脚本
 * 当价格高于 0.6981 时发送通知
 */

const THRESHOLD = 0.6981;
const LOG_FILE = '/workspace/projects/workspace/logs/aster_price.log';

// 确保日志目录存在
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// 通过 CoinGecko API 获取价格
async function getPriceFromCoinGecko() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=aster&vs_currencies=usd');
        const data = await response.json();
        if (data.aster && data.aster.usd) {
            return parseFloat(data.aster.usd);
        }
    } catch (e) {
        log(`CoinGecko API 错误: ${e.message}`);
    }
    return null;
}

// 通过 Bitget API 获取价格
async function getPriceFromBitget() {
    try {
        const response = await fetch('https://api.bitget.com/api/v2/spot/market/tickers?symbol=ASTERUSDT');
        const data = await response.json();
        if (data.data && data.data[0] && data.data[0].lastPr) {
            return parseFloat(data.data[0].lastPr);
        }
    } catch (e) {
        log(`Bitget API 错误: ${e.message}`);
    }
    return null;
}

// 发送微信消息（使用 OpenClaw message 工具）
async function sendWechatMessage(price) {
    const message = `🚨 ASTER 价格警报！

当前价格: ${price} USDT
阈值: ${THRESHOLD} USDT
涨幅: +${((price - THRESHOLD) / THRESHOLD * 100).toFixed(2)}%
时间: ${new Date().toLocaleString('zh-CN')}

交易链接: https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT`;

    log(`发送微信消息: ${message}`);
    
    // 使用 OpenClaw 的 message 工具发送
    // 注意：这里需要通过 OpenClaw 的 message 功能发送
    // 由于这是独立脚本，我们记录到文件，主程序会读取并发送
    const alertFile = '/workspace/projects/workspace/logs/aster_alert_pending';
    fs.writeFileSync(alertFile, JSON.stringify({
        type: 'price_alert',
        coin: 'ASTER',
        price: price,
        threshold: THRESHOLD,
        message: message,
        timestamp: new Date().toISOString()
    }));
    
    return true;
}

// 主函数
async function main() {
    log('开始检查 ASTER 价格...');
    
    let price = null;
    
    // 尝试从多个源获取价格
    price = await getPriceFromBitget();
    if (!price) {
        price = await getPriceFromCoinGecko();
    }
    
    if (!price) {
        log('无法从任何源获取价格');
        process.exit(1);
    }
    
    log(`当前 ASTER 价格: ${price} USDT`);
    
    // 检查是否超过阈值
    if (price > THRESHOLD) {
        log(`⚠️ 价格高于阈值 ${THRESHOLD}！`);
        await sendWechatMessage(price);
    } else {
        log(`价格正常，低于阈值 ${THRESHOLD}`);
    }
}

main().catch(e => {
    log(`脚本错误: ${e.message}`);
    process.exit(1);
});
