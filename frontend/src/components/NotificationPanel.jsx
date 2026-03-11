/**
 * Notification Panel Component
 * Displays user notifications in a slide-out panel
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import './NotificationPanel.css';

function NotificationPanel({ onClose }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await axios.get('/api/student/notifications?limit=20');
            setNotifications(response.data.data.notifications);
            setUnreadCount(response.data.data.unreadCount);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await axios.put(`/api/student/notifications/${notificationId}/read`);

            // Update local state
            setNotifications(notifications.map(n =>
                n.id === notificationId ? { ...n, is_read: 1 } : n
            ));
            setUnreadCount(Math.max(0, unreadCount - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'arrival': return '🚌';
            case 'lock': return '🔒';
            case 'breakdown': return '⚠️';
            case 'delay': return '⏰';
            default: return '📢';
        }
    };

    const getNotificationColor = (type) => {
        switch (type) {
            case 'arrival': return 'info';
            case 'lock': return 'warning';
            case 'breakdown': return 'error';
            case 'delay': return 'warning';
            default: return 'info';
        }
    };

    return (
        <div className="notification-panel-overlay" onClick={onClose}>
            <div className="notification-panel slide-in" onClick={(e) => e.stopPropagation()}>
                <div className="panel-header">
                    <h2 className="panel-title">
                        <span>🔔</span>
                        Notifications
                        {unreadCount > 0 && (
                            <span className="unread-badge">{unreadCount}</span>
                        )}
                    </h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="panel-content">
                    {loading ? (
                        <div className="panel-loading">
                            <div className="spin">⏳</div>
                            <p>Loading notifications...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="panel-empty">
                            <div className="empty-icon">📭</div>
                            <p>No notifications yet</p>
                        </div>
                    ) : (
                        <div className="notifications-list">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                                    onClick={() => !notification.is_read && markAsRead(notification.id)}
                                >
                                    <div className={`notification-icon ${getNotificationColor(notification.type)}`}>
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="notification-content">
                                        <h4 className="notification-title">{notification.title}</h4>
                                        <p className="notification-message">{notification.message}</p>
                                        <span className="notification-time">
                                            {new Date(notification.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    {!notification.is_read && (
                                        <div className="notification-dot"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default NotificationPanel;
