#!/usr/bin/env node
/**
 * ASTER 价格监控守护进程
 * 使用 setInterval 代替 cron，每 5 分钟检查一次价格
 * 
 * 使用方法:
 *   node scripts/monitor_daemon.js start    # 启动监控
 *   node scripts/monitor_daemon.js stop     # 停止监控
 *   node scripts/monitor_daemon.js status   # 查看状态
 *   node scripts/monitor_daemon.js check    # 立即检查一次
 */

const THRESHOLD = 0.6981;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟
const LOG_FILE = '/workspace/projects/workspace/logs/aster_daemon.log';
const PID_FILE = '/workspace/projects/workspace/logs/aster_daemon.pid';
const ALERT_FILE = '/workspace/projects/workspace/logs/aster_telegram_alert_pending.json';

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// 确保日志目录存在
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
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
                change24h: data.aster.usd_24h_change || 0,
                source: 'CoinGecko'
            };
        }
    } catch (e) {
        log(`CoinGecko API 失败: ${e.message}`);
    }
    return null;
}

// 从搜索获取价格（备用方案）
async function getPriceFromSearch() {
    return new Promise((resolve) => {
        const cmd = `cd /workspace/projects/workspace/skills/coze-web-search && npx ts-node scripts/search.ts -q "ASTER USDT price today current" --count 3 --format text 2>&1`;
        
        exec(cmd, { timeout: 45000 }, (error, stdout) => {
            if (error) {
                log(`搜索失败: ${error.message}`);
                resolve(null);
                return;
            }
            
            // 尝试从输出中提取价格
            // 查找类似 "0.65" 或 "$0.65" 的价格格式
            const priceMatches = stdout.match(/\$?([0-9]+\.[0-9]{2,6})\s*(?:USDT|USD)?/gi);
            
            if (priceMatches && priceMatches.length > 0) {
                // 过滤合理的价格范围 (0.1 - 10)
                for (const match of priceMatches) {
                    const cleanPrice = match.replace(/[$,]/g, '').replace(/USDT|USD/i, '').trim();
                    const price = parseFloat(cleanPrice);
                    if (price > 0.1 && price < 10) {
                        log(`从搜索获取价格: ${price} USDT`);
                        resolve({
                            price: price,
                            change24h: 0,
                            source: 'search'
                        });
                        return;
                    }
                }
            }
            
            log('无法从搜索结果解析价格');
            resolve(null);
        });
    });
}

// 获取价格（主入口）
async function getPrice() {
    // 先尝试 CoinGecko
    let result = await getPriceFromCoinGecko();
    
    // 如果失败，使用搜索作为备用
    if (!result) {
        log('尝试从搜索获取价格...');
        result = await getPriceFromSearch();
    }
    
    return result;
}

// 尝试发送 Telegram 消息
async function trySendTelegram(message) {
    const CONFIG_FILE = '/workspace/projects/workspace/config/telegram_bot.json';
    const TOKEN_FILE = '/workspace/projects/workspace/config/.bot_token';
    
    try {
        // 检查配置
        if (!fs.existsSync(CONFIG_FILE) || !fs.existsSync(TOKEN_FILE)) {
            return false;
        }
        
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (!config.enabled || !config.chat_id) {
            return false;
        }
        
        const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        
        const data = {
            chat_id: config.chat_id,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        };
        
        return new Promise((resolve) => {
            // 使用代理（如果配置了）
            let proxyOption = '';
            if (config.proxy && config.proxy.enabled && config.proxy.http_proxy) {
                proxyOption = `-x "${config.proxy.http_proxy}"`;
            }
            
            const cmd = `curl -s ${proxyOption} -X POST "${url}" -H "Content-Type: application/json" -d '${JSON.stringify(data)}' --max-time 15`;
            
            log(`发送命令: curl -s ${proxyOption ? '-x "***" ' : ''}-X POST "${url}" ...`);
            
            exec(cmd, (error, stdout) => {
                if (error) {
                    log(`Telegram 发送失败: ${error.message}`);
                    resolve(false);
                    return;
                }
                
                try {
                    const response = JSON.parse(stdout);
                    if (response.ok) {
                        log('Telegram 消息发送成功！');
                        resolve(true);
                    } else {
                        log(`Telegram API 错误: ${response.description}`);
                        resolve(false);
                    }
                } catch (e) {
                    log(`解析响应失败: ${e.message}`);
                    resolve(false);
                }
            });
        });
    } catch (e) {
        return false;
    }
}

// 保存警报
async function saveAlert(price, change24h) {
    const changeEmoji = change24h >= 0 ? '📈' : '📉';
    const changeText = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;
    
    const message = `🚨 <b>ASTER 价格警报</b>

💰 当前价格: <b>${price.toFixed(6)} USDT</b>
📊 24h 变化: ${changeEmoji} ${changeText}
🎯 阈值: ${THRESHOLD} USDT
📈 高于阈值: +${((price - THRESHOLD) / THRESHOLD * 100).toFixed(2)}%

⏰ ${new Date().toLocaleString('zh-CN')}

🔗 <a href="https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT">前往交易</a>`;
    
    const alertData = {
        type: 'price_alert',
        coin: 'ASTER',
        price: price,
        threshold: THRESHOLD,
        change24h: change24h,
        message: message,
        timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(ALERT_FILE, JSON.stringify(alertData, null, 2));
    log(`警报已保存: ${price} USDT`);
    
    // 尝试发送 Telegram 消息
    log('尝试发送 Telegram 通知...');
    const sent = await trySendTelegram(message);
    if (!sent) {
        log('Telegram 未配置或发送失败，警报已保存到文件');
    }
}

// 检查价格
async function checkPrice() {
    log('========== 开始价格检查 ==========');
    
    const priceData = await getPrice();
    
    if (!priceData) {
        log('无法获取价格');
        return;
    }
    
    const { price, change24h } = priceData;
    log(`当前 ASTER 价格: ${price} USDT (24h: ${change24h?.toFixed(2) || 0}%)`);
    
    // 检查是否超过阈值
    if (price > THRESHOLD) {
        log(`⚠️ 价格高于阈值 ${THRESHOLD}！`);
        await saveAlert(price, change24h);
    } else {
        log(`✅ 价格正常，低于阈值 ${THRESHOLD}`);
    }
    
    // 保存价格历史
    const historyFile = '/workspace/projects/workspace/logs/aster_price_history.json';
    let history = [];
    try {
        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        }
    } catch (e) {}
    
    history.push({
        timestamp: new Date().toISOString(),
        price: price,
        change24h: change24h
    });
    
    // 只保留最近 1000 条
    if (history.length > 1000) history = history.slice(-1000);
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    
    log('========== 检查结束 ==========\n');
}

// 启动守护进程
function startDaemon() {
    // 检查是否已经在运行
    if (fs.existsSync(PID_FILE)) {
        const pid = fs.readFileSync(PID_FILE, 'utf8');
        try {
            process.kill(parseInt(pid), 0);
            log(`监控已在运行中 (PID: ${pid})`);
            return;
        } catch (e) {
            // 进程不存在，删除旧的 pid 文件
            fs.unlinkSync(PID_FILE);
        }
    }
    
    // 后台运行
    const child = spawn(process.execPath, [__filename, 'daemon'], {
        detached: true,
        stdio: 'ignore'
    });
    
    child.unref();
    fs.writeFileSync(PID_FILE, child.pid.toString());
    log(`监控已启动 (PID: ${child.pid})`);
    console.log(`✅ ASTER 价格监控已启动！`);
    console.log(`   - 检查间隔: 5 分钟`);
    console.log(`   - 价格阈值: ${THRESHOLD} USDT`);
    console.log(`   - 日志文件: logs/aster_daemon.log`);
}

// 停止守护进程
function stopDaemon() {
    if (!fs.existsSync(PID_FILE)) {
        log('监控未运行');
        console.log('监控未运行');
        return;
    }
    
    const pid = fs.readFileSync(PID_FILE, 'utf8');
    try {
        process.kill(parseInt(pid), 'SIGTERM');
        fs.unlinkSync(PID_FILE);
        log(`监控已停止 (PID: ${pid})`);
        console.log('✅ 监控已停止');
    } catch (e) {
        log(`停止失败: ${e.message}`);
        console.log('停止失败，进程可能已结束');
        fs.unlinkSync(PID_FILE);
    }
}

// 查看状态
function checkStatus() {
    if (!fs.existsSync(PID_FILE)) {
        console.log('❌ 监控未运行');
        return;
    }
    
    const pid = fs.readFileSync(PID_FILE, 'utf8');
    try {
        process.kill(parseInt(pid), 0);
        console.log(`✅ 监控运行中 (PID: ${pid})`);
        
        // 显示最后检查时间
        if (fs.existsSync(LOG_FILE)) {
            const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(l => l.includes('当前 ASTER'));
            if (lines.length > 0) {
                console.log(`📊 ${lines[lines.length - 1]}`);
            }
        }
    } catch (e) {
        console.log('❌ 监控未运行 (PID 文件残留)');
        fs.unlinkSync(PID_FILE);
    }
}

// 守护进程主循环
function runDaemon() {
    log('========== ASTER 价格监控守护进程启动 ==========');
    log(`检查间隔: ${CHECK_INTERVAL / 1000} 秒`);
    log(`价格阈值: ${THRESHOLD} USDT`);
    
    // 立即检查一次
    checkPrice();
    
    // 定时检查
    setInterval(checkPrice, CHECK_INTERVAL);
    
    // 处理退出信号
    process.on('SIGTERM', () => {
        log('收到 SIGTERM，正在退出...');
        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
        }
        process.exit(0);
    });
}

// 主函数
const command = process.argv[2] || 'status';

switch (command) {
    case 'start':
        startDaemon();
        break;
    case 'stop':
        stopDaemon();
        break;
    case 'status':
        checkStatus();
        break;
    case 'check':
        checkPrice();
        break;
    case 'daemon':
        runDaemon();
        break;
    default:
        console.log('用法: node monitor_daemon.js [start|stop|status|check]');
        console.log('  start  - 启动监控');
        console.log('  stop   - 停止监控');
        console.log('  status - 查看状态');
        console.log('  check  - 立即检查一次价格');
}
