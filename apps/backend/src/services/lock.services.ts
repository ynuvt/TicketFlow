import { redis } from '../lib/redis';
import crypto from 'crypto';

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

export class DistributedLockService {
  private fallbackMemoryLock: Set<string> = new Set();
  private fallbackIdempotency: Set<string> = new Set();

  public async acquireLock(key: string, ttlMs: number = 3000): Promise<{ acquired: boolean; lockValue: string }> {
    const lockKey = `lock:${key}`;
    const lockValue = crypto.randomUUID();

    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const result = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
        if (result === 'OK') {
          return { acquired: true, lockValue };
        }
      }
    } catch {
      // Memory fallback if Redis is unavailable locally
    }

    if (this.fallbackMemoryLock.has(lockKey)) {
      return { acquired: false, lockValue: '' };
    }
    this.fallbackMemoryLock.add(lockKey);
    setTimeout(() => this.fallbackMemoryLock.delete(lockKey), ttlMs);
    return { acquired: true, lockValue };
  }

  public async releaseLock(key: string, lockValue: string): Promise<void> {
    const lockKey = `lock:${key}`;
    try {
      if (redis.status === 'ready' && lockValue) {
        await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, lockValue);
        return;
      }
    } catch {
      // Memory fallback release
    }
    this.fallbackMemoryLock.delete(lockKey);
  }

  public async checkAndSetIdempotency(key: string, ttlSeconds: number = 60): Promise<boolean> {
    const idempotencyKey = `idempotency:${key}`;

    try {
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const result = await redis.set(idempotencyKey, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
      }
    } catch {
      // Memory fallback
    }

    if (this.fallbackIdempotency.has(idempotencyKey)) {
      return false;
    }
    this.fallbackIdempotency.add(idempotencyKey);
    setTimeout(() => this.fallbackIdempotency.delete(idempotencyKey), ttlSeconds * 1000);
    return true;
  }
}

export const distributedLockService = new DistributedLockService();
