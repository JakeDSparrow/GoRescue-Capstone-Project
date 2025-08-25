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
  shiftStart: null,
  shiftEnd: null,
  createdAt: null,
};

const SHIFT_TIMES = {
  dayShift: { startHour: 6, endHour: 18 },
  nightShift: { startHour: 18, endHour: 6 },
};

const teamsKeys = ['alpha', 'bravo'];
const shifts = ['dayShift', 'nightShift'];

function getShiftTimes(shiftKey) {
  const now = new Date();
  const { startHour, endHour } = SHIFT_TIMES[shiftKey];
  const start = new Date(now);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(now);
  end.setHours(endHour, 0, 0, 0);

  if (endHour <= startHour) {
    end.setDate(end.getDate() + 1);
  }

  return { shiftStart: start.toISOString(), shiftEnd: end.toISOString() };
}

function isWithinShift(shift, now) {
  if (!shift || !shift.shiftStart || !shift.shiftEnd) return false;

  const start = new Date(shift.shiftStart);
  const end = new Date(shift.shiftEnd);

  if (start.getHours() > end.getHours()) {
    return now >= start || now < end;
  }

  return now >= start && now < end;
}

function hasMembers(shift) {
  if (!shift) return false;
  return Object.keys(roleLabels).some(role => shift[role]?.uid);
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
  const [currentTime, setCurrentTime] = useState(new Date());

  const db = getFirestore();

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Fetching data...');
        const [respondersSnapshot, teamsData] = await Promise.all([
          getDocs(collection(db, 'mdrrmo-users')),
          loadTeamsData()
        ]);

        const allUsers = respondersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setResponders(
          allUsers.filter(u => u.role?.toLowerCase() === 'responder' && u.status !== 'inactive')
        );
        setTeams(teamsData);
        console.log('Data fetched successfully.');

      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    const loadTeamsData = async () => {
      const teamsToLoad = [];
      for (const teamKey of teamsKeys) {
        for (const shiftKey of shifts) {
          const docId = `${teamKey}-${shiftKey}`;
          const docRef = doc(db, 'teams', docId);
          teamsToLoad.push({ teamKey, shiftKey, docRef });
        }
      }

      const snapshots = await Promise.all(teamsToLoad.map(item => getDoc(item.docRef)));
      const loadedTeams = { alpha: {}, bravo: {} };

      for (let i = 0; i < snapshots.length; i++) {
        const { teamKey, shiftKey, docRef } = teamsToLoad[i];
        const docSnap = snapshots[i];
        const times = getShiftTimes(shiftKey);

        if (docSnap.exists()) {
          loadedTeams[teamKey][shiftKey] = {
            ...docSnap.data(),
            shiftStart: times.shiftStart,
            shiftEnd: times.shiftEnd,
          };
        } else {
          const newShift = {
            ...defaultShift,
            ...times,
            createdAt: new Date().toISOString(),
          };
          loadedTeams[teamKey][shiftKey] = newShift;
          await setDoc(docRef, newShift);
        }
      }
      return loadedTeams;
    };

    loadData();

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, [db]);

  const handleEdit = (teamKey, shiftKey) => {
    setSelectedTeamKey(teamKey);
    setSelectedShiftKey(shiftKey);
    setIsModalOpen(true);
  };

  const handleSave = async (teamKey, shiftKey, updatedShift) => {
    try {
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
        [teamKey]: { ...prev[teamKey], [shiftKey]: shiftToSave },
      }));
    } catch (error) {
      console.error('Failed to save shift:', error);
    }
  };

  const clearShift = async (teamKey, shiftKey) => {
    const shift = teams[teamKey][shiftKey];
    const clearedShift = {
      ...shift,
      teamLeader: null,
      emt1: null,
      emt2: null,
      ambulanceDriver: null,
    };
    await handleSave(teamKey, shiftKey, clearedShift);
  };

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

              const isActive = hasMembers(shift) && isWithinShift(shift, currentTime);
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
                      <strong>
                        {shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}
                      </strong>
                      {isActive && (
                        <span
                          style={{
                            color: '#6c8c44',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                          }}
                        >
                          (Active)
                        </span>
                      )}
                    </div>
                    <div className="deck-actions">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit(teamKey, shiftKey)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="clear-button"
                        onClick={() => clearShift(teamKey, shiftKey)}
                      >
                        🗑️ Clear
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
                          <span
                            className={
                              user?.fullName ? 'role-name' : 'unassigned'
                            }
                          >
                            {user?.fullName || 'Not assigned'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {shift.createdAt && (
                    <div
                      className="deck-timestamp"
                      style={{ marginTop: 10 }}
                    >
                      Created: {new Date(shift.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isModalOpen && selectedTeamKey && selectedShiftKey && (
        <TeamEditorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          teamDate={selectedTeamKey}
          currentTeam={teams[selectedTeamKey][selectedShiftKey]}
          responders={responders.filter(
            r =>
              !Object.values(teams[selectedTeamKey][selectedShiftKey]).some(
                val => val?.uid === r.uid
              )
          )}
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