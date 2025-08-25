import React, { useCallback, useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import RequestModal from '../../components/RequestsModal';

const RequestsView = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [newRequest, setNewRequest] = useState({
    title: '',
    type: '',
    description: '',
    submittedBy: 'Admin',
    status: 'Pending'
  });

  const toDate = useCallback((value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    return new Date(value);
  }, []);

  useEffect(() => {
    setLoading(true);
    const qRef = query(collection(db, 'mdrrmo-requests'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(qRef, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, []);

  const generateRequestPDF = (req) => {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 48;
    let y = margin;

    const addHeader = () => {
      pdf.setFillColor(27, 67, 113);
      pdf.rect(0, 0, pageWidth, 72, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Municipal DRRMO - Request Report', margin, 44);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const now = new Date();
      pdf.text(`Generated: ${now.toLocaleString()}`, pageWidth - margin, 44, { align: 'right' });
      y = 96;
    };

    const addFooter = (pageNumber) => {
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 24, { align: 'center' });
    };

    const drawDivider = () => {
      pdf.setDrawColor(220);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 16;
    };

    const addField = (label, value) => {
      const safe = (value ?? '').toString();
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(33);
      pdf.setFontSize(11);
      pdf.text(label, margin, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60);
      const lineHeight = 16;
      const maxWidth = pageWidth - margin * 2;
      const lines = pdf.splitTextToSize(safe, maxWidth);
      y += 14;
      lines.forEach((line) => {
        if (y > pageHeight - margin - 40) {
          addFooter(pdf.getNumberOfPages());
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += lineHeight;
      });
      y += 4;
    };

    addHeader();

    // Title block
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(20);
    pdf.setFontSize(16);
    pdf.text(req.title || 'Request', margin, y);
    y += 10;
    drawDivider();

    // Metadata
    addField('Request ID', req.id || '');
    addField('Type', req.type || '');
    addField('Submitted By', req.submittedBy || '');
    const submittedAt = toDate(req.submittedAt)?.toLocaleString() || '';
    addField('Submitted At', submittedAt);

    drawDivider();
    addField('Description', req.description || '');

    // Signature line
    if (y < pageHeight - margin - 72) {
      y = pageHeight - margin - 72;
    }
    pdf.setDrawColor(160);
    pdf.line(margin, y, margin + 200, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80);
    pdf.text('Prepared by', margin, y + 14);

    addFooter(pdf.getNumberOfPages());
    pdf.save(`request-${req.id || 'report'}.pdf`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;

    try {
      await deleteDoc(doc(db, 'mdrrmo-requests', id));
      setRequests(prev => prev.filter(r => r.id !== id));
      alert('Request deleted.');
    } catch (err) {
      console.error('Error deleting request:', err);
      alert('Failed to delete request');
    }
  };

  const handleEdit = (req) => {
    setNewRequest({
      title: req.title,
      type: req.type,
      description: req.description,
      submittedBy: req.submittedBy,
      status: req.status
    });
    setEditId(req.id);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!newRequest.title || !newRequest.type || !newRequest.description) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      if (isEditMode && editId) {
        const ref = doc(db, 'mdrrmo-requests', editId);
        await updateDoc(ref, {
          title: newRequest.title,
          type: newRequest.type,
          description: newRequest.description,
          submittedBy: newRequest.submittedBy || 'Admin',
          status: newRequest.status || 'Pending',
          updatedAt: serverTimestamp()
        });
        alert('Request updated!');
      } else {
        await addDoc(collection(db, 'mdrrmo-requests'), {
          ...newRequest,
          submittedAt: serverTimestamp()
        });
        alert('Request submitted!');
      }

      setShowModal(false);
      setNewRequest({
        title: '',
        type: '',
        description: '',
        submittedBy: 'Admin',
        status: 'Pending'
      });
      setIsEditMode(false);
      setEditId(null);
      // realtime listener will update list
    } catch (err) {
      console.error('Error submitting request:', err);
      alert('Failed to submit request');
    }
  };

  // Status controls removed per requirements

  return (
    <div className="requests-container">
      <div className="requests-header d-flex justify-content-between align-items-center mb-3">
        <h2>Submitted Requests</h2>
        <button className="btn btn-primary" onClick={() => {
          setShowModal(true);
          setIsEditMode(false);
          setNewRequest({
            title: '',
            type: '',
            description: '',
            submittedBy: 'Admin',
            status: 'Pending'
          });
        }}>
          Add Request
        </button>
      </div>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <p className="text-muted">No requests found.</p>
      ) : (
        requests.map(req => (
          <div key={req.id} id={`request-${req.id}`} className="request-card card mb-3 p-3 shadow-sm">
            <h4 className="mb-2">{req.title}</h4>
            <p><strong>Type:</strong> {req.type}</p>
            <p><strong>Description:</strong> {req.description}</p>
            <p><strong>Submitted By:</strong> {req.submittedBy}</p>
            <p><strong>Date:</strong> {toDate(req.submittedAt)?.toLocaleString()}</p>

            <div className="request-actions">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={()=> generateRequestPDF(req)}>
                📄 Generate PDF
              </button>
              <button type="button" className="btn btn-sm btn-warning" onClick={()=> handleEdit(req)}>
                ✏️ Edit
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={()=> handleDelete(req.id)}>
                🗑️ Delete
              </button>
            </div>
          </div>
        ))
      )}

      <RequestModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setIsEditMode(false);
          setEditId(null);
        }}
        onSubmit={handleSubmit}
        newRequest={newRequest}
        setNewRequest={setNewRequest}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default RequestsView;