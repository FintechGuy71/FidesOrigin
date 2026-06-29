-- ============================================
-- FidesOrigin 示例数据脚本
-- 区块链风险分析平台 - 种子数据
-- ============================================
-- 版本: 1.0.0
-- 创建时间: 2026-04-03
-- ============================================

-- ============================================
-- 1. 插入风险规则数据
-- ============================================

INSERT INTO risk_rules (
    name, description, rule_type, rule_config,
    threshold_low, threshold_medium, threshold_high, threshold_critical,
    is_enabled, priority, tags, category, created_by
) VALUES
-- 制裁名单检测
(
    'OFAC制裁名单检测',
    '检测与OFAC制裁名单上的地址进行交易',
    'SANCTIONS_LIST',
    '{
        "sources": ["OFAC"],
        "check_direct": true,
        "check_indirect": true,
        "hops": 2
    }'::jsonb,
    90.00, 95.00, 98.00, 100.00,
    true, 10, ARRAY['sanctions', 'compliance'], '合规', 'system'
),
(
    '联合国制裁名单检测',
    '检测与联合国制裁名单上的地址进行交易',
    'SANCTIONS_LIST',
    '{
        "sources": ["UN"],
        "check_direct": true
    }'::jsonb,
    85.00, 92.00, 97.00, 100.00,
    true, 11, ARRAY['sanctions', 'compliance'], '合规', 'system'
),

-- 大额交易检测
(
    '大额ETH转账检测',
    '检测超过10,000 USD的ETH转账',
    'HEURISTIC',
    '{
        "chain": "ETH",
        "min_value_usd": 10000,
        "check_new_addresses": true
    }'::jsonb,
    30.00, 50.00, 70.00, 85.00,
    true, 20, ARRAY['large_transfer', 'monitoring'], '监控', 'system'
),
(
    '大额USDT转账检测',
    '检测超过100,000 USD的USDT转账',
    'HEURISTIC',
    '{
        "token": "USDT",
        "min_value_usd": 100000
    }'::jsonb,
    25.00, 45.00, 65.00, 80.00,
    true, 21, ARRAY['large_transfer', 'stablecoin'], '监控', 'system'
),

-- 异常行为检测
(
    '快进快出检测',
    '检测资金在短时间内进入后立即转出的行为',
    'HEURISTIC',
    '{
        "max_hold_time_minutes": 60,
        "similar_amount_threshold": 0.95
    }'::jsonb,
    40.00, 60.00, 80.00, 95.00,
    true, 30, ARRAY['layering', 'suspicious'], '反洗钱', 'system'
),
(
    '多跳转账检测',
    '检测通过多个中间地址进行的复杂转账',
    'HEURISTIC',
    '{
        "max_hops": 5,
        "time_window_hours": 24
    }'::jsonb,
    35.00, 55.00, 75.00, 90.00,
    true, 31, ARRAY['layering', 'complex'], '反洗钱', 'system'
),

-- 鲸鱼活动检测
(
    '鲸鱼钱包活动检测',
    '检测持有大量资产的钱包活动',
    'WHALE_ALERT',
    '{
        "min_wallet_value_usd": 10000000,
        "alert_on_any_transfer": true
    }'::jsonb,
    20.00, 40.00, 60.00, 80.00,
    true, 40, ARRAY['whale', 'market_impact'], '市场监控', 'system'
),

-- ML模型检测
(
    '异常交易模式检测',
    '使用机器学习模型检测异常交易模式',
    'ML_MODEL',
    '{
        "model_version": "v2.1",
        "model_type": "isolation_forest",
        "features": ["amount", "frequency", "timing", "counterparties"]
    }'::jsonb,
    50.00, 70.00, 85.00, 95.00,
    true, 50, ARRAY['ml', 'anomaly'], 'AI检测', 'system'
),
(
    '混币器检测',
    '检测与已知混币器协议的交互',
    'HEURISTIC',
    '{
        "known_mixers": ["Tornado.Cash", "Sinbad.io", "Blender.io"],
        "detection_type": "both"
    }'::jsonb,
    60.00, 80.00, 90.00, 98.00,
    true, 15, ARRAY['mixer', 'privacy', 'suspicious'], '反洗钱', 'system'
),

-- 交易所相关
(
    '无KYC交易所出金检测',
    '检测从无KYC要求的交易所提取资金',
    'HEURISTIC',
    '{
        "exchange_type": "non_kyc",
        "check_deposits": false,
        "check_withdrawals": true
    }'::jsonb,
    45.00, 65.00, 80.00, 92.00,
    true, 35, ARRAY['exchange', 'kyc'], '合规', 'system'
),

-- 新地址检测
(
    '新地址大额交易',
    '检测新创建地址的大额交易',
    'HEURISTIC',
    '{
        "max_address_age_days": 7,
        "min_value_usd": 5000
    }'::jsonb,
    30.00, 50.00, 70.00, 85.00,
    true, 60, ARRAY['new_address', 'suspicious'], '监控', 'system'
);

-- ============================================
-- 2. 插入制裁名单数据
-- ============================================

INSERT INTO sanctions_list (address, chain, source, list_name, entity_name, entity_type, programs, published_at)
VALUES
-- OFAC 制裁地址 (示例)
('0x1da5821544e25c636c1417ba96de4cf6d2f9b5a2', 'ETH', 'OFAC', 'SDN List', 'Lazarus Group', 'organization', ARRAY['CYBER2'], '2019-09-13'),
('0x2f389ce8bd8c84f62e023a82c91bf07c03d4b439', 'ETH', 'OFAC', 'SDN List', 'Lazarus Group', 'organization', ARRAY['CYBER2'], '2019-09-13'),
('0x2f5054b3e3b0e3e3b0e3e3b0e3e3b0e3e3b0e3e', 'ETH', 'OFAC', 'SDN List', 'Tornado Cash', 'smart_contract', ARRAY['CYBER2'], '2022-08-08'),
('0x722122df12d4e14e13ac3b6895a86e84145b6967', 'ETH', 'OFAC', 'SDN List', 'Tornado Cash', 'smart_contract', ARRAY['CYBER2'], '2022-08-08'),
('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC', 'OFAC', 'SDN List', 'Hydra Market', 'darknet_market', ARRAY['ILLICIT_DRUGS'], '2022-04-05'),
('0x3e3b0e3e3b0e3e3b0e3e3b0e3e3b0e3e3b0e3e3b', 'ETH', 'OFAC', 'SDN List', 'Garantex', 'exchange', ARRAY['CYBER2'], '2022-04-05');

-- ============================================
-- 3. 插入地址数据
-- ============================================

INSERT INTO addresses (
    address, chain, address_type, risk_score, risk_level, risk_factors, tags,
    entity_name, entity_category, total_transactions, total_volume_usd,
    first_seen_at, last_seen_at, metadata, created_at, updated_at
) VALUES
-- 高风险地址
(
    '0x1da5821544e25c636c1417ba96de4cf6d2f9b5a2',
    'ETH',
    'EOA',
    98.50,
    'CRITICAL',
    '{
        "sanctions_match": {"source": "OFAC", "entity": "Lazarus Group"},
        "associated_risk": "nation_state_actor"
    }'::jsonb,
    ARRAY['sanctioned', 'lazarus_group', 'high_risk'],
    'Lazarus Group',
    '恶意行为者',
    1250,
    150000000.00,
    '2019-09-13 00:00:00+00',
    '2026-03-15 12:30:00+00',
    '{
        "threat_intel": {"source": "Chainalysis", "confidence": 0.98}
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '5 days'
),
(
    '0x2f389ce8bd8c84f62e023a82c91bf07c03d4b439',
    'ETH',
    'EOA',
    97.80,
    'CRITICAL',
    '{
        "sanctions_match": {"source": "OFAC", "entity": "Lazarus Group"}
    }'::jsonb,
    ARRAY['sanctioned', 'lazarus_group'],
    'Lazarus Group',
    '恶意行为者',
    890,
    85000000.00,
    '2019-09-13 00:00:00+00',
    '2026-03-20 08:15:00+00',
    '{}'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '3 days'
),

-- 混币器合约
(
    '0x2f5054b3e3b0e3e3b0e3e3b0e3e3b0e3e3b0e3e',
    'ETH',
    'CONTRACT',
    95.00,
    'CRITICAL',
    '{
        "mixer_detected": true,
        "sanctions_match": {"source": "OFAC", "entity": "Tornado Cash"}
    }'::jsonb,
    ARRAY['sanctioned', 'mixer', 'tornado_cash', 'privacy'],
    'Tornado Cash',
    '混币器',
    2500000,
    7500000000.00,
    '2019-12-01 00:00:00+00',
    '2026-03-28 14:20:00+00',
    '{
        "contract_type": "mixer",
        "anonymity_set": 15000
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '1 day'
),

-- 中风险地址
(
    '0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE',
    'ETH',
    'EOA',
    65.50,
    'MEDIUM',
    '{
        "exchange_usage": {"non_kyc_exchanges": 3, "volume_ratio": 0.45},
        "transaction_pattern": "frequent_large_transfers"
    }'::jsonb,
    ARRAY['exchange_user', 'non_kyc', 'frequent_trader'],
    'Binance Hot Wallet 6',
    '交易所',
    45000,
    2500000000.00,
    '2018-06-15 00:00:00+00',
    '2026-04-02 18:45:00+00',
    '{
        "exchange": "Binance",
        "wallet_type": "hot"
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW()
),
(
    '0x8ba1f109551bD432803012645Hac136c482',
    'ETH',
    'EOA',
    45.20,
    'MEDIUM',
    '{
        "new_address": {"age_days": 3},
        "large_transactions": {"count_7d": 15, "total_usd": 500000}
    }'::jsonb,
    ARRAY['new_address', 'high_volume'],
    NULL,
    NULL,
    25,
    500000.00,
    '2026-03-30 00:00:00+00',
    '2026-04-03 10:30:00+00',
    '{}'::jsonb,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '2 hours'
),

-- 低风险地址 (知名实体)
(
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'ETH',
    'CONTRACT',
    5.00,
    'LOW',
    '{
        "verified_contract": true,
        "known_entity": "Wrapped Ether"
    }'::jsonb,
    ARRAY['verified', 'weth', 'defi'],
    'Wrapped Ether',
    'DeFi协议',
    150000000,
    500000000000.00,
    '2017-12-31 00:00:00+00',
    '2026-04-03 20:00:00+00',
    '{
        "contract_verified": true,
        "token_symbol": "WETH"
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW()
),
(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'ETH',
    'CONTRACT',
    3.50,
    'LOW',
    '{
        "verified_contract": true,
        "stablecoin": true
    }'::jsonb,
    ARRAY['verified', 'usdc', 'stablecoin', 'circle'],
    'USD Coin',
    '稳定币',
    85000000,
    800000000000.00,
    '2018-09-01 00:00:00+00',
    '2026-04-03 20:00:00+00',
    '{
        "contract_verified": true,
        "token_symbol": "USDC",
        "issuer": "Circle"
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW()
),

-- 鲸鱼地址
(
    '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'ETH',
    'CONTRACT',
    8.00,
    'LOW',
    '{
        "whale_wallet": true,
        "verified_contract": true
    }'::jsonb,
    ARRAY['verified', 'usdt', 'stablecoin', 'tether', 'whale'],
    'Tether USD',
    '稳定币',
    120000000,
    1200000000000.00,
    '2017-11-28 00:00:00+00',
    '2026-04-03 20:00:00+00',
    '{
        "contract_verified": true,
        "token_symbol": "USDT",
        "issuer": "Tether"
    }'::jsonb,
    NOW() - INTERVAL '30 days',
    NOW()
);

-- ============================================
-- 4. 插入交易数据
-- ============================================

INSERT INTO transactions (
    tx_hash, chain, from_address, to_address, from_address_id, to_address_id,
    value, value_usd, token_symbol, token_address,
    block_number, block_hash, block_timestamp,
    risk_score, risk_level, risk_factors,
    gas_price, gas_used, transaction_fee, transaction_fee_usd,
    status, raw_data, analyzed_at, created_at
)
SELECT 
    '0x' || encode(gen_random_bytes(32), 'hex'),
    'ETH',
    '0x' || encode(gen_random_bytes(20), 'hex'),
    a.address,
    NULL,
    a.id,
    (random() * 1000)::numeric(36,18),
    (random() * 5000000 + 10000)::numeric(24,8),
    CASE WHEN random() > 0.5 THEN 'ETH' ELSE 'USDT' END,
    CASE WHEN random() > 0.5 THEN NULL ELSE '0xdAC17F958D2ee523a2206206994597C13D831ec7' END,
    18000000 + (random() * 100000)::bigint,
    '0x' || encode(gen_random_bytes(32), 'hex'),
    NOW() - (random() * INTERVAL '7 days'),
    CASE 
        WHEN a.risk_level = 'CRITICAL' THEN 90 + random() * 10
        WHEN a.risk_level = 'HIGH' THEN 70 + random() * 20
        WHEN a.risk_level = 'MEDIUM' THEN 40 + random() * 30
        ELSE random() * 40
    END,
    a.risk_level,
    jsonb_build_object(
        'counterparty_risk', a.risk_score,
        'amount_risk', CASE WHEN random() > 0.7 THEN 'high' ELSE 'normal' END
    ),
    (random() * 1000000000)::numeric(36,18),
    (random() * 100000)::bigint,
    (random() * 0.01)::numeric(36,18),
    (random() * 50)::numeric(24,8),
    'SUCCESS',
    '{}'::jsonb,
    NOW(),
    NOW()
FROM addresses a
WHERE a.risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM')
LIMIT 20;

-- ============================================
-- 5. 插入风险事件数据
-- ============================================

INSERT INTO risk_events (
    event_type, event_name, description,
    address_id, address, tx_id, tx_hash, chain,
    risk_level, risk_score, risk_factors, matched_rules, status,
    metadata, detected_at, created_at
)
SELECT 
    'SANCTIONS_MATCH',
    'OFAC制裁名单匹配',
    '该地址被列入OFAC制裁名单',
    a.id,
    a.address,
    NULL,
    NULL,
    a.chain,
    'CRITICAL',
    98.5,
    jsonb_build_object(
        'source', 'OFAC',
        'entity', a.entity_name,
        'confidence', 0.98
    ),
    ARRAY['ofac-sanctions-rule-uuid']::uuid[],  -- 占位符，实际使用时需要关联真实规则ID
    'PENDING',
    jsonb_build_object(
        'auto_flagged', true,
        'requires_review', true
    ),
    NOW() - (random() * INTERVAL '3 days'),
    NOW()
FROM addresses a
WHERE a.risk_level = 'CRITICAL' AND a.entity_name IS NOT NULL
LIMIT 5;

-- ============================================
-- 6. 插入审计日志数据
-- ============================================

INSERT INTO audit_logs (
    action, action_name, description,
    resource_type, resource_id, resource_name,
    user_id, user_name, user_ip, user_agent, session_id,
    old_values, new_values,
    success, execution_time_ms,
    request_method, request_path, request_params,
    created_at
)
VALUES
(
    'LOGIN', '用户登录', '管理员用户成功登录系统',
    'user', 'admin_001', 'admin',
    'admin_001', '系统管理员', '192.168.1.100'::inet, 'Mozilla/5.0', 'sess_001',
    NULL,
    jsonb_build_object('login_time', NOW()),
    true, 150,
    'POST', '/api/v1/auth/login',
    jsonb_build_object('username', 'admin'),
    NOW() - INTERVAL '2 hours'
),
(
    'QUERY', '地址查询', '查询高风险地址列表',
    'address', NULL, NULL,
    'admin_001', '系统管理员', '192.168.1.100'::inet, 'Mozilla/5.0', 'sess_001',
    NULL, NULL,
    true, 45,
    'GET', '/api/v1/addresses',
    jsonb_build_object('risk_level', 'CRITICAL', 'limit', 50),
    NOW() - INTERVAL '1 hour'
),
(
    'CREATE', '创建风险规则', '创建新的风险检测规则',
    'risk_rule', 'rule_001', '大额交易检测',
    'admin_001', '系统管理员', '192.168.1.100'::inet, 'Mozilla/5.0', 'sess_001',
    NULL,
    jsonb_build_object('name', '大额交易检测', 'threshold', 10000),
    true, 230,
    'POST', '/api/v1/risk-rules',
    jsonb_build_object('name', '大额交易检测'),
    NOW() - INTERVAL '30 minutes'
),
(
    'UPDATE', '更新事件状态', '将风险事件标记为已处理',
    'risk_event', 'event_001', 'OFAC制裁名单匹配',
    'analyst_001', '风控分析师', '192.168.1.101'::inet, 'Mozilla/5.0', 'sess_002',
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', 'RESOLVED', 'resolution', '已确认并上报'),
    true, 89,
    'PATCH', '/api/v1/risk-events/event_001',
    jsonb_build_object('status', 'RESOLVED'),
    NOW() - INTERVAL '15 minutes'
),
(
    'EXPORT', '导出报告', '导出高风险地址报告',
    'report', 'report_001', '高风险地址月度报告',
    'admin_001', '系统管理员', '192.168.1.100'::inet, 'Mozilla/5.0', 'sess_001',
    NULL, NULL,
    true, 1200,
    'GET', '/api/v1/reports/export',
    jsonb_build_object('format', 'PDF', 'period', 'monthly'),
    NOW() - INTERVAL '5 minutes'
);

-- ============================================
-- 7. 更新地址统计信息
-- ============================================

-- 基于交易数据更新地址统计
WITH address_stats AS (
    SELECT 
        from_address_id as addr_id,
        COUNT(*) as tx_count,
        SUM(value_usd) as total_sent
    FROM transactions
    WHERE from_address_id IS NOT NULL
    GROUP BY from_address_id
    UNION ALL
    SELECT 
        to_address_id as addr_id,
        COUNT(*) as tx_count,
        SUM(value_usd) as total_received
    FROM transactions
    WHERE to_address_id IS NOT NULL
    GROUP BY to_address_id
)
UPDATE addresses a
SET 
    total_transactions = COALESCE((SELECT SUM(tx_count) FROM address_stats WHERE addr_id = a.id), 0),
    total_volume_usd = COALESCE((SELECT SUM(COALESCE(total_sent, 0) + COALESCE(total_received, 0)) FROM address_stats WHERE addr_id = a.id), 0)
WHERE a.id IN (SELECT DISTINCT addr_id FROM address_stats);

-- ============================================
-- 8. 验证数据
-- ============================================

-- 统计各表数据量
SELECT 'addresses' as table_name, COUNT(*) as count FROM addresses
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'risk_rules', COUNT(*) FROM risk_rules
UNION ALL
SELECT 'risk_events', COUNT(*) FROM risk_events
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'sanctions_list', COUNT(*) FROM sanctions_list;

-- ============================================
-- 种子数据插入完成
-- ============================================
SELECT 'Seed data inserted successfully!' as status;
