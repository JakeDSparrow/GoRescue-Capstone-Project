import React, { useEffect, useState } from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';
import ViewModal from '../../components/ViewModal';
import CreateRescueModal from '../../components/CreateReportModal';
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
              reportLogs.map((log, index) => (
                <tr key={`${log.id || log.reportId}-${index}`}>
                  <td>{safeRender(log.reportId || log.id)}</td>
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
                      {safeRender(emergencySeverityMap[log.emergencySeverity]?.label || log.emergencySeverity)}
                    </span>
                  </td>
                  <td>
                    {safeRender(log.reporter)} <br />
                    <small>{safeRender(log.contact)}</small>
                  </td>
                  <td>{formatRespondingTeam(log.respondingTeam)}</td>
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
                      {safeRender(statusMap[log.status]?.label || log.status)}
                    </span>
                  </td>
                  <td>{safeRender(log.timestamp ? formatDateTime(log.timestamp) : null)}</td>
                  <td>
                    <button
                      className="btn-action btn-view"
                      onClick={() => handleView(log)}
                      title="View Details"
                    >
                      <i className="fas fa-eye" /> View
                    </button>
                    <button
                      className="btn-action btn-edit"
                      onClick={() => handleEdit(log)}
                      title="Edit Report"
                    >
                      <i className="fas fa-edit" /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <ViewModal isOpen={viewModalOpen} onClose={closeViewModal} report={selectedReport} />
      <CreateRescueModal
        isOpen={editModalOpen}
        onClose={closeEditModal}
        reportToEdit={selectedReport} // prefill logic inside CreateRescueModal
      />
    </div>
  );
}
