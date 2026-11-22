process.env.RISK_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000001';
process.env.FATF_RISK_REGISTRY_ADDRESS = process.env.RISK_REGISTRY_ADDRESS;
process.env.PUBLISHER_PRIVATE_KEY = '0x' + '11'.repeat(32);
const { MessageQueue } = require('../dist/src/message-queue');

function redisFake() {
  return {
    calls: [],
    async xGroupCreate(...args) { this.calls.push(['xGroupCreate', ...args]); },
    async xAck(...args) { this.calls.push(['xAck', ...args]); return 1; },
    async lPush(...args) { this.calls.push(['lPush', ...args]); return 1; },
    async lTrim(...args) { this.calls.push(['lTrim', ...args]); return true; },
  };
}

describe('message queue reliability contract', () => {
  it('uses the shared stream and reads backlog', async () => {
    const redis = redisFake();
    const queue = new MessageQueue();
    queue.redis = redis;
    await queue.ensureConsumerGroup();
    expect(redis.calls[0]).toEqual([
      'xGroupCreate', 'fides:stream:risk_updates', 'fides:cg:publisher', '0', { MKSTREAM: true },
    ]);
  });

  it('acks successful processing exactly once', async () => {
    const redis = redisFake();
    const queue = new MessageQueue();
    queue.redis = redis;
    queue.onMessage('risk_update', async () => {});
    await queue.handleStreamMessage('1-1', {
      data: JSON.stringify({ type: 'risk_update', payload: {}, message_id: 'm1' }),
    });
    expect(redis.calls.filter(([name]) => name === 'xAck')).toHaveLength(1);
  });

  it('sends exhausted failures to DLQ and acknowledges the original', async () => {
    const redis = redisFake();
    const queue = new MessageQueue();
    queue.redis = redis;
    queue.onMessage('risk_update', async () => { throw new Error('publish failed'); });
    await queue.handleStreamMessage('2-1', {
      data: JSON.stringify({ type: 'risk_update', payload: {}, message_id: 'm2', retry_count: 2 }),
    }, true);
    expect(redis.calls.some(([name]) => name === 'lPush')).toBe(true);
    expect(redis.calls.filter(([name]) => name === 'xAck')).toHaveLength(1);
  });

  it('serializes overlapping timer polls and records progress', async () => {
    const queue = new MessageQueue();
    queue.isRunning = true;
    queue.redis = { isOpen: true };
    queue.subscriberStartedAt = Date.now();
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    queue.pollStream = async () => {
      calls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 20));
      active--;
    };
    await Promise.all([
      queue.pollSerialized(), queue.pollSerialized(), queue.pollSerialized(),
    ]);
    expect(calls).toBe(1);
    expect(maxActive).toBe(1);
    expect(queue.lastPollSuccess).toBeGreaterThan(0);
    expect(queue.isHealthy()).toBe(true);
  });

  it('reports unhealthy when polling has stopped making progress', () => {
    const queue = new MessageQueue();
    queue.isRunning = true;
    queue.redis = { isOpen: true };
    queue.subscriberStartedAt = Date.now() - 20000;
    queue.lastPollSuccess = Date.now() - 20000;
    queue.lastPollError = 'stalled';
    expect(queue.isHealthy()).toBe(false);
  });
});
