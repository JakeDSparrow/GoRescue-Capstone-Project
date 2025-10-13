import React, { useState, useEffect } from 'react';
import TeamEditorModal from '../../components/TeamEditorModal';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
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

// Helper function to format time in Philippine Standard Time
function formatTimeInPST(date) {
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Helper function to check if team is within their shift time
function isWithinShift(shiftKey, currentTime) {
  const { startHour, endHour } = SHIFT_TIMES[shiftKey];
  // Convert to Philippine time
  const philippineTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const currentHour = philippineTime.getHours();
  
  if (shiftKey === 'dayShift') {
    // Day shift: 6 AM - 6 PM
    return currentHour >= startHour && currentHour < endHour;
  } else {
    // Night shift: 6 PM - 6 AM (next day)
    return currentHour >= startHour || currentHour < endHour;
  }
}

// Helper function to check if team is active (within shift time and has members)
function isTeamActive(shift, shiftKey, currentTime) {
  return hasMembers(shift) && isWithinShift(shiftKey, currentTime);
}

// Helper function to check if team is on call (has members but not in shift time)
function isTeamOnCall(shift, shiftKey, currentTime) {
  return hasMembers(shift) && !isWithinShift(shiftKey, currentTime);
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
  const [isReassign, setIsReassign] = useState(false);
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
          createdAt: new Date().toISOString(),
        };
        continue;
      }

      if (docSnap && docSnap.exists()) {
        loadedTeams[teamKey][shiftKey] = {
          ...docSnap.data(),
        };
      } else {
        const newShift = {
          ...defaultShift,
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
    setIsReassign(false);
    setIsModalOpen(true);
  };

  const handleReassign = (teamKey, shiftKey) => {
    setSelectedTeamKey(teamKey);
    setSelectedShiftKey(shiftKey);
    setIsReassign(true);
    setIsModalOpen(true);
  };

  const handleSave = async (teamKey, shiftKey, updatedShift) => {
    try {
      const docId = `${teamKey}-${shiftKey}`;
      const docRef = doc(db, 'teams', docId);
      const shiftToSave = {
        ...updatedShift,
        createdAt: new Date().toISOString(),
        // Don't override status if it exists (let mobile app manage it)
        status: updatedShift.status || teams[teamKey][shiftKey].status || 'active'
      };
      await setDoc(docRef, shiftToSave);

      // After saving the team, sync mdrrmo-users.teamId assignments
      const prevShift = teams[teamKey][shiftKey] || {};
      const roleKeys = Object.keys({ teamLeader: true, emt1: true, emt2: true, ambulanceDriver: true });

      const prevAssignedUids = new Set(
        roleKeys
          .map(rk => prevShift[rk]?.uid)
          .filter(Boolean)
      );
      const newAssignedUids = new Set(
        roleKeys
          .map(rk => updatedShift[rk]?.uid)
          .filter(Boolean)
      );

      const teamId = docId;
      const updates = [];

      // Users newly assigned → set teamId
      newAssignedUids.forEach(uid => {
        if (!prevAssignedUids.has(uid)) {
          const userRef = doc(db, 'mdrrmo-users', uid);
          updates.push(updateDoc(userRef, { teamId }));
        }
      });

      // Users removed → clear teamId
      prevAssignedUids.forEach(uid => {
        if (!newAssignedUids.has(uid)) {
          const userRef = doc(db, 'mdrrmo-users', uid);
          updates.push(updateDoc(userRef, { teamId: null }));
        }
      });

      if (updates.length) {
        await Promise.all(updates);
      }

      setTeams(prev => ({
        ...prev,
        [teamKey]: { ...prev[teamKey], [shiftKey]: shiftToSave },
      }));
      console.log(`✅ Shift saved and user teamId synced: ${docId}`);
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
        {/* Header removed per request */}
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
        {/* Header removed per request */}
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
      {/* Header removed per request */}
      
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

              const isActive = isTeamActive(shift, shiftKey, currentTime);
              const isOnCall = isTeamOnCall(shift, shiftKey, currentTime);
              const currentTimePST = formatTimeInPST(currentTime);
              const shiftTimes = SHIFT_TIMES[shiftKey];
              const shiftTimeDisplay = shiftKey === 'dayShift' 
                ? `6:00 AM - 6:00 PM` 
                : `6:00 PM - 6:00 AM`;

              return (
                <div
                  key={shiftKey}
                  className={`deck-card ${isActive ? 'active' : isOnCall ? 'oncall' : ''}`}
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
                      {isOnCall && (
                        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.9rem' }}>
                          (On Call)
                        </span>
                      )}
                    </div>
                    <div className="deck-actions">
                      <button className="edit-button" onClick={() => handleEdit(teamKey, shiftKey)}>
                        ✏️ Edit
                      </button>
                      <button className="clear-button" onClick={() => handleReassign(teamKey, shiftKey)}>
                        🔁 Reassign
                      </button>
                    </div>
                  </div>

                  <div className="deck-timestamp">
                    Shift Time: {shiftTimeDisplay} PST
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
                      Created: {new Date(shift.createdAt).toLocaleString('en-US', {
                        timeZone: 'America/Los_Angeles',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })} PST
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
          currentTeam={isReassign ? { teamLeader: null, emt1: null, emt2: null, ambulanceDriver: null } : teams[selectedTeamKey][selectedShiftKey]}
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