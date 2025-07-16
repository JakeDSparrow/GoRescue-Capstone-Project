import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'mdrrmo-requests'), orderBy('submittedAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleDownloadPDF = async (id) => {
    const requestEl = document.getElementById(`request-${id}`);
    if (!requestEl) return;

    const canvas = await html2canvas(requestEl);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`request-${id}.pdf`);
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
        await updateDoc(ref, newRequest);
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
      await fetchRequests();
    } catch (err) {
      console.error('Error submitting request:', err);
      alert('Failed to submit request');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'mdrrmo-requests', id), { status: newStatus });
      await fetchRequests();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

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
            <p><strong>Date:</strong> {req.submittedAt?.toDate().toLocaleString()}</p>
            <p>
              <strong>Status:</strong>{" "}
              <span className={`badge px-3 py-1 status-badge ${req.status.toLowerCase()}`}>
                {req.status}
              </span>
              <select
                className="form-select form-select-sm d-inline w-auto ms-3"
                value={req.status}
                onChange={(e) => handleStatusChange(req.id, e.target.value)}
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Completed">Completed</option>
              </select>
            </p>

            <div className="request-actions">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={()=> handleDownloadPDF(req.id)}>
                📄 Download PDF
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
