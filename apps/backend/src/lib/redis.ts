import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection warning (falling back to memory if unavailable):', err.message);
});
