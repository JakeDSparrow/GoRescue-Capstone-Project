import React from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';

export default function IncidentHistoryView({ reportLogs }) {
  const {formatDateTime} = useFormatDate();  // <-- call the hook here

  return (
    <div className="card">
      <h2>Incident History</h2>
      <div className="table-container">
        <table className="log-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Emergency Severity</th>
              <th>Reported By</th>
              <th>Responding Team</th>
              <th>Status</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {reportLogs.length === 0 ? (
              <tr className="empty-row">
                <td colSpan="6">
                  <div className="empty-state">
                    <i className="fas fa-history"></i>
                    <p>No incident records yet</p>
                  </div>
                </td>
              </tr>
            ) : (
              reportLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.reportId || log.id}</td><td>
                    <span
                      className="emergency-tag"
                      style={{
                        backgroundColor:
                          emergencySeverityMap[log.emergencySeverity.toLowerCase()]?.color || '#ccc',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {emergencySeverityMap[log.emergencySeverity.toLowerCase()]?.label.toUpperCase() ||
                        log.emergencySeverity.toUpperCase()}
                    </span>
                  </td><td>
                    {log.reporterName || log.reporter} <br />
                    <small>{log.contactNumber || log.contact}</small>
                  </td><td>{log.respondingTeam}</td><td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusMap[log.status.toLowerCase()]?.color || '#ccc',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {statusMap[log.status.toLowerCase()]?.label.toUpperCase() || log.status.toUpperCase()}
                    </span>
                  </td><td>{formatDateTime(log.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
