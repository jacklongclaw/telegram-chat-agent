#!/usr/bin/env npx tsx
/**
 * 简单的 API 服务器
 * 用于提供分类数据给前端仪表盘
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3100;
const DATA_DIR = path.join(__dirname, '../data');
const UI_DIR = path.join(__dirname, '../ui');

// Cache for classifications data
let messageCache: { data: any[], timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds cache

// 读取所有分类数据
function getAllClassifications(): any[] {
  try {
    // Check cache
    if (messageCache && Date.now() - messageCache.timestamp < CACHE_TTL) {
      return messageCache.data;
    }

    const results: any[] = [];

    if (!fs.existsSync(DATA_DIR)) {
      logger.warn('Data directory does not exist', { dataDir: DATA_DIR });
      return results;
    }

    const files = fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('classifications_') && f.endsWith('.jsonl'))
      .sort()
      .reverse() // 最新的文件优先
      .slice(0, 7); // 只读取最近7天的数据

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            results.push(JSON.parse(line));
          } catch (e: any) {
            logger.warn('Failed to parse classification line', e, { file, line: line.substring(0, 50) });
          }
        }
      }

      // Limit to 1000 messages
      if (results.length >= 1000) {
        logger.debug('Reached message limit', { count: results.length });
        break;
      }
    }

    // Update cache
    messageCache = { data: results, timestamp: Date.now() };
    logger.debug('Classifications loaded', { count: results.length, filesRead: files.length });

    return results;
  } catch (error: any) {
    logger.error('Failed to load classifications', error);
    return [];
  }
}

// 获取统计数据
function getStats() {
  const messages = getAllClassifications();
  
  const stats = {
    total: messages.length,
    categories: {} as Record<string, number>,
    sentiments: { positive: 0, neutral: 0, negative: 0 },
    urgency: { urgent: 0, normal: 0, low: 0 },
    recentMessages: messages.slice(0, 10)
  };

  for (const msg of messages) {
    // 分类统计
    const catId = msg.category?.id || 'other';
    stats.categories[catId] = (stats.categories[catId] || 0) + 1;
    
    // 情感统计
    const sentiment = msg.sentiment?.label || 'neutral';
    if (stats.sentiments.hasOwnProperty(sentiment)) {
      stats.sentiments[sentiment as keyof typeof stats.sentiments]++;
    }
    
    // 紧急程度统计
    const urgency = msg.urgency?.level || 'normal';
    if (stats.urgency.hasOwnProperty(urgency)) {
      stats.urgency[urgency as keyof typeof stats.urgency]++;
    }
  }

  return stats;
}

// 处理 API 请求
function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url || '/';
  
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.startsWith('/api/messages')) {
    // 获取所有消息（支持分页）
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const page = Math.max(1, parseInt(urlObj.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(urlObj.searchParams.get('limit') || '50')));
      const category = urlObj.searchParams.get('category') || '';

      let allMessages = getAllClassifications();

      // Filter by category if specified
      if (category && category !== 'all') {
        allMessages = allMessages.filter(msg => msg.category?.id === category);
      }

      // Pagination
      const total = allMessages.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedMessages = allMessages.slice(start, end);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        data: paginatedMessages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }));
      logger.debug('Messages API response', { page, limit, total, returned: paginatedMessages.length });
    } catch (error: any) {
      logger.error('Error in messages API', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch messages' }));
    }
    return;
  }

  if (url === '/api/stats') {
    // 获取统计数据
    try {
      const stats = getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      logger.debug('Stats API response', { totalMessages: stats.total });
    } catch (error: any) {
      logger.error('Error in stats API', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch stats' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// 处理静态文件请求
function handleStaticRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let url = req.url || '/';
  
  // 默认返回 index.html
  if (url === '/' || url === '/index.html') {
    url = '/dashboard.html';
  }

  // API endpoints
  if (url.startsWith('/api/')) {
    handleApiRequest(req, res);
    return;
  }

  const filePath = path.join(UI_DIR, url);
  
  // 安全检查：防止目录遍历
  if (!filePath.startsWith(UI_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // 设置内容类型
  const ext = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  // 添加 CORS 支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  const content = fs.readFileSync(filePath);
  res.writeHead(200);
  res.end(content);
}

// 主服务器
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const startTime = Date.now();

  logger.debug('Incoming request', { method: req.method, url });

  try {
    if (url.startsWith('/api/')) {
      handleApiRequest(req, res);
    } else {
      handleStaticRequest(req, res);
    }

    const duration = Date.now() - startTime;
    logger.debug('Request completed', { method: req.method, url, duration });
  } catch (error: any) {
    logger.error('Request handler error', error, { method: req.method, url });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🤖 Telegram 消息分类仪表盘服务器已启动                      ║
║                                                            ║
║   📊 仪表盘地址: http://localhost:${PORT}                      ║
║   📡 API 地址:    http://localhost:${PORT}/api/messages        ║
║   📈 统计 API:    http://localhost:${PORT}/api/stats           ║
║                                                            ║
║   按 Ctrl+C 停止服务器                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 服务器关闭中...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
