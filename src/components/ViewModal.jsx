import React from 'react';
import './modalstyles/ViewModalStyles.css';

function formatRespondingTeam(teamKey) {
  if (!teamKey) return 'N/A';
  
  if (teamKey.toLowerCase().startsWith('team ')) {
    return teamKey;
  }
  
  const team = teamKey.split('-')[0];
  if (!team) return teamKey;
  
  return `Team ${team.charAt(0).toUpperCase() + team.slice(1)}`;
}

function getSeverityClass(severity) {
  if (!severity) return '';
  const severityLower = severity.toLowerCase();
  if (severityLower.includes('high')) return 'severity-high';
  if (severityLower.includes('medium')) return 'severity-medium';
  if (severityLower.includes('low')) return 'severity-low';
  return '';
}

function getStatusClass(status) {
  if (!status) return '';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('pending')) return 'status-pending';
  if (statusLower.includes('responding')) return 'status-responding';
  if (statusLower.includes('resolved')) return 'status-resolved';
  return '';
}

export default function ViewModal({ isOpen, onClose, report }) {
  if (!isOpen || !report) return null;

  // Add this log to debug the report object
  console.log('ViewModal report data:', report);

  const safeRender = (field) => {
    if (field === null || field === undefined) return 'N/A';
    if (typeof field === 'object') {
      if ('lat' in field && 'lng' in field) {
        return `Lat: ${field.lat}, Lng: ${field.lng}`;
      }
      return JSON.stringify(field);
    }
    return String(field);
  };

  const renderSeverity = (severity) => {
    const severityClass = getSeverityClass(severity);
    if (severityClass) {
      return <span className={severityClass}>{safeRender(severity)}</span>;
    }
    return safeRender(severity);
  };

  const renderStatus = (status) => {
    const statusClass = getStatusClass(status);
    if (statusClass) {
      return <span className={statusClass}>{safeRender(status)}</span>;
    }
    return safeRender(status);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header>
          <h3>Report Details - {safeRender(report.reportId || report.id)}</h3>
          <button className="btn-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </header>
        <div className="modal-body">
          <p>
            <strong>Emergency Severity:</strong> 
            {renderSeverity(report.emergencySeverity)}
          </p>
          <p><strong>Reported By:</strong> {safeRender(report.reporter)}</p>
          <p>
            <strong>Contact:</strong> 
            <span className="contact-info">{safeRender(report.contact)}</span>
          </p>
          <p>
            <strong>Location:</strong> 
            <span className="location-coords">{safeRender(report.locationText)}</span>
          </p>
          <p><strong>Responding Team:</strong> {formatRespondingTeam(report.respondingTeam)}</p>
          <p>
            <strong>Status:</strong> 
            {renderStatus(report.status)}
          </p>
          <p><strong>Timestamp:</strong> {report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}