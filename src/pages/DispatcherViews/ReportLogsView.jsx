import React, { useEffect, useState } from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';
import ViewModal from '../../components/ViewModal';
import CreateRescueModal, { emergencyTypeMap } from '../../components/CreateReportModal'; // Import emergencyTypeMap
import '../../components/modalstyles/ViewModalStyles.css';

function formatRespondingTeam(teamKey) {
  if (!teamKey) return 'N/A';
  if (teamKey.toLowerCase().startsWith('team ')) return teamKey;
  const team = teamKey.split('-')[0];
  if (!team) return teamKey;
  return `Team ${team.charAt(0).toUpperCase() + team.slice(1)}`;
}

function safeRender(field) {
  if (field === null || field === undefined) return 'N/A';
  if (typeof field === 'object') {
    if ('lat' in field && 'lng' in field) return `Lat: ${field.lat}, Lng: ${field.lng}`;
    return JSON.stringify(field);
  }
  return String(field);
}

export default function ReportLogsView({ reportLogs, setReportLogs, onUpdate }) {
  const { formatDateTime } = useFormatDate();
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (reportLogs.length === 0) {
      const testLog = {
        id: 'TEST-001',
        reportId: 'TEST-001',
        emergencyType: 'medical', // Add the new field to the test log
        emergencySeverity: 'critical',
        reporter: 'Test Reporter',
        contact: '09999999999',
        location: { lat: 14.59, lng: 120.98 },
        timestamp: new Date().toISOString(),
        respondingTeam: 'alpha-dayShift',
        status: 'dispatched'
      };
      setReportLogs([testLog]);
    }
  }, [reportLogs, setReportLogs]);

  // Sort reports by timestamp (most recent first) and filter active ones
  const activeReports = reportLogs
    .filter(
      (log) =>
        log.status === 'Pending' ||
        log.status === 'Acknowledged' ||
        log.status === 'In Progress'
    )
    .sort((a, b) => {
      try {
        // Ensure we have valid timestamps
        const timestampA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timestampB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timestampB - timestampA; // Most recent first
      } catch (error) {
        console.warn('Error sorting reports by timestamp:', error);
        return 0; // Keep original order if timestamp is invalid
      }
    });

  const handleView = (log) => {
    setSelectedReport(log);
    setViewModalOpen(true);
  };

  const handleEdit = (log) => {
    setSelectedReport(log);
    setEditModalOpen(true);
  };

  const closeViewModal = () => setViewModalOpen(false);
  const closeEditModal = () => setEditModalOpen(false);

return (
    <div className="card">
      <h2>Report Logs</h2>
      <div className="table-container">
        <table className="log-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Emergency Type</th>
              <th>Emergency Severity</th>
              <th>Reported By</th>
              <th>Responding Team</th>
              <th>Status</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeReports.length === 0 ? (
              <tr className="empty-row">
                <td colSpan="8">
                  <div className="empty-state">
                    <i className="fas fa-inbox" />
                    <p>No active reports</p>
                  </div>
                </td>
              </tr>
            ) : (
              activeReports.map((log, index) => (
                <tr key={`${log.id || log.reportId}-${index}`}>
                  <td>{log.reportId || log.id}</td>
                  <td>
                    <span
                      style={{
                        color: emergencyTypeMap[log.emergencyType]?.color || '#000',
                        fontWeight: 'bold',
                      }}
                    >
                      {emergencyTypeMap[log.emergencyType]?.label || log.emergencyType}
                    </span>
                  </td>
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
                  <td>{formatRespondingTeam(log.respondingTeam)}</td>
                  <td>
                    {(() => {
                      const statusKey = (log.status || '').toLowerCase();
                      const statusMeta = statusMap[statusKey];
                      return (
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: statusMeta?.color || '#ccc',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {statusMeta?.label || log.status || 'N/A'}
                        </span>
                      );
                    })()}
                  </td>
                  <td>{log.timestamp ? formatDateTime(log.timestamp) : 'N/A'}</td>
                  <td>
                    <button className="btn-action btn-view" onClick={() => handleView(log)}>
                      <i className="fas fa-eye" /> View
                    </button>
                    <button className="btn-action btn-edit" onClick={() => handleEdit(log)}>
                      <i className="fas fa-edit" /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ViewModal isOpen={viewModalOpen} onClose={closeViewModal} report={selectedReport} />
      <CreateRescueModal isOpen={editModalOpen} onClose={closeEditModal} reportToEdit={selectedReport} />
    </div>
  );
}