/**
 * Graph Implementation for Bus Routes (Adjacency List)
 * Vertices: Bus Stops
 * Edges: Routes with weights (distance/time)
 */

class Graph {
    constructor() {
        // Adjacency list: Map<stopId, Array<{stopId, weight}>>
        this.adjacencyList = new Map();
        this.stops = new Map(); // stopId -> stop data
    }

    /**
     * Add a stop (vertex) to the graph
     * Time Complexity: O(1)
     */
    addStop(stopId, stopData) {
        if (!this.adjacencyList.has(stopId)) {
            this.adjacencyList.set(stopId, []);
            this.stops.set(stopId, stopData);
        }
    }

    /**
     * Add a route (edge) between two stops
     * Time Complexity: O(1)
     * @param {number} fromStopId - Source stop
     * @param {number} toStopId - Destination stop
     * @param {number} weight - Distance or time between stops
     * @param {boolean} bidirectional - If true, add edge in both directions
     */
    addRoute(fromStopId, toStopId, weight, bidirectional = false) {
        // Ensure both stops exist
        if (!this.adjacencyList.has(fromStopId)) {
            this.addStop(fromStopId, {});
        }
        if (!this.adjacencyList.has(toStopId)) {
            this.addStop(toStopId, {});
        }

        // Add edge from -> to
        this.adjacencyList.get(fromStopId).push({ stopId: toStopId, weight });

        // Add reverse edge if bidirectional
        if (bidirectional) {
            this.adjacencyList.get(toStopId).push({ stopId: fromStopId, weight });
        }
    }

    /**
     * Get all neighbors of a stop
     * Time Complexity: O(1)
     */
    getNeighbors(stopId) {
        return this.adjacencyList.get(stopId) || [];
    }

    /**
     * Get stop data
     * Time Complexity: O(1)
     */
    getStop(stopId) {
        return this.stops.get(stopId);
    }

    /**
     * Calculate shortest path using Dijkstra's Algorithm
     * Time Complexity: O((V + E) log V) with priority queue
     * @param {number} startStopId - Starting stop
     * @param {number} endStopId - Destination stop
     * @returns {Object} - { distance, path }
     */
    dijkstra(startStopId, endStopId) {
        const distances = new Map();
        const previous = new Map();
        const visited = new Set();
        const pq = new MinPriorityQueue();

        // Initialize distances
        for (const stopId of this.adjacencyList.keys()) {
            distances.set(stopId, Infinity);
        }
        distances.set(startStopId, 0);

        // Add start node to priority queue
        pq.enqueue(startStopId, 0);

        while (!pq.isEmpty()) {
            const { element: currentStopId } = pq.dequeue();

            // Skip if already visited
            if (visited.has(currentStopId)) continue;
            visited.add(currentStopId);

            // Found destination
            if (currentStopId === endStopId) break;

            // Check all neighbors
            const neighbors = this.getNeighbors(currentStopId);
            for (const { stopId: neighborId, weight } of neighbors) {
                if (visited.has(neighborId)) continue;

                const newDistance = distances.get(currentStopId) + weight;

                if (newDistance < distances.get(neighborId)) {
                    distances.set(neighborId, newDistance);
                    previous.set(neighborId, currentStopId);
                    pq.enqueue(neighborId, newDistance);
                }
            }
        }

        // Reconstruct path
        const path = [];
        let current = endStopId;
        while (current !== undefined) {
            path.unshift(current);
            current = previous.get(current);
        }

        return {
            distance: distances.get(endStopId),
            path: path.length > 1 ? path : []
        };
    }

    /**
     * Calculate ETA from current position to target stop
     * @param {Object} currentLocation - { lat, lng }
     * @param {number} targetStopId - Target stop ID
     * @param {number} avgSpeed - Average speed in km/h (default: 30)
     * @returns {number} - ETA in minutes
     */
    calculateETA(currentLocation, targetStopId, avgSpeed = 30) {
        // Find nearest stop to current location
        const nearestStopId = this.findNearestStop(currentLocation);

        if (!nearestStopId) return Infinity;

        // Calculate distance from current location to nearest stop
        const nearestStop = this.getStop(nearestStopId);
        const distanceToNearestStop = this.haversineDistance(
            currentLocation.lat,
            currentLocation.lng,
            nearestStop.latitude,
            nearestStop.longitude
        );

        // Calculate shortest path from nearest stop to target
        const { distance: pathDistance } = this.dijkstra(nearestStopId, targetStopId);

        if (pathDistance === Infinity) return Infinity;

        // Total distance in km
        const totalDistance = distanceToNearestStop + pathDistance;

        // ETA in minutes
        const etaMinutes = (totalDistance / avgSpeed) * 60;

        return Math.round(etaMinutes);
    }

    /**
     * Find nearest stop to given coordinates
     * Time Complexity: O(n) where n is number of stops
     */
    findNearestStop(location) {
        let minDistance = Infinity;
        let nearestStopId = null;

        for (const [stopId, stop] of this.stops.entries()) {
            const distance = this.haversineDistance(
                location.lat,
                location.lng,
                stop.latitude,
                stop.longitude
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestStopId = stopId;
            }
        }

        return nearestStopId;
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @returns {number} - Distance in kilometers
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) *
            Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get all stops in the graph
     */
    getAllStops() {
        return Array.from(this.stops.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    /**
     * Clear the graph
     */
    clear() {
        this.adjacencyList.clear();
        this.stops.clear();
    }
}

/**
 * Min Priority Queue for Dijkstra's Algorithm
 */
class MinPriorityQueue {
    constructor() {
        this.heap = [];
    }

    enqueue(element, priority) {
        this.heap.push({ element, priority });
        this.bubbleUp(this.heap.length - 1);
    }

    dequeue() {
        if (this.isEmpty()) return null;

        const min = this.heap[0];
        const last = this.heap.pop();

        if (this.heap.length > 0) {
            this.heap[0] = last;
            this.bubbleDown(0);
        }

        return min;
    }

    bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.heap[index].priority >= this.heap[parentIndex].priority) break;

            [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
            index = parentIndex;
        }
    }

    bubbleDown(index) {
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let smallest = index;

            if (leftChild < this.heap.length &&
                this.heap[leftChild].priority < this.heap[smallest].priority) {
                smallest = leftChild;
            }

            if (rightChild < this.heap.length &&
                this.heap[rightChild].priority < this.heap[smallest].priority) {
                smallest = rightChild;
            }

            if (smallest === index) break;

            [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
            index = smallest;
        }
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    size() {
        return this.heap.length;
    }
}

module.exports = Graph;
