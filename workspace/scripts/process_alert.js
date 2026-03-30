#!/usr/bin/env node
/**
 * 发送 ASTER 价格警报到当前 OpenClaw 会话
 * 由监控守护进程调用
 */

const fs = require('fs');
const ALERT_FILE = '/workspace/projects/workspace/logs/aster_telegram_alert_pending.json';
const SENT_FILE = '/workspace/projects/workspace/logs/aster_alerts_sent.json';

async function main() {
    // 检查是否有待发送的警报
    if (!fs.existsSync(ALERT_FILE)) {
        console.log('没有待发送的警报');
        process.exit(0);
    }
    
    const alertData = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf8'));
    
    // 检查是否已经发送过
    let sentAlerts = [];
    try {
        if (fs.existsSync(SENT_FILE)) {
            sentAlerts = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'));
        }
    } catch (e) {}
    
    const alreadySent = sentAlerts.some(a => a.timestamp === alertData.timestamp);
    if (alreadySent) {
        console.log('此警报已发送过');
        fs.unlinkSync(ALERT_FILE);
        process.exit(0);
    }
    
    // 输出发送指令（供 OpenClaw 读取）
    console.log('\n========================================');
    console.log('ASTER 价格警报 - 需要发送到 Telegram');
    console.log('========================================');
    console.log('');
    console.log(alertData.message.replace(/<[^>]*>/g, ''));  // 移除 HTML 标签
    console.log('');
    console.log('========================================');
    console.log('发送指令:');
    console.log(`sessions_send --message "🚨 ASTER 价格警报！当前价格: ${alertData.price} USDT (高于阈值 ${alertData.threshold})"`);
    console.log('========================================\n');
    
    // 标记为已发送
    sentAlerts.push({
        timestamp: alertData.timestamp,
        price: alertData.price,
        sentAt: new Date().toISOString()
    });
    
    if (sentAlerts.length > 50) sentAlerts = sentAlerts.slice(-50);
    fs.writeFileSync(SENT_FILE, JSON.stringify(sentAlerts, null, 2));
    
    // 删除待发送文件
    fs.unlinkSync(ALERT_FILE);
    
    console.log('警报已处理，等待发送...');
}

main().catch(e => {
    console.error(`错误: ${e.message}`);
    process.exit(1);
});
