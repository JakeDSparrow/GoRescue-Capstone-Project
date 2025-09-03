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
  teamDate, // This is actually the team key (alpha/bravo)
  currentTeam = {},
  responders,
  onSave,
  teams,
  selectedTeamKey,
  selectedShiftKey // Add this prop to know which shift we're editing
}) {
  const [formState, setFormState] = useState({});

  useEffect(() => {
    if (isOpen && currentTeam) {
      // Initialize form state with current team data
      setFormState({ ...currentTeam });
      console.log('Modal opened with team data:', currentTeam);
    }
  }, [isOpen, currentTeam]);

  const getFilteredResponders = (roleKey) => {
    if (!teams || !responders) return [];
    
    const assignedUids = new Set();

    // Go through all teams and shifts to find already assigned responders
    Object.entries(teams).forEach(([teamKey, teamShifts]) => {
      Object.entries(teamShifts || {}).forEach(([shiftKey, shift]) => {
        // Skip the current shift we're editing
        if (teamKey === selectedTeamKey && shiftKey === selectedShiftKey) {
          return;
        }
        
        // Add all assigned UIDs from other shifts
        Object.entries(roleLabels).forEach(([roleType]) => {
          if (shift?.[roleType]?.uid) {
            assignedUids.add(shift[roleType].uid);
          }
        });
      });
    });

    // Filter responders: exclude already assigned ones, but include the current assignment for this role
    return responders.filter(responder => {
      // Always include if not assigned anywhere else
      if (!assignedUids.has(responder.uid)) return true;
      
      // Include if currently assigned to this role (allows keeping current assignment)
      if (formState[roleKey]?.uid === responder.uid) return true;
      
      // Exclude if assigned elsewhere
      return false;
    });
  };

  const handleRoleChange = (roleKey, selectedUid) => {
    const selectedResponder = responders.find(r => r.uid === selectedUid);
    
    setFormState(prev => {
      const newState = { ...prev };
      
      if (!selectedUid) {
        // Unassigning - just clear this role
        newState[roleKey] = null;
      } else {
        // Check if this responder is already assigned to another role in this shift
        const currentlyAssignedRole = Object.keys(roleLabels).find(
          role => newState[role]?.uid === selectedUid
        );
        
        if (currentlyAssignedRole && currentlyAssignedRole !== roleKey) {
          // Swap the assignments
          const temp = newState[roleKey];
          newState[roleKey] = selectedResponder;
          newState[currentlyAssignedRole] = temp;
        } else {
          // Simple assignment
          newState[roleKey] = selectedResponder;
        }
      }
      
      console.log('Form state updated:', newState);
      return newState;
    });
  };

  const handleSave = () => {
    console.log('Saving team data:', formState);
    // Pass the team key and shift key, not teamDate
    onSave(selectedTeamKey, selectedShiftKey, formState);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-content">
          <h2>Edit {selectedTeamKey?.toUpperCase()} Team - {selectedShiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}</h2>

          <div className="form-section">
            {Object.entries(roleLabels).map(([roleKey, label]) => {
              const availableResponders = getFilteredResponders(roleKey);
              const currentValue = formState[roleKey]?.uid || '';
              
              return (
                <div className="form-group" key={roleKey}>
                  <label>{label}</label>
                  <select
                    value={currentValue}
                    onChange={e => handleRoleChange(roleKey, e.target.value)}
                  >
                    <option value="">-- Not assigned --</option>
                    {availableResponders.map(responder => {
                      const isUnavailable = responder.status?.toLowerCase() === 'unavailable';
                      return (
                        <option
                          key={responder.uid}
                          value={responder.uid}
                          disabled={isUnavailable}
                        >
                          {responder.fullName || responder.name}
                          {isUnavailable ? ' (Unavailable)' : ''}
                        </option>
                      );
                    })}
                  </select>
                  
                  {/* Debug info - remove in production */}
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
                    Available: {availableResponders.length} | 
                    Current: {formState[roleKey]?.fullName || 'None'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="modal-actions">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn btn-primary">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}