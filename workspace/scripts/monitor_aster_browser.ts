/**
 * ASTER 价格监控 - 浏览器自动化版本
 * 使用 Playwright 访问 AsterDex 获取价格
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const THRESHOLD = 0.6981;
const URL = 'https://www.asterdex.com/en/trade/pro/futures/ASTERUSDT';
const LOG_FILE = '/workspace/projects/workspace/logs/aster_browser.log';

function log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

async function getPrice() {
    let browser;
    try {
        log('启动浏览器...');
        browser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        const page = await context.newPage();
        
        log(`访问 ${URL}...`);
        await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
        
        // 等待页面加载
        await page.waitForTimeout(5000);
        
        // 尝试多种选择器来获取价格
        const selectors = [
            '[class*="price"]',
            '[class*="Price"]',
            '.current-price',
            '.last-price',
            '[data-testid*="price"]',
            'span:has-text("USDT")',
        ];
        
        let priceText = null;
        for (const selector of selectors) {
            try {
                const element = await page.locator(selector).first();
                if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                    priceText = await element.textContent();
                    log(`找到价格元素 (${selector}): ${priceText}`);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个选择器
            }
        }
        
        // 如果没找到，截图保存用于调试
        if (!priceText) {
            const screenshotPath = '/workspace/projects/workspace/logs/asterdex_screenshot.png';
            await page.screenshot({ path: screenshotPath, fullPage: true });
            log(`已保存截图到 ${screenshotPath}`);
            
            // 尝试从页面内容中提取价格
            const pageContent = await page.content();
            fs.writeFileSync('/workspace/projects/workspace/logs/asterdex_page.html', pageContent);
            log('已保存页面 HTML');
        }
        
        await browser.close();
        return priceText;
        
    } catch (e) {
        log(`错误: ${e.message}`);
        if (browser) await browser.close();
        return null;
    }
}

async function main() {
    log('========== 开始价格监控 ==========');
    
    const priceText = await getPrice();
    
    if (!priceText) {
        log('无法获取价格');
        process.exit(1);
    }
    
    // 解析价格
    const priceMatch = priceText.match(/[\d,]+\.?\d*/);
    if (!priceMatch) {
        log(`无法解析价格文本: ${priceText}`);
        process.exit(1);
    }
    
    const price = parseFloat(priceMatch[0].replace(/,/g, ''));
    log(`当前 ASTER 价格: ${price} USDT`);
    
    if (price > THRESHOLD) {
        log(`⚠️ 价格高于阈值 ${THRESHOLD}！`);
        
        // 保存警报信息
        const alertData = {
            type: 'price_alert',
            coin: 'ASTER',
            price: price,
            threshold: THRESHOLD,
            message: `🚨 ASTER 价格警报！\n当前价格: ${price} USDT\n阈值: ${THRESHOLD} USDT\n涨幅: +${((price - THRESHOLD) / THRESHOLD * 100).toFixed(2)}%`,
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(
            '/workspace/projects/workspace/logs/aster_alert_pending.json',
            JSON.stringify(alertData, null, 2)
        );
        
        log('警报信息已保存');
    } else {
        log(`价格正常，低于阈值 ${THRESHOLD}`);
    }
}

main().catch(e => {
    log(`脚本错误: ${e.message}`);
    process.exit(1);
});
