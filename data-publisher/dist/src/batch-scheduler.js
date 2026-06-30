"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const batch_collector_1 = require("./batch-collector");
const logger_1 = __importDefault(require("./logger"));
/**
 * Batch Risk Data Scheduler
 * Runs daily delta sync of OFAC + ScamSniffer using batchUpdateRiskProfiles.
 * Replaces the slow per-address sync with 100-address batches (~2 min vs 9 hours).
 */
class BatchScheduler {
    task;
    isRunning = false;
    cronExpression;
    syncOptions;
    constructor(cronExpression = '30 3 * * *', syncOptions = {}) {
        this.cronExpression = cronExpression;
        this.syncOptions = syncOptions;
    }
    start() {
        if (this.task) {
            logger_1.default.warn('BatchScheduler already running');
            return;
        }
        this.task = node_cron_1.default.schedule(this.cronExpression, async () => {
            if (this.isRunning) {
                logger_1.default.warn('Batch sync already in progress, skipping');
                return;
            }
            this.isRunning = true;
            try {
                const result = await (0, batch_collector_1.runBatchSync)(this.syncOptions);
                logger_1.default.info(`Batch sync finished: ${result.published} published, ${result.failed} failed`, { totalNew: result.totalNew, published: result.published, failed: result.failed, sources: result.sources });
            }
            catch (e) {
                logger_1.default.error(`Batch sync failed: ${e.message}`, { error: e.stack });
            }
            finally {
                this.isRunning = false;
            }
        }, {
            scheduled: false,
            timezone: 'Asia/Shanghai',
        });
        this.task.start();
        logger_1.default.info(`BatchScheduler started: ${this.cronExpression}`, { cron: this.cronExpression });
    }
    stop() {
        this.task?.stop();
        this.task = undefined;
        logger_1.default.info('BatchScheduler stopped');
    }
    get isActive() {
        return !!this.task;
    }
}
exports.BatchScheduler = BatchScheduler;
//# sourceMappingURL=batch-scheduler.js.map