/**
 * 优雅关闭处理
 * 支持 SIGTERM/SIGINT 信号、资源清理、超时强制退出
 */

const { createLogger } = require('./logger');

const logger = createLogger('graceful-shutdown');

class GracefulShutdown {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000; // 默认30秒超时
    this.handlers = [];
    this.isShuttingDown = false;
    this.startTime = null;
  }

  /**
   * 注册关闭处理器
   */
  register(name, handler, priority = 0) {
    this.handlers.push({ name, handler, priority });
    // 按优先级排序（高优先级先执行）
    this.handlers.sort((a, b) => b.priority - a.priority);
    logger.info(`注册关闭处理器: ${name} (优先级: ${priority})`);
  }

  /**
   * 启动信号监听
   */
  listen() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    for (const signal of signals) {
      process.on(signal, () => this.shutdown(signal));
    }

    // PM2 集群模式支持
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        this.shutdown('PM2_SHUTDOWN');
      }
    });

    logger.info('优雅关闭信号监听已启动');
  }

  /**
   * 执行关闭
   */
  async shutdown(signal = 'UNKNOWN') {
    if (this.isShuttingDown) {
      logger.warn('关闭已在进行中，忽略重复信号');
      return;
    }

    this.isShuttingDown = true;
    this.startTime = Date.now();
    logger.info(`收到 ${signal} 信号，开始优雅关闭...`);

    // 设置超时强制退出
    const timeoutId = setTimeout(() => {
      logger.error(`优雅关闭超时 (${this.timeout}ms)，强制退出`);
      process.exit(1);
    }, this.timeout);

    // 按优先级执行关闭处理器
    for (const { name, handler } of this.handlers) {
      try {
        logger.info(`执行关闭处理器: ${name}`);
        await handler();
        logger.info(`关闭处理器完成: ${name}`);
      } catch (err) {
        logger.error(`关闭处理器失败: ${name}`, { error: err.message });
      }
    }

    clearTimeout(timeoutId);
    const duration = Date.now() - this.startTime;
    logger.info(`优雅关闭完成，耗时 ${duration}ms`);
    process.exit(0);
  }
}

module.exports = { GracefulShutdown };
