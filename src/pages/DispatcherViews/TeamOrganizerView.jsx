import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const db = getFirestore();
  const auth = getAuth();

  // Check current user and their role
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const userDocRef = doc(db, 'mdrrmo-users', user.uid);
      getDoc(userDocRef).then(docSnap => {
        if (docSnap.exists()) {
          const userData = { uid: docSnap.id, ...docSnap.data() };
          setCurrentUser(userData);
          console.log('Current user:', userData);
        }
      }).catch(error => {
        console.error('Error fetching current user:', error);
      });
    }
  }, [db, auth]);

  async function loadTeamsData() {
    const teamsToLoad = [];
    for (const teamKey of teamsKeys) {
      for (const shiftKey of shifts) {
        const docId = `${teamKey}-${shiftKey}`;
        const docRef = doc(db, 'teams', docId);
        teamsToLoad.push({ teamKey, shiftKey, docRef, docId });
      }
    }

    const snapshots = await Promise.all(
      teamsToLoad.map(async (item) => {
        try {
          const docSnap = await getDoc(item.docRef);
          return { ...item, docSnap, success: true };
        } catch (error) {
          console.error(`Error loading team ${item.docId}:`, error);
          return { ...item, docSnap: null, success: false, error };
        }
      })
    );
    
    const loadedTeams = { alpha: {}, bravo: {} };

    for (const item of snapshots) {
      const { teamKey, shiftKey, docRef, docSnap, success } = item;
      
      if (!success) {
        console.warn(`Failed to load ${teamKey}-${shiftKey}, using default`);
        loadedTeams[teamKey][shiftKey] = {
          ...defaultShift,
          ...getShiftTimes(shiftKey),
          createdAt: new Date().toISOString(),
        };
        continue;
      }

      const times = getShiftTimes(shiftKey);

      if (docSnap && docSnap.exists()) {
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
        
        // Try to create the document
        try {
          await setDoc(docRef, newShift);
          console.log(`Created new shift document: ${teamKey}-${shiftKey}`);
        } catch (error) {
          console.error(`Failed to create shift document ${teamKey}-${shiftKey}:`, error);
        }
      }
    }
    return loadedTeams;
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        console.log('Starting to fetch data...');

        // Load responders
        console.log('Fetching responders...');
        try {
          const respondersSnapshot = await getDocs(collection(db, 'mdrrmo-users'));
          const allUsers = respondersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
          console.log('All users fetched:', allUsers.length);

          const activeResponders = allUsers.filter(
            u => u.role?.toLowerCase() === 'responder' && u.status?.toLowerCase() !== 'inactive'
          );
          console.log('Active responders:', activeResponders.length);
          setResponders(activeResponders);
        } catch (responderError) {
          console.error('❌ Failed to load responders:', responderError);
          console.error('Error code:', responderError.code);
          console.error('Error message:', responderError.message);
          throw new Error(`Failed to load responders: ${responderError.message}`);
        }

        // Load teams data
        console.log('Fetching teams data...');
        try {
          const teamsData = await loadTeamsData();
          console.log('Teams data loaded:', teamsData);
          setTeams(teamsData);
        } catch (teamsError) {
          console.error('❌ Failed to load teams:', teamsError);
          console.error('Error code:', teamsError.code);
          console.error('Error message:', teamsError.message);
          throw new Error(`Failed to load teams: ${teamsError.message}`);
        }

        console.log('✅ All data fetched successfully');
      } catch (error) {
        console.error('❌ Failed to load data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    // Only load data if user is authenticated
    if (auth.currentUser) {
      loadData();
    } else {
      setError('User not authenticated');
      setLoading(false);
    }

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, [db, auth]);

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
        // Don't override status if it exists (let mobile app manage it)
        status: updatedShift.status || teams[teamKey][shiftKey].status || 'active'
      };
      await setDoc(docRef, shiftToSave);
      setTeams(prev => ({
        ...prev,
        [teamKey]: { ...prev[teamKey], [shiftKey]: shiftToSave },
      }));
      console.log(`✅ Shift saved successfully: ${docId}`);
    } catch (error) {
      console.error('❌ Failed to save shift:', error);
      alert(`Failed to save shift: ${error.message}`);
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

  if (loading) {
    return (
      <div className="team-organizer-container">
        <h2>Team Organizer</h2>
        <div>Loading teams and responders...</div>
        {currentUser && (
          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
            Logged in as: {currentUser.fullName || currentUser.email} ({currentUser.role})
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-organizer-container">
        <h2>Team Organizer</h2>
        <div style={{ color: 'red', padding: '20px', border: '1px solid red', borderRadius: '5px' }}>
          <strong>Error loading data:</strong> {error}
          <br />
          <br />
          <strong>Troubleshooting:</strong>
          <ul>
            <li>Check if you're logged in with the correct account</li>
            <li>Verify your role is 'admin' or 'dispatcher' in the database</li>
            <li>Check Firestore security rules allow your role to read the collections</li>
            <li>Check browser console for more detailed error messages</li>
          </ul>
          {currentUser && (
            <div style={{ marginTop: '10px', fontSize: '0.9rem' }}>
              Current user: {currentUser.fullName || currentUser.email} (Role: {currentUser.role})
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="team-organizer-container">
      <h2>Team Organizer</h2>
      
      {currentUser && (
        <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '20px' }}>
          Logged in as: {currentUser.fullName || currentUser.email} ({currentUser.role}) | 
          Responders loaded: {responders.length}
        </div>
      )}

      <div className="teams-container">
        {teamsKeys.map(teamKey => (
          <div key={teamKey} className="team-section">
            <h3>{`Team ${teamKey.charAt(0).toUpperCase()}${teamKey.slice(1)}`}</h3>
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
                        {shiftKey === 'dayShift' ? 'Day Shift ☀️' : 'Night Shift 🌙'}
                      </strong>
                      {isActive && (
                        <span style={{ color: '#6c8c44', fontWeight: 600, fontSize: '0.9rem' }}>
                          (Active)
                        </span>
                      )}
                    </div>
                    <div className="deck-actions">
                      <button className="edit-button" onClick={() => handleEdit(teamKey, shiftKey)}>
                        ✏️ Edit
                      </button>
                      <button className="clear-button" onClick={() => clearShift(teamKey, shiftKey)}>
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
                          <span className={user?.fullName ? 'role-name' : 'unassigned'}>
                            {user?.fullName || 'Not assigned'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {shift.createdAt && (
                    <div className="deck-timestamp" style={{ marginTop: 10 }}>
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
          teamDate={selectedTeamKey} // Keep for backward compatibility
          currentTeam={teams[selectedTeamKey][selectedShiftKey]}
          responders={responders}
          onSave={(teamKey, shiftKey, data) => {
            handleSave(teamKey, shiftKey, data);
            setIsModalOpen(false);
          }}
          teams={teams}
          selectedTeamKey={selectedTeamKey}
          selectedShiftKey={selectedShiftKey} // Add this prop
        />
      )}
    </div>
  );
}