import React from 'react';
import { emergencyTypeMap, statusMap } from '../../constants/dispatchConstants';

export default function IncidentHistoryView({ reportLogs }) {
  return (
    <div className="card">
      <h2>Incident History</h2>
      <div className="table-container">
        <table className="log-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Emergency Type</th>
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
                  <td>{log.id}</td>
                  <td>
                    <span className="emergency-tag" style={{
                      backgroundColor: emergencyTypeMap[log.emergencyType]?.color || '#ccc',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {emergencyTypeMap[log.emergencyType]?.label || log.emergencyType}
                    </span>
                  </td>
                  <td>{log.reporter} <br /><small>{log.contact}</small></td>
                  <td>{log.respondingTeam}</td>
                  <td>
                    <span className="status-badge" style={{
                      backgroundColor: statusMap[log.status]?.color || '#ccc',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {statusMap[log.status]?.label || log.status}
                    </span>
                  </td>
                  <td>
                    {new Date(log.timestamp).toLocaleString('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
