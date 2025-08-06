import React, {useEffect} from 'react';

import { emergencyTypeMap, statusMap } from '../../constants/dispatchConstants';

export default function ReportLogsView({ reportLogs, setReportLogs, formatDateTime }) {

  useEffect(() => {
    if (reportLogs.length === 0) {
      const testLog = {
        id: 'TEST-001',
        emergencyType: 'medical',
        reporter: 'Test Reporter',
        contact: '09999999999',
        location: 'Test Location',
        timestamp: new Date().toISOString(),
        respondingTeam: 'Team Alpha',
        status: 'dispatched'
      };
      setReportLogs([testLog]);
    }
  }, []);

  return (
    <div className="card">
      <h2>Report Logs</h2>
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
                  <td>{formatDateTime(log.timestamp)}</td>
                  <td>
                    <button className="btn-action" disabled>
                      <i className="fas fa-check" /> Done
                    </button>
                    {/* Replace above with logic when you're ready to allow completion */}
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
