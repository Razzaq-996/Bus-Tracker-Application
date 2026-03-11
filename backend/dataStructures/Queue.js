/**
 * Queue Implementation for Notification Management
 * FIFO (First In First Out) data structure
 */

class Queue {
    constructor() {
        this.items = [];
        this.front = 0;
        this.rear = 0;
    }

    /**
     * Add element to the rear of queue
     * Time Complexity: O(1)
     */
    enqueue(element) {
        this.items[this.rear] = element;
        this.rear++;
        return this;
    }

    /**
     * Remove and return element from front of queue
     * Time Complexity: O(1) amortized
     */
    dequeue() {
        if (this.isEmpty()) {
            return null;
        }

        const item = this.items[this.front];
        delete this.items[this.front];
        this.front++;

        // Reset queue when it becomes empty to prevent memory leak
        if (this.front === this.rear) {
            this.items = [];
            this.front = 0;
            this.rear = 0;
        }

        return item;
    }

    /**
     * Get front element without removing
     * Time Complexity: O(1)
     */
    peek() {
        if (this.isEmpty()) {
            return null;
        }
        return this.items[this.front];
    }

    /**
     * Check if queue is empty
     * Time Complexity: O(1)
     */
    isEmpty() {
        return this.front === this.rear;
    }

    /**
     * Get queue size
     * Time Complexity: O(1)
     */
    size() {
        return this.rear - this.front;
    }

    /**
     * Clear all elements
     * Time Complexity: O(1)
     */
    clear() {
        this.items = [];
        this.front = 0;
        this.rear = 0;
    }

    /**
     * Get all elements as array (without removing)
     * Time Complexity: O(n)
     */
    toArray() {
        const result = [];
        for (let i = this.front; i < this.rear; i++) {
            result.push(this.items[i]);
        }
        return result;
    }

    /**
     * Filter queue elements
     * Time Complexity: O(n)
     */
    filter(predicate) {
        const filtered = new Queue();
        for (let i = this.front; i < this.rear; i++) {
            if (predicate(this.items[i])) {
                filtered.enqueue(this.items[i]);
            }
        }
        return filtered;
    }

    /**
     * Execute callback for each element
     * Time Complexity: O(n)
     */
    forEach(callback) {
        for (let i = this.front; i < this.rear; i++) {
            callback(this.items[i], i - this.front);
        }
    }
}

module.exports = Queue;
