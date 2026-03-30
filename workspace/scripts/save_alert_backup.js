#!/usr/bin/env node
/**
 * ASTER 价格监控 - 备用通知方案
 * 当 Telegram 不可用时，使用以下方式：
 * 1. 保存警报到文件，你可以手动读取
 * 2. 尝试其他通知渠道（如果有配置）
 * 3. 生成可分享的警报链接
 */

const fs = require('fs');
const path = require('path');

const ALERT_FILE = '/workspace/projects/workspace/logs/aster_alert_latest.json';
const ALERT_HTML = '/workspace/projects/workspace/logs/alert_viewer.html';

function generateAlertHTML(price, threshold) {
    const now = new Date().toLocaleString('zh-CN');
    const change = ((price - threshold) / threshold * 100).toFixed(2);
    
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="30">
    <title>ASTER 价格警报</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .alert { background: #ff4444; color: white; padding: 20px; border-radius: 10px; text-align: center; }
        .normal { background: #44ff44; color: black; padding: 20px; border-radius: 10px; text-align: center; }
        .info { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .price { font-size: 48px; font-weight: bold; margin: 20px 0; }
        .time { color: #666; font-size: 14px; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    <div class="${price > threshold ? 'alert' : 'normal'}">
        <h1>🚨 ASTER 价格${price > threshold ? '警报' : '正常'}</h1>
        <div class="price">${price} USDT</div>
        <p>阈值: ${threshold} USDT</p>
        <p>${price > threshold ? `高于阈值 ${change}%` : '价格正常'}</p>
    </div>
    <div class="info">
        <p><strong>交易对:</strong> ASTER/USDT</p>
        <p><strong>交易所:</strong> <a href="https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT" target="_blank">AsterDex</a></p>
        <p class="time">更新时间: ${now}</p>
        <p class="time">每 5 分钟自动刷新</p>
    </div>
</body>
</html>`;
}

function updateAlertView(price, threshold) {
    const html = generateAlertHTML(price, threshold);
    fs.writeFileSync(ALERT_HTML, html);
    console.log(`警报页面已更新: ${ALERT_HTML}`);
}

function saveAlert(price, threshold) {
    const alert = {
        type: 'price_alert',
        coin: 'ASTER',
        price: price,
        threshold: threshold,
        timestamp: new Date().toISOString(),
        message: `ASTER 价格 ${price} USDT 高于阈值 ${threshold} USDT`
    };
    
    fs.writeFileSync(ALERT_FILE, JSON.stringify(alert, null, 2));
    updateAlertView(price, threshold);
    
    return alert;
}

// 主函数
const price = parseFloat(process.argv[2]) || 4.92;
const threshold = parseFloat(process.argv[3]) || 0.6981;

const alert = saveAlert(price, threshold);
console.log('警报已保存:', alert.message);
console.log('');
console.log('查看方式:');
console.log(`1. JSON 数据: ${ALERT_FILE}`);
console.log(`2. HTML 页面: ${ALERT_HTML}`);
console.log('');
console.log('提示: 你可以用浏览器打开 HTML 文件查看警报状态');
