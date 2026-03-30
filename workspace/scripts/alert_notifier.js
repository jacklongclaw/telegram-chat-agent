#!/usr/bin/env node
/**
 * 本地警报通知器
 * 创建一个可以被外部轮询的警报文件
 */

const fs = require('fs');
const ALERT_FILE = '/workspace/projects/workspace/logs/aster_alert_for_user.json';
const ALERT_HISTORY = '/workspace/projects/workspace/logs/aster_alert_history.json';

function createAlert(price, threshold) {
    const alert = {
        type: 'price_alert',
        coin: 'ASTER',
        price: price,
        threshold: threshold,
        message: `🚨 ASTER 价格警报！当前价格 ${price} USDT 高于阈值 ${threshold} USDT`,
        timestamp: new Date().toISOString(),
        notified: false
    };
    
    fs.writeFileSync(ALERT_FILE, JSON.stringify(alert, null, 2));
    
    // 添加到历史
    let history = [];
    try {
        if (fs.existsSync(ALERT_HISTORY)) {
            history = JSON.parse(fs.readFileSync(ALERT_HISTORY, 'utf8'));
        }
    } catch (e) {}
    
    history.push(alert);
    if (history.length > 100) history = history.slice(-100);
    fs.writeFileSync(ALERT_HISTORY, JSON.stringify(history, null, 2));
    
    console.log('警报已创建:', alert.message);
}

// 检查是否有未读警报
function checkAlert() {
    if (!fs.existsSync(ALERT_FILE)) {
        return null;
    }
    
    const alert = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    
    if (!alert.notified) {
        return alert;
    }
    
    return null;
}

// 标记警报为已读
function markAsNotified() {
    if (fs.existsSync(ALERT_FILE)) {
        const alert = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
        alert.notified = true;
        fs.writeFileSync(ALERT_FILE, JSON.stringify(alert, null, 2));
    }
}

module.exports = { createAlert, checkAlert, markAsNotified };

// 如果直接运行
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'check') {
        const alert = checkAlert();
        if (alert) {
            console.log('ALERT:');
            console.log(JSON.stringify(alert, null, 2));
        } else {
            console.log('没有新警报');
        }
    } else if (command === 'mark') {
        markAsNotified();
        console.log('已标记为已读');
    } else {
        console.log('用法: node alert_notifier.js [check|mark]');
    }
}
