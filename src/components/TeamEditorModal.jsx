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
  teamDate,
  currentTeam = {},
  responders,
  onSave,
  teams,
  selectedTeamKey,
  selectedDeckIndex // will be ignored in shift mode
}) {
  const [formState, setFormState] = useState({});

  useEffect(() => {
    if (isOpen) setFormState(currentTeam);
  }, [isOpen, currentTeam]);

  // Filter responders to exclude those assigned in other shifts
  const getFilteredResponders = (roleKey) => {
    const currentShift = teams?.[selectedTeamKey] || {};
    const assignedUids = new Set();

    Object.entries(teams || {}).forEach(([teamKey, shift]) => {
      if (teamKey === selectedTeamKey) return; // skip current shift
      Object.values(shift || {}).forEach(role => {
        if (role?.uid) assignedUids.add(role.uid);
      });
    });

    return responders.filter(r =>
      !assignedUids.has(r.uid) || r.uid === currentShift?.[roleKey]?.uid
    );
  };

  const handleSave = () => {
    onSave(teamDate, formState);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-content">
          <h2>Edit Team for {teamDate.toUpperCase()}</h2>

          <div className="form-section">
            {Object.entries(roleLabels).map(([roleKey, label]) => (
              <div className="form-group" key={roleKey}>
                <label>{label}</label>
                <select
                  value={formState[roleKey]?.uid || ''}
                  onChange={e => {
                    const selectedUid = e.target.value;
                    const selectedResponder = responders.find(r => r.uid === selectedUid);

                    setFormState(prev => {
                      // Find if selected responder already assigned elsewhere in this shift
                      const previousRoleKey = Object.keys(prev).find(
                        key => prev[key]?.uid === selectedUid
                      );

                      const updatedState = { ...prev };

                      if (previousRoleKey && previousRoleKey !== roleKey) {
                        // Swap roles
                        const temp = updatedState[roleKey];
                        updatedState[roleKey] = selectedResponder;
                        updatedState[previousRoleKey] = temp || null;
                      } else {
                        // Remove from other roles and assign to current role
                        Object.keys(updatedState).forEach(key => {
                          if (updatedState[key]?.uid === selectedUid) {
                            updatedState[key] = null;
                          }
                        });
                        updatedState[roleKey] = selectedResponder || null;
                      }

                      return updatedState;
                    });
                  }}
                >
                  <option value="">-- Not assigned --</option>
                  {getFilteredResponders(roleKey).map(r => (
                    <option
                      key={r.uid}
                      value={r.uid}
                      disabled={r.status === 'unavailable'}
                    >
                      {r.fullName || r.name}
                      {r.status === 'unavailable' ? ' (Unavailable)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
