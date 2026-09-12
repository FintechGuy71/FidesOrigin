# Render 后端部署事故与恢复全记录（2026-09-04 ~ 2026-09-12）

> 面向后续维护者的运维备忘。三位一体的根因、修复动作与验证证据，以及日常排障速查。

## TL;DR

2026-09-04 起 Render 后端（`fidesorigin-backend`）连续出现异常，最终定位为**三个独立问题叠加**，2026-09-12 全部修复并实证：

1. **启动崩溃**（`update_failed`）：`database.py` 误用 stdlib logging 却以 structlog 风格传 kwargs
2. **登录端点 500**：Render 服务缺 `ADMIN_USERNAME` 环境变量（代码 fail-closed）
3. **push 不再自动部署**：Render 账号的 GitHub 部署凭据丢失（GitHub App 被移除），静默失效无任何报错

---

## 一、时间线（UTC+8）

| 时间 | 事件 |
|---|---|
| 09-03 17:04~17:35 | 连续 4 次部署 `update_failed`，gunicorn worker 启动即退出 |
| 09-04 02:30 | PR #64（`b608889`，logger 修复）经 API 手动触发部署 → live |
| 09-04 白天起 | PR #66（`ae199da1`，公开端点签名豁免）合并后 **Render 无任何反应**；PR #67（`f100f4a`）空改动重触发也无效 |
| 09-12 16:10 | 经 Render API 手动触发部署 `f100f4a` → live（豁免生效） |
| 09-12 16:2x | 验收发现 login 500 → 补 `ADMIN_USERNAME=admin`，重启 + 重新部署后恢复 |
| 09-12 17:0x | 重装 Render GitHub App（授权 All repositories） |
| 09-12 17:08 | 探针 PR #68（`44d1a13`）合并 → Render Events 出现 **"New commit via Auto-Deploy"**，自动部署链路实证恢复 |

## 二、根因与修复细节

### 1. 启动崩溃：stdlib logger 误用 structlog kwargs

- **现象**：`TypeError: Logger._log() got an unexpected keyword argument 'names'`，worker failed to boot，exit status 3
- **根因**：`backend/app/database.py` 用 `logging.getLogger(__name__)`（stdlib，不认 kwargs），却按项目 structlog 封装风格调用 `logger.info("...", names=...)` / `logger.error("...", error=...)`
- **修复（PR #64）**：保持 stdlib logging，kwargs 改为 `%s` 占位符风格
- **⚠️ 坑**：不能简单改成 `from app.core.logging import get_logger`——会触发循环 import（core.__init__ → core.di → database 的 AsyncSessionLocal），已实测复现
- **排查方法**：Render API 拉日志 `GET /v1/logs?ownerId=...&resource=...&startTime=...`

### 2. 登录端点 500：`Server authentication not configured`

- **根因**：`auth.py` 启动登录校验时 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 任一缺失即 fail-closed 返回 500；Render 服务上只配了 `ADMIN_PASSWORD`
- **修复**：`PUT /v1/services/{id}/env-vars/ADMIN_USERNAME` = `admin`（`.env.example` 文档约定值）
- **⚠️ 坑**：Render 上改环境变量**不一定会重建实例**——需显式 `POST /services/{id}/restart` 或触发一次新部署才生效
- **⚠️ 坑**：Render API 批量 `PUT /env-vars`（body 为 `{"envVars":[...]}`）在本服务上静默无效；单键 `PUT /env-vars/{KEY}`（body `{"value":"..."}`）可用

### 3. push 不触发自动部署（最隐蔽）

- **表象**：服务 Settings 仍显示 `FintechGuy71/FidesOrigin@main`、Auto-Deploy = On Commit，一切"看起来正常"
- **根因**：Render 账号 Account Settings → **Git Deployment Credentials 为空**；GitHub 仓库 → Settings → GitHub Apps 中 **Render 未安装**（仅剩 Vercel）。凭据丢失后 Render 收不到 push 事件，**配置残留导致静默失效**
- **判别证据**：服务 Events 页中，正常自动部署标注 "New commit via Auto-Deploy"，API 触发标注 "Triggered by you via API"；09-04 后长时间无任何事件
- **修复**：Account Settings → Git Deployment Credentials → Add credential → GitHub → 安装 Render GitHub App（当前授权范围 **All repositories**，含未来新仓库）
- **实证**：PR #68 合并后自动出现 "Deploy started — New commit via Auto-Deploy" 并 live

## 三、验收基线（回归时必须全过）

| 项 | 方法 | 期望 |
|---|---|---|
| 健康检查 | `GET /health` | 200 |
| 登录（错误凭据） | `POST /api/v1/auth/login` | 401 `Incorrect username or password.`（**不是** `Request signature required` / `CSRF token missing` / 500） |
| 联系表单 | `POST /api/v1/contact` 合法 body | 200 |
| 网关链路 | 经 `fidesorigin-api.vercel.app` 重复上两项 | 同上 |

**直连后端的探测必须模拟浏览器 CSRF 流程**：先 `GET /health` 取 `csrf_token` Cookie，再带 `X-CSRF-Token` 头发 POST。这是设计行为（双重 Cookie），不是缺陷。经 Vercel 网关的请求由服务端注入 `X-API-Key`，按设计跳过 CSRF。

## 四、运维速查

- **手动触发部署**（自动链路再出问题时）：
  `POST https://api.render.com/v1/services/srv-da6sh3ajnfac738ln8ag/deploys`，Header `Authorization: Bearer <RENDER_API_KEY>`，body `{"clearCache":"do_not_clear"}`
- **服务关键标识**：Service ID `srv-da6sh3ajnfac738ln8ag`；Owner ID `tea-da6se7e1egvs73bvt420`；region Ohio；plan Free（有冷启动，首次请求可能 50s+）
- **改 env 后必须 restart 或重新部署**，否则旧进程不加载新值
- **自动部署健康自查**：GitHub 仓库 → Settings → GitHub Apps 应有 Render；Render Account Settings → Git Deployment Credentials 应有 FintechGuy71
- **rootDir = `backend/`**：`backend/` 之外的改动不触发后端自动部署（docs 类 PR 不会引起后端重建，属预期）
- **Vercel Hobby 限制**：`apps/api/api/` 下每个非 `_` 前缀目录的 .js 计为 serverless 函数，上限 12——不要往 `api/` 加文件
- **main 受 Rulesets 保护**：只能走 PR（squash 合并），CI 11 项全绿后合入
- `backend/.render-autodeploy-probe` 是 09-12 的验证探针文件，无逻辑作用，可删

## 五、遗留事项

- Render API Key（曾存于运维工作区 `.secrets/render.env`）具备账号内服务读写权限，建议定期轮换/不用即撤销
- Render 免费档 spin down 导致的首请求延迟属平台限制，非故障
