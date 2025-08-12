import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const roleLabels = {
  teamLeader: 'Team Leader',
  emt1: 'EMT 1',
  emt2: 'EMT 2',
  ambulanceDriver: 'Ambulance Driver',
};

const defaultShift = {
  teamLeader: null,
  emt1: null,
  emt2: null,
  ambulanceDriver: null,
  shiftActive: false,
  shiftStart: null,
  shiftEnd: null,
  createdAt: null,
};

const SHIFT_TIMES = {
  dayShift: { startHour: 6, endHour: 18 },   // 6AM to 6PM
  nightShift: { startHour: 18, endHour: 6 }, // 6PM to 6AM next day
};

const teamsKeys = ['alpha', 'bravo'];
const shifts = ['dayShift', 'nightShift'];

function getShiftTimes(shiftKey) {
  const now = new Date();
  const { startHour, endHour } = SHIFT_TIMES[shiftKey];

  // Start time today at startHour
  const start = new Date(now);
  start.setHours(startHour, 0, 0, 0);

  // End time: if endHour < startHour, end time is next day
  const end = new Date(start);
  if (endHour <= startHour) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(endHour, 0, 0, 0);

  return { shiftStart: start.toISOString(), shiftEnd: end.toISOString() };
}

function isCurrentShiftActive(shiftStartISO, shiftEndISO) {
  const now = new Date();
  const start = new Date(shiftStartISO);
  const end = new Date(shiftEndISO);

  if (end > start) {
    return now >= start && now < end;
  } else {
    // Overnight shift
    return now >= start || now < end;
  }
}

export default function TeamOrganizerView() {
  const [responders, setResponders] = useState([]);
  const [teams, setTeams] = useState({
    alpha: { dayShift: { ...defaultShift }, nightShift: { ...defaultShift } },
    bravo: { dayShift: { ...defaultShift }, nightShift: { ...defaultShift } },
  });
  const [selectedTeamKey, setSelectedTeamKey] = useState(null);
  const [selectedShiftKey, setSelectedShiftKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const db = getFirestore();

  useEffect(() => {
    // Load responders (filter active responders)
    const loadResponders = async () => {
      const snapshot = await collection(db, 'mdrrmo-users');
      const docs = await getDocs(snapshot);
      const allUsers = docs.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      const filtered = allUsers.filter(
        u => u.role?.toLowerCase() === 'responder' && u.status !== 'inactive'
      );
      setResponders(filtered);
    };

    // Load shifts per team and shift
    const loadTeams = async () => {
      const loadedTeams = {
        alpha: {},
        bravo: {},
      };

      for (const teamKey of teamsKeys) {
        for (const shiftKey of shifts) {
          const docId = `${teamKey}-${shiftKey}`;
          const docRef = doc(db, 'teams', docId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            loadedTeams[teamKey][shiftKey] = {
              ...defaultShift,
              ...docSnap.data(),
              shiftStart: docSnap.data().shiftStart || getShiftTimes(shiftKey).shiftStart,
              shiftEnd: docSnap.data().shiftEnd || getShiftTimes(shiftKey).shiftEnd,
              createdAt: docSnap.data().createdAt || new Date().toISOString(),
            };
          } else {
            // If no doc, create default shift times
            const times = getShiftTimes(shiftKey);
            loadedTeams[teamKey][shiftKey] = {
              ...defaultShift,
              shiftActive: false,
              shiftStart: times.shiftStart,
              shiftEnd: times.shiftEnd,
              createdAt: new Date().toISOString(),
            };
            // Save default to Firestore
            await setDoc(docRef, loadedTeams[teamKey][shiftKey]);
          }
        }
      }
      setTeams(loadedTeams);
    };

    loadResponders();
    loadTeams();
  }, []);

  // Open modal for editing a shift
  const handleEdit = (teamKey, shiftKey) => {
    setSelectedTeamKey(teamKey);
    setSelectedShiftKey(shiftKey);
    setIsModalOpen(true);
  };

  // Save changes to Firestore and state
  const handleSave = async (teamKey, shiftKey, updatedShift) => {
    const docId = `${teamKey}-${shiftKey}`;
    const docRef = doc(db, 'teams', docId);

    const shiftToSave = {
      ...updatedShift,
      createdAt: new Date().toISOString(),
      shiftStart: updatedShift.shiftStart || teams[teamKey][shiftKey].shiftStart,
      shiftEnd: updatedShift.shiftEnd || teams[teamKey][shiftKey].shiftEnd,
    };

    await setDoc(docRef, shiftToSave);

    setTeams(prev => ({
      ...prev,
      [teamKey]: {
        ...prev[teamKey],
        [shiftKey]: shiftToSave,
      },
    }));
  };

  // Extend shift end by 1 hour
  const extendShift = async (teamKey, shiftKey) => {
    const shift = teams[teamKey][shiftKey];
    const currentEnd = new Date(shift.shiftEnd);
    currentEnd.setHours(currentEnd.getHours() + 1);

    const updatedShift = {
      ...shift,
      shiftEnd: currentEnd.toISOString(),
    };
    await handleSave(teamKey, shiftKey, updatedShift);
  };

  // Toggle shift active status manually
  const toggleShiftActive = async (teamKey, shiftKey) => {
    const shift = teams[teamKey][shiftKey];
    const updatedShift = {
      ...shift,
      shiftActive: !shift.shiftActive,
    };
    await handleSave(teamKey, shiftKey, updatedShift);
  };

  // Collect assigned responder UIDs across all teams and shifts, to prevent duplicates in modal
  const assignedUids = new Set();
  Object.values(teams).forEach(teamShifts => {
    Object.values(teamShifts).forEach(shift => {
      Object.entries(shift).forEach(([key, val]) => {
        if (roleLabels[key] && val?.uid) assignedUids.add(val.uid);
      });
    });
  });

  // Current editing shift
  const currentShift =
    selectedTeamKey && selectedShiftKey ? teams[selectedTeamKey][selectedShiftKey] : null;

  // Filter responders: exclude those assigned in other shifts except current editing shift
  const filteredResponders = responders.filter(responder => {
    if (!responder.uid) return false;
    if (!assignedUids.has(responder.uid)) return true;
    if (!currentShift) return false;
    return Object.entries(currentShift).some(([key, val]) => val?.uid === responder.uid);
  });

  return (
    <div className="team-organizer-container">
      <h2>Team Organizer</h2>
      <div className="teams-container">
        {teamsKeys.map(teamKey => (
          <div key={teamKey} className="team-section">
            <h3>{`Team ${teamKey.toUpperCase()}`}</h3>
            {shifts.map(shiftKey => {
              const shift = teams[teamKey][shiftKey];
              if (!shift) return null;

              const isActive =
                shift.shiftActive || isCurrentShiftActive(shift.shiftStart, shift.shiftEnd);
              const startTime = new Date(shift.shiftStart).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endTime = new Date(shift.shiftEnd).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={shiftKey}
                  className={`deck-card ${isActive ? 'active' : ''}`}
                >
                  <div className="deck-header">
                    <div className="deck-title-group">
                      <strong>{shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}</strong>
                      {isActive && (
                        <span style={{ color: '#6c8c44', fontWeight: '600', fontSize: '0.9rem' }}>
                          (Active)
                        </span>
                      )}
                    </div>
                    <div className="deck-actions">
                      <button className="edit-button" onClick={() => handleEdit(teamKey, shiftKey)}>✏️ Edit</button>
                      <button className="edit-button" onClick={() => extendShift(teamKey, shiftKey)}>➕ Extend 1h</button>
                      <button
                        className={isActive ? 'delete-button' : 'edit-button'}
                        onClick={() => toggleShiftActive(teamKey, shiftKey)}
                      >
                        {isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  <div className="deck-timestamp">
                    {startTime} - {endTime}
                  </div>

                  <div className="deck-body">
                    {Object.entries(roleLabels).map(([roleKey, label]) => {
                      const user = shift[roleKey];
                      const iconMap = {
                        teamLeader: 'fas fa-user-shield',
                        emt1: 'fas fa-user-nurse',
                        emt2: 'fas fa-user-nurse',
                        ambulanceDriver: 'fas fa-ambulance',
                      };
                      return (
                        <div key={roleKey} className="deck-row">
                          <div className="deck-role">
                            <i className={iconMap[roleKey]}></i>
                            <span className="role-label">{label}</span>
                          </div>
                          <span className={user?.fullName ? 'role-name' : 'unassigned'}>
                            {user?.fullName || 'Not assigned'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {shift.createdAt && (
                    <div className="deck-timestamp" style={{ marginTop: '10px' }}>
                      Created: {new Date(shift.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && selectedTeamKey && selectedShiftKey && (
        <TeamEditorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          teamDate={selectedTeamKey}
          currentTeam={teams[selectedTeamKey][selectedShiftKey]}
          responders={filteredResponders}
          onSave={(teamKey, data) => {
            handleSave(teamKey, selectedShiftKey, data);
            setIsModalOpen(false);
          }}
          teams={teams}
          selectedTeamKey={selectedTeamKey}
          selectedDeckIndex={null}
          decks={[]}
        />
      )}
    </div>
  );
}
