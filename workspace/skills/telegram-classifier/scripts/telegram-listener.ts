#!/usr/bin/env npx tsx
/**
 * Telegram Bot Listener
 * 
 * Connects to Telegram Bot API and classifies incoming messages
 * Requires: TELEGRAM_BOT_TOKEN environment variable
 * Optional: HTTPS_PROXY for proxy (e.g., http://47.94.149.194:7890)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { request, ProxyAgent } from 'undici';
import { classifyMessage } from './classify';
import type { ClassificationResult } from './classify';
import { logger } from './logger';
import { validateConfig, printValidationResult } from './config-validator';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const POLL_INTERVAL = 2000; // 2 seconds
const DATA_DIR = path.join(__dirname, '../data');

if (PROXY_URL) {
  logger.info('Using proxy for Telegram API', { proxy: PROXY_URL });
}

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

// HTTP request helper using undici (modern, fast, and reliable)
async function telegramRequest(method: string, params: Record<string, any> = {}): Promise<any> {
  const url = `${API_BASE}/${method}`;

  const options: any = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params),
    bodyTimeout: 60000,
    headersTimeout: 60000
  };

  // Add proxy support if configured
  if (PROXY_URL) {
    try {
      options.dispatcher = new ProxyAgent(PROXY_URL);
    } catch (error) {
      console.error('Failed to configure proxy:', error);
    }
  }

  try {
    const response = await request(url, options);

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.statusCode}`);
    }

    const json = await response.body.json() as any;

    if (json.ok) {
      return json.result;
    } else {
      throw new Error(`Telegram API error: ${json.description || 'Unknown error'}`);
    }
  } catch (error: any) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

// Send message to Telegram
async function sendMessage(chatId: number, text: string): Promise<void> {
  try {
    await telegramRequest('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
    logger.debug('Message sent successfully', { chatId, textLength: text.length });
  } catch (error: any) {
    logger.error('Failed to send message', error, { chatId });
  }
}

// Process incoming message
async function processMessage(message: TelegramMessage): Promise<void> {
  try {
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

    logger.info('Processing new message', {
      userId,
      username,
      messageId: message.message_id,
      contentLength: content.length
    });

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

    logger.info('Message classified', {
      messageId: result.messageId,
      category: result.category.id,
      sentiment: result.sentiment.label,
      urgency: result.urgency.level,
      confidence: result.category.confidence
    });

    // Save result
    saveClassificationResult(result);

    // Auto-reply based on classification
    await sendAutoReply(message.chat.id, result);

    // Save stats
    saveStats();
  } catch (error: any) {
    logger.error('Failed to process message', error, {
      messageId: message.message_id,
      chatId: message.chat.id
    });
  }
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
  try {
    ensureDataDir();
    const date = new Date().toISOString().split('T')[0];
    const filename = `classifications_${date}.jsonl`;
    const filepath = path.join(DATA_DIR, filename);

    fs.appendFileSync(filepath, JSON.stringify(result) + '\n', 'utf-8');
    logger.debug('Classification saved', { messageId: result.messageId, filepath });
  } catch (error: any) {
    logger.error('Failed to save classification result', error, {
      messageId: result.messageId
    });
  }
}

// Save statistics
function saveStats(): void {
  try {
    ensureDataDir();
    const filepath = path.join(DATA_DIR, 'stats.json');
    fs.writeFileSync(filepath, JSON.stringify(stats, null, 2), 'utf-8');
    logger.debug('Statistics saved', { totalMessages: stats.totalMessages });
  } catch (error: any) {
    logger.error('Failed to save statistics', error);
  }
}

// Load statistics
function loadStats(): void {
  const filepath = path.join(DATA_DIR, 'stats.json');
  if (fs.existsSync(filepath)) {
    try {
      stats = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      logger.info('Statistics loaded', {
        totalMessages: stats.totalMessages,
        startTime: stats.startTime
      });
    } catch (error: any) {
      logger.warn('Failed to load statistics, starting fresh', error);
    }
  } else {
    logger.info('No existing statistics found, starting fresh');
  }
}

// Main polling loop
async function startPolling(): Promise<void> {
  let lastUpdateId = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;

  logger.info('Telegram Bot Classifier started');
  logger.info('Waiting for messages...');
  console.log('\n🤖 Bot is running');
  console.log('📋 Commands available:');
  console.log('  /stats - Show bot statistics');
  console.log('\nPress Ctrl+C to stop\n');

  while (true) {
    try {
      const updates: TelegramUpdate[] = await telegramRequest('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ['message', 'edited_message']
      });

      // Reset error counter on successful request
      consecutiveErrors = 0;

      for (const update of updates) {
        lastUpdateId = update.update_id;

        const message = update.message || update.edited_message;
        if (message) {
          await processMessage(message);
        }
      }
    } catch (error: any) {
      consecutiveErrors++;
      logger.error('Polling error', error, {
        consecutiveErrors,
        lastUpdateId
      });

      // If too many consecutive errors, exit
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error('Too many consecutive errors, exiting', undefined, {
          consecutiveErrors
        });
        process.exit(1);
      }

      // Exponential backoff: wait longer after each error
      const waitTime = Math.min(5000 * Math.pow(1.5, consecutiveErrors - 1), 60000);
      logger.warn('Retrying after error', { waitTime, consecutiveErrors });
      await new Promise(resolve => setTimeout(resolve, waitTime));
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
  
  // Validate configuration
  const validation = validateConfig();
  printValidationResult(validation);

  if (!validation.valid) {
    console.error('\nGet your bot token from @BotFather on Telegram');
    console.error('Then set it: export TELEGRAM_BOT_TOKEN="your-token"');
    return 1;
  }

  try {
    ensureDataDir();
    loadStats();

    const me = await telegramRequest('getMe');
    logger.info('Connected to Telegram successfully', {
      username: me.username,
      firstName: me.first_name,
      botId: me.id
    });
    console.log(`\n✅ Connected as: @${me.username} (${me.first_name})\n`);

    await startPolling();
  } catch (error: any) {
    logger.error('Failed to start bot', error);
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
main().then((code) => process.exit(code));

export { startPolling, processMessage, sendAutoReply };
