/**
 * Simple in-memory cache with TTL for Supabase queries
 * Reduces redundant database requests dramatically
 */

const cache = new Map();
const CACHE_TTL = {
  // Long-lived data (changes infrequently)
  PROJECTS: 5 * 60 * 1000, // 5 minutes
  EMPLOYEES: 5 * 60 * 1000, // 5 minutes
  PROFILES: 5 * 60 * 1000, // 5 minutes
  AGENCIES: 5 * 60 * 1000, // 5 minutes
  BRANDS: 5 * 60 * 1000, // 5 minutes
  USERS: 5 * 60 * 1000, // 5 minutes
  SETTINGS: 10 * 60 * 1000, // 10 minutes
  // Activity logs (changes more frequently)
  ACTIVITY_LOGS: 2 * 60 * 1000, // 2 minutes
  // Channels (use realtime, but cache initial load)
  CHANNELS: 1 * 60 * 1000, // 1 minute
  SECTIONS: 1 * 60 * 1000, // 1 minute
};

class CacheEntry {
  constructor(data, ttl) {
    this.data = data;
    this.expiresAt = Date.now() + ttl;
  }

  isValid() {
    return Date.now() < this.expiresAt;
  }
}

export const queryCache = {
  /**
   * Get cached data if valid
   */
  get(key) {
    const entry = cache.get(key);
    if (entry && entry.isValid()) {
      return entry.data;
    }
    if (entry) {
      // Expired, remove it
      cache.delete(key);
    }
    return null;
  },

  /**
   * Set cached data with TTL
   */
  set(key, data, ttl) {
    cache.set(key, new CacheEntry(data, ttl));
  },

  /**
   * Invalidate a specific cache key
   */
  invalidate(key) {
    cache.delete(key);
  },

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  },

  /**
   * Clear all cache
   */
  clear() {
    cache.clear();
  },

  /**
   * Get cache key for a query
   */
  getKey(table, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}:${params[k]}`)
      .join('|');
    return `${table}${paramStr ? `|${paramStr}` : ''}`;
  },

  /**
   * Get TTL for a table
   */
  getTTL(table) {
    return CACHE_TTL[table.toUpperCase()] || 1 * 60 * 1000; // Default 1 minute
  },
};

/**
 * Cache wrapper for async functions
 * Automatically handles caching with TTL
 */
export function withCache(fn, table, params = {}) {
  const cacheKey = queryCache.getKey(table, params);
  const ttl = queryCache.getTTL(table);

  return async (...args) => {
    // Check cache first
    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const data = await fn(...args);
    
    // Cache the result
    queryCache.set(cacheKey, data, ttl);
    
    return data;
  };
}

