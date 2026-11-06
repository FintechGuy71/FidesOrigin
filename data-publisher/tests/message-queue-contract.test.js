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
});
