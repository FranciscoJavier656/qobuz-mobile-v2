class CacheManager {
    private cache: Map<string, { data: any; expiry: number }>;

    constructor() {
        this.cache = new Map();
    }

    set(key: string, data: any, ttl: number) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { data, expiry });
    }

    get(key: string) {
        const cached = this.cache.get(key);
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }
        this.cache.delete(key); // Remove expired cache
        return null;
    }

    clear() {
        this.cache.clear();
    }

    delete(key: string) {
        this.cache.delete(key);
    }
}

export default CacheManager;