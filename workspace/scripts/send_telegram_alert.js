#!/usr/bin/env node
/**
 * 发送 ASTER 价格警报到 Telegram
 * 由 monitor_aster_telegram.js 调用
 */

const ALERT_FILE = '/workspace/projects/workspace/logs/aster_telegram_alert_pending.json';
const SENT_FILE = '/workspace/projects/workspace/logs/aster_alerts_sent.json';

const fs = require('fs');

async function main() {
    // 检查是否有待发送的警报
    if (!fs.existsSync(ALERT_FILE)) {
        console.log('没有待发送的警报');
        process.exit(0);
    }
    
    const alertData = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    
    // 检查是否已经发送过（通过时间戳判断）
    let sentAlerts = [];
    try {
        if (fs.existsSync(SENT_FILE)) {
            sentAlerts = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
        }
    } catch (e) {}
    
    const alreadySent = sentAlerts.some(a => a.timestamp === alertData.timestamp);
    if (alreadySent) {
        console.log('此警报已发送过');
        fs.unlinkSync(ALERT_FILE);  // 删除待发送文件
        process.exit(0);
    }
    
    // 输出警报信息（主程序会读取并通过 message 工具发送）
    console.log('ALERT_DATA:');
    console.log(JSON.stringify(alertData, null, 2));
    
    // 标记为已发送
    sentAlerts.push({
        timestamp: alertData.timestamp,
        price: alertData.price,
        sentAt: new Date().toISOString()
    });
    
    // 只保留最近 50 条发送记录
    if (sentAlerts.length > 50) sentAlerts = sentAlerts.slice(-50);
    fs.writeFileSync(SENT_FILE, JSON.stringify(sentAlerts, null, 2));
    
    // 删除待发送文件
    fs.unlinkSync(ALERT_FILE);
    
    console.log('警报已处理');
}

main().catch(e => {
    console.error(`错误: ${e.message}`);
    process.exit(1);
});
