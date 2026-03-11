/**
 * HashMap Implementation for O(1) User/Bus Lookups
 * Uses JavaScript Map with additional utility methods
 */

class HashMap {
    constructor() {
        this.map = new Map();
        this.size = 0;
    }

    /**
     * Insert or update a key-value pair
     * Time Complexity: O(1)
     */
    set(key, value) {
        const hadKey = this.map.has(key);
        this.map.set(key, value);
        if (!hadKey) {
            this.size++;
        }
        return this;
    }

    /**
     * Get value by key
     * Time Complexity: O(1)
     */
    get(key) {
        return this.map.get(key);
    }

    /**
     * Check if key exists
     * Time Complexity: O(1)
     */
    has(key) {
        return this.map.has(key);
    }

    /**
     * Delete a key-value pair
     * Time Complexity: O(1)
     */
    delete(key) {
        const deleted = this.map.delete(key);
        if (deleted) {
            this.size--;
        }
        return deleted;
    }

    /**
     * Clear all entries
     * Time Complexity: O(1)
     */
    clear() {
        this.map.clear();
        this.size = 0;
    }

    /**
     * Get all keys
     * Time Complexity: O(n)
     */
    keys() {
        return Array.from(this.map.keys());
    }

    /**
     * Get all values
     * Time Complexity: O(n)
     */
    values() {
        return Array.from(this.map.values());
    }

    /**
     * Get all entries as array of [key, value]
     * Time Complexity: O(n)
     */
    entries() {
        return Array.from(this.map.entries());
    }

    /**
     * Filter entries based on predicate
     * Time Complexity: O(n)
     */
    filter(predicate) {
        const result = new HashMap();
        for (const [key, value] of this.map.entries()) {
            if (predicate(value, key)) {
                result.set(key, value);
            }
        }
        return result;
    }

    /**
     * Find first entry matching predicate
     * Time Complexity: O(n)
     */
    find(predicate) {
        for (const [key, value] of this.map.entries()) {
            if (predicate(value, key)) {
                return value;
            }
        }
        return undefined;
    }

    /**
     * Execute callback for each entry
     * Time Complexity: O(n)
     */
    forEach(callback) {
        this.map.forEach((value, key) => callback(value, key));
    }

    /**
     * Convert to plain object
     * Time Complexity: O(n)
     */
    toObject() {
        const obj = {};
        for (const [key, value] of this.map.entries()) {
            obj[key] = value;
        }
        return obj;
    }

    /**
     * Get current size
     * Time Complexity: O(1)
     */
    getSize() {
        return this.size;
    }

    /**
     * Check if empty
     * Time Complexity: O(1)
     */
    isEmpty() {
        return this.size === 0;
    }
}

module.exports = HashMap;
