#!/bin/bash
# ASTER 价格监控 - 使用浏览器自动化
# 这个脚本会被 cron 定期调用

cd /workspace/projects/workspace

# 运行浏览器监控脚本
npx ts-node scripts/monitor_aster_browser.ts 2>&1 | tee -a logs/aster_browser.log
