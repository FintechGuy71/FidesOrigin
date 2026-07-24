import { createClient, RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import logger from './logger';
import { config } from './config';

/**
 * FidesOrigin Message Queue (Redis Streams)
 *
 * [P2-Fix] Replaced Redis Pub/Sub with Redis Streams for reliable message delivery.
 * - Redis Pub/Sub is fire-and-forget: messages are lost if subscriber is offline.
 * - Redis Streams provides persistence, consumer groups, and acknowledgement.
 * - Supports at-least-once delivery with explicit acknowledgement.
 * - Supports dead-letter queue (DLQ) for messages that fail after max retries.
 *
 * Message format:
 * {
 *   "type": "risk_update",
 *   "payload": {"address": "0x...", "score": 85, "tier": "HIGH"},
 *   "timestamp": 1234567890,
 *   "source": "backend",
 *   "message_id": "uuid",
 *   "retry_count": 0
 * }
 */

export interface RiskUpdatePayload {
  address: string;
  score: number;
  tier: string;
}

export interface MessageEnvelope {
  type: string;
  payload: RiskUpdatePayload | Record<string, any>;
  timestamp: number;
  source: string;
  message_id: string;
  retry_count?: number;
}

export interface MessageHandler {
  (message: MessageEnvelope): Promise<void>;
}

export interface DLQEntry {
  message: MessageEnvelope;
  reason: string;
  failed_at: number;
}

const STREAM_KEY = 'fides:mq:risk_updates';
const CONSUMER_GROUP = 'fides:mq:consumers';
const CONSUMER_NAME = `consumer-${process.pid}-${Date.now()}`;
const DLQ_KEY = 'fides:mq:dlq';
const MAX_RETRY_COUNT = 3;

export class MessageQueue {
  private redis: RedisClientType | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isRunning: boolean = false;
  private readInterval: NodeJS.Timeout | null = null;

  constructor() {}

  private async getRedis(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = createClient({ url: config.cluster.redisUrl });
      await this.redis.connect();
    }
    return this.redis;
  }

  /**
   * Ensure consumer group exists (idempotent).
   */
  private async ensureConsumerGroup(): Promise<void> {
    const redis = await this.getRedis();
    try {
      await redis.xGroupCreate(STREAM_KEY, CONSUMER_GROUP, '$', { MKSTREAM: true });
      logger.info('Redis Stream consumer group created', { group: CONSUMER_GROUP });
    } catch (err: any) {
      // BUSYGROUP means the group already exists — safe to ignore
      if (!err.message?.includes('BUSYGROUP')) {
        throw err;
      }
    }
  }

  /**
   * Publish risk update message to Redis Stream.
   */
  async publishRiskUpdate(
    address: string,
    score: number,
    tier: string,
    source: string = 'publisher',
  ): Promise<string> {
    const message: MessageEnvelope = {
      type: 'risk_update',
      payload: { address, score, tier },
      timestamp: Math.floor(Date.now() / 1000),
      source,
      message_id: randomUUID(),
      retry_count: 0,
    };

    const redis = await this.getRedis();
    const id = await redis.xAdd(STREAM_KEY, '*', { data: JSON.stringify(message) });

    logger.info('Message published to Redis Stream', {
      stream: STREAM_KEY,
      messageId: id,
      source,
      address,
      score,
      tier,
    });

    return id;
  }

  /**
   * Publish custom message to Redis Stream.
   */
  async publishCustom(
    messageType: string,
    payload: Record<string, any>,
    source: string = 'publisher',
  ): Promise<string> {
    const message: MessageEnvelope = {
      type: messageType,
      payload,
      timestamp: Math.floor(Date.now() / 1000),
      source,
      message_id: randomUUID(),
      retry_count: 0,
    };

    const redis = await this.getRedis();
    const id = await redis.xAdd(STREAM_KEY, '*', { data: JSON.stringify(message) });

    logger.info('Custom message published to Redis Stream', {
      stream: STREAM_KEY,
      messageId: id,
      type: messageType,
      source,
    });

    return id;
  }

  /**
   * Acknowledge a message (remove from pending list).
   */
  async acknowledgeMessage(streamId: string): Promise<boolean> {
    const redis = await this.getRedis();
    const result = await redis.xAck(STREAM_KEY, CONSUMER_GROUP, streamId);
    if (result > 0) {
      logger.debug('Message acknowledged', { streamId });
    }
    return result > 0;
  }

  /**
   * Send a message to the dead-letter queue.
   */
  async sendToDLQ(message: MessageEnvelope, reason: string): Promise<void> {
    const redis = await this.getRedis();
    const dlqEntry: DLQEntry = {
      message,
      reason,
      failed_at: Math.floor(Date.now() / 1000),
    };

    await redis.lPush(DLQ_KEY, JSON.stringify(dlqEntry));
    await redis.lTrim(DLQ_KEY, 0, 999);

    logger.warn('Message sent to DLQ', {
      messageId: message.message_id,
      reason,
      retryCount: message.retry_count || 0,
    });
  }

  /**
   * Get DLQ messages.
   */
  async getDLQMessages(limit: number = 100): Promise<DLQEntry[]> {
    const redis = await this.getRedis();
    const messages = await redis.lRange(DLQ_KEY, 0, limit - 1);
    const result: DLQEntry[] = [];

    for (const msgData of messages) {
      try {
        result.push(JSON.parse(msgData));
      } catch (e) {
        logger.error('Failed to parse DLQ message', { error: (e as Error).message });
      }
    }

    return result;
  }

  /**
   * Retry a DLQ message.
   */
  async retryDLQMessage(messageId: string): Promise<string | null> {
    const redis = await this.getRedis();
    const messages = await redis.lRange(DLQ_KEY, 0, -1);

    for (const msgData of messages) {
      try {
        const entry: DLQEntry = JSON.parse(msgData);
        if (entry.message.message_id === messageId) {
          await redis.lRem(DLQ_KEY, 0, msgData);

          const retryMessage: MessageEnvelope = {
            ...entry.message,
            retry_count: (entry.message.retry_count || 0) + 1,
            message_id: randomUUID(),
            timestamp: Math.floor(Date.now() / 1000),
          };

          const id = await redis.xAdd(STREAM_KEY, '*', { data: JSON.stringify(retryMessage) });

          logger.info('DLQ message retried', {
            originalMessageId: messageId,
            newMessageId: retryMessage.message_id,
          });

          return id;
        }
      } catch (e) {
        logger.error('Failed to retry DLQ message', { error: (e as Error).message });
      }
    }

    return null;
  }

  /**
   * Register a message handler.
   */
  onMessage(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
    logger.info('Message handler registered', { type });
  }

  /**
   * Start the stream subscriber (consumer group polling).
   */
  async startSubscriber(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    await this.ensureConsumerGroup();
    this.isRunning = true;

    // Poll Redis Streams every 1 second
    this.readInterval = setInterval(() => {
      this.pollStream().catch((error) => {
        logger.error('Stream poll error', { error: error.message });
      });
    }, 1000);

    logger.info('Redis Stream subscriber started', {
      stream: STREAM_KEY,
      group: CONSUMER_GROUP,
      consumer: CONSUMER_NAME,
    });
  }

  /**
   * Poll the stream for new messages.
   */
  private async pollStream(): Promise<void> {
    if (!this.isRunning) return;

    const redis = await this.getRedis();
    const messages = await redis.xReadGroup(
      CONSUMER_GROUP,
      CONSUMER_NAME,
      [{ key: STREAM_KEY, id: '>' }],
      { COUNT: 10, BLOCK: 500 }
    );

    if (!messages || messages.length === 0) return;

    for (const stream of messages) {
      for (const message of stream.messages) {
        await this.handleStreamMessage(message.id, message.message);
      }
    }
  }

  /**
   * Handle a single stream message.
   */
  private async handleStreamMessage(
    streamId: string,
    fields: Record<string, string>
  ): Promise<void> {
    let envelope: MessageEnvelope;

    try {
      const rawData = fields.data || fields.message || '';
      envelope = JSON.parse(rawData) as MessageEnvelope;
    } catch (e) {
      logger.error('Failed to parse stream message', { error: (e as Error).message, fields });
      // Acknowledge malformed message so it doesn't get redelivered
      await this.acknowledgeMessage(streamId);
      return;
    }

    logger.debug('Stream message received', {
      streamId,
      messageId: envelope.message_id,
      type: envelope.type,
      source: envelope.source,
    });

    const handlers = this.handlers.get(envelope.type) || [];

    for (const handler of handlers) {
      try {
        await handler(envelope);
        // Acknowledge on successful processing
        await this.acknowledgeMessage(streamId);
      } catch (error) {
        logger.error('Message handler failed', {
          streamId,
          messageId: envelope.message_id,
          error: (error as Error).message,
        });

        if ((envelope.retry_count || 0) >= MAX_RETRY_COUNT) {
          await this.sendToDLQ(envelope, (error as Error).message);
          await this.acknowledgeMessage(streamId);
        }
        // If retry count < MAX, don't ack — Redis will redeliver to another consumer
      }
    }

    // If no handlers registered, ack to prevent infinite redelivery
    if (handlers.length === 0) {
      await this.acknowledgeMessage(streamId);
    }
  }

  /**
   * Stop the stream subscriber.
   */
  async stopSubscriber(): Promise<void> {
    this.isRunning = false;

    if (this.readInterval) {
      clearInterval(this.readInterval);
      this.readInterval = null;
    }

    logger.info('Redis Stream subscriber stopped');
  }

  /**
   * Close the message queue.
   */
  async close(): Promise<void> {
    await this.stopSubscriber();

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }

    logger.info('Message queue closed');
  }
}

// Global singleton
let globalMessageQueue: MessageQueue | null = null;

export function getMessageQueue(): MessageQueue {
  if (!globalMessageQueue) {
    globalMessageQueue = new MessageQueue();
  }
  return globalMessageQueue;
}

export function resetMessageQueue(): void {
  globalMessageQueue = null;
}
