import React, { useEffect } from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';

export default function ReportLogsView({ reportLogs, setReportLogs }) {
  const {formatDateTime}  = useFormatDate();  // <-- destructure here

  useEffect(() => {
    if (reportLogs.length === 0) {
      const testLog = {
        id: 'TEST-001',
        reportId: 'TEST-001',   // Added for consistent display
        emergencySeverity: 'critical',
        reporter: 'Test Reporter',
        contact: '09999999999',
        location: 'Test Location',
        timestamp: new Date().toISOString(),
        respondingTeam: 'Team Alpha',
        status: 'dispatched'
      };
      setReportLogs([testLog]);
    }
  }, [reportLogs, setReportLogs]);

  return (
    <div className="card">
      <h2>Report Logs</h2>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reportLogs.length === 0 ? (
              <tr className="empty-row">
                <td colSpan="7">
                  <div className="empty-state">
                    <i className="fas fa-inbox" />
                    <p>No reports available</p>
                  </div>
                </td>
              </tr>
            ) : (
              reportLogs.map((log) => (
                <tr key={log.id}>
                  <td>{log.reportId || log.id}</td>
                  <td>
                    <span
                      className="emergency-tag"
                      style={{
                        backgroundColor: emergencySeverityMap[log.emergencySeverity]?.color || '#ccc',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {emergencySeverityMap[log.emergencySeverity]?.label || log.emergencySeverity}
                    </span>
                  </td>
                  <td>
                    {log.reporter} <br />
                    <small>{log.contact}</small>
                  </td>
                  <td>{log.respondingTeam}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: statusMap[log.status]?.color || '#ccc',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {statusMap[log.status]?.label || log.status}
                    </span>
                  </td>
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>
                    <button className="btn-action" disabled>
                      <i className="fas fa-check" /> Done
                    </button>
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
