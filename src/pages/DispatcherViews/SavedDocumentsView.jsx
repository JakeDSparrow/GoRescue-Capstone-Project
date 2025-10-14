import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import './DispatchStyle/DispatcherPage.css';

const SavedDocumentsView = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all'); // all | submitted | draft

  useEffect(() => {
    console.log('SavedDocumentsView: Setting up Firestore listener for saved_documents collection');
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'saved_documents'), orderBy('createdAtMs', 'desc')),
      (snapshot) => {
        console.log('SavedDocumentsView: Received snapshot with', snapshot.docs.length, 'documents');
        const docs = [];
        snapshot.forEach((doc) => {
          try {
            const data = doc.data();
            docs.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
            });
          } catch (err) {
            console.error('Error processing document:', doc.id, err);
          }
        });
        setDocuments(docs);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching saved documents:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('SavedDocumentsView: Cleaning up listener');
      unsubscribe();
    };
  }, []);

  const handleViewDocument = (document) => {
    setSelectedDocument(document);
    setViewModalOpen(true);
  };

  const closeViewModal = () => {
    setViewModalOpen(false);
    setSelectedDocument(null);
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status) => {
    const statusClass = status === 'submitted' ? 'status-submitted' : 'status-draft';
    const displayText = status === 'submitted' ? 'SUBMITTED' : 'DRAFT';
    
    return (
      <span className={`status-badge ${statusClass}`}>
        {displayText}
      </span>
    );
  };

  const parseFormDataSafe = (formData) => {
    try {
      if (!formData) return {};
      return typeof formData === 'string' ? JSON.parse(formData) : formData;
    } catch (e) {
      return { _raw: formData };
    }
  };

  const isRefusalDocument = (doc) => {
    const parsed = parseFormDataSafe(doc.formData);
    if (parsed && typeof parsed === 'object') {
      if (parsed.isRefusalForm === true) return true;
      // also detect if refusalData has meaningful content
      if (parsed.refusalData && JSON.stringify(parsed.refusalData) !== '{}' && JSON.stringify(parsed.refusalData).length > 2) {
        return true;
      }
    }
    return false;
  };

  const handleDownloadJSON = (doc) => {
    try {
      const parsed = parseFormDataSafe(doc.formData);
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.documentType || 'document'}_${doc.missionId || 'mission'}_${doc.reportId || 'report'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to download JSON', e);
      alert('Failed to download JSON');
    }
  };

  const getDocumentTypeIcon = (type) => {
    switch (type) {
      case 'PCR_Form_Activity':
        return 'fa-file-medical';
      case 'PCR_Transport_Refusal':
        return 'fa-file-medical-alt';
      default:
        return 'fa-file-alt';
    }
  };

  if (loading) {
    return (
      <div className="dispatcher-page">
        <div className="team-dashboard-loading">
          <div className="loading-content">
            <div className="loading-spinner"></div>
            <p>Loading saved documents...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dispatcher-page">
        <div className="team-missions-dashboard">
          <div className="dashboard-header">
            <h2>Saved Documents</h2>
            <p>View and manage documents submitted by responders</p>
          </div>
          <div className="error-state">
            <i className="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Documents</h3>
            <p>{error}</p>
            <button 
              className="btn-retry"
              onClick={() => window.location.reload()}
            >
              <i className="fas fa-refresh"></i>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatcher-page">
      <div className="team-missions-dashboard">
        <div className="dashboard-header">
          <h2>Saved Documents</h2>
          <p>View and manage documents submitted by responders</p>
        </div>

        <div className="dashboard-actions" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`btn-view ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            <i className="fas fa-list"></i>
            All
          </button>
          <button
            className={`btn-view ${statusFilter === 'submitted' ? 'active' : ''}`}
            onClick={() => setStatusFilter('submitted')}
          >
            <i className="fas fa-check"></i>
            Submitted
          </button>
          <button
            className={`btn-view ${statusFilter === 'draft' ? 'active' : ''}`}
            onClick={() => setStatusFilter('draft')}
          >
            <i className="fas fa-pencil-alt"></i>
            Drafts
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="no-documents">
            <i className="fas fa-file-medical"></i>
            <h3>No documents found</h3>
            <p>No documents have been submitted yet.</p>
            <div className="help-text">
              <p><strong>Note:</strong> Documents will appear here once responders submit forms from the mobile app.</p>
              <p>Make sure the mobile app is properly configured to save documents to the "saved_documents" collection.</p>
            </div>
          </div>
        ) : (
          <div className="documents-grid">
            {documents
              .filter((d) => statusFilter === 'all' || d.status === statusFilter)
              .map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="document-type">
                    <i className={`fas ${getDocumentTypeIcon(doc.documentType)}`}></i>
                    <span>{doc.documentType}</span>
                  </div>
                  {getStatusBadge(doc.status)}
                </div>

                <div className="document-info">
                  <div className="info-row">
                    <strong>Mission ID:</strong>
                    <span>{doc.missionId}</span>
                  </div>
                  <div className="info-row">
                    <strong>Report ID:</strong>
                    <span>{doc.reportId}</span>
                  </div>
                  {isRefusalDocument(doc) && (
                    <div className="info-row">
                      <strong>Type:</strong>
                      <span style={{ color: '#dc3545', fontWeight: 600 }}>Patient Refusal</span>
                    </div>
                  )}
                  <div className="info-row">
                    <strong>Team:</strong>
                    <span>{doc.teamName || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <strong>Created by:</strong>
                    <span>{doc.createdBy}</span>
                  </div>
                  <div className="info-row">
                    <strong>Created at:</strong>
                    <span>{formatDateTime(doc.createdAt)}</span>
                  </div>
                  {doc.incidentLocation && (
                    <div className="info-row">
                      <strong>Location:</strong>
                      <span>{doc.incidentLocation}</span>
                    </div>
                  )}
                  {doc.emergencyType && (
                    <div className="info-row">
                      <strong>Emergency Type:</strong>
                      <span>{doc.emergencyType}</span>
                    </div>
                  )}
                </div>

                <div className="document-actions">
                  {doc.pdfUrl ? (
                    <a 
                      href={doc.pdfUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-download-pdf"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <i className="fas fa-file-pdf"></i>
                      View PDF
                    </a>
                  ) : (
                    doc.status === 'submitted' && (
                      <button className="btn-download-pdf" disabled onClick={(e) => e.stopPropagation()}>
                        <i className="fas fa-clock"></i>
                        PDF processing...
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        
      </div>
    </div>
  );
};

export default SavedDocumentsView;
