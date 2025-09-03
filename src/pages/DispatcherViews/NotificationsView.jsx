import React from 'react';
import { emergencyTypeMap } from '../../constants/dispatchConstants';

export default function NotificationsView({ notifications, viewOnMap, dismissNotification }) {
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <div className="notifications-container">
      <h2 className="view-title">Emergency Notifications</h2>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>No active emergency reports at the moment.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => {
            const { id, reporter, reporterContact, status, acknowledgedBy, date } = notification;
            const typeMeta = emergencyTypeMap[notification.type] || {
              color: '#ccc'
            };
            const statusLabel = status || 'Pending';

            return (
              <div
                key={id}
                className="notification-card"
                style={{ borderLeft: `6px solid ${typeMeta.color}` }}
              >
                {/* Close button */}
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

                {/* Header */}
                <h3 className="notification-header">
                  {id} - {statusLabel}
                  {acknowledgedBy ? ` (by ${acknowledgedBy})` : ''}
                </h3>

                {/* Reporter and Date */}
                <p><strong>Reporter:</strong> {reporter} ({reporterContact || 'N/A'})</p>
                <p><strong>Date:</strong> {formatDate(date)}</p>

                {/* Actions */}
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
