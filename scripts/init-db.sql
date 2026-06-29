-- ============================================
-- FidesOrigin 数据库初始化脚本
-- 区块链风险分析平台 - PostgreSQL Schema
-- ============================================
-- 版本: 1.0.0
-- 创建时间: 2026-04-03
-- 作者: FidesOrigin Dev Team
-- ============================================

-- ============================================
-- 1. 扩展和基础配置
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";        -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pgcrypto";         -- 加密函数
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- 查询统计

-- 创建自定义类型
DO $$ BEGIN
    CREATE TYPE risk_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_status AS ENUM ('PENDING', 'PROCESSING', 'RESOLVED', 'FALSE_POSITIVE', 'IGNORED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rule_type AS ENUM ('HEURISTIC', 'ML_MODEL', 'SANCTIONS_LIST', 'WHALE_ALERT', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'QUERY', 'EXPORT', 'LOGIN', 'LOGOUT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. 地址表 (addresses)
-- ============================================
-- 存储区块链地址的基础信息和风险评分
CREATE TABLE addresses (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(255) NOT NULL,                    -- 区块链地址
    chain VARCHAR(50) NOT NULL,                       -- 链类型 (ETH, BTC, BSC, etc.)
    address_type VARCHAR(50),                         -- 地址类型 (EOA, CONTRACT, etc.)
    
    -- 风险评分 (0-100)
    risk_score DECIMAL(5,2) DEFAULT 0.00,             -- 综合风险评分
    risk_level risk_level DEFAULT 'UNKNOWN',          -- 风险等级
    risk_factors JSONB DEFAULT '{}',                  -- 风险因子详情
    
    -- 标签系统
    tags TEXT[] DEFAULT '{}',                         -- 标签数组
    entity_name VARCHAR(255),                         -- 实体名称 (如交易所、协议)
    entity_category VARCHAR(100),                     -- 实体分类
    
    -- 统计数据
    total_transactions INTEGER DEFAULT 0,             -- 总交易数
    total_volume_usd DECIMAL(24,8) DEFAULT 0,         -- 总交易额 (USD)
    first_seen_at TIMESTAMP WITH TIME ZONE,           -- 首次出现时间
    last_seen_at TIMESTAMP WITH TIME ZONE,            -- 最后活跃时间
    
    -- 元数据
    metadata JSONB DEFAULT '{}',                      -- 附加元数据
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    updated_by VARCHAR(255) DEFAULT 'system',
    
    -- 软删除
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
) PARTITION BY RANGE (created_at);

-- 创建分区表 (按月分区，支持大数据量)
CREATE TABLE addresses_2026_01 PARTITION OF addresses
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE addresses_2026_02 PARTITION OF addresses
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE addresses_2026_03 PARTITION OF addresses
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE addresses_2026_04 PARTITION OF addresses
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE addresses_2026_05 PARTITION OF addresses
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE addresses_2026_06 PARTITION OF addresses
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE addresses_default PARTITION OF addresses DEFAULT;

-- 地址表索引
CREATE UNIQUE INDEX idx_addresses_address_chain ON addresses(address, chain) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_risk_score ON addresses(risk_score) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_risk_level ON addresses(risk_level) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_entity ON addresses(entity_name) WHERE deleted_at IS NULL AND entity_name IS NOT NULL;
CREATE INDEX idx_addresses_tags ON addresses USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_addresses_first_seen ON addresses(first_seen_at);
CREATE INDEX idx_addresses_updated ON addresses(updated_at DESC);

-- 风险评分BRIN索引 (适合大范围查询)
CREATE INDEX idx_addresses_risk_score_brin ON addresses USING BRIN(risk_score);

-- ============================================
-- 3. 交易表 (transactions)
-- ============================================
-- 存储区块链交易数据和风险分析结果
CREATE TABLE transactions (
    id BIGSERIAL,
    tx_hash VARCHAR(255) NOT NULL,                    -- 交易哈希
    chain VARCHAR(50) NOT NULL,                       -- 链类型
    
    -- 交易参与方
    from_address VARCHAR(255) NOT NULL,               -- 发送方地址
    to_address VARCHAR(255) NOT NULL,                 -- 接收方地址
    from_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    to_address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    
    -- 交易金额
    value DECIMAL(36,18) NOT NULL,                    -- 交易金额 (原生代币)
    value_usd DECIMAL(24,8),                          -- 交易金额 (USD)
    token_symbol VARCHAR(50),                         -- 代币符号
    token_address VARCHAR(255),                       -- 代币合约地址
    
    -- 区块信息
    block_number BIGINT NOT NULL,                     -- 区块高度
    block_hash VARCHAR(255),                          -- 区块哈希
    block_timestamp TIMESTAMP WITH TIME ZONE,         -- 区块时间戳
    
    -- 风险评分
    risk_score DECIMAL(5,2) DEFAULT 0.00,             -- 交易风险评分
    risk_level risk_level DEFAULT 'UNKNOWN',          -- 风险等级
    risk_factors JSONB DEFAULT '{}',                  -- 风险因子详情
    
    -- Gas信息
    gas_price DECIMAL(36,18),                         -- Gas价格
    gas_used BIGINT,                                  -- Gas消耗
    transaction_fee DECIMAL(36,18),                   -- 交易费用
    transaction_fee_usd DECIMAL(24,8),                -- 交易费用 (USD)
    
    -- 状态
    status VARCHAR(50) DEFAULT 'SUCCESS',             -- 交易状态
    
    -- 原始数据
    raw_data JSONB,                                   -- 完整交易数据
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,             -- 分析完成时间
    
    PRIMARY KEY (id, block_timestamp)
) PARTITION BY RANGE (block_timestamp);

-- 创建交易表分区 (按月分区)
CREATE TABLE transactions_2026_01 PARTITION OF transactions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE transactions_2026_02 PARTITION OF transactions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE transactions_2026_03 PARTITION OF transactions
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE transactions_2026_04 PARTITION OF transactions
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE transactions_2026_05 PARTITION OF transactions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE transactions_2026_06 PARTITION OF transactions
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE transactions_default PARTITION OF transactions DEFAULT;

-- 交易表索引
CREATE UNIQUE INDEX idx_transactions_hash_chain ON transactions(tx_hash, chain);
CREATE INDEX idx_transactions_from ON transactions(from_address, block_timestamp DESC);
CREATE INDEX idx_transactions_to ON transactions(to_address, block_timestamp DESC);
CREATE INDEX idx_transactions_block ON transactions(block_number, chain);
CREATE INDEX idx_transactions_timestamp ON transactions(block_timestamp DESC);
CREATE INDEX idx_transactions_risk ON transactions(risk_score) WHERE risk_score > 50;
CREATE INDEX idx_transactions_value_usd ON transactions(value_usd) WHERE value_usd > 10000;

-- BRIN索引用于大数据量范围查询
CREATE INDEX idx_transactions_timestamp_brin ON transactions USING BRIN(block_timestamp);

-- ============================================
-- 4. 风险规则表 (risk_rules)
-- ============================================
-- 存储风险检测规则和配置
CREATE TABLE risk_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- 规则信息
    name VARCHAR(255) NOT NULL,                       -- 规则名称
    description TEXT,                                 -- 规则描述
    rule_type rule_type NOT NULL,                     -- 规则类型
    
    -- 规则配置
    rule_config JSONB NOT NULL DEFAULT '{}',          -- 规则配置参数
    
    -- 阈值设置
    threshold_low DECIMAL(5,2) DEFAULT 30.00,         -- 低风险阈值
    threshold_medium DECIMAL(5,2) DEFAULT 50.00,      -- 中风险阈值
    threshold_high DECIMAL(5,2) DEFAULT 75.00,        -- 高风险阈值
    threshold_critical DECIMAL(5,2) DEFAULT 90.00,    -- 严重风险阈值
    
    -- 状态
    is_enabled BOOLEAN DEFAULT TRUE,                  -- 是否启用
    priority INTEGER DEFAULT 100,                     -- 优先级 (数字越小优先级越高)
    
    -- 统计
    total_evaluations BIGINT DEFAULT 0,               -- 总评估次数
    total_matches BIGINT DEFAULT 0,                   -- 命中次数
    last_evaluated_at TIMESTAMP WITH TIME ZONE,       -- 最后评估时间
    
    -- 元数据
    tags TEXT[] DEFAULT '{}',                         -- 标签
    category VARCHAR(100),                            -- 分类
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255) DEFAULT 'system',
    updated_by VARCHAR(255) DEFAULT 'system',
    
    -- 软删除
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- 规则表索引
CREATE INDEX idx_risk_rules_type ON risk_rules(rule_type) WHERE is_active = TRUE;
CREATE INDEX idx_risk_rules_enabled ON risk_rules(is_enabled) WHERE is_active = TRUE;
CREATE INDEX idx_risk_rules_priority ON risk_rules(priority) WHERE is_active = TRUE;
CREATE INDEX idx_risk_rules_tags ON risk_rules USING GIN(tags) WHERE is_active = TRUE;

-- ============================================
-- 5. 风险事件表 (risk_events)
-- ============================================
-- 存储检测到的风险事件
CREATE TABLE risk_events (
    id BIGSERIAL,
    event_uuid UUID DEFAULT uuid_generate_v4(),       -- 全局唯一事件ID
    
    -- 事件信息
    event_type VARCHAR(100) NOT NULL,                 -- 事件类型
    event_name VARCHAR(255) NOT NULL,                 -- 事件名称
    description TEXT,                                 -- 事件描述
    
    -- 关联对象
    address_id BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    address VARCHAR(255),                             -- 相关地址
    tx_id BIGINT,                                     -- 相关交易ID
    tx_hash VARCHAR(255),                             -- 相关交易哈希
    chain VARCHAR(50),                                -- 链类型
    
    -- 风险信息
    risk_level risk_level NOT NULL,                   -- 风险等级
    risk_score DECIMAL(5,2) NOT NULL,                 -- 风险评分
    risk_factors JSONB DEFAULT '{}',                  -- 风险因子
    matched_rules UUID[] DEFAULT '{}',                -- 匹配的规则ID
    
    -- 状态
    status event_status DEFAULT 'PENDING',            -- 处理状态
    assigned_to VARCHAR(255),                         -- 分配给
    resolved_at TIMESTAMP WITH TIME ZONE,             -- 解决时间
    resolution_notes TEXT,                            -- 解决备注
    
    -- 元数据
    metadata JSONB DEFAULT '{}',                      -- 附加元数据
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 检测时间
    
    PRIMARY KEY (id, detected_at)
) PARTITION BY RANGE (detected_at);

-- 创建事件表分区 (按月分区)
CREATE TABLE risk_events_2026_01 PARTITION OF risk_events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE risk_events_2026_02 PARTITION OF risk_events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE risk_events_2026_03 PARTITION OF risk_events
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE risk_events_2026_04 PARTITION OF risk_events
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE risk_events_2026_05 PARTITION OF risk_events
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE risk_events_2026_06 PARTITION OF risk_events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE risk_events_default PARTITION OF risk_events DEFAULT;

-- 事件表索引
CREATE UNIQUE INDEX idx_risk_events_uuid ON risk_events(event_uuid);
CREATE INDEX idx_risk_events_address ON risk_events(address) WHERE detected_at > NOW() - INTERVAL '90 days';
CREATE INDEX idx_risk_events_tx ON risk_events(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX idx_risk_events_level ON risk_events(risk_level, detected_at DESC);
CREATE INDEX idx_risk_events_status ON risk_events(status) WHERE status != 'RESOLVED';
CREATE INDEX idx_risk_events_created ON risk_events(created_at DESC);

-- BRIN索引
CREATE INDEX idx_risk_events_detected_brin ON risk_events USING BRIN(detected_at);

-- ============================================
-- 6. 审计日志表 (audit_logs)
-- ============================================
-- 存储系统操作日志
CREATE TABLE audit_logs (
    id BIGSERIAL,
    log_uuid UUID DEFAULT uuid_generate_v4(),         -- 全局唯一日志ID
    
    -- 操作信息
    action audit_action NOT NULL,                     -- 操作类型
    action_name VARCHAR(255),                         -- 操作名称
    description TEXT,                                 -- 操作描述
    
    -- 操作对象
    resource_type VARCHAR(100),                       -- 资源类型
    resource_id VARCHAR(255),                         -- 资源ID
    resource_name VARCHAR(255),                       -- 资源名称
    
    -- 操作者信息
    user_id VARCHAR(255),                             -- 用户ID
    user_name VARCHAR(255),                           -- 用户名
    user_ip INET,                                     -- 用户IP
    user_agent TEXT,                                  -- 用户代理
    session_id VARCHAR(255),                          -- 会话ID
    
    -- 变更详情
    old_values JSONB,                                 -- 变更前值
    new_values JSONB,                                 -- 变更后值
    
    -- 执行结果
    success BOOLEAN DEFAULT TRUE,                     -- 是否成功
    error_message TEXT,                               -- 错误信息
    execution_time_ms INTEGER,                        -- 执行时间(毫秒)
    
    -- 请求信息
    request_method VARCHAR(20),                       -- HTTP方法
    request_path TEXT,                                -- 请求路径
    request_params JSONB,                             -- 请求参数
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 创建审计日志表分区 (按日分区，支持大量日志)
CREATE TABLE audit_logs_2026_04_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-04-02');
CREATE TABLE audit_logs_2026_04_02 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-02') TO ('2026-04-03');
CREATE TABLE audit_logs_2026_04_03 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-03') TO ('2026-04-04');
CREATE TABLE audit_logs_2026_04_04 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-04') TO ('2026-04-05');
CREATE TABLE audit_logs_2026_04_05 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-04-05') TO ('2026-04-06');
-- 默认分区
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- 审计日志表索引
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- BRIN索引
CREATE INDEX idx_audit_logs_created_brin ON audit_logs USING BRIN(created_at);

-- ============================================
-- 7. 辅助表
-- ============================================

-- 制裁名单表
CREATE TABLE sanctions_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(255) NOT NULL,                    -- 制裁地址
    chain VARCHAR(50) NOT NULL,                       -- 链类型
    source VARCHAR(100) NOT NULL,                     -- 数据来源 (OFAC, UN, etc.)
    list_name VARCHAR(255),                           -- 名单名称
    entity_name VARCHAR(255),                         -- 实体名称
    entity_type VARCHAR(100),                         -- 实体类型
    programs TEXT[],                                  -- 制裁项目
    published_at TIMESTAMP WITH TIME ZONE,            -- 发布时间
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(address, chain, source)
);

CREATE INDEX idx_sanctions_address ON sanctions_list(address, chain);
CREATE INDEX idx_sanctions_source ON sanctions_list(source);

-- 地址关联表 (用于追踪地址关系)
CREATE TABLE address_relationships (
    id BIGSERIAL PRIMARY KEY,
    source_address_id BIGINT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
    target_address_id BIGINT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL,          -- 关系类型
    strength DECIMAL(5,2),                            -- 关联强度 (0-100)
    evidence JSONB DEFAULT '{}',                      -- 证据数据
    first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_address_id, target_address_id, relationship_type)
);

CREATE INDEX idx_addr_rel_source ON address_relationships(source_address_id);
CREATE INDEX idx_addr_rel_target ON address_relationships(target_address_id);
CREATE INDEX idx_addr_rel_type ON address_relationships(relationship_type);

-- ============================================
-- 8. 函数和触发器
-- ============================================

-- 更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为各表添加更新时间戳触发器
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_rules_updated_at BEFORE UPDATE ON risk_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_events_updated_at BEFORE UPDATE ON risk_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sanctions_list_updated_at BEFORE UPDATE ON sanctions_list
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 自动更新地址最后活跃时间
CREATE OR REPLACE FUNCTION update_address_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE addresses 
    SET last_seen_at = NEW.block_timestamp,
        total_transactions = total_transactions + 1
    WHERE address IN (NEW.from_address, NEW.to_address);
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_address_activity AFTER INSERT ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_address_last_seen();

-- ============================================
-- 9. 视图
-- ============================================

-- 高风险地址视图
CREATE VIEW v_high_risk_addresses AS
SELECT 
    a.*,
    COUNT(DISTINCT re.id) as event_count
FROM addresses a
LEFT JOIN risk_events re ON a.id = re.address_id AND re.detected_at > NOW() - INTERVAL '30 days'
WHERE a.risk_score >= 75 OR a.risk_level IN ('HIGH', 'CRITICAL')
GROUP BY a.id;

-- 风险事件统计视图
CREATE VIEW v_risk_event_stats AS
SELECT 
    DATE(detected_at) as date,
    risk_level,
    COUNT(*) as event_count,
    AVG(risk_score) as avg_score
FROM risk_events
WHERE detected_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(detected_at), risk_level
ORDER BY date DESC, risk_level;

-- 地址交易统计视图
CREATE VIEW v_address_transaction_stats AS
SELECT 
    a.id,
    a.address,
    a.chain,
    COUNT(DISTINCT t.id) as tx_count,
    COALESCE(SUM(CASE WHEN t.from_address = a.address THEN t.value_usd ELSE 0 END), 0) as total_sent_usd,
    COALESCE(SUM(CASE WHEN t.to_address = a.address THEN t.value_usd ELSE 0 END), 0) as total_received_usd
FROM addresses a
LEFT JOIN transactions t ON (a.address = t.from_address OR a.address = t.to_address)
GROUP BY a.id, a.address, a.chain;

-- ============================================
-- 10. 注释
-- ============================================

COMMENT ON TABLE addresses IS '区块链地址主表，存储地址基础信息、风险评分和标签';
COMMENT ON TABLE transactions IS '区块链交易表，存储交易数据和风险分析结果';
COMMENT ON TABLE risk_rules IS '风险检测规则表，存储规则配置和阈值设置';
COMMENT ON TABLE risk_events IS '风险事件表，存储检测到的风险事件';
COMMENT ON TABLE audit_logs IS '审计日志表，存储系统操作记录';
COMMENT ON TABLE sanctions_list IS '制裁名单表，存储来自各机构的制裁地址';
COMMENT ON TABLE address_relationships IS '地址关联表，追踪地址之间的关系';

COMMENT ON COLUMN addresses.risk_score IS '综合风险评分，范围0-100';
COMMENT ON COLUMN addresses.risk_factors IS 'JSON格式的风险因子详情，包含各项风险指标';
COMMENT ON COLUMN transactions.risk_factors IS '交易风险因子详情，包含匹配的规则和权重';
COMMENT ON COLUMN risk_rules.rule_config IS '规则配置参数，JSON格式，不同类型规则配置不同';

-- ============================================
-- 11. 权限设置
-- ============================================

-- 创建应用用户角色
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fidesorigin_app') THEN
        CREATE ROLE fidesorigin_app WITH LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

-- 授予权限
GRANT CONNECT ON DATABASE postgres TO fidesorigin_app;
GRANT USAGE ON SCHEMA public TO fidesorigin_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO fidesorigin_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO fidesorigin_app;

-- ============================================
-- 12. 分区管理函数
-- ============================================

-- 自动创建地址表新分区
CREATE OR REPLACE FUNCTION create_address_partition(year INT, month INT)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'addresses_' || year || '_' || LPAD(month::TEXT, 2, '0');
    start_date := MAKE_DATE(year, month, 1);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF addresses FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- 自动创建交易表新分区
CREATE OR REPLACE FUNCTION create_transaction_partition(year INT, month INT)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'transactions_' || year || '_' || LPAD(month::TEXT, 2, '0');
    start_date := MAKE_DATE(year, month, 1);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF transactions FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- 自动创建事件表新分区
CREATE OR REPLACE FUNCTION create_event_partition(year INT, month INT)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'risk_events_' || year || '_' || LPAD(month::TEXT, 2, '0');
    start_date := MAKE_DATE(year, month, 1);
    end_date := start_date + INTERVAL '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF risk_events FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- 自动创建审计日志表新分区
CREATE OR REPLACE FUNCTION create_audit_partition(year INT, month INT, day INT)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    partition_name := 'audit_logs_' || year || '_' || LPAD(month::TEXT, 2, '0') || '_' || LPAD(day::TEXT, 2, '0');
    start_date := MAKE_DATE(year, month, day);
    end_date := start_date + INTERVAL '1 day';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
                   partition_name, start_date, end_date);
    
    RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 初始化完成
-- ============================================
SELECT 'FidesOrigin database schema initialized successfully!' as status;
