#!/usr/bin/env python3
"""
OpenClaw Dashboard - 飞书消息管理与监控系统
"""

from flask import Flask, render_template, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json

app = Flask(__name__)

# 数据库配置
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'openclaw',
    'user': 'openclaw',
    'password': 'openclaw'
}

def get_db_connection():
    """获取数据库连接"""
    return psycopg2.connect(**DB_CONFIG)

def init_tables():
    """初始化必要的表"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    # 1. 调试日志表
    cur.execute('''
        CREATE TABLE IF NOT EXISTS debug_logs (
            id SERIAL PRIMARY KEY,
            level VARCHAR(20) DEFAULT 'info',
            category VARCHAR(50) DEFAULT 'general',
            title VARCHAR(255),
            description TEXT,
            solution TEXT,
            status VARCHAR(20) DEFAULT 'open',
            source VARCHAR(50) DEFAULT 'terminal',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            tags TEXT[]
        )
    ''')
    
    # 2. 系统指标表
    cur.execute('''
        CREATE TABLE IF NOT EXISTS system_metrics (
            id SERIAL PRIMARY KEY,
            metric_name VARCHAR(100),
            metric_value VARCHAR(100),
            unit VARCHAR(20),
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 3. 任务追踪表
    cur.execute('''
        CREATE TABLE IF NOT EXISTS task_tracker (
            id SERIAL PRIMARY KEY,
            task_name VARCHAR(255),
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            priority VARCHAR(20) DEFAULT 'medium',
            due_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    ''')
    
    # 4. 统计汇总表
    cur.execute('''
        CREATE TABLE IF NOT EXISTS daily_stats (
            id SERIAL PRIMARY KEY,
            stat_date DATE UNIQUE,
            total_messages INT DEFAULT 0,
            expense_count INT DEFAULT 0,
            expense_amount DECIMAL(10,2) DEFAULT 0,
            debug_count INT DEFAULT 0,
            general_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 创建索引
    cur.execute('CREATE INDEX IF NOT EXISTS idx_debug_logs_level ON debug_logs(level)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_debug_logs_status ON debug_logs(status)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_debug_logs_category ON debug_logs(category)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_feishu_messages_category ON feishu_messages(category)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_feishu_messages_date ON feishu_messages(timestamp)')
    
    conn.commit()
    cur.close()
    conn.close()

@app.route('/')
def index():
    """主页 - Dashboard"""
    return render_template('dashboard.html')

@app.route('/api/stats')
def get_stats():
    """获取统计信息"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    stats = {}
    
    # 消息总数
    cur.execute('SELECT COUNT(*) as total FROM feishu_messages')
    stats['total_messages'] = cur.fetchone()['total']
    
    # 分类统计
    cur.execute('''
        SELECT category, COUNT(*) as count 
        FROM feishu_messages 
        GROUP BY category 
        ORDER BY count DESC
    ''')
    stats['category_stats'] = [dict(row) for row in cur.fetchall()]
    
    # 发送者统计
    cur.execute('''
        SELECT sender_name, COUNT(*) as count 
        FROM feishu_messages 
        GROUP BY sender_name 
        ORDER BY count DESC
    ''')
    stats['sender_stats'] = [dict(row) for row in cur.fetchall()]
    
    # 今日消息
    cur.execute('''
        SELECT COUNT(*) as today_count 
        FROM feishu_messages 
        WHERE DATE(timestamp) = CURRENT_DATE
    ''')
    stats['today_messages'] = cur.fetchone()['today_count']
    
    # 未解决的问题数
    cur.execute("SELECT COUNT(*) as open_issues FROM debug_logs WHERE status = 'open'")
    stats['open_issues'] = cur.fetchone()['open_issues']
    
    # 待办任务数
    cur.execute("SELECT COUNT(*) as pending_tasks FROM task_tracker WHERE status = 'pending'")
    stats['pending_tasks'] = cur.fetchone()['pending_tasks']
    
    cur.close()
    conn.close()
    
    return jsonify(stats)

@app.route('/api/messages')
def get_messages():
    """获取消息列表"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    category = request.args.get('category', None)
    search = request.args.get('search', None)
    
    offset = (page - 1) * per_page
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    where_clause = "WHERE 1=1"
    params = []
    
    if category:
        where_clause += " AND category = %s"
        params.append(category)
    
    if search:
        where_clause += " AND message_text ILIKE %s"
        params.append(f'%{search}%')
    
    # 获取总数
    cur.execute(f'SELECT COUNT(*) as total FROM feishu_messages {where_clause}', params)
    total = cur.fetchone()['total']
    
    # 获取消息
    cur.execute(f'''
        SELECT * FROM feishu_messages 
        {where_clause}
        ORDER BY timestamp DESC 
        LIMIT %s OFFSET %s
    ''', params + [per_page, offset])
    
    messages = [dict(row) for row in cur.fetchall()]
    
    # 转换时间戳为字符串
    for msg in messages:
        if msg['timestamp']:
            msg['timestamp'] = msg['timestamp'].isoformat()
    
    cur.close()
    conn.close()
    
    return jsonify({
        'messages': messages,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': (total + per_page - 1) // per_page
    })

@app.route('/api/debug-logs')
def get_debug_logs():
    """获取调试日志"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        SELECT * FROM debug_logs 
        ORDER BY created_at DESC 
        LIMIT 100
    ''')
    
    logs = [dict(row) for row in cur.fetchall()]
    
    # 转换时间戳
    for log in logs:
        if log['created_at']:
            log['created_at'] = log['created_at'].isoformat()
        if log['resolved_at']:
            log['resolved_at'] = log['resolved_at'].isoformat()
    
    cur.close()
    conn.close()
    
    return jsonify(logs)

@app.route('/api/debug-logs', methods=['POST'])
def add_debug_log():
    """添加调试日志"""
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        INSERT INTO debug_logs (level, category, title, description, solution, status, source, tags)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    ''', (
        data.get('level', 'info'),
        data.get('category', 'general'),
        data.get('title', ''),
        data.get('description', ''),
        data.get('solution', ''),
        data.get('status', 'open'),
        data.get('source', 'terminal'),
        data.get('tags', [])
    ))
    
    log = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify(log)

@app.route('/api/debug-logs/<int:log_id>', methods=['PUT'])
def update_debug_log(log_id):
    """更新调试日志"""
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    updates = []
    params = []
    
    for key in ['level', 'category', 'title', 'description', 'solution', 'status', 'tags']:
        if key in data:
            updates.append(f"{key} = %s")
            params.append(data[key])
    
    if data.get('status') == 'resolved':
        updates.append("resolved_at = CURRENT_TIMESTAMP")
    
    params.append(log_id)
    
    cur.execute(f'''
        UPDATE debug_logs SET {', '.join(updates)}
        WHERE id = %s
        RETURNING *
    ''', params)
    
    log = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify(log)

@app.route('/api/tasks')
def get_tasks():
    """获取任务列表"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        SELECT * FROM task_tracker 
        ORDER BY 
            CASE priority 
                WHEN 'high' THEN 1 
                WHEN 'medium' THEN 2 
                WHEN 'low' THEN 3 
            END,
            due_date ASC NULLS LAST
    ''')
    
    tasks = [dict(row) for row in cur.fetchall()]
    
    for task in tasks:
        if task['created_at']:
            task['created_at'] = task['created_at'].isoformat()
        if task['completed_at']:
            task['completed_at'] = task['completed_at'].isoformat()
    
    cur.close()
    conn.close()
    
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    """添加任务"""
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        INSERT INTO task_tracker (task_name, description, status, priority, due_date)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
    ''', (
        data.get('task_name', ''),
        data.get('description', ''),
        data.get('status', 'pending'),
        data.get('priority', 'medium'),
        data.get('due_date')
    ))
    
    task = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify(task)

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """更新任务"""
    data = request.json
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    updates = []
    params = []
    
    for key in ['task_name', 'description', 'status', 'priority', 'due_date']:
        if key in data:
            updates.append(f"{key} = %s")
            params.append(data[key])
    
    if data.get('status') == 'completed':
        updates.append("completed_at = CURRENT_TIMESTAMP")
    
    params.append(task_id)
    
    cur.execute(f'''
        UPDATE task_tracker SET {', '.join(updates)}
        WHERE id = %s
        RETURNING *
    ''', params)
    
    task = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify(task)

@app.route('/api/chart/category-trend')
def get_category_trend():
    """获取分类趋势（最近7天）"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) FILTER (WHERE category = 'expense') as expense_count,
            COUNT(*) FILTER (WHERE category = 'general') as general_count,
            COUNT(*) FILTER (WHERE category = 'debug') as debug_count,
            COUNT(*) as total
        FROM feishu_messages
        WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY DATE(timestamp)
        ORDER BY date
    ''')
    
    trend = [dict(row) for row in cur.fetchall()]
    
    for row in trend:
        if row['date']:
            row['date'] = row['date'].isoformat()
    
    cur.close()
    conn.close()
    
    return jsonify(trend)

@app.route('/api/chart/expense-summary')
def get_expense_summary():
    """获取支出汇总"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute('''
        SELECT 
            sender_name,
            COUNT(*) as count,
            message_text
        FROM feishu_messages
        WHERE category = 'expense'
        GROUP BY sender_name, message_text
        ORDER BY sender_name
    ''')
    
    expenses = [dict(row) for row in cur.fetchall()]
    
    cur.close()
    conn.close()
    
    return jsonify(expenses)

if __name__ == '__main__':
    # 初始化表
    init_tables()
    
    # 启动服务器
    print("=" * 50)
    print("OpenClaw Dashboard 已启动")
    print("访问地址: http://localhost:8080")
    print("外网地址: http://43.138.104.54:8080")
    print("=" * 50)
    app.run(host='0.0.0.0', port=8080, debug=False)
