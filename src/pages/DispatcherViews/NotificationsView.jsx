import React from 'react';
import { emergencyTypeMap, statusMap } from '../../constants/dispatchConstants';

export default function NotificationsView({
  notifications,
  dispatchTeam,
  dispatchAllResponders,
  viewOnMap
}) {

  return (
    <div className="notifications-container">
      <h2 className="view-title">Emergency Notifications</h2>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <p>No active emergency reports at the moment.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map(notification => {
            const typeMeta = emergencyTypeMap[notification.type] || {};
            const statusMeta = statusMap[notification.status] || {};

            return (
              <div
                key={notification.id}
                className="notification-card"
                style={{ borderLeft: `6px solid ${typeMeta.color || '#ccc'}` }}
              >
                <h3 className="notification-header">
                  <i className={`fas ${typeMeta.icon}`} style={{ color: typeMeta.color, marginRight: '8px' }} />
                  {typeMeta.label || notification.type} – {notification.location}

                  {notification.status && (
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusMeta.color,
                        color: '#fff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        marginLeft: '10px'
                      }}
                    >
                      {statusMeta.label}
                    </span>
                  )}
                </h3>

                <p><strong>Reporter:</strong> {notification.reporter} ({notification.reporterContact})</p>
                <p><strong>Details:</strong> {notification.details}</p>

                <div className="notification-actions">
                  <button className="btn map" onClick={() => viewOnMap(notification.coordinates)}>
                    <i className="fas fa-map-marker-alt" /> View on Map
                  </button>
                  <button className="btn all" onClick={() => dispatchAllResponders(notification.id)}>
                    <i className="fas fa-broadcast-tower" /> Dispatch All
                  </button>
                  <button className="btn alpha" onClick={() => dispatchTeam(notification.id, 'alpha')}>
                    <i className="fas fa-users" /> Team Alpha
                  </button>
                  <button className="btn bravo" onClick={() => dispatchTeam(notification.id, 'bravo')}>
                    <i className="fas fa-users" /> Team Bravo
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
