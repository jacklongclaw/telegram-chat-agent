#!/usr/bin/env npx tsx
/**
 * Telegram Message Classifier
 * 
 * Analyzes and classifies Telegram messages using LLM
 * Supports: topic classification, sentiment analysis, urgency detection
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Classification types
interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priority: string;
}

interface ClassificationResult {
  messageId: string;
  timestamp: string;
  userId: string;
  username?: string;
  content: string;
  category: {
    id: string;
    name: string;
    confidence: number;
  };
  sentiment: {
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  urgency: {
    level: 'urgent' | 'normal' | 'low';
    confidence: number;
  };
  keywords: string[];
  summary: string;
  suggestedResponse?: string;
}

interface ClassifierConfig {
  categories: Category[];
  sentimentAnalysis: { enabled: boolean; categories: string[] };
  urgencyDetection: { enabled: boolean; levels: string[] };
}

// Load configuration
const configPath = path.join(__dirname, '../config/categories.json');
const config: ClassifierConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Keyword-based classification with improved accuracy
function classifyByKeywords(content: string): { category: Category; score: number } {
  const normalizedContent = content.toLowerCase();
  let bestMatch: { category: Category; score: number } = {
    category: config.categories.find(c => c.id === 'other')!,
    score: 0
  };

  for (const category of config.categories) {
    if (category.keywords.length === 0) continue;

    let totalScore = 0;
    let matchedKeywords = 0;

    for (const keyword of category.keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = normalizedContent.indexOf(keywordLower);

      if (index >= 0) {
        matchedKeywords++;

        // Position weight: earlier keywords have higher weight (0.7-1.0)
        const positionWeight = 1 - (index / normalizedContent.length) * 0.3;

        // Frequency weight: count multiple occurrences
        const regex = new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const occurrences = (normalizedContent.match(regex) || []).length;
        const frequencyWeight = Math.min(occurrences * 0.2 + 0.8, 1.5);

        totalScore += positionWeight * frequencyWeight;
      }
    }

    // Calculate normalized score considering keyword density
    const score = matchedKeywords > 0
      ? (totalScore / category.keywords.length) * Math.min(matchedKeywords / 2, 1)
      : 0;

    if (score > bestMatch.score) {
      bestMatch = { category, score };
    }
  }

  return bestMatch;
}

// Sentiment analysis with negation detection and emoji support
function analyzeSentiment(content: string): { label: 'positive' | 'neutral' | 'negative'; confidence: number } {
  const positivePatterns = [
    '谢谢', '感谢', '很好', '不错', '喜欢', '满意', '棒', '赞',
    '太好了', '完美', '优秀', '给力', '厉害', '超赞', '舒服',
    '惊喜', '开心', '高兴', '靠谱', '值得'
  ];
  const negativePatterns = [
    '不满', '差', '糟糕', '失望', '生气', '投诉', '退货',
    '垃圾', '骗', '坑', '烂', '恶心', '愤怒', '抱怨', '难用',
    '退款', '问题', '不行', '无法', '崩溃'
  ];
  const negations = ['不', '没', '别', '勿', '非', '未', '无'];

  const normalizedContent = content.toLowerCase();

  // Detect punctuation and emojis
  const exclamationCount = (content.match(/[!！]/g) || []).length;
  const questionCount = (content.match(/[?？]/g) || []).length;
  const hasPositiveEmoji = /[😊😄😃😀🎉👍✨💖🥰😍🤗👏]/.test(content);
  const hasNegativeEmoji = /[😠😡😤😞😔💔😢😭🤬😩]/.test(content);

  let positiveScore = 0;
  let negativeScore = 0;

  // Check positive patterns with negation context
  for (const pattern of positivePatterns) {
    const index = normalizedContent.indexOf(pattern);
    if (index >= 0) {
      // Check if there's a negation word within 2 characters before
      const contextBefore = normalizedContent.substring(Math.max(0, index - 2), index);
      const hasNegation = negations.some(neg => contextBefore.includes(neg));

      // If negated, reduce positive score or increase negative
      if (hasNegation) {
        negativeScore += 0.8;
      } else {
        positiveScore += 1;
      }
    }
  }

  // Check negative patterns
  for (const pattern of negativePatterns) {
    if (normalizedContent.includes(pattern)) {
      negativeScore += 1;
    }
  }

  // Add emoji weights
  if (hasPositiveEmoji) positiveScore += 0.5;
  if (hasNegativeEmoji) negativeScore += 0.5;

  // Exclamation marks slightly boost sentiment strength
  if (exclamationCount > 0) {
    const boostFactor = Math.min(exclamationCount * 0.1, 0.3);
    if (positiveScore > negativeScore) {
      positiveScore += boostFactor;
    } else if (negativeScore > positiveScore) {
      negativeScore += boostFactor;
    }
  }

  const total = positiveScore + negativeScore;

  if (total === 0) {
    return { label: 'neutral', confidence: 0.7 };
  }

  if (positiveScore > negativeScore) {
    const confidence = Math.min((positiveScore / (total + 1)) * 1.2, 0.95);
    return { label: 'positive', confidence: Math.round(confidence * 100) / 100 };
  } else if (negativeScore > positiveScore) {
    const confidence = Math.min((negativeScore / (total + 1)) * 1.2, 0.95);
    return { label: 'negative', confidence: Math.round(confidence * 100) / 100 };
  }

  return { label: 'neutral', confidence: 0.5 };
}

// Urgency detection with context awareness
function detectUrgency(content: string, category: Category): { level: 'urgent' | 'normal' | 'low'; confidence: number } {
  const urgentPatterns = [
    '紧急', '急', '马上', '立刻', '尽快', '现在', '立即',
    '投诉', '报警', '赶紧', '迅速', '快点', '速度', '等不了',
    '崩溃', '瘫痪', '无法使用', '严重'
  ];
  const lowPatterns = [
    '不急', '有空', '方便时', '慢慢', '随时', '不着急',
    '有时间', '闲聊', '聊聊', '问一下'
  ];

  const normalizedContent = content.toLowerCase();

  // Check for urgent patterns with scoring
  let urgencyScore = 0;
  for (const pattern of urgentPatterns) {
    if (normalizedContent.includes(pattern)) {
      urgencyScore += 1;
      // Multiple exclamation marks increase urgency
      if (/[!！]{2,}/.test(content)) {
        urgencyScore += 0.5;
      }
    }
  }

  // Check for low priority patterns
  let lowScore = 0;
  for (const pattern of lowPatterns) {
    if (normalizedContent.includes(pattern)) {
      lowScore += 1;
    }
  }

  // Determine urgency level
  if (urgencyScore > 0) {
    const confidence = Math.min(0.75 + (urgencyScore * 0.1), 0.95);
    return { level: 'urgent', confidence: Math.round(confidence * 100) / 100 };
  }

  if (lowScore > 0) {
    const confidence = Math.min(0.7 + (lowScore * 0.05), 0.85);
    return { level: 'low', confidence: Math.round(confidence * 100) / 100 };
  }

  // Use category priority as fallback
  if (category.priority === 'high') {
    return { level: 'urgent', confidence: 0.6 };
  } else if (category.priority === 'low') {
    return { level: 'low', confidence: 0.6 };
  }

  return { level: 'normal', confidence: 0.7 };
}

// Extract keywords from content with improved filtering
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '什么', '这个', '那个', '怎么', '为什么', '吗', '呢', '吧',
    '啊', '呀', '哦', '嗯', '哈', '啦', '嘛', '哪', '能', '可以', '还是', '但是',
    '如果', '因为', '所以', '然后', '已经', '可能', '应该', '觉得', '知道', '出来',
    '起来', '下去', '过来', '进来', '回来'
  ]);

  // Split by various punctuation and whitespace
  const words = content.split(/[\s,，。！？、；：""''（）《》【】\[\]\n\t]+/);
  const keywordMap = new Map<string, number>();

  for (const word of words) {
    const trimmed = word.trim();
    // Filter: length >= 2, not a number, not stopword
    if (trimmed.length >= 2 && !stopWords.has(trimmed) && !/^\d+$/.test(trimmed)) {
      // Count frequency
      keywordMap.set(trimmed, (keywordMap.get(trimmed) || 0) + 1);
    }
  }

  // Sort by frequency and return top keywords
  const sortedKeywords = Array.from(keywordMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);

  return sortedKeywords;
}

// Generate summary
function generateSummary(content: string, category: Category): string {
  const maxLength = 100;
  const truncated = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  return `[${category.name}] ${truncated}`;
}

// Main classification function
function classifyMessage(message: {
  id: string;
  userId: string;
  username?: string;
  content: string;
}): ClassificationResult {
  const { id, userId, username, content } = message;
  
  // Classify by keywords
  const keywordResult = classifyByKeywords(content);
  
  // Analyze sentiment
  const sentiment = analyzeSentiment(content);
  
  // Detect urgency
  const urgency = detectUrgency(content, keywordResult.category);
  
  // Extract keywords
  const keywords = extractKeywords(content);
  
  // Generate summary
  const summary = generateSummary(content, keywordResult.category);
  
  return {
    messageId: id,
    timestamp: new Date().toISOString(),
    userId,
    username,
    content,
    category: {
      id: keywordResult.category.id,
      name: keywordResult.category.name,
      confidence: Math.round(keywordResult.score * 100) / 100
    },
    sentiment: {
      label: sentiment.label,
      confidence: Math.round(sentiment.confidence * 100) / 100
    },
    urgency: {
      level: urgency.level,
      confidence: Math.round(urgency.confidence * 100) / 100
    },
    keywords,
    summary
  };
}

// Save classification result to file
function saveResult(result: ClassificationResult, outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `classifications_${date}.jsonl`;
  const filepath = path.join(outputDir, filename);
  
  fs.appendFileSync(filepath, JSON.stringify(result) + '\n', 'utf-8');
}

// CLI interface
async function main(): Promise<number> {
  const args = process.argv.slice(2);
  
  let content = '';
  let userId = 'test-user';
  let username = 'Test User';
  let messageId = `msg_${Date.now()}`;
  let outputDir = path.join(__dirname, '../data');
  let format: 'json' | 'text' = 'text';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--content' || arg === '-c') && args[i + 1]) {
      content = args[++i];
    } else if (arg === '--user-id' && args[i + 1]) {
      userId = args[++i];
    } else if (arg === '--username' && args[i + 1]) {
      username = args[++i];
    } else if (arg === '--message-id' && args[i + 1]) {
      messageId = args[++i];
    } else if (arg === '--output-dir' && args[i + 1]) {
      outputDir = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      format = args[++i] as 'json' | 'text';
    } else if (arg === '--help') {
      console.log(`
Telegram Message Classifier

Usage: npx ts-node classify.ts [OPTIONS]

Options:
  -c, --content <text>      Message content to classify (required)
  --user-id <id>            User ID (default: test-user)
  --username <name>         Username (default: Test User)
  --message-id <id>         Message ID (default: auto-generated)
  --output-dir <path>       Output directory for results (default: ../data)
  --format <format>         Output format: json or text (default: text)
  --help                    Show this help message

Examples:
  # Basic classification
  npx ts-node classify.ts -c "请问这个产品怎么使用？"

  # With user info
  npx ts-node classify.ts -c "我想投诉订单问题" --user-id "user123" --username "张三"

  # JSON output
  npx ts-node classify.ts -c "非常满意这次服务！" --format json
`);
      return 0;
    }
  }
  
  if (!content) {
    console.error('Error: --content is required');
    return 1;
  }
  
  const result = classifyMessage({ id: messageId, userId, username, content });
  
  // Save result
  saveResult(result, outputDir);
  
  // Output result
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('MESSAGE CLASSIFICATION RESULT');
    console.log('='.repeat(60));
    console.log(`\n📝 Content: ${content}`);
    console.log(`\n📊 Category: ${result.category.name} (${result.category.id})`);
    console.log(`   Confidence: ${result.category.confidence * 100}%`);
    console.log(`\n😊 Sentiment: ${result.sentiment.label}`);
    console.log(`   Confidence: ${result.sentiment.confidence * 100}%`);
    console.log(`\n⚡ Urgency: ${result.urgency.level}`);
    console.log(`   Confidence: ${result.urgency.confidence * 100}%`);
    console.log(`\n🔑 Keywords: ${result.keywords.join(', ') || 'None'}`);
    console.log(`\n📄 Summary: ${result.summary}`);
    console.log(`\n💾 Saved to: ${outputDir}/classifications_${new Date().toISOString().split('T')[0]}.jsonl`);
    console.log('\n' + '='.repeat(60) + '\n');
  }
  
  return 0;
}

// Export for use as module
export { classifyMessage };
export type { ClassificationResult, ClassifierConfig, Category };
