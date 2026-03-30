#!/usr/bin/env npx tsx
/**
 * CLI wrapper for message classification
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { classifyMessage } from './classify';
import type { ClassificationResult, ClassifierConfig } from './classify';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.join(__dirname, '../config/categories.json');

interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priority: string;
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

Usage: npx tsx classify-cli.ts [OPTIONS]

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
  npx tsx classify-cli.ts -c "请问这个产品怎么使用？"

  # With user info
  npx tsx classify-cli.ts -c "我想投诉订单问题" --user-id "user123" --username "张三"

  # JSON output
  npx tsx classify-cli.ts -c "非常满意这次服务！" --format json
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

main().then((code) => process.exit(code));
