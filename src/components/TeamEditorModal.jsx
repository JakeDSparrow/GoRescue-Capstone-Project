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
  selectedDeckIndex
}) {
  const [formState, setFormState] = useState({});

  useEffect(() => {
    if (isOpen) setFormState(currentTeam);
  }, [isOpen, currentTeam]);

  const handleSave = () => {
    onSave(teamDate, formState);
    onClose();
  };

  if (!isOpen) return null;

  const getFilteredResponders = (roleKey) => {
  // Get the deck being edited
  const currentDeck = teams?.[selectedTeamKey]?.[selectedDeckIndex] || {};

  // Collect all assigned uids except those in the current deck
  const assignedUids = new Set();

    Object.entries(teams || {}).forEach(([teamKey, decks]) => {
      decks.forEach((deck, idx) => {
        if (teamKey === selectedTeamKey && idx === selectedDeckIndex) return; // skip current deck
        Object.values(deck).forEach(role => {
          if (role?.uid) assignedUids.add(role.uid);
        });
      });
    });

    return responders.filter(r =>
      !assignedUids.has(r.uid) || r.uid === currentDeck?.[roleKey]?.uid
    );
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-content">
          <h2>Edit Deck for Team {teamDate.toUpperCase()}</h2>

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
                      // 1. Find if selected responder already has a role
                      const previousRoleKey = Object.keys(prev).find(
                        key => prev[key]?.uid === selectedUid
                      );

                      const updatedState = { ...prev };

                      // 2. If the selected responder is already assigned to another role, swap them
                      if (previousRoleKey && previousRoleKey !== roleKey) {
                        // Swap the two responders
                        const temp = updatedState[roleKey];
                        updatedState[roleKey] = selectedResponder;
                        updatedState[previousRoleKey] = temp || null;
                      } else {
                        // Otherwise, just assign them normally and remove them elsewhere
                        // Remove from all other roles
                        Object.keys(updatedState).forEach(key => {
                          if (updatedState[key]?.uid === selectedUid) {
                            updatedState[key] = null;
                          }
                        });
                        // Assign to current role
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
