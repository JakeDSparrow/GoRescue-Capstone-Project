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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header>
          <h3>Report Details - {safeRender(report.reportId || report.id)}</h3>
          <button className="btn-close" onClick={onClose} aria-label="Close modal">&times;</button>
        </header>
        <div className="modal-body">
          <p><strong>Emergency Severity:</strong> {safeRender(report.emergencySeverity)}</p>
          <p><strong>Reported By:</strong> {safeRender(report.reporter)}</p>
          <p><strong>Contact:</strong> {safeRender(report.contact)}</p>

          <p><strong>Location:</strong> {safeRender(report.locationText)}</p>

          <p><strong>Responding Team:</strong> {formatRespondingTeam(report.respondingTeam)}</p>

          <p><strong>Status:</strong> {safeRender(report.status)}</p>
          <p><strong>Timestamp:</strong> {report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
