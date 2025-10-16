import React from 'react';

const PrivacyPolicyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95%' }}>
        <div className="modal-content">
          <div className="modal-header" style={{ alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, fontSize: '1.5rem' }}>
              <i className="fas fa-user-shield" style={{ color: '#2563eb' }} /> Privacy Policy
            </h2>
            <button className="close-btn" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', lineHeight: 1.7, fontSize: '1.05rem' }}>
            <p>Last updated: October 2025</p>
            <p>
              This Privacy Policy describes how we collect, use, and protect personal information in the
              GoRescue applications (Dispatcher/Admin Web App and Responder Mobile App).
            </p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Information We Collect</h3>
            <ul style={{ paddingLeft: 18 }}>
              <li>Account details (name, email, role, team assignment)</li>
              <li>Operational data (incidents, locations, timestamps, notes)</li>
              <li>Device/location data (for responders when on-duty, if enabled)</li>
              <li>Documents and uploads (generated PDFs and form submissions)</li>
            </ul>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>How We Use Information</h3>
            <ul style={{ paddingLeft: 18 }}>
              <li>Dispatch coordination, incident logging, notification and reporting</li>
              <li>Team organization and shift planning</li>
              <li>Security, auditing, and service improvements</li>
              <li>Regulatory and compliance requirements</li>
            </ul>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Legal Basis</h3>
            <p>We process data based on consent, contractual necessity, and legitimate interests in public safety operations.</p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Data Sharing</h3>
            <p>
              We may share operational data with authorized government agencies and partner responders as necessary for
              emergency response. We do not sell personal information.
            </p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Data Retention</h3>
            <p>
              Data is retained according to organizational policy and applicable law. Document retention and archiving
              may follow settings configured in the Admin panel.
            </p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Security</h3>
            <p>
              We use Firebase Authentication, Firestore security rules, and transport encryption. Access is role-based and limited
              to authorized personnel.
            </p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Your Rights</h3>
            <p>
              You may request access, correction, or deletion where applicable. Contact your system administrator or the
              data controller for your organization.
            </p>
            <h3 style={{ fontSize: '1.15rem', marginTop: 16 }}>Contact</h3>
            <p>
              For privacy inquiries, please contact: privacy@gorescue.local (replace with your official contact).
            </p>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              By using the app, you agree to this Privacy Policy.
            </div>
            <button className="submit-btn" onClick={onClose}>I understand</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyModal;


