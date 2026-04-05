#!/bin/bash
# 导入飞书消息到 PostgreSQL

DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="openclaw"
DB_USER="openclaw"
DB_PASS="openclaw"

JSONL_FILE="/workspace/projects/workspace/data/conversations/chat_2026-04-05.jsonl"

# 使用 psql 的 COPY 命令导入
export PGPASSWORD="$DB_PASS"

# 先创建一个临时表
psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- 清空现有数据
TRUNCATE feishu_messages RESTART IDENTITY;

-- 创建临时表用于导入
CREATE TEMP TABLE tmp_messages (
    message_id TEXT,
    sender_id TEXT,
    sender_name TEXT,
    message_text TEXT,
    chat_id TEXT,
    categories TEXT,
    timestamp TIMESTAMP
);
\q
EOF

# 使用 Python 解析并导入（更可靠）
python3 << 'PYTHON_EOF'
import json
import subprocess
import os

db_host = "localhost"
db_port = "5432"
db_name = "openclaw"
db_user = "openclaw"
db_pass = "openclaw"

jsonl_file = "/workspace/projects/workspace/data/conversations/chat_2026-04-05.jsonl"

# 读取 JSONL 文件
with open(jsonl_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

count = 0
for line in lines:
    try:
        data = json.loads(line.strip())
        
        message_id = f"msg_{data.get('timestamp', '').replace(':', '').replace('-', '').replace('.', '')}"
        sender_id = data.get('sender_id', '')
        sender_name = data.get('sender_name', '').replace("'", "''")
        message_text = data.get('message', '').replace("'", "''")
        chat_id = data.get('chat_id', '')
        categories = ','.join(data.get('categories', ['general']))
        timestamp = data.get('timestamp', '')
        
        # 插入数据
        sql = f"INSERT INTO feishu_messages (message_id, sender_id, sender_name, message_text, chat_id, category, timestamp) VALUES ('{message_id}', '{sender_id}', '{sender_name}', '{message_text}', '{chat_id}', '{categories}', '{timestamp}')"
        
        result = subprocess.run(
            ['psql', '-h', db_host, '-U', db_user, '-d', db_name, '-c', sql],
            env={'PGPASSWORD': db_pass},
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            count += 1
    except Exception as e:
        print(f"Error: {e}")
        continue

print(f"Successfully imported {count} messages")
PYTHON_EOF

# 验证结果
echo ""
echo "=== 导入结果 ==="
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as total_messages FROM feishu_messages;"
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT category, COUNT(*) FROM feishu_messages GROUP BY category;"
