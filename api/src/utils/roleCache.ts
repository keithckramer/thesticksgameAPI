import type { Role } from '../types/roles';

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

type CacheEntry = {
  role: Role;
  expiresAt: number;
};

export class RoleCache {
  private readonly ttlMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(ttlMs: number = TEN_MINUTES_IN_MS) {
    this.ttlMs = ttlMs;
  }

  get(userId: string): Role | undefined {
    const entry = this.cache.get(userId);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(userId);
      return undefined;
    }

    return entry.role;
  }

  set(userId: string, role: Role): void {
    this.cache.set(userId, {
      role,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const roleCache = new RoleCache();

export default roleCache;
