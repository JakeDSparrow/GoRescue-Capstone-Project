import React, { useState } from 'react';
import { emergencyTypeMap } from '../../constants/dispatchConstants';

export default function NotificationsView({ notifications, viewOnMap, dismissNotification }) {
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const toLower = (v) => (typeof v === 'string' ? v.toLowerCase() : '');
  const isCompleted = (n) => {
    const s = toLower(n.status);
    const t = toLower(n.type);
    return s === 'completed' || s === 'resolved' || t === 'completion' || t === 'completed';
  };
  const incomingNotifications = (notifications || []).filter((n) => !isCompleted(n));
  const completedNotifications = (notifications || []).filter(isCompleted);
  const [filter, setFilter] = useState('all'); // all | incoming | completed

  const filtered =
    filter === 'incoming' ? incomingNotifications :
    filter === 'completed' ? completedNotifications :
    (notifications || []);

  return (
    <div className="notifications-container">
      <h2 className="view-title">Emergency Notifications</h2>

      {/* Filters */}
      <div className="filter-buttons" style={{ marginTop: 4 }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All ({(notifications || []).length})
        </button>
        <button className={filter === 'incoming' ? 'active' : ''} onClick={() => setFilter('incoming')}>
          From Mobile ({incomingNotifications.length})
        </button>
        <button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>
          Completed ({completedNotifications.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No notifications to display.</p>
        </div>
      ) : (
        <div className="notification-list">
          {filtered.map((notification) => {
            const { id, reporter, reporterContact, status, date } = notification;
            const typeMeta = emergencyTypeMap[notification.type] || { color: '#ccc' };
            const statusLabel = status || (isCompleted(notification) ? 'Completed' : 'Pending');

            return (
              <div
                key={id}
                className="notification-card"
                style={{ borderLeft: `6px solid ${typeMeta.color}` }}
              >
                <button
                  onClick={() => dismissNotification && dismissNotification(id)}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '16px',
                  }}
                >
                  ×
                </button>

                <h3 className="notification-header">
                  {id} - {statusLabel}
                </h3>
                <p><strong>Reporter:</strong> {reporter} ({reporterContact || 'N/A'})</p>
                <p><strong>Date:</strong> {formatDate(date)}</p>
                <div className="notification-actions">
                  <button
                    className="btn map"
                    onClick={() => viewOnMap(notification.location)}
                  >
                    <i className="fas fa-map-marker-alt" /> View on Map
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
