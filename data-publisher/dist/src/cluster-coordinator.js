"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClusterCoordinator = void 0;
const redis_1 = require("redis");
const logger_1 = require("./logger");
class ClusterCoordinator {
    client;
    config;
    heartbeatTimer;
    isLeader = false;
    constructor(config) {
        this.config = config;
        this.client = (0, redis_1.createClient)({ url: config.redisUrl });
        this.client.on('error', (err) => {
            logger_1.logger.error('Redis connection error', { error: err.message });
        });
    }
    /**
     * Connect to Redis
     */
    async connect() {
        await this.client.connect();
        logger_1.logger.info('Connected to Redis', {
            redisUrl: this.config.redisUrl.replace(/:\/\/.*@/, '://***@'),
            instanceId: this.config.instanceId,
        });
    }
    /**
     * Try to acquire a distributed lock for a sync job
     */
    async acquireLock(lockName, ttl) {
        const key = `${this.config.lockPrefix}:${lockName}`;
        const token = `${this.config.instanceId}:${Date.now()}`;
        const lockTtl = ttl || this.config.lockTtl;
        // Use SET NX EX for atomic lock acquisition
        const result = await this.client.set(key, token, {
            NX: true,
            PX: lockTtl,
        });
        if (result === 'OK') {
            logger_1.logger.info(`Acquired lock: ${lockName}`, { instanceId: this.config.instanceId });
            return true;
        }
        // Check if lock owner is still alive
        const owner = await this.client.get(key);
        if (owner) {
            const [instanceId] = owner.split(':');
            const lastHeartbeat = await this.client.get(`${this.config.lockPrefix}:heartbeat:${instanceId}`);
            if (!lastHeartbeat || Date.now() - parseInt(lastHeartbeat) > this.config.lockTtl * 2) {
                // Owner seems dead, force release and retry
                logger_1.logger.warn(`Lock owner ${instanceId} appears dead, force releasing`, { lockName });
                await this.releaseLock(lockName, true);
                return this.acquireLock(lockName, ttl);
            }
        }
        logger_1.logger.debug(`Lock ${lockName} held by another instance`);
        return false;
    }
    /**
     * Release a distributed lock
     */
    async releaseLock(lockName, force = false) {
        const key = `${this.config.lockPrefix}:${lockName}`;
        if (!force) {
            // Only release if we own it
            const owner = await this.client.get(key);
            if (owner && owner.startsWith(this.config.instanceId)) {
                await this.client.del(key);
                logger_1.logger.info(`Released lock: ${lockName}`);
            }
        }
        else {
            await this.client.del(key);
        }
    }
    /**
     * Start heartbeat to indicate this instance is alive
     */
    startHeartbeat() {
        this.heartbeatTimer = setInterval(async () => {
            try {
                await this.client.set(`${this.config.lockPrefix}:heartbeat:${this.config.instanceId}`, Date.now().toString(), { PX: this.config.lockTtl * 2 });
            }
            catch (err) {
                logger_1.logger.error('Heartbeat failed', { error: err.message });
            }
        }, this.config.heartbeatInterval);
        logger_1.logger.info('Heartbeat started', { interval: this.config.heartbeatInterval });
    }
    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }
    /**
     * Get all active instances
     */
    async getActiveInstances() {
        const pattern = `${this.config.lockPrefix}:heartbeat:*`;
        const keys = await this.client.keys(pattern);
        const instances = [];
        const now = Date.now();
        for (const key of keys) {
            const lastHeartbeat = await this.client.get(key);
            if (lastHeartbeat && now - parseInt(lastHeartbeat) < this.config.lockTtl * 2) {
                const instanceId = key.split(':').pop();
                instances.push(instanceId);
            }
        }
        return instances;
    }
    /**
     * Distribute addresses among instances (consistent hashing)
     */
    async getAddressPartition(allAddresses) {
        const instances = await this.getActiveInstances();
        if (instances.length <= 1)
            return allAddresses;
        // Sort instances for consistent ordering
        instances.sort();
        const myIndex = instances.indexOf(this.config.instanceId);
        if (myIndex === -1) {
            logger_1.logger.warn('Instance not found in active list, processing all addresses');
            return allAddresses;
        }
        // Simple modulo partitioning
        const partitionSize = Math.ceil(allAddresses.length / instances.length);
        const start = myIndex * partitionSize;
        const end = Math.min(start + partitionSize, allAddresses.length);
        const myPartition = allAddresses.slice(start, end);
        logger_1.logger.info(`Partitioned addresses: ${myPartition.length}/${allAddresses.length}`, {
            instanceIndex: myIndex,
            totalInstances: instances.length,
        });
        return myPartition;
    }
    /**
     * Publish sync progress for other instances to see
     */
    async publishProgress(jobId, progress) {
        await this.client.set(`${this.config.lockPrefix}:progress:${jobId}`, JSON.stringify({ ...progress, instanceId: this.config.instanceId, timestamp: Date.now() }), { PX: this.config.lockTtl * 10 });
    }
    /**
     * Get sync progress from all instances
     */
    async getProgress(jobId) {
        const pattern = `${this.config.lockPrefix}:progress:${jobId}`;
        const keys = await this.client.keys(pattern);
        const progress = [];
        for (const key of keys) {
            const data = await this.client.get(key);
            if (data)
                progress.push(JSON.parse(data));
        }
        return progress;
    }
    /**
     * Disconnect from Redis
     */
    async disconnect() {
        this.stopHeartbeat();
        await this.client.quit();
        logger_1.logger.info('Disconnected from Redis');
    }
}
exports.ClusterCoordinator = ClusterCoordinator;
exports.default = ClusterCoordinator;
//# sourceMappingURL=cluster-coordinator.js.map