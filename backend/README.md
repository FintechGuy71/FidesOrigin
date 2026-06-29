# FidesOrigin 后端 API

Web3 风险智能平台后端服务

## 技术栈

- **Python 3.11+**
- **FastAPI** - 现代、高性能 Web 框架
- **SQLAlchemy 2.0** - ORM
- **PostgreSQL** - 主数据库
- **Redis** - 缓存和消息队列
- **Alembic** - 数据库迁移
- **Docker** - 容器化部署

## 快速开始

### 1. 环境准备

```bash
# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，配置数据库和其他服务
```

### 2. Docker 部署（推荐）

```bash
# 启动所有服务
docker-compose up -d

# 运行数据库迁移
docker-compose --profile migration run --rm migration

# 查看日志
docker-compose logs -f api
```

### 3. 本地开发

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
export DATABASE_URL=postgresql+asyncpg://localhost/fidesorigin

# 运行迁移
alembic upgrade head

# 启动服务
uvicorn app.main:app --reload
```

## API 端点

### 地址风险

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/address/{address}/risk` | 查询地址风险评分 |
| POST | `/api/v1/address/{address}/report` | 上报可疑地址 |
| GET | `/api/v1/address/{address}/events` | 获取地址风险事件 |
| GET | `/api/v1/address/search` | 搜索地址 |

### 交易监控

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/transaction/{tx_hash}/risk` | 查询交易风险 |
| GET | `/api/v1/transaction/{tx_hash}` | 获取交易详情 |
| GET | `/api/v1/transaction/` | 获取交易列表 |

### 风险规则

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/rules` | 获取规则列表 |
| POST | `/api/v1/rules` | 创建规则 |
| PATCH | `/api/v1/rules/{rule_id}` | 更新规则 |
| DELETE | `/api/v1/rules/{rule_id}` | 删除规则 |

### 实时监控

| 方法 | 端点 | 描述 |
|------|------|------|
| WebSocket | `/api/v1/monitor/stream` | 实时交易流 |

## 文档

启动服务后，访问以下地址查看 API 文档：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## 数据库迁移

```bash
# 创建新迁移
alembic revision --autogenerate -m "描述"

# 升级到最新版本
alembic upgrade head

# 降级
alembic downgrade -1

# 查看历史
alembic history
```

## 测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_api.py::test_health_check -v

# 生成覆盖率报告
pytest --cov=app --cov-report=html
```

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用入口
│   ├── config.py        # 配置管理
│   ├── database.py      # 数据库连接
│   ├── models.py        # SQLAlchemy 模型
│   ├── schemas.py       # Pydantic 模型
│   ├── routers/         # API 路由
│   │   ├── addresses.py
│   │   ├── transactions.py
│   │   ├── rules.py
│   │   └── monitor.py
│   └── services/        # 业务服务
│       ├── blockscout.py
│       └── risk_engine.py
├── alembic/             # 数据库迁移
├── tests/               # 单元测试
├── requirements.txt     # Python 依赖
├── Dockerfile           # Docker 构建
├── docker-compose.yml   # Docker Compose 配置
└── README.md
```

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `DEBUG` | 调试模式 | `false` |
| `LOG_LEVEL` | 日志级别 | `INFO` |
| `DATABASE_URL` | 数据库 URL | - |
| `REDIS_URL` | Redis URL | - |
| `BLOCKSCOUT_API_KEY` | Blockscout API Key | - |
| `SECRET_KEY` | 应用密钥 | - |

## 许可证

MIT
