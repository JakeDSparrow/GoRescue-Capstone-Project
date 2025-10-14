import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import ViewModal from '../../components/ViewModal';

const formatDateTime = (date) => {
  if (!date) return 'N/A';
  try {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return 'N/A';
  }
};

const ArchivesView = () => {
  const [incidents, setIncidents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [incidentToDelete, setIncidentToDelete] = useState(null);

  useEffect(() => {
    const unsubInc = onSnapshot(
      query(collection(db, 'incidents'), orderBy('timestamp', 'desc')),
      (snap) => {
        const items = [];
        snap.forEach((d) => {
          const data = d.data();
          items.push({
            id: d.id,
            ...data,
            timestamp: data.timestamp?.toDate?.() || new Date(),
            completedAt: data.completedAt?.toDate?.() || null,
            cancelledAt: data.cancelledAt?.toDate?.() || null,
          });
        });
        setIncidents(items);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load incidents', err);
        setError(err.message || 'Failed to load incidents');
        setLoading(false);
      }
    );

    const unsubDocs = onSnapshot(
      query(collection(db, 'saved_documents'), orderBy('createdAtMs', 'desc')),
      (snap) => {
        const docs = [];
        snap.forEach((d) => {
          const data = d.data();
          docs.push({ id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() });
        });
        setDocuments(docs);
      },
      (err) => {
        console.error('Failed to load documents', err);
      }
    );

    return () => {
      unsubInc();
      unsubDocs();
    };
  }, []);

  const docsByMissionId = useMemo(() => {
    const map = new Map();
    for (const doc of documents) {
      const key = doc.missionId || doc.reportId || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(doc);
    }
    return map;
  }, [documents]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      const yearOk = yearFilter === 'all' || (inc.timestamp && String(inc.timestamp.getFullYear()) === String(yearFilter));
      if (!yearOk) return false;
      if (statusFilter === 'all') return true;
      const statusNorm = String(inc.status || '').toLowerCase();
      if (statusFilter === 'in-progress') {
        return ['in-progress', 'acknowledged', 'responding'].includes(statusNorm);
      }
      return statusNorm === statusFilter;
    });
  }, [incidents, yearFilter, statusFilter]);

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
          <p>Loading archives...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '24px', marginBottom: '10px', color: '#e74c3c' }}></i>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const years = Array.from(new Set(incidents.map((i) => (i.timestamp ? i.timestamp.getFullYear() : new Date().getFullYear())))).sort((a, b) => b - a);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Archives</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredIncidents.length === 0 ? (
        <div className="empty-state">
          <i className="fas fa-archive" />
          <p>No missions found for the selected filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredIncidents.map((inc) => {
            const missionDocs = docsByMissionId.get(inc.id) || docsByMissionId.get(inc.reportId) || [];
            const statusKey = String(inc.status || '').toLowerCase();
            return (
              <div key={inc.id} className="archive-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="report-id">{inc.reportId || inc.id}</span>
                      <span className="incident-code">{inc.incidentCode || 'N/A'}</span>
                      <span className={`status-badge status-${statusKey.replace(/\s+/g, '-')}`} style={{ marginLeft: 8 }}>{inc.status || 'Pending'}</span>
                    </div>
                    <div style={{ marginTop: 6, color: '#374151', fontSize: 14 }}>
                      <div><strong>Type:</strong> {inc.emergencyType || 'N/A'}</div>
                      <div><strong>Location:</strong> {inc.locationText || inc.matchedLocation || 'N/A'}</div>
                      <div><strong>Created:</strong> {formatDateTime(inc.timestamp)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-action btn-view"
                      onClick={() => { setSelectedIncident(inc); setViewModalOpen(true); }}
                    >
                      <i className="fas fa-eye" /> View
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => { setIncidentToDelete(inc); setConfirmOpen(true); }}
                    >
                      <i className="fas fa-trash" /> Delete
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <i className="fas fa-paperclip attachment-icon" />
                    <strong>Documents ({missionDocs.length})</strong>
                  </div>
                  {missionDocs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '8px 0' }}>No documents yet</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                      {missionDocs.map((doc) => (
                        <div key={doc.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                              <i className="fas fa-file-medical" />
                              <span>{doc.documentType || 'Form'}</span>
                            </div>
                            <span className={`status-badge ${doc.status === 'submitted' ? 'status-inprogress' : 'status-pending'}`}>
                              {doc.status === 'submitted' ? 'SUBMITTED' : 'DRAFT'}
                            </span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>
                            <div><strong>Created:</strong> {formatDateTime(doc.createdAt)}</div>
                            {doc.teamName && <div><strong>Team:</strong> {doc.teamName}</div>}
                          </div>
                          <div className="pdf-actions">
                            {doc.pdfUrl ? (
                              <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-download-pdf"><i className="fas fa-file-pdf"></i> View PDF</a>
                            ) : (
                              doc.status === 'submitted' ? (
                                <button className="btn-download-pdf" disabled><i className="fas fa-clock"></i> PDF processing...</button>
                              ) : null
                            )}
                            <button className="btn-view" onClick={() => {
                              try {
                                const parsed = typeof doc.formData === 'string' ? JSON.parse(doc.formData) : (doc.formData || {});
                                const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${doc.documentType || 'document'}_${doc.missionId || inc.id}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                              } catch (e) {
                                alert('Failed to download JSON');
                              }
                            }}>
                              <i className="fas fa-download"></i> Download JSON
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Shared View Modal */}
      {viewModalOpen && selectedIncident && (
        <ViewModal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          report={selectedIncident}
        />
      )}

      {confirmOpen && incidentToDelete && (
        <div className="admin-confirm-overlay" role="dialog" aria-modal="true">
          <div className="admin-confirm-modal">
            <div className="modal-header">
              <h3>Delete Incident</h3>
              <button className="close-btn" onClick={() => setConfirmOpen(false)} aria-label="Close">&times;</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete this incident?</p>
              <p><strong>Report ID:</strong> {incidentToDelete.reportId || incidentToDelete.id}</p>
              <p><strong>Status:</strong> {incidentToDelete.status || 'Pending'}</p>
              <p style={{ color: '#b91c1c' }}><i className="fas fa-exclamation-triangle"></i> This action cannot be undone.</p>
            </div>
            <div className="modal-footer confirm-actions">
              <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await deleteDoc(doc(db, 'incidents', incidentToDelete.id));
                    setConfirmOpen(false);
                    setIncidentToDelete(null);
                  } catch (e) {
                    console.error('Failed to delete incident', e);
                    alert('Failed to delete incident');
                  }
                }}
              >
                <i className="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivesView;
