/**
 * Notification Service
 * Manages notification queue and delivery using Queue data structure
 */

const { getInstance } = require('./database.service');
const Queue = require('../dataStructures/Queue');

class NotificationService {
    constructor() {
        this.db = getInstance();
        this.notificationQueue = new Queue();
        this.socketIO = null; // Will be set by server
    }

    /**
     * Set Socket.IO instance for real-time notifications
     */
    setSocketIO(io) {
        this.socketIO = io;
        console.log('🔔 Notification service connected to Socket.IO');
    }

    /**
     * Create and queue a notification
     * @param {number} userId - User ID
     * @param {string} type - Notification type
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     */
    createNotification(userId, type, title, message) {
        // Save to database
        const result = this.db.execute(
            `INSERT INTO notifications (user_id, type, title, message, is_read)
             VALUES (?, ?, ?, ?, 0)`,
            [userId, type, title, message]
        );

        const notification = {
            id: result.lastInsertRowid,
            userId,
            type,
            title,
            message,
            isRead: false,
            createdAt: new Date().toISOString()
        };

        // Add to queue for processing
        this.notificationQueue.enqueue(notification);

        // Process immediately
        this.processNotificationQueue();

        return notification;
    }

    /**
     * Create bulk notifications
     */
    createBulkNotifications(userIds, type, title, message) {
        const notifications = [];

        userIds.forEach(userId => {
            const notification = this.createNotification(userId, type, title, message);
            notifications.push(notification);
        });

        return notifications;
    }

    /**
     * Process notification queue and send via WebSocket
     */
    processNotificationQueue() {
        while (!this.notificationQueue.isEmpty()) {
            const notification = this.notificationQueue.dequeue();

            if (this.socketIO) {
                // Send to specific user via Socket.IO
                this.socketIO.to(`user-${notification.userId}`).emit('notification', {
                    id: notification.id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    createdAt: notification.createdAt
                });
            }
        }
    }

    /**
     * Get user notifications
     */
    getUserNotifications(userId, limit = 50, unreadOnly = false) {
        let query = `
            SELECT id, type, title, message, is_read, created_at
            FROM notifications
            WHERE user_id = ?
        `;

        if (unreadOnly) {
            query += ' AND is_read = 0';
        }

        query += ' ORDER BY created_at DESC LIMIT ?';

        return this.db.query(query, [userId, limit]);
    }

    /**
     * Mark notification as read
     */
    markAsRead(notificationId, userId) {
        this.db.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    }

    /**
     * Mark all notifications as read for a user
     */
    markAllAsRead(userId) {
        this.db.execute(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [userId]
        );
    }

    /**
     * Get unread notification count
     */
    getUnreadCount(userId) {
        const result = this.db.queryOne(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [userId]
        );
        return result.count;
    }

    /**
     * Delete notification
     */
    deleteNotification(notificationId, userId) {
        this.db.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [notificationId, userId]
        );
    }

    /**
     * Notify students about bus arrival
     */
    notifyBusArrival(stopId, eta) {
        // Get all students assigned to this stop
        const students = this.db.query(
            `SELECT DISTINCT u.id, u.full_name
             FROM users u
             JOIN student_stops ss ON u.id = ss.student_id
             WHERE ss.stop_id = ? AND u.role = 'student'`,
            [stopId]
        );

        const stop = this.db.queryOne('SELECT name FROM stops WHERE id = ?', [stopId]);

        students.forEach(student => {
            this.createNotification(
                student.id,
                'arrival',
                'Bus Approaching',
                `Bus will arrive at ${stop.name} in approximately ${eta} minutes.`
            );
        });
    }

    /**
     * Notify students about attendance lock
     */
    notifyAttendanceLock(stopId) {
        const students = this.db.query(
            `SELECT DISTINCT u.id, u.full_name
             FROM users u
             JOIN student_stops ss ON u.id = ss.student_id
             JOIN attendance a ON u.id = a.student_id AND ss.stop_id = a.stop_id
             WHERE ss.stop_id = ? AND a.status = 'absent' AND a.date = DATE('now')`,
            [stopId]
        );

        const stop = this.db.queryOne('SELECT name FROM stops WHERE id = ?', [stopId]);

        students.forEach(student => {
            this.createNotification(
                student.id,
                'lock',
                'Attendance Locked',
                `Attendance for ${stop.name} is now locked. You cannot confirm attendance anymore.`
            );
        });
    }

    /**
     * Notify all students on route about breakdown
     */
    notifyBreakdown(routeId, message) {
        const students = this.db.query(
            `SELECT DISTINCT u.id
             FROM users u
             JOIN student_stops ss ON u.id = ss.student_id
             JOIN stops s ON ss.stop_id = s.id
             WHERE s.route_id = ? AND u.role = 'student'`,
            [routeId]
        );

        students.forEach(student => {
            this.createNotification(
                student.id,
                'breakdown',
                'Bus Breakdown Alert',
                message || 'The bus has encountered a breakdown. Please wait for updates.'
            );
        });
    }

    /**
     * Notify all students on route about delay
     */
    notifyDelay(routeId, delayMinutes) {
        const students = this.db.query(
            `SELECT DISTINCT u.id
             FROM users u
             JOIN student_stops ss ON u.id = ss.student_id
             JOIN stops s ON ss.stop_id = s.id
             WHERE s.route_id = ? AND u.role = 'student'`,
            [routeId]
        );

        students.forEach(student => {
            this.createNotification(
                student.id,
                'delay',
                'Bus Delayed',
                `The bus is running ${delayMinutes} minutes late. Please adjust your schedule accordingly.`
            );
        });
    }
}

module.exports = new NotificationService();
