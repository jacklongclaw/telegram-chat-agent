#!/bin/bash
#
# Telegram Classifier Dashboard Startup Script
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}║   🤖 Telegram 消息分类仪表盘启动脚本                         ║${NC}"
echo -e "${BLUE}║                                                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ 错误: Node.js 未安装${NC}"
  echo "请先安装 Node.js: https://nodejs.org/"
  exit 1
fi

echo -e "${GREEN}✅ Node.js 已安装: $(node --version)${NC}"

# Check if tsx is available
if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ 错误: npx 未找到${NC}"
  exit 1
fi

echo -e "${GREEN}✅ npx 可用${NC}"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start the server
echo -e "${BLUE}🚀 启动仪表盘服务器...${NC}"
echo ""

cd "$SCRIPT_DIR"
npx tsx scripts/server.ts
