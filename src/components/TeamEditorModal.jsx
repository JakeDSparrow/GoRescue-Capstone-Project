import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Timestamp } from "firebase/firestore";
import './modalstyles/TeamEditorModalStyles.css';

// Display labels only; keys must remain the same for Firestore compatibility
const roleLabels = {
  teamLeader: 'Team Leader',
  ambulanceDriver: 'Ambulance Operator', // keep key ambulanceDriver
  emt1: 'EMT 1',
  emt2: 'EMT 2'
};

export default function TeamEditorModal({
  isOpen,
  onClose,
  currentTeam = {},
  responders,
  onSave,
  teams,
  selectedTeamKey,
  selectedShiftKey 
}) {
  const [formState, setFormState] = useState({});
  const [draggedResponder, setDraggedResponder] = useState(null);
  const [dropZoneActive, setDropZoneActive] = useState(null);
  const teamId = `${selectedTeamKey}-${selectedShiftKey}`;

  useEffect(() => {
    if (isOpen && currentTeam) {
      setFormState({ ...currentTeam });
      console.log('Modal opened with team data:', currentTeam);
    }
  }, [isOpen, currentTeam]);

  const getFilteredResponders = () => {
    if (!teams || !responders) return [];

    const assignedUids = new Set();

    // Go through ALL teams and shifts to find already assigned responders
    Object.entries(teams).forEach(([teamKey, teamShifts]) => {
      Object.entries(teamShifts || {}).forEach(([shiftKey, shift]) => {
        if (teamKey === selectedTeamKey && shiftKey === selectedShiftKey) {
          return;
        }
        
        // Add all assigned UIDs from *other* shifts to the exclusion list
        Object.keys(roleLabels).forEach((roleType) => {
          if (shift?.[roleType]?.uid) {
            assignedUids.add(shift[roleType].uid);
          }
        });
      });
    });

    return responders.filter(responder => {
        const isCurrentlyAssigned = assignedUids.has(responder.uid);
        return !isCurrentlyAssigned;
    });
  };

  const getUnassignedResponders = () => {
    const assignedUids = new Set(
      Object.values(formState)
        .filter(responder => responder?.uid)
        .map(responder => responder.uid)
    );

    // Optional: prefer responders whose shift window matches the selected shift
    const withinShift = (responder) => {
      if (!responder) return false;
      const toDate = (ts) => {
        try {
          if (ts && typeof ts.toDate === 'function') return ts.toDate();
          if (ts instanceof Date) return ts;
          const d = new Date(ts);
          return isNaN(d.getTime()) ? null : d;
        } catch {
          return null;
        }
      };
      const now = new Date();
      const start = toDate(responder.shiftStart);
      const end = toDate(responder.shiftEnd);
      if (!start || !end) return true; // if no window, consider available
      return now >= start && now <= end;
    };

    const filtered = getFilteredResponders().filter(responder => !assignedUids.has(responder.uid));

    // Sort so in-window responders appear first
    return filtered.sort((a, b) => {
      const aIn = withinShift(a) ? 1 : 0;
      const bIn = withinShift(b) ? 1 : 0;
      return bIn - aIn;
    });
  };

  const handleDragStart = (e, responder, source = 'unassigned') => {
    setDraggedResponder({ ...responder, source });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedResponder(null);
    setDropZoneActive(null);
  };

  const handleDragOver = (e, roleKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZoneActive(roleKey);
  };

  const handleDragLeave = (e) => {
    // Only clear if we're really leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropZoneActive(null);
    }
  };

  const handleDrop = (e, targetRoleKey) => {
    e.preventDefault();
    
    if (!draggedResponder) return;
    
    setFormState(prev => {
      const newState = { ...prev };
      
      // If responder came from another role, clear that role
      if (draggedResponder.source !== 'unassigned') {
        Object.keys(roleLabels).forEach(roleKey => {
          if (newState[roleKey]?.uid === draggedResponder.uid) {
            newState[roleKey] = null;
          }
        });
      }
      
      // Assign responder to new role - ensure we maintain the correct structure
      const responderData = {
        uid: draggedResponder.uid,
        name: draggedResponder.name || draggedResponder.fullName,
        fullName: draggedResponder.fullName || draggedResponder.name,
        email: draggedResponder.email
      };

      // Remove any undefined values to match your backend expectations
      Object.keys(responderData).forEach(key => {
        if (responderData[key] === undefined) {
          delete responderData[key];
        }
      });

      newState[targetRoleKey] = responderData;
      
      console.log('Updated form state:', newState);
      return newState;
    });
    
    setDropZoneActive(null);
    setDraggedResponder(null);
  };

  const handleRemoveFromRole = (roleKey) => {
    setFormState(prev => ({
      ...prev,
      [roleKey]: null
    }));
  };

  const handleSave = async () => {
    console.log('Saving team data:', formState);
    try {
      // --- Get PH timezone base ---
      const now = new Date();
      const phTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Manila" })
      );

      // --- Define fixed shift times ---
      let shiftStart, shiftEnd;

      if (selectedShiftKey === "dayShift") {
        // 6 AM - 6 PM
        shiftStart = new Date(phTime);
        shiftStart.setHours(6, 0, 0, 0);

        shiftEnd = new Date(phTime);
        shiftEnd.setHours(18, 0, 0, 0);
      } else if (selectedShiftKey === "nightShift") {
        // 6 PM - 6 AM (next day)
        shiftStart = new Date(phTime);
        shiftStart.setHours(18, 0, 0, 0);

        shiftEnd = new Date(phTime);
        shiftEnd.setDate(shiftEnd.getDate() + 1); // next day
        shiftEnd.setHours(6, 0, 0, 0);
      }

      await onSave(selectedTeamKey, selectedShiftKey, {
        ...formState,
        teamId,
        shiftStart: Timestamp.fromDate(shiftStart),
        shiftEnd: Timestamp.fromDate(shiftEnd),
        updatedAt: Timestamp.fromDate(phTime)
      });

      console.log("✅ Team saved with PH shift times");
    } catch (error) {
      console.error("❌ Error saving team:", error);
    }
  };

  if (!isOpen) return null;

  const unassignedResponders = getUnassignedResponders();

  return (
    <div className="view-modal-overlay">
      <div className="view-modal" style={{ maxWidth: '900px', maxHeight: '90vh' }}>
        <div className="view-modal-header">
          <h2>Edit {selectedTeamKey?.toUpperCase()} Team - {selectedShiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="view-modal-body">
          <div className="drag-drop-container">
            {/* Available Responders */}
            <div className="responders-pool">
              <h3>Available Responders</h3>
              <div className="responders-list">
                {unassignedResponders.length === 0 ? (
                  <div className="empty-state">
                    <p>All available responders have been assigned</p>
                  </div>
                ) : (
                  unassignedResponders.map(responder => (
                    <div
                      key={responder.uid}
                      className="responder-item draggable"
                      draggable
                      onDragStart={(e) => handleDragStart(e, responder, 'unassigned')}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="responder-avatar">
                        {(responder.fullName || responder.name)?.charAt(0).toUpperCase()}
                      </div>
                      <div className="responder-info">
                        <div className="responder-name">
                          {responder.fullName || responder.name}
                        </div>
                        <div className="responder-email">
                          {responder.email}
                        </div>
                      </div>
                      <div className="drag-handle">⋮⋮</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Team Roles */}
            <div className="team-roles">
              <h3>Team Assignments</h3>
              <div className="roles-grid">
                {Object.entries(roleLabels).map(([roleKey, roleLabel]) => {
                  const assignedResponder = formState[roleKey];
                  const isDropZone = dropZoneActive === roleKey;
                  
                  return (
                    <div
                      key={roleKey}
                      className={`role-slot ${isDropZone ? 'drop-active' : ''} ${assignedResponder ? 'occupied' : 'empty'}`}
                      onDragOver={(e) => handleDragOver(e, roleKey)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, roleKey)}
                    >
                      <div className="role-header">
                        <h4>{roleLabel}</h4>
                        {assignedResponder && (
                          <button
                            className="remove-btn"
                            onClick={() => handleRemoveFromRole(roleKey)}
                            title="Remove from role"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      
                      {assignedResponder ? (
                        <div
                          className="responder-item assigned draggable"
                          draggable
                          onDragStart={(e) => handleDragStart(e, assignedResponder, roleKey)}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="responder-avatar">
                            {(assignedResponder.fullName || assignedResponder.name)?.charAt(0).toUpperCase()}
                          </div>
                          <div className="responder-info">
                            <div className="responder-name">
                              {assignedResponder.fullName || assignedResponder.name}
                            </div>
                            <div className="responder-email">
                              {assignedResponder.email}
                            </div>
                          </div>
                          <div className="drag-handle">⋮⋮</div>
                        </div>
                      ) : (
                        <div className="drop-zone">
                          <div className="drop-zone-content">
                            <div className="drop-icon">+</div>
                            <p>Drop responder here</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="view-modal-footer">
          <button onClick={onClose} className="view-close-btn">Cancel</button>
          <button onClick={handleSave} className="view-edit-btn">Save Team</button>
        </div>
      </div>
    </div>
  );
}