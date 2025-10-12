import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp, setDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './modalstyles/CancellationModalStyles.css';

const CancellationModal = ({ isOpen, onClose, incidentData, onSuccess }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser } = useAuth();

  const cancellationReasons = [
    'False alarm / No emergency',
    'Already handled by another team',
    'Patient refused assistance',
    'Duplicate incident',
    'Other'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedReason) {
      alert('Please select a cancellation reason');
      return;
    }

    if (selectedReason === 'Other' && !customReason.trim()) {
      alert('Please provide a custom reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalReason = selectedReason === 'Other' ? customReason : selectedReason;
      
      // Debug: Log incident data to help identify undefined values
      console.log("Incident data received:", incidentData);
      
      // Collect current incident data for audit trail
      const currentIncidentData = {
        incidentId: incidentData.id || "unknown",
        originalStatus: incidentData.status || "unknown",
        originalSubStatus: incidentData.subStatus || "unknown",
        respondingTeams: incidentData.respondingTeams || incidentData.respondingTeam || "none",
        emergencyType: incidentData.emergencyType || "unknown",
        location: incidentData.locationText || incidentData.location || incidentData.address || "unknown",
        priority: incidentData.emergencySeverity || incidentData.priority || "unknown",
        timestamp: incidentData.timestamp || new Date().toISOString(),
        cancelledAt: new Date().toISOString(),
        cancelledBy: currentUser?.uid || "dispatcher",
        cancelledByName: currentUser?.displayName || "Dispatcher",
        cancellationReason: finalReason
      };

      // Remove any undefined values to prevent Firestore errors
      const cleanIncidentData = Object.fromEntries(
        Object.entries(currentIncidentData).filter(([_, value]) => value !== undefined)
      );

      // Update incident status
      const incidentRef = doc(db, "incidents", incidentData.id);
      await updateDoc(incidentRef, {
        status: "cancelled",
        subStatus: "Cancelled by dispatcher",
        responderId: null,
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cancelledBy: currentUser?.uid || "dispatcher",
        cancelledByName: currentUser?.displayName || "Dispatcher",
        cancellationReason: finalReason,
        originalData: cleanIncidentData
      });

      // Add audit log entry
      try {
        const auditData = {
          action: "mission_cancelled",
          incidentId: incidentData.id || "unknown",
          documentType: "incident",
          status: "cancelled",
          userId: currentUser?.uid || "dispatcher",
          userName: currentUser?.displayName || "Dispatcher",
          timestamp: serverTimestamp(),
          details: {
            originalStatus: incidentData.status || "unknown",
            originalSubStatus: incidentData.subStatus || "unknown",
            respondingTeams: incidentData.respondingTeams || incidentData.respondingTeam || "none",
            emergencyType: incidentData.emergencyType || "unknown",
            location: incidentData.locationText || incidentData.location || incidentData.address || "unknown",
            priority: incidentData.emergencySeverity || incidentData.priority || "unknown",
            cancellationReason: finalReason
          }
        };

        // Clean audit data to remove undefined values
        const cleanAuditData = Object.fromEntries(
          Object.entries(auditData).map(([key, value]) => [
            key,
            typeof value === 'object' && value !== null && !Array.isArray(value) && value.constructor === Object
              ? Object.fromEntries(Object.entries(value).filter(([_, v]) => v !== undefined))
              : value
          ])
        );

        const auditRef = doc(collection(db, "audit_logs"));
        await setDoc(auditRef, cleanAuditData);
      } catch (auditError) {
        console.warn("Failed to add audit log:", auditError);
      }

      onSuccess();
      onClose();
      
    } catch (error) {
      console.error("Error cancelling incident:", error);
      alert("Failed to cancel mission: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setCustomReason('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cancellation-modal-overlay">
      <div className="cancellation-modal">
        <div className="cancellation-modal-header">
          <h2>Cancel Mission</h2>
          <button 
            className="cancellation-modal-close" 
            onClick={handleClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <div className="cancellation-modal-content">
          <div className="incident-info">
            <h3>Mission Details</h3>
            <p><strong>Mission ID:</strong> {incidentData.id}</p>
            <p><strong>Emergency Type:</strong> {incidentData.emergencyType}</p>
            <p><strong>Location:</strong> {incidentData.locationText || incidentData.location || incidentData.address}</p>
            <p><strong>Priority:</strong> {incidentData.emergencySeverity || incidentData.priority}</p>
          </div>

          <form onSubmit={handleSubmit} className="cancellation-form">
            <div className="form-group">
              <label htmlFor="reason">Cancellation Reason *</label>
              <select
                id="reason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                required
                disabled={isSubmitting}
              >
                <option value="">Select a reason...</option>
                {cancellationReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {selectedReason === 'Other' && (
              <div className="form-group">
                <label htmlFor="customReason">Please specify *</label>
                <textarea
                  id="customReason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter the cancellation reason..."
                  rows="3"
                  required
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div className="cancellation-modal-actions">
              <button
                type="button"
                onClick={handleClose}
                className="btn-cancel"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-confirm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CancellationModal;
