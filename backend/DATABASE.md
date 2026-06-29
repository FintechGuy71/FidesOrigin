# FidesOrigin 数据库文档

## 概述

FidesOrigin 使用 PostgreSQL 作为核心数据库，Redis 作为缓存层。数据库设计针对区块链数据分析场景进行了优化，支持大数据量分区存储。

## 技术栈

- **PostgreSQL 15**: 主数据库
- **Redis 7**: 缓存和会话存储
- **pgAdmin 4**: 数据库管理界面
- **SQLAlchemy 2.0**: Python ORM
- **Alembic**: 数据库迁移工具
- **asyncpg**: 异步 PostgreSQL 驱动

## 快速开始

### 1. 启动数据库服务

```bash
# 复制环境变量配置
cp .env.db.example .env

# 启动所有服务
docker-compose up -d

# 或使用可选服务
docker-compose --profile adminer up -d    # 包含 Adminer
docker-compose --profile tools up -d       # 包含 Redis Commander
docker-compose --profile monitoring up -d  # 包含 Prometheus + Grafana
docker-compose --profile backup up -d      # 包含自动备份
```

### 2. 访问管理界面

- **pgAdmin**: http://localhost:5050
  - 邮箱: admin@fidesorigin.com
  - 密码: admin_secret_2026
  
- **Adminer** (可选): http://localhost:8080
  - 系统: PostgreSQL
  - 服务器: postgres
  - 用户名: fidesorigin
  - 密码: fidesorigin_secret_2026
  - 数据库: fidesorigin

- **Redis Commander** (可选): http://localhost:8081

- **Grafana** (可选): http://localhost:3000

### 3. 运行迁移

```bash
cd backend

# 初始化 Alembic（首次）
alembic init alembic

# 创建迁移脚本
alembic revision --autogenerate -m "描述变更"

# 升级数据库
alembic upgrade head

# 降级数据库
alembic downgrade -1
```

## 数据库架构

### 核心表

| 表名 | 说明 | 分区策略 |
|------|------|----------|
| `addresses` | 区块链地址信息 | 按月分区 (created_at) |
| `transactions` | 区块链交易数据 | 按月分区 (block_timestamp) |
| `risk_rules` | 风险检测规则 | 无分区 |
| `risk_events` | 风险事件记录 | 按月分区 (detected_at) |
| `audit_logs` | 审计日志 | 按日分区 (created_at) |

### 辅助表

| 表名 | 说明 |
|------|------|
| `sanctions_list` | 制裁名单数据 |
| `address_relationships` | 地址关联关系 |

## 表结构详情

### addresses (地址表)

```sql
- id: BIGINT PRIMARY KEY
- address: VARCHAR(255) - 区块链地址
- chain: VARCHAR(50) - 链类型 (ETH, BTC, etc.)
- address_type: VARCHAR(50) - 地址类型 (EOA, CONTRACT)
- risk_score: DECIMAL(5,2) - 风险评分 (0-100)
- risk_level: ENUM - 风险等级 (LOW/MEDIUM/HIGH/CRITICAL/UNKNOWN)
- risk_factors: JSONB - 风险因子详情
- tags: TEXT[] - 标签数组
- entity_name: VARCHAR(255) - 实体名称
- entity_category: VARCHAR(100) - 实体分类
- total_transactions: INTEGER - 总交易数
- total_volume_usd: DECIMAL(24,8) - 总交易额
- first_seen_at: TIMESTAMP - 首次出现时间
- last_seen_at: TIMESTAMP - 最后活跃时间
- metadata: JSONB - 附加元数据
```

### transactions (交易表)

```sql
- id: BIGINT PRIMARY KEY
- tx_hash: VARCHAR(255) - 交易哈希
- chain: VARCHAR(50) - 链类型
- from_address: VARCHAR(255) - 发送方
- to_address: VARCHAR(255) - 接收方
- from_address_id: BIGINT - 发送方ID (外键)
- to_address_id: BIGINT - 接收方ID (外键)
- value: DECIMAL(36,18) - 交易金额
- value_usd: DECIMAL(24,8) - 交易金额(USD)
- block_number: BIGINT - 区块高度
- block_timestamp: TIMESTAMP - 区块时间
- risk_score: DECIMAL(5,2) - 风险评分
- gas_price, gas_used, transaction_fee - Gas信息
- status: VARCHAR(50) - 交易状态
- raw_data: JSONB - 原始数据
```

### risk_rules (风险规则表)

```sql
- id: UUID PRIMARY KEY
- name: VARCHAR(255) - 规则名称
- description: TEXT - 规则描述
- rule_type: ENUM - 规则类型
- rule_config: JSONB - 规则配置
- threshold_low/medium/high/critical - 阈值设置
- is_enabled: BOOLEAN - 是否启用
- priority: INTEGER - 优先级
- total_evaluations/matches - 统计信息
```

### risk_events (风险事件表)

```sql
- id: BIGINT PRIMARY KEY
- event_uuid: UUID - 全局唯一ID
- event_type/name/description - 事件信息
- address_id/address - 关联地址
- tx_id/tx_hash - 关联交易
- risk_level/score/factors - 风险信息
- matched_rules: UUID[] - 匹配的规则
- status: ENUM - 处理状态
- assigned_to - 分配给谁
- resolved_at/resolution_notes - 解决信息
```

### audit_logs (审计日志表)

```sql
- id: BIGINT PRIMARY KEY
- log_uuid: UUID - 全局唯一ID
- action: ENUM - 操作类型
- resource_type/id/name - 操作对象
- user_id/name/ip/agent/session_id - 操作者信息
- old_values/new_values: JSONB - 变更详情
- success: BOOLEAN - 是否成功
- execution_time_ms: INTEGER - 执行时间
- request_method/path/params - 请求信息
```

## 索引设计

### 主要索引

```sql
-- 地址表
CREATE UNIQUE INDEX idx_addresses_address_chain ON addresses(address, chain);
CREATE INDEX idx_addresses_risk_score ON addresses(risk_score);
CREATE INDEX idx_addresses_risk_level ON addresses(risk_level);
CREATE INDEX idx_addresses_tags ON addresses USING GIN(tags);
CREATE INDEX idx_addresses_risk_score_brin ON addresses USING BRIN(risk_score);

-- 交易表
CREATE UNIQUE INDEX idx_transactions_hash_chain ON transactions(tx_hash, chain);
CREATE INDEX idx_transactions_from ON addresses(from_address, block_timestamp DESC);
CREATE INDEX idx_transactions_to ON addresses(to_address, block_timestamp DESC);
CREATE INDEX idx_transactions_timestamp_brin ON transactions USING BRIN(block_timestamp);

-- 事件表
CREATE INDEX idx_risk_events_level ON risk_events(risk_level, detected_at DESC);
CREATE INDEX idx_risk_events_status ON risk_events(status) WHERE status != 'RESOLVED';

-- 审计日志
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```

## 分区管理

### 自动创建分区函数

```sql
-- 创建地址表新分区
SELECT create_address_partition(2026, 7);  -- 2026年7月

-- 创建交易表新分区
SELECT create_transaction_partition(2026, 7);

-- 创建事件表新分区
SELECT create_event_partition(2026, 7);

-- 创建审计日志表新分区（按日）
SELECT create_audit_partition(2026, 7, 15);  -- 2026年7月15日
```

### 分区查询示例

```sql
-- 查看所有分区
SELECT parent.relname AS parent_table,
       child.relname AS partition_name,
       pg_get_expr(child.relpartbound, child.oid) AS partition_bounds
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
WHERE parent.relname = 'transactions';

-- 查询特定分区数据
SELECT * FROM transactions_2026_04 WHERE risk_score > 80;
```

## 性能优化

### 配置调优

PostgreSQL 配置已针对以下场景优化：

- **分区表查询**: enable_partitionwise_join = on
- **SSD 存储**: random_page_cost = 1.1
- **大内存**: shared_buffers = 1GB
- **并行查询**: max_parallel_workers = 8

### 查询优化建议

```sql
-- 使用分区裁剪
SELECT * FROM transactions 
WHERE block_timestamp >= '2026-04-01' 
  AND block_timestamp < '2026-05-01';

-- 使用 BRIN 索引进行范围查询
SELECT * FROM transactions 
WHERE block_timestamp > NOW() - INTERVAL '7 days';

-- 使用覆盖索引
SELECT tx_hash, block_number, risk_score 
FROM transactions 
WHERE from_address = '0x...' 
ORDER BY block_timestamp DESC 
LIMIT 100;
```

## 备份与恢复

### 自动备份

备份服务已配置为每天凌晨2点自动执行：

```bash
# 查看备份
ls -la backups/

# 手动备份
docker-compose exec postgres pg_dump -U fidesorigin fidesorigin | gzip > backup_manual.sql.gz

# 恢复备份
gunzip < backup_20260403_020000.sql.gz | docker-compose exec -T postgres psql -U fidesorigin fidesorigin
```

### 备份保留策略

- 默认保留7天
- 可通过环境变量 `BACKUP_RETENTION_DAYS` 修改

## 监控

### 数据库指标

启用 Prometheus 监控后，可查看以下指标：

- 连接数
- 查询吞吐量
- 缓存命中率
- 事务速率
- 锁等待

### 慢查询日志

执行时间超过1秒的查询会被记录到日志：

```bash
# 查看慢查询
docker-compose exec postgres tail -f /var/lib/postgresql/data/log/postgresql-*.log
```

## 安全

### 生产环境建议

1. **修改默认密码**
   ```bash
   # 生成强密码
   openssl rand -base64 32
   ```

2. **启用 SSL**
   ```yaml
   # docker-compose.yml
   - ./certs:/var/lib/postgresql/certs:ro
   - ssl=on
   - ssl_cert_file=/var/lib/postgresql/certs/server.crt
   - ssl_key_file=/var/lib/postgresql/certs/server.key
   ```

3. **限制网络访问**
   ```yaml
   # docker-compose.yml
   ports:
     - "127.0.0.1:5432:5432"  # 仅本地访问
   ```

4. **定期更新**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## 故障排查

### 常见问题

```bash
# 1. 连接问题
docker-compose logs postgres

# 2. 性能问题
# 查看当前活动连接
docker-compose exec postgres psql -U fidesorigin -c "SELECT * FROM pg_stat_activity;"

# 3. 表大小
docker-compose exec postgres psql -U fidesorigin -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables 
WHERE schemaname='public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# 4. 索引使用情况
docker-compose exec postgres psql -U fidesorigin -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
"
```

## API 使用示例

### Python SQLAlchemy

```python
from app.database import get_db_context
from app.models import Address, RiskEvent
from sqlalchemy import select

async def get_high_risk_addresses():
    async with get_db_context() as db:
        result = await db.execute(
            select(Address)
            .where(Address.risk_score >= 75)
            .order_by(Address.risk_score.desc())
            .limit(100)
        )
        return result.scalars().all()

async def create_risk_event(address_id: int, event_data: dict):
    async with get_db_context() as db:
        event = RiskEvent(
            address_id=address_id,
            event_type="SANCTIONS_MATCH",
            risk_level="CRITICAL",
            **event_data
        )
        db.add(event)
        await db.commit()
        return event
```

### Redis 缓存

```python
from app.cache import get_redis, Cache, address_cache_key

async def get_address_with_cache(address: str, chain: str):
    redis = await get_redis()
    cache = Cache(redis)
    
    # 尝试从缓存获取
    key = address_cache_key(address, chain)
    cached = await cache.get(key)
    if cached:
        return json.loads(cached)
    
    # 从数据库获取
    async with get_db_context() as db:
        addr = await db.get(Address, address=address, chain=chain)
        
    # 写入缓存
    await cache.set(key, json.dumps(addr.to_dict()), expire=300)
    return addr
```

## 扩展

### 添加新分区

```python
# 使用 Alembic 迁移
from alembic import op

def upgrade():
    # 创建新分区
    op.execute("""
        CREATE TABLE IF NOT EXISTS addresses_2026_07 
        PARTITION OF addresses 
        FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    """)
```

### 添加自定义规则

```python
from app.models import RiskRule, RuleType

async def create_custom_rule():
    rule = RiskRule(
        name="自定义检测规则",
        description="检测特定交易模式",
        rule_type=RuleType.CUSTOM,
        rule_config={
            "pattern": "specific_behavior",
            "threshold": 0.8
        },
        threshold_high=70,
        threshold_critical=90,
        priority=50,
        tags=["custom", "specific"]
    )
    async with get_db_context() as db:
        db.add(rule)
        await db.commit()
```

## 参考

- [PostgreSQL 分区文档](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [SQLAlchemy 2.0 文档](https://docs.sqlalchemy.org/en/20/)
- [Alembic 文档](https://alembic.sqlalchemy.org/)
