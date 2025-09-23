import React, { useEffect, useState } from 'react';
import './modalstyles/TeamEditorModalStyles.css';

const roleLabels = {
  teamLeader: 'Team Leader',
  emt1: 'EMT 1',
  emt2: 'EMT 2',
  ambulanceDriver: 'Ambulance Driver'
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

  useEffect(() => {
    if (isOpen && currentTeam) {
      // Initialize form state with current team data
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
        // Exclude all assignments from the team and shift currently being edited.
        // This is the key fix. It ensures that any responder on the current team
        // is available for reassignment within that team.
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

    // Filter responders: allow any responder who is not assigned to another team/shift
    // Remove status check - now gets all responders with responder role
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
    
    return getFilteredResponders().filter(responder => 
      !assignedUids.has(responder.uid)
    );
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

  const handleSave = () => {
    console.log('Saving team data:', formState);
    onSave(selectedTeamKey, selectedShiftKey, formState);
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