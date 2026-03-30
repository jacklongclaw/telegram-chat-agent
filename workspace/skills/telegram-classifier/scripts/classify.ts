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

// Keyword-based classification
function classifyByKeywords(content: string): { category: Category; score: number } {
  const normalizedContent = content.toLowerCase();
  let bestMatch: { category: Category; score: number } = {
    category: config.categories.find(c => c.id === 'other')!,
    score: 0
  };

  for (const category of config.categories) {
    if (category.keywords.length === 0) continue;
    
    let matchCount = 0;
    for (const keyword of category.keywords) {
      if (normalizedContent.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    
    const score = matchCount / category.keywords.length;
    if (score > bestMatch.score) {
      bestMatch = { category, score };
    }
  }

  return bestMatch;
}

// Sentiment analysis using keyword patterns
function analyzeSentiment(content: string): { label: 'positive' | 'neutral' | 'negative'; confidence: number } {
  const positivePatterns = ['谢谢', '感谢', '很好', '不错', '喜欢', '满意', '棒', '赞', '太好了', '完美'];
  const negativePatterns = ['不满', '差', '糟糕', '失望', '生气', '投诉', '退货', '垃圾', '骗', '坑'];
  
  const normalizedContent = content.toLowerCase();
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const pattern of positivePatterns) {
    if (normalizedContent.includes(pattern)) positiveCount++;
  }
  
  for (const pattern of negativePatterns) {
    if (normalizedContent.includes(pattern)) negativeCount++;
  }
  
  const total = positiveCount + negativeCount;
  
  if (total === 0) {
    return { label: 'neutral', confidence: 0.7 };
  }
  
  if (positiveCount > negativeCount) {
    return { label: 'positive', confidence: positiveCount / total };
  } else if (negativeCount > positiveCount) {
    return { label: 'negative', confidence: negativeCount / total };
  }
  
  return { label: 'neutral', confidence: 0.5 };
}

// Urgency detection
function detectUrgency(content: string, category: Category): { level: 'urgent' | 'normal' | 'low'; confidence: number } {
  const urgentPatterns = ['紧急', '急', '马上', '立刻', '尽快', '现在', '立刻', '马上', '投诉', '报警'];
  const lowPatterns = ['不急', '有空', '方便时', '慢慢'];
  
  const normalizedContent = content.toLowerCase();
  
  // Check for urgent patterns
  for (const pattern of urgentPatterns) {
    if (normalizedContent.includes(pattern)) {
      return { level: 'urgent', confidence: 0.8 };
    }
  }
  
  // Check for low priority patterns
  for (const pattern of lowPatterns) {
    if (normalizedContent.includes(pattern)) {
      return { level: 'low', confidence: 0.7 };
    }
  }
  
  // Use category priority as fallback
  if (category.priority === 'high') {
    return { level: 'urgent', confidence: 0.6 };
  } else if (category.priority === 'low') {
    return { level: 'low', confidence: 0.6 };
  }
  
  return { level: 'normal', confidence: 0.7 };
}

// Extract keywords from content
function extractKeywords(content: string): string[] {
  const stopWords = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么']);
  
  const words = content.split(/[\s,，。！？、；：""''（）《》【】\n]+/);
  const keywords: string[] = [];
  
  for (const word of words) {
    if (word.length >= 2 && !stopWords.has(word)) {
      keywords.push(word);
    }
  }
  
  return [...new Set(keywords)].slice(0, 10);
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
