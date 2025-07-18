import React, { useEffect, useState } from 'react';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import '../components/modalstyles/TeamEditorModalStyles.css';

const roleLabels = {
  teamLeader: 'Team Leader',
  emt1: 'EMT 1',
  emt2: 'EMT 2',
  ambulanceDriver: 'Ambulance Driver'
};

export default function TeamEditorModal({ isOpen, onClose, teamDate, currentTeam = {}, responders, onSave }) {
  const [formState, setFormState] = useState({});

  useEffect(() => {
    if (isOpen) setFormState(currentTeam);
  }, [isOpen, currentTeam]);

  const handleSave = () => {
    onSave(teamDate, formState);
    onClose();
  };

  return isOpen && (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-content">
          <h3>Edit TEAM {teamDate.toUpperCase()}</h3>

          {Object.entries(roleLabels).map(([roleKey, roleName]) => (
            <div className="form-group" key={roleKey}>
              <label>{roleName}</label>
              <select
                value={formState[roleKey]?.uid || ''}
                onChange={e => {
                  const res = responders.find(r => r.uid === e.target.value);
                  setFormState(prev => ({ ...prev, [roleKey]: res }));
                }}
              >
                <option value="">-- Not assigned --</option>
                {responders.map(r => (
                  <option key={r.uid} value={r.uid} disabled={r.status === 'unavailable'}>
                    {r.fullName || r.name}{r.status === 'unavailable' ? ' (Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
