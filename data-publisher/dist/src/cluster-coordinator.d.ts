/**
 * Cluster Coordinator — Redis-based distributed locking for multi-instance deployments
 * Prevents multiple publisher instances from pushing the same data simultaneously
 */
export interface ClusterConfig {
    enabled: boolean;
    redisUrl: string;
    lockPrefix: string;
    lockTtl: number;
    instanceId: string;
    heartbeatInterval: number;
}
export declare class ClusterCoordinator {
    private client;
    private config;
    private heartbeatTimer?;
    private isLeader;
    constructor(config: ClusterConfig);
    /**
     * Connect to Redis
     */
    connect(): Promise<void>;
    /**
     * Try to acquire a distributed lock for a sync job
     */
    acquireLock(lockName: string, ttl?: number): Promise<boolean>;
    /**
     * Release a distributed lock
     */
    releaseLock(lockName: string, force?: boolean): Promise<void>;
    /**
     * Start heartbeat to indicate this instance is alive
     */
    startHeartbeat(): void;
    /**
     * Stop heartbeat
     */
    stopHeartbeat(): void;
    /**
     * Get all active instances
     */
    getActiveInstances(): Promise<string[]>;
    /**
     * Distribute addresses among instances (consistent hashing)
     */
    getAddressPartition(allAddresses: string[]): Promise<string[]>;
    /**
     * Publish sync progress for other instances to see
     */
    publishProgress(jobId: string, progress: {
        processed: number;
        total: number;
        status: string;
    }): Promise<void>;
    /**
     * Get sync progress from all instances
     */
    getProgress(jobId: string): Promise<any[]>;
    /**
     * Disconnect from Redis
     */
    disconnect(): Promise<void>;
}
export default ClusterCoordinator;
//# sourceMappingURL=cluster-coordinator.d.ts.map