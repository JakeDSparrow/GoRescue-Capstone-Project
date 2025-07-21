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
  onSave
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
                    const selected = responders.find(r => r.uid === e.target.value);
                    setFormState(prev => ({ ...prev, [roleKey]: selected }));
                  }}
                >
                  <option value="">-- Not assigned --</option>
                  {responders.map(r => (
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
