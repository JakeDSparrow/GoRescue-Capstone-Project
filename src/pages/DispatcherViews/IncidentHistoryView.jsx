import React, { useState } from 'react';
import { emergencySeverityMap, statusMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';

export default function IncidentHistoryView({ reportLogs }) {
  const { formatDateTime } = useFormatDate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('All');

  const filteredLogs = reportLogs.filter((log) => {
    const logDate = new Date(log.timestamp);
    const yearMatch = logDate.getFullYear().toString() === selectedYear;
    const monthMatch = selectedMonth === 'All' || logDate.getMonth() === parseInt(selectedMonth);
    return yearMatch && monthMatch;
  });

  return (
    <div className="team-organizer-container">
      <div className="archives-header">
        <h2 className="view-title">Incident History</h2>
        <div className="filters">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="All">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="teams-container">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-history"></i>
            <p>No incident records yet</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="deck-card">
              <div className="deck-header">
                <div className="deck-title-group">
                  <strong>{log.reportId || log.id}</strong>
                  <span className="deck-timestamp">{formatDateTime(log.timestamp)}</span>
                </div>
              </div>

              <div className="shift-info">
                <div>
                  <strong>Severity:</strong>{' '}
                  <span
                    style={{
                      backgroundColor:
                        emergencySeverityMap[log.emergencySeverity.toLowerCase()]?.color || '#ccc',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontSize: '0.85rem',
                    }}
                  >
                    {emergencySeverityMap[log.emergencySeverity.toLowerCase()]?.label.toUpperCase() ||
                      log.emergencySeverity.toUpperCase()}
                  </span>
                </div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span
                    style={{
                      backgroundColor: statusMap[log.status.toLowerCase()]?.color || '#ccc',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      fontSize: '0.85rem',
                    }}
                  >
                    {statusMap[log.status.toLowerCase()]?.label.toUpperCase() || log.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="deck-body">
                <div className="deck-row">
                  <em>Reported By:</em> {log.reporterName || log.reporter} ({log.contactNumber || log.contact})
                </div>
                <div className="deck-row">
                  <em>Responding Team:</em> {log.respondingTeam || 'Unassigned'}
                </div>
              </div>

              <div className="deck-actions">
                {log.fileUrl && (
                  <>
                    <a href={log.fileUrl} target="_blank" rel="noreferrer" className="edit-button">
                      <i className="fas fa-file-alt"></i> Read
                    </a>
                    <a href={log.fileUrl} download className="edit-button">
                      <i className="fas fa-download"></i> Download
                    </a>
                  </>
                )}
                <button className="clear-button">
                  <i className="fas fa-trash-alt"></i> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
