const http = require('http');
const url = require('url');
const { createLogger } = require('./logger');

const logger = createLogger('healthcheck');

/**
 * 健康检查与指标监控服务器
 * 支持 /health, /ready, /metrics 端点
 * 包含 Prometheus 格式指标输出
 */

class HealthCheckServer {
  constructor(options = {}) {
    this.port = options.port || 3001;
    this.server = null;
    this.prisma = options.prisma || null;
    this.provider = options.provider || null;
    this.startTime = Date.now();

    // 指标计数器
    this.metrics = {
      syncTotal: 0,
      syncSuccess: 0,
      syncFailed: 0,
      addressesProcessed: 0,
      addressesSynced: 0,
      gasUsedTotal: 0,
      lastSyncTime: null,
      lastSyncDuration: 0,
      errorsByType: new Map(),
      apiCallsBySource: new Map(),
    };
  }

  /**
   * 启动健康检查服务器
   */
  start() {
    this.server = http.createServer(async (req, res) => {
      const parsedUrl = url.parse(req.url, true);
      const isDev = process.env.NODE_ENV === 'development';
      res.setHeader('Access-Control-Allow-Origin', isDev ? '*' : 'http://localhost:3000');

      try {
        if (parsedUrl.pathname === '/health') {
          await this._handleHealth(req, res);
        } else if (parsedUrl.pathname === '/ready') {
          await this._handleReady(req, res);
        } else if (parsedUrl.pathname === '/metrics') {
          await this._handleMetrics(req, res);
        } else if (parsedUrl.pathname === '/metrics/prometheus') {
          await this._handlePrometheusMetrics(req, res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (err) {
        logger.error('健康检查端点错误', { path: parsedUrl.pathname, error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`健康检查端口 ${this.port} 已被占用`);
      } else {
        logger.error('健康检查服务器错误', { error: err.message });
      }
    });

    this.server.listen(this.port, () => {
      logger.info(`健康检查端点已启动: http://localhost:${this.port}/health`);
    });

    return this.server;
  }

  /**
   * 停止服务器
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  /**
   * 记录同步指标
   */
  recordSync(result) {
    this.metrics.syncTotal++;
    if (result.success) {
      this.metrics.syncSuccess++;
    } else {
      this.metrics.syncFailed++;
    }
    this.metrics.lastSyncTime = Date.now();
    this.metrics.lastSyncDuration = result.duration || 0;
    this.metrics.addressesProcessed += result.processed || 0;
    this.metrics.addressesSynced += result.synced || 0;
    this.metrics.gasUsedTotal += result.gasUsed || 0;
  }

  /**
   * 记录错误
   */
  recordError(type, message) {
    const count = this.metrics.errorsByType.get(type) || 0;
    this.metrics.errorsByType.set(type, count + 1);
  }

  /**
   * 记录 API 调用
   */
  recordApiCall(source) {
    const count = this.metrics.apiCallsBySource.get(source) || 0;
    this.metrics.apiCallsBySource.set(source, count + 1);
  }

  /**
   * /health - 存活检查
   */
  async _handleHealth(req, res) {
    const health = await this._getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  /**
   * /ready - 就绪检查
   */
  async _handleReady(req, res) {
    const ready = await this._getReadinessStatus();
    const statusCode = ready.ready ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ready, null, 2));
  }

  /**
   * /metrics - JSON 格式指标
   */
  async _handleMetrics(req, res) {
    const metrics = await this._getMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }

  /**
   * /metrics/prometheus - Prometheus 格式指标
   */
  async _handlePrometheusMetrics(req, res) {
    const lines = await this._getPrometheusMetrics();
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(lines.join('\n'));
  }

  /**
   * 获取健康状态
   */
  async _getHealthStatus() {
    const checks = {
      database: false,
      blockchain: false,
      memory: false,
    };

    // 数据库检查
    if (this.prisma) {
      try {
        await this.prisma.$queryRaw`SELECT 1`;
        checks.database = true;
      } catch (e) {
        logger.warn('数据库健康检查失败', { error: e.message });
      }
    }

    // 区块链检查（带 10 秒超时，防止 K8s liveness probe 挂起）
    if (this.provider) {
      try {
        await Promise.race([
          this.provider.getBlockNumber(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('RPC timeout')), 10000)
          ),
        ]);
        checks.blockchain = true;
      } catch (e) {
        logger.warn('区块链健康检查失败', { error: e.message });
      }
    }

    // 内存检查
    const mem = process.memoryUsage();
    checks.memory = mem.heapUsed / 1024 / 1024 < 1024; // < 1GB

    const allHealthy = Object.values(checks).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      uptimeMs: Date.now() - this.startTime,
      checks,
      memory: {
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        external: `${Math.round(mem.external / 1024 / 1024)}MB`,
      },
    };
  }

  /**
   * 获取就绪状态
   */
  async _getReadinessStatus() {
    const health = await this._getHealthStatus();
    return {
      ready: health.status === 'healthy',
      timestamp: new Date().toISOString(),
      dependencies: health.checks,
    };
  }

  /**
   * 获取 JSON 格式指标
   */
  async _getMetrics() {
    let totalAddresses = 0;
    let totalSyncs = 0;

    if (this.prisma) {
      try {
        totalAddresses = await this.prisma.riskAddress.count();
        totalSyncs = await this.prisma.syncHistory.count();
      } catch (e) {
        // 忽略数据库错误
      }
    }

    const mem = process.memoryUsage();

    return {
      timestamp: new Date().toISOString(),
      addresses: { total: totalAddresses },
      syncs: {
        total: this.metrics.syncTotal,
        success: this.metrics.syncSuccess,
        failed: this.metrics.syncFailed,
        lastSyncTime: this.metrics.lastSyncTime
          ? new Date(this.metrics.lastSyncTime).toISOString()
          : null,
        lastSyncDuration: this.metrics.lastSyncDuration,
      },
      addressesProcessed: this.metrics.addressesProcessed,
      addressesSynced: this.metrics.addressesSynced,
      gasUsedTotal: this.metrics.gasUsedTotal,
      errors: Object.fromEntries(this.metrics.errorsByType),
      apiCalls: Object.fromEntries(this.metrics.apiCallsBySource),
      system: {
        uptime: process.uptime(),
        uptimeMs: Date.now() - this.startTime,
        memory: {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          rss: Math.round(mem.rss / 1024 / 1024),
        },
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
  }

  /**
   * 获取 Prometheus 格式指标
   */
  async _getPrometheusMetrics() {
    const lines = [];
    const prefix = 'fidesorigin_datasync';

    // [Cross-check fix] Escape label values to prevent format injection
    const escapeLabel = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    };

    // 帮助信息
    lines.push(`# HELP ${prefix}_up Service availability`);
    lines.push(`# TYPE ${prefix}_up gauge`);
    const health = await this._getHealthStatus();
    lines.push(`${prefix}_up ${health.status === 'healthy' ? 1 : 0}`);

    lines.push(`# HELP ${prefix}_sync_total Total sync operations`);
    lines.push(`# TYPE ${prefix}_sync_total counter`);
    lines.push(`${prefix}_sync_total ${this.metrics.syncTotal}`);

    lines.push(`# HELP ${prefix}_sync_success Successful sync operations`);
    lines.push(`# TYPE ${prefix}_sync_success counter`);
    lines.push(`${prefix}_sync_success ${this.metrics.syncSuccess}`);

    lines.push(`# HELP ${prefix}_sync_failed Failed sync operations`);
    lines.push(`# TYPE ${prefix}_sync_failed counter`);
    lines.push(`${prefix}_sync_failed ${this.metrics.syncFailed}`);

    lines.push(`# HELP ${prefix}_addresses_processed Total addresses processed`);
    lines.push(`# TYPE ${prefix}_addresses_processed counter`);
    lines.push(`${prefix}_addresses_processed ${this.metrics.addressesProcessed}`);

    lines.push(`# HELP ${prefix}_addresses_synced Total addresses synced to chain`);
    lines.push(`# TYPE ${prefix}_addresses_synced counter`);
    lines.push(`${prefix}_addresses_synced ${this.metrics.addressesSynced}`);

    lines.push(`# HELP ${prefix}_gas_used_total Total gas used`);
    lines.push(`# TYPE ${prefix}_gas_used_total counter`);
    lines.push(`${prefix}_gas_used_total ${this.metrics.gasUsedTotal}`);

    lines.push(`# HELP ${prefix}_last_sync_timestamp Last sync timestamp`);
    lines.push(`# TYPE ${prefix}_last_sync_timestamp gauge`);
    lines.push(`${prefix}_last_sync_timestamp ${this.metrics.lastSyncTime || 0}`);

    lines.push(`# HELP ${prefix}_uptime_seconds Process uptime`);
    lines.push(`# TYPE ${prefix}_uptime_seconds gauge`);
    lines.push(`${prefix}_uptime_seconds ${process.uptime()}`);

    lines.push(`# HELP ${prefix}_memory_heap_used_mb Heap memory used`);
    lines.push(`# TYPE ${prefix}_memory_heap_used_mb gauge`);
    const mem = process.memoryUsage();
    lines.push(`${prefix}_memory_heap_used_mb ${Math.round(mem.heapUsed / 1024 / 1024)}`);

    lines.push(`# HELP ${prefix}_memory_rss_mb RSS memory`);
    lines.push(`# TYPE ${prefix}_memory_rss_mb gauge`);
    lines.push(`${prefix}_memory_rss_mb ${Math.round(mem.rss / 1024 / 1024)}`);

    // 错误指标
    for (const [type, count] of this.metrics.errorsByType) {
      lines.push(`# HELP ${prefix}_errors Errors by type`);
      lines.push(`# TYPE ${prefix}_errors counter`);
      lines.push(`${prefix}_errors{type="${escapeLabel(type)}"} ${count}`);
    }

    // API 调用指标
    for (const [source, count] of this.metrics.apiCallsBySource) {
      lines.push(`# HELP ${prefix}_api_calls API calls by source`);
      lines.push(`# TYPE ${prefix}_api_calls counter`);
      lines.push(`${prefix}_api_calls{source="${escapeLabel(source)}"} ${count}`);
    }

    return lines;
  }
}

module.exports = { HealthCheckServer };
