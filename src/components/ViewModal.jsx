import React from 'react';
import { emergencySeverityMap, emergencyTypeMap } from '../constants/dispatchConstants';
import './modalstyles/ViewModalStyles.css';

function formatRespondingTeam(teamKey) {
  if (!teamKey) return 'N/A';
  if (teamKey.toLowerCase().startsWith('team ')) return teamKey;
  const team = teamKey.split('-')[0];
  if (!team) return teamKey;
  return `Team ${team.charAt(0).toUpperCase() + team.slice(1)}`;
}

function getSeverityClass(severity) {
  if (!severity) return '';
  const severityLower = severity.toLowerCase();
  if (severityLower.includes('critical')) return 'severity-critical';
  if (severityLower.includes('high')) return 'severity-high';
  if (severityLower.includes('moderate') || severityLower.includes('medium')) return 'severity-moderate';
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

  const safeRender = (field) => {
    if (field === null || field === undefined) return 'N/A';
    if (typeof field === 'object') {
      if ('lat' in field && 'lng' in field) return `Lat: ${field.lat}, Lng: ${field.lng}`;
      return JSON.stringify(field);
    }
    return String(field);
  };

  const renderEmergencyType = (emergencyType) => {
    const typeConfig = emergencyTypeMap[emergencyType];
    if (typeConfig) {
      return (
        <span style={{ color: typeConfig.color, fontWeight: 'bold' }}>
          <i className={`fa ${typeConfig.icon}`} style={{ marginRight: '8px' }}></i>
          {typeConfig.label}
        </span>
      );
    }
    return safeRender(emergencyType);
  };

  const renderSeverity = (severity) => {
    if (!severity) return 'N/A';
    const severityLower = severity.toLowerCase();
    for (const [key, config] of Object.entries(emergencySeverityMap)) {
      if (severityLower.includes(key)) {
        return (
          <span className={`severity-${key}`}>
            <i className={`fa ${config.icon}`} style={{ marginRight: '4px' }}></i>
            {config.label}
          </span>
        );
      }
    }
    return <span className={getSeverityClass(severity)}>{safeRender(severity)}</span>;
  };

  const renderStatus = (status) => <span className={getStatusClass(status)}>{safeRender(status)}</span>;

  return (
    <div className="view-modal-overlay" onClick={onClose}>
      <div className="view-modal" onClick={e => e.stopPropagation()}>
        <div className="view-modal-header">
          <h2>Report Details - {safeRender(report.reportId || report.id)}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <div className="view-modal-body">
          <div className="view-detail-row">
            <div className="view-detail-label">Report ID:</div>
            <div className="view-detail-value">{safeRender(report.reportId)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Incident Code:</div>
            <div className="view-detail-value">{safeRender(report.incidentCode)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Emergency Type:</div>
            <div className="view-detail-value">{renderEmergencyType(report.emergencyType)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Emergency Severity:</div>
            <div className="view-detail-value">{renderSeverity(report.emergencySeverity)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Reporter:</div>
            <div className="view-detail-value">{safeRender(report.reporter)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Contact:</div>
            <div className="view-detail-value">{safeRender(report.contact)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Location:</div>
            <div className="view-detail-value">{safeRender(report.locationText)}</div>
          </div>

          {report.location && (
            <div className="view-detail-row">
              <div className="view-detail-label">Coordinates:</div>
              <div className="view-detail-value">{`Lat: ${report.location.lat}, Lng: ${report.location.lng}`}</div>
            </div>
          )}

          <div className="view-detail-row">
            <div className="view-detail-label">Responding Team:</div>
            <div className="view-detail-value">{formatRespondingTeam(report.respondingTeam)}</div>
          </div>

          {report.teamData?.members?.length > 0 && (
            <div className="view-detail-row">
              <div className="view-detail-label">Team Members:</div>
              <div className="view-detail-value">
                <ul>
                  {report.teamData.members.map(member => (
                    <li key={member.uid}>
                      {member.fullName} ({member.role || 'Responder'}) - {member.phone || member.contact || 'N/A'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="view-detail-row">
            <div className="view-detail-label">Status:</div>
            <div className="view-detail-value">{renderStatus(report.status)}</div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Timestamp:</div>
            <div className="view-detail-value">
              {report.timestamp ? new Date(report.timestamp).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="view-detail-row">
            <div className="view-detail-label">Notes:</div>
            <div className="view-detail-value">{safeRender(report.notes)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}