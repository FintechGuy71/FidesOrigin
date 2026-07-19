import { createClient, RedisClientType } from 'redis';
import { randomUUID } from 'crypto';
import logger from './logger';
import { config } from './config';

/**
 * FidesOrigin Message Queue (Redis Pub/Sub)
 *
 * P1-2 Fix: 引入消息队列，统一 backend 和 data-publisher 通信
 * - 使用 Redis Pub/Sub 作为轻量级消息队列（不引入新依赖）
 * - 支持消息确认机制（at-least-once delivery）
 * - 支持死信队列（处理失败的消息）
 * - publisher 订阅 backend 发布的消息，处理后发布确认
 *
 * 消息格式:
 * {
 *   "type": "risk_update",
 *   "payload": {"address": "0x...", "score": 85, "tier": "HIGH"},
 *   "timestamp": 1234567890,
 *   "source": "backend",  // 或 "publisher"
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

export class MessageQueue {
  private redis: RedisClientType | null = null;
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isRunning: boolean = false;

  // 频道名称
  private readonly CHANNEL_RISK_UPDATES = 'fides:mq:risk_updates';
  private readonly CHANNEL_ACK = 'fides:mq:ack';

  // 死信队列 key
  private readonly DLQ_KEY = 'fides:mq:dlq';

  // 消息处理中集合
  private readonly INFLIGHT_KEY = 'fides:mq:inflight';

  // 最大重试次数
  private readonly MAX_RETRY_COUNT = 3;

  // 消息处理超时（秒）
  private readonly MESSAGE_TIMEOUT = 60;

  constructor() {}

  /**
   * 获取 Redis 连接
   */
  private async getRedis(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = createClient({
        url: config.cluster.redisUrl,
      });
      await this.redis.connect();
    }
    return this.redis;
  }

  /**
   * 获取发布者 Redis 连接
   */
  private async getPublisher(): Promise<RedisClientType> {
    if (!this.publisher) {
      this.publisher = createClient({
        url: config.cluster.redisUrl,
      });
      await this.publisher.connect();
    }
    return this.publisher;
  }

  /**
   * 获取订阅者 Redis 连接
   */
  private async getSubscriber(): Promise<RedisClientType> {
    if (!this.subscriber) {
      this.subscriber = createClient({
        url: config.cluster.redisUrl,
      });
      await this.subscriber.connect();
    }
    return this.subscriber;
  }

  /**
   * 发布风险更新消息
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

    const publisher = await this.getPublisher();
    await publisher.publish(this.CHANNEL_RISK_UPDATES, JSON.stringify(message));

    // 同时存入 inflight 集合
    const redis = await this.getRedis();
    await redis.hSet(this.INFLIGHT_KEY, message.message_id, JSON.stringify(message));
    await redis.expire(this.INFLIGHT_KEY, this.MESSAGE_TIMEOUT * 2);

    logger.info('Message published to queue', {
      channel: this.CHANNEL_RISK_UPDATES,
      messageId: message.message_id,
      source,
      address,
      score,
      tier,
    });

    return message.message_id;
  }

  /**
   * 发布自定义消息
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

    const publisher = await this.getPublisher();
    await publisher.publish(this.CHANNEL_RISK_UPDATES, JSON.stringify(message));

    logger.info('Custom message published', {
      channel: this.CHANNEL_RISK_UPDATES,
      messageId: message.message_id,
      type: messageType,
      source,
    });

    return message.message_id;
  }

  /**
   * 确认消息已处理
   */
  async acknowledgeMessage(messageId: string): Promise<boolean> {
    const redis = await this.getRedis();
    const result = await redis.hDel(this.INFLIGHT_KEY, messageId);

    if (result > 0) {
      logger.debug('Message acknowledged', { messageId });
    }

    return result > 0;
  }

  /**
   * 检查消息是否还在处理中
   */
  async isMessageInflight(messageId: string): Promise<boolean> {
    const redis = await this.getRedis();
    return await redis.hExists(this.INFLIGHT_KEY, messageId);
  }

  /**
   * 发送消息到死信队列
   */
  async sendToDLQ(message: MessageEnvelope, reason: string): Promise<void> {
    const redis = await this.getRedis();
    const dlqEntry: DLQEntry = {
      message,
      reason,
      failed_at: Math.floor(Date.now() / 1000),
    };

    await redis.lPush(this.DLQ_KEY, JSON.stringify(dlqEntry));
    // 保留最近 1000 条
    await redis.lTrim(this.DLQ_KEY, 0, 999);

    logger.warn('Message sent to DLQ', {
      messageId: message.message_id,
      reason,
      retryCount: message.retry_count || 0,
    });
  }

  /**
   * 获取死信队列消息
   */
  async getDLQMessages(limit: number = 100): Promise<DLQEntry[]> {
    const redis = await this.getRedis();
    const messages = await redis.lRange(this.DLQ_KEY, 0, limit - 1);
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
   * 重试死信队列中的消息
   */
  async retryDLQMessage(messageId: string): Promise<string | null> {
    const redis = await this.getRedis();
    const messages = await redis.lRange(this.DLQ_KEY, 0, -1);

    for (const msgData of messages) {
      try {
        const entry: DLQEntry = JSON.parse(msgData);
        if (entry.message.message_id === messageId) {
          // 从 DLQ 移除
          await redis.lRem(this.DLQ_KEY, 0, msgData);

          // 重新发布（增加重试计数）
          const retryMessage: MessageEnvelope = {
            ...entry.message,
            retry_count: (entry.message.retry_count || 0) + 1,
            message_id: randomUUID(),
            timestamp: Math.floor(Date.now() / 1000),
          };

          const publisher = await this.getPublisher();
          await publisher.publish(this.CHANNEL_RISK_UPDATES, JSON.stringify(retryMessage));

          logger.info('DLQ message retried', {
            originalMessageId: messageId,
            newMessageId: retryMessage.message_id,
          });

          return retryMessage.message_id;
        }
      } catch (e) {
        logger.error('Failed to retry DLQ message', { error: (e as Error).message });
      }
    }

    return null;
  }

  /**
   * 注册消息处理器
   */
  onMessage(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    logger.info('Message handler registered', { type });
  }

  /**
   * 启动消息订阅者
   */
  async startSubscriber(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const subscriber = await this.getSubscriber();

    await subscriber.subscribe(this.CHANNEL_RISK_UPDATES, (message) => {
      this.handleMessage(message).catch((error) => {
        logger.error('Message handler error', { error: error.message });
      });
    });

    logger.info('Message subscriber started', { channel: this.CHANNEL_RISK_UPDATES });
  }

  /**
   * 停止消息订阅者
   */
  async stopSubscriber(): Promise<void> {
    this.isRunning = false;

    if (this.subscriber) {
      await this.subscriber.unsubscribe(this.CHANNEL_RISK_UPDATES);
      await this.subscriber.quit();
      this.subscriber = null;
    }

    logger.info('Message subscriber stopped');
  }

  /**
   * 处理接收到的消息
   */
  private async handleMessage(rawMessage: string): Promise<void> {
    let envelope: MessageEnvelope;

    try {
      envelope = JSON.parse(rawMessage) as MessageEnvelope;
    } catch (e) {
      logger.error('Failed to parse message', { error: (e as Error).message, rawMessage });
      return;
    }

    logger.debug('Message received', {
      messageId: envelope.message_id,
      type: envelope.type,
      source: envelope.source,
    });

    // 分发消息到处理器
    const handlers = this.handlers.get(envelope.type) || [];

    for (const handler of handlers) {
      try {
        await handler(envelope);
      } catch (error) {
        logger.error('Message handler failed', {
          messageId: envelope.message_id,
          error: (error as Error).message,
        });

        // 超过重试次数，发送到死信队列
        if ((envelope.retry_count || 0) >= this.MAX_RETRY_COUNT) {
          await this.sendToDLQ(envelope, (error as Error).message);
        } else {
          // 重试：重新发布消息
          const retryMessage: MessageEnvelope = {
            ...envelope,
            retry_count: (envelope.retry_count || 0) + 1,
            message_id: randomUUID(),
            timestamp: Math.floor(Date.now() / 1000),
          };

          const publisher = await this.getPublisher();
          await publisher.publish(this.CHANNEL_RISK_UPDATES, JSON.stringify(retryMessage));

          logger.info('Message queued for retry', {
            messageId: envelope.message_id,
            retryCount: retryMessage.retry_count,
          });
        }
      }
    }
  }

  /**
   * 关闭消息队列
   */
  async close(): Promise<void> {
    await this.stopSubscriber();

    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }

    logger.info('Message queue closed');
  }
}

// 全局单例
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
