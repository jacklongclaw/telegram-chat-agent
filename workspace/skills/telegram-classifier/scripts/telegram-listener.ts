#!/usr/bin/env npx ts-node
/**
 * Telegram Bot Listener
 * 
 * Connects to Telegram Bot API and classifies incoming messages
 * Requires: TELEGRAM_BOT_TOKEN environment variable
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { fileURLToPath } from 'url';
import { classifyMessage } from './classify.js';
import type { ClassificationResult } from './classify.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const POLL_INTERVAL = 1000; // 1 second
const DATA_DIR = path.join(__dirname, '../data');

// Types
interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

// Statistics
interface BotStats {
  startTime: string;
  totalMessages: number;
  categoriesCount: { [key: string]: number };
  sentimentCount: { [key: string]: number };
  urgencyCount: { [key: string]: number };
}

let stats: BotStats = {
  startTime: new Date().toISOString(),
  totalMessages: 0,
  categoriesCount: {},
  sentimentCount: { positive: 0, neutral: 0, negative: 0 },
  urgencyCount: { urgent: 0, normal: 0, low: 0 }
};

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// HTTP request helper
function telegramRequest(method: string, params: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/${method}`;
    const body = JSON.stringify(params);
    
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve(json.result);
          } else {
            reject(new Error(`Telegram API error: ${json.description}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Send message to Telegram
async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

// Process incoming message
async function processMessage(message: TelegramMessage): Promise<void> {
  const content = message.text || message.caption || '';
  
  if (!content || content.startsWith('/')) {
    // Skip empty messages and commands (except /stats)
    if (content === '/stats') {
      await sendStats(message.chat.id);
    }
    return;
  }
  
  const userId = message.from?.id?.toString() || 'unknown';
  const username = message.from?.username || 
    `${message.from?.first_name || ''} ${message.from?.last_name || ''}`.trim();
  
  console.log(`\n📩 New message from ${username} (${userId}):`);
  console.log(`   "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`);
  
  // Classify the message
  const result = classifyMessage({
    id: message.message_id.toString(),
    userId,
    username,
    content
  });
  
  // Update statistics
  stats.totalMessages++;
  stats.categoriesCount[result.category.id] = (stats.categoriesCount[result.category.id] || 0) + 1;
  stats.sentimentCount[result.sentiment.label]++;
  stats.urgencyCount[result.urgency.level]++;
  
  // Save result
  saveClassificationResult(result);
  
  // Log result
  console.log(`\n📊 Classification:`);
  console.log(`   Category: ${result.category.name} (${result.category.confidence * 100}%)`);
  console.log(`   Sentiment: ${result.sentiment.label} (${result.sentiment.confidence * 100}%)`);
  console.log(`   Urgency: ${result.urgency.level}`);
  
  // Auto-reply based on classification
  await sendAutoReply(message.chat.id, result);
  
  // Save stats
  saveStats();
}

// Send automatic reply based on classification
async function sendAutoReply(chatId: number, result: ClassificationResult): Promise<void> {
  let reply = '';
  
  switch (result.category.id) {
    case 'question':
      reply = '感谢您的提问！我已经收到您的问题，正在为您处理中...';
      break;
    case 'complaint':
      reply = '非常抱歉给您带来不便！您的反馈我们非常重视，会尽快处理。';
      break;
    case 'order':
      reply = '收到您的订单相关咨询，稍后会为您查询处理。';
      break;
    case 'technical':
      reply = '收到您的问题反馈，技术团队会尽快跟进处理。';
      break;
    case 'suggestion':
      reply = '感谢您的宝贵建议！我们会认真考虑并持续改进。';
      break;
    case 'chitchat':
      reply = '您好！有什么可以帮您的吗？';
      break;
    default:
      // No auto-reply for other categories
      return;
  }
  
  if (result.urgency.level === 'urgent') {
    reply = '⚡ *紧急消息已收到*\n\n' + reply;
  }
  
  await sendMessage(chatId, reply);
}

// Send statistics
async function sendStats(chatId: number): Promise<void> {
  const uptime = Math.floor((Date.now() - new Date(stats.startTime).getTime()) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  let statsText = `📊 *Bot Statistics*\n\n`;
  statsText += `⏱ Uptime: ${hours}h ${minutes}m\n`;
  statsText += `📨 Total Messages: ${stats.totalMessages}\n\n`;
  
  statsText += `📂 *Categories:*\n`;
  for (const [cat, count] of Object.entries(stats.categoriesCount)) {
    statsText += `  • ${cat}: ${count}\n`;
  }
  
  statsText += `\n😊 *Sentiment:*\n`;
  statsText += `  • Positive: ${stats.sentimentCount.positive}\n`;
  statsText += `  • Neutral: ${stats.sentimentCount.neutral}\n`;
  statsText += `  • Negative: ${stats.sentimentCount.negative}\n`;
  
  statsText += `\n⚡ *Urgency:*\n`;
  statsText += `  • Urgent: ${stats.urgencyCount.urgent}\n`;
  statsText += `  • Normal: ${stats.urgencyCount.normal}\n`;
  statsText += `  • Low: ${stats.urgencyCount.low}\n`;
  
  await sendMessage(chatId, statsText);
}

// Save classification result
function saveClassificationResult(result: ClassificationResult): void {
  ensureDataDir();
  const date = new Date().toISOString().split('T')[0];
  const filename = `classifications_${date}.jsonl`;
  const filepath = path.join(DATA_DIR, filename);
  
  fs.appendFileSync(filepath, JSON.stringify(result) + '\n', 'utf-8');
}

// Save statistics
function saveStats(): void {
  ensureDataDir();
  const filepath = path.join(DATA_DIR, 'stats.json');
  fs.writeFileSync(filepath, JSON.stringify(stats, null, 2), 'utf-8');
}

// Load statistics
function loadStats(): void {
  const filepath = path.join(DATA_DIR, 'stats.json');
  if (fs.existsSync(filepath)) {
    try {
      stats = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    } catch (e) {
      console.log('Starting with fresh statistics');
    }
  }
}

// Main polling loop
async function startPolling(): Promise<void> {
  let lastUpdateId = 0;
  
  console.log('🤖 Telegram Bot Classifier started');
  console.log('📋 Waiting for messages...\n');
  console.log('Commands available:');
  console.log('  /stats - Show bot statistics');
  console.log('\nPress Ctrl+C to stop\n');
  
  while (true) {
    try {
      const updates: TelegramUpdate[] = await telegramRequest('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ['message', 'edited_message']
      });
      
      for (const update of updates) {
        lastUpdateId = update.update_id;
        
        const message = update.message || update.edited_message;
        if (message) {
          await processMessage(message);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
    }
  }
}

// CLI interface
async function main(): Promise<number> {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      console.log(`
Telegram Bot Classifier

Usage: npx ts-node telegram-listener.ts [OPTIONS]

Environment Variables:
  TELEGRAM_BOT_TOKEN    Your Telegram Bot Token (required)

Options:
  --help                Show this help message

Setup:
  1. Create a bot via @BotFather on Telegram
  2. Copy the bot token
  3. Set environment variable:
     export TELEGRAM_BOT_TOKEN="your-bot-token"
  4. Run this script:
     npx ts-node telegram-listener.ts

Features:
  - Automatic message classification
  - Sentiment analysis
  - Urgency detection
  - Statistics tracking (/stats command)
  - Auto-reply based on category
`);
      return 0;
    }
  }
  
  if (!BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required');
    console.error('\nGet your bot token from @BotFather on Telegram');
    console.error('Then set it: export TELEGRAM_BOT_TOKEN="your-token"');
    return 1;
  }
  
  ensureDataDir();
  loadStats();
  
  try {
    const me = await telegramRequest('getMe');
    console.log(`\n✅ Connected to Telegram as: @${me.username} (${me.first_name})\n`);
    
    await startPolling();
  } catch (error) {
    console.error('Failed to start bot:', error);
    return 1;
  }
  
  return 0;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  saveStats();
  process.exit(0);
});

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => process.exit(code));
}

export { startPolling, processMessage, sendAutoReply };
