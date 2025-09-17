import React, { useEffect, useState } from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import ViewModal from '../../components/ViewModal';
import CreateRescueModal, { emergencyTypeMap } from '../../components/CreateReportModal';
import '../../components/modalstyles/ViewModalStyles.css';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

function formatRespondingTeam(teamKey) {
  if (!teamKey) return 'N/A';
  if (teamKey.toLowerCase().startsWith('team ')) return teamKey;
  const team = teamKey.split('-')[0];
  if (!team) return teamKey;
  return `Team ${team.charAt(0).toUpperCase() + team.slice(1)}`;
}

function parseFirestoreDate(timestamp) {
  if (!timestamp) return null;
  
  try {
    // Firebase Timestamp object
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Already a Date object
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? null : timestamp;
    }
    
    // String timestamp (ISO format)
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Unix timestamp (number)
    if (typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    return null;
  } catch (error) {
    console.warn('Error parsing timestamp:', timestamp, error);
    return null;
  }
}

export default function ReportLogsView({ onUpdate }) {
  const [reportLogs, setReportLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Fetch data directly from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "incidents")),
      (snapshot) => {
        const incidents = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          incidents.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
            acknowledgedAt: data.acknowledgedAt?.toDate() || null,
            completedAt: data.completedAt?.toDate() || null,
          });
        });
        setReportLogs(incidents);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching incidents:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter and sort active reports
const activeReports = React.useMemo(() => {
  return reportLogs
    .filter((log) => {
      if (!log) return false;
      // Normalize status to handle case variations
      const status = (log.status || '').trim().toLowerCase();
      const activeStatuses = ['pending', 'acknowledged', 'in progress', 'partially complete', 'completed'];
      return !log.status || activeStatuses.includes(status);
    })
    .sort((a, b) => {
      try {
        const dateA = parseFirestoreDate(a.timestamp);
        const dateB = parseFirestoreDate(b.timestamp);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeB - timeA; // Most recent first
      } catch (error) {
        console.warn('Error sorting reports by timestamp:', error);
        return 0;
      }
    });
}, [reportLogs]);

  // Debug logging - remove in production
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('=== REPORT LOGS DEBUG ===');
      console.log('Total logs:', reportLogs.length);
      console.log('Active reports after filtering:', activeReports.length);
      console.log('Raw reportLogs data:', reportLogs);
      reportLogs.forEach((log, index) => {
        console.log(`Report ${index}:`, {
          id: log.id || log.reportId,
          status: log.status,
          statusType: typeof log.status,
          timestamp: log.timestamp,
          timestampType: typeof log.timestamp,
          isFirebaseTimestamp: log.timestamp?.toDate ? true : false,
          willShow: log.status ? ['Pending', 'Acknowledged', 'In Progress', 'Partially Complete', 'Completed'].includes(log.status) : 'No status field',
          acknowledgedAt: log.acknowledgedAt,
          completedAt: log.completedAt
        });
      });
    }
  }, [reportLogs, activeReports]);

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

  if (loading) {
    return (
      <div className="card">
        <h2>Report Logs</h2>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeReports.length === 0 ? (
              <tr className="empty-row">
                <td colSpan="7">
                  <div className="empty-state">
                    <i className="fas fa-inbox" />
                    <p>No reports found</p>
                    <small>Total reports in system: {reportLogs.length}</small>
                    {process.env.NODE_ENV === 'development' && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                        <p>Debug Info:</p>
                        <p>• reportLogs type: {typeof reportLogs}</p>
                        <p>• reportLogs length: {reportLogs?.length || 0}</p>
                        <p>• First report status: {reportLogs?.[0]?.status || 'undefined'}</p>
                        <p>• Check console for detailed logs</p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              activeReports.map((log, index) => (
                <tr key={`${log.id || log.reportId}-${index}`}>
                  <td>{log.reportId || log.id || 'N/A'}</td>
                  <td>
                    <span
                      style={{
                        color: (emergencyTypeMap && emergencyTypeMap[log.emergencyType]?.color) || '#000',
                        fontWeight: 'bold',
                      }}
                    >
                      {(emergencyTypeMap && emergencyTypeMap[log.emergencyType]?.label) || log.emergencyType || 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span
                      className="emergency-tag"
                      style={{
                        backgroundColor: (emergencySeverityMap && emergencySeverityMap[log.emergencySeverity]?.color) || '#ccc',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {(emergencySeverityMap && emergencySeverityMap[log.emergencySeverity]?.label) || log.emergencySeverity || 'N/A'}
                    </span>
                  </td>
                  <td>
                    {log.reporter || 'N/A'} <br />
                    <small>{log.contact || 'N/A'}</small>
                  </td>
                  <td>{formatRespondingTeam(log.respondingTeam)}</td>
                  <td>
                    {(() => {
                      let displayStatus = 'N/A';
                      let statusKey = '';
                      
                      // If status field exists, use it
                      if (log.status) {
                        displayStatus = log.status;
                        const statusMapping = {
                          'Pending': 'pending',
                          'Acknowledged': 'acknowledged',
                          'In Progress': 'in-progress', 
                          'Partially Complete': 'partially-complete',
                          'Completed': 'completed'
                        };
                        statusKey = statusMapping[log.status] || (log.status || '').toLowerCase().replace(/\s+/g, '-').trim();
                      } else {
                        // FIXED: Improved status determination from timestamps
                        const hasAcknowledged = log.acknowledgedAt;
                        const hasCompleted = log.completedAt;
                        
                        if (hasCompleted) {
                          displayStatus = 'Completed';
                          statusKey = 'completed';
                        } else if (hasAcknowledged) {
                          // Check if there's additional progress beyond acknowledgment
                          // You might want to add more logic here based on your business rules
                          displayStatus = 'Acknowledged';
                          statusKey = 'acknowledged';
                        } else {
                          displayStatus = 'Pending';
                          statusKey = 'pending';
                        }
                      }
                      
                      const statusMeta = statusMap && statusMap[statusKey];
                      
                      return (
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: (statusMeta?.color) || '#ccc',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {(statusMeta?.label) || displayStatus}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <button className="btn-action btn-view" onClick={() => handleView(log)}>
                      <i className="fas fa-eye" /> View
                    </button>
                    {(() => {
                      // Determine if report is completed
                      const isCompleted = log.status === 'Completed' || log.completedAt;
                      return !isCompleted && (
                        <button className="btn-action btn-edit" onClick={() => handleEdit(log)}>
                          <i className="fas fa-edit" /> Edit
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedReport && (
        <>
          <ViewModal 
            isOpen={viewModalOpen} 
            onClose={closeViewModal} 
            report={selectedReport} 
          />
          <CreateRescueModal 
            isOpen={editModalOpen} 
            onClose={closeEditModal} 
            reportToEdit={selectedReport} 
            onReportCreated={onUpdate}
          />
        </>
      )}
    </div>
  );
}