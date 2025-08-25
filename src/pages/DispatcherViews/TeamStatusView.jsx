import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore'; // Removed getFirestore
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'; // Removed getAuth

// Directly import db and auth assuming they are named exports from your firebase setup file
import { db, auth } from '../../firebase'; // FIX: Corrected import

// Load thresholds
const MAX_LOAD_AVAILABLE = 2;
const MAX_LOAD_BUSY = 4;
const MAX_LOAD_OVERLOADED = 5;

const TeamStatusView = () => {
  const [teamStatuses, setTeamStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Authenticate user anonymously
  useEffect(() => {
    const setupAuth = async () => {
      try {
        await signInAnonymously(auth);
        onAuthStateChanged(auth, (user) => {
          if (user) setUserId(user.uid);
        });
      } catch (error) {
        console.error('Firebase auth error:', error);
      }
    };
    setupAuth();
  }, []); // Empty dependency array means this runs once on mount

  // Listen to teams and incidents
  useEffect(() => {
    if (!userId) return; // Only run if a user is authenticated

    setLoading(true);

    // Teams listener
    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teams = {};
      snapshot.forEach(doc => {
        const [teamKey, shiftKey] = doc.id.split('-');
        if (teamKey && shiftKey) {
          teams[doc.id] = {
            id: doc.id,
            name: `${teamKey.charAt(0).toUpperCase() + teamKey.slice(1)} Team (${shiftKey})`,
            members: doc.data(),
            activeIncidents: 0,
          };
        }
      });
      setTeamStatuses(Object.values(teams));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false);
    });

    // Incidents listener
    const unsubscribeIncidents = onSnapshot(
      query(collection(db, 'incidents'), where('status', 'in', ['pending', 'responding'])),
      (snapshot) => {
        setTeamStatuses(prev => {
          const updated = prev.map(t => ({ ...t, activeIncidents: 0 })); // Reset counts
          snapshot.forEach(doc => {
            const incident = doc.data();
            if (incident.respondingTeam === 'all-responders') {
              updated.forEach(t => t.activeIncidents += 1);
            } else {
              const idx = updated.findIndex(t => t.id === incident.respondingTeam);
              if (idx !== -1) updated[idx].activeIncidents += 1;
            }
          });
          return updated;
        });
      }, (error) => {
        console.error("Error fetching incidents:", error);
      }
    );

    // Cleanup function for listeners
    return () => {
      unsubscribeTeams();
      unsubscribeIncidents();
    };
  }, [userId]); // Re-run when userId changes

  // Helpers for status display (using inline styles for brevity here)
  const getStatusColor = (load) => {
    if (load <= MAX_LOAD_AVAILABLE) return 'green';
    if (load <= MAX_LOAD_BUSY) return 'yellow';
    if (load <= MAX_LOAD_OVERLOADED) return 'orange';
    return 'red';
  };
  const getStatusText = (load) => {
    if (load <= MAX_LOAD_AVAILABLE) return 'Available';
    if (load <= MAX_LOAD_BUSY) return 'Busy';
    if (load <= MAX_LOAD_OVERLOADED) return 'High Load';
    return 'Overloaded';
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, sans-serif' }}>
      <h1>Team Status & Rescue Load</h1>
      <p>Real-time status and active rescue load for each team.</p>

      {loading ? (
        <p>Loading team status...</p>
      ) : teamStatuses.length === 0 ? (
        <p>No teams found.</p>
      ) : (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {teamStatuses.map(team => (
            <div key={team.id} style={{ border: '1px solid #ccc', padding: 20, borderRadius: 8 }}>
              <h3>{team.name}</h3>
              <div
                style={{
                  background: getStatusColor(team.activeIncidents),
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 20,
                  display: 'inline-block',
                  marginBottom: 10
                }}
              >
                {getStatusText(team.activeIncidents)}
              </div>
              <p>Active Incidents: {team.activeIncidents} / {MAX_LOAD_OVERLOADED}</p>
              <div style={{ height: 8, background: '#eee', borderRadius: 4 }}>
                <div
                  style={{
                    width: `${(Math.min(team.activeIncidents, MAX_LOAD_OVERLOADED) / MAX_LOAD_OVERLOADED) * 100}%`,
                    height: '100%',
                    background: getStatusColor(team.activeIncidents)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={{ marginTop: 20, fontSize: 12, color: '#999' }}>User ID: {userId || 'Authenticating...'}</p>
    </div>
  );
};

export default TeamStatusView;