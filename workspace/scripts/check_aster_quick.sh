#!/bin/bash
# ASTER 价格监控快速检查脚本
# 使用 coze-web-search 技能获取价格

cd /workspace/projects/workspace

# 搜索最新价格
echo "正在获取 ASTER 最新价格..."
npx ts-node skills/coze-web-search/scripts/search.ts \
    -q "ASTER USDT price today current" \
    --count 3 \
    --format text 2>&1 | tee -a logs/aster_search.log

echo ""
echo "检查完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "阈值: 0.6981 USDT"
