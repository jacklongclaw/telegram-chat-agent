/**
 * ASTER/USDT 价格监控配置和工具
 * 
 * 使用方法:
 * 1. 手动检查: 在 OpenClaw 会话中运行 "检查 ASTER 价格"
 * 2. 自动监控: 设置 cron 任务定期调用
 */

export const CONFIG = {
    // 监控配置
    coin: 'ASTER',
    pair: 'ASTERUSDT',
    url: 'https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT',
    threshold: 0.6981,  // 价格阈值
    
    // 检查频率（毫秒）
    checkInterval: 5 * 60 * 1000,  // 5分钟
    
    // 通知配置
    notification: {
        enabled: true,
        // 可以配置多个通知渠道
        channels: ['wechat', 'log'],
    },
    
    // 日志配置
    logFile: '/workspace/projects/workspace/logs/aster_price_monitor.log',
    alertFile: '/workspace/projects/workspace/logs/aster_alerts.json',
};

// 价格历史记录
export interface PriceRecord {
    timestamp: string;
    price: number;
    source: string;
    alertTriggered?: boolean;
}

// 当前状态
export interface MonitorState {
    lastCheck: string | null;
    lastPrice: number | null;
    alertCount: number;
    isRunning: boolean;
}

// 默认状态
export const defaultState: MonitorState = {
    lastCheck: null,
    lastPrice: null,
    alertCount: 0,
    isRunning: false,
};
