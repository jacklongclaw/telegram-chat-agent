#!/usr/bin/env npx tsx
/**
 * 简单的 API 服务器
 * 用于提供分类数据给前端仪表盘
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3100;
const DATA_DIR = path.join(__dirname, '../data');
const UI_DIR = path.join(__dirname, '../ui');

// 读取所有分类数据
function getAllClassifications(): any[] {
  const results: any[] = [];
  
  if (!fs.existsSync(DATA_DIR)) {
    return results;
  }

  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith('classifications_') && f.endsWith('.jsonl'))
    .sort()
    .reverse(); // 最新的文件优先

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          results.push(JSON.parse(line));
        } catch (e) {
          // 跳过解析错误的行
        }
      }
    }
  }

  return results;
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

  if (url === '/api/messages') {
    // 获取所有消息
    const messages = getAllClassifications();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(messages));
    return;
  }

  if (url === '/api/stats') {
    // 获取统计数据
    const stats = getStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats));
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
  
  const content = fs.readFileSync(filePath);
  res.writeHead(200);
  res.end(content);
}

// 主服务器
const server = http.createServer((req, res) => {
  const url = req.url || '/';
  
  console.log(`${new Date().toISOString()} ${req.method} ${url}`);
  
  if (url.startsWith('/api/')) {
    handleApiRequest(req, res);
  } else {
    handleStaticRequest(req, res);
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
