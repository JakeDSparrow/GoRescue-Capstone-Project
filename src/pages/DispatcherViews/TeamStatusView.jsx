// Let's go with this more robust approach
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from '../../firebase';

const TeamStatusView = () => {
  const [teamStatuses, setTeamStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [teamsData, setTeamsData] = useState(null); // New state to hold teams data

  // Authenticate user anonymously
  useEffect(() => {
    const setupAuth = async () => {
      try {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            const userCredential = await signInAnonymously(auth);
            setUserId(userCredential.user.uid);
          }
        });
      } catch (error) {
        console.error('Firebase auth error:', error);
        setLoading(false);
      }
    };
    setupAuth();
  }, []);

  // Listener for teams data
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teams = {};
      snapshot.forEach(doc => {
        teams[doc.id] = {
          id: doc.id,
          name: doc.id.replace('-', ' ').toUpperCase(),
          members: doc.data(),
          missions: []
        };
      });
      setTeamsData(teams); // Update the state with new teams data
      setLoading(false);
    }, (error) => {
      console.error('Error fetching teams:', error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // Listener for incidents data, dependent on teamsData
  useEffect(() => {
    // Only run this effect if teamsData is available and not null
    if (!teamsData) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'incidents'), where('status', 'in', ['pending', 'in-progress'])),
      (snapshot) => {
        const missionsPerTeam = {};
        snapshot.forEach(doc => {
          const incident = doc.data();
          const teamId = incident.respondingTeam;

          if (teamId === 'all-responders') {
            Object.keys(teamsData).forEach(id => {
              if (!missionsPerTeam[id]) missionsPerTeam[id] = [];
              missionsPerTeam[id].push(incident);
            });
          } else if (teamId && teamsData[teamId]) {
            if (!missionsPerTeam[teamId]) missionsPerTeam[teamId] = [];
            missionsPerTeam[teamId].push(incident);
          }
        });

        const updatedTeams = Object.values(teamsData).map(team => ({
          ...team,
          missions: missionsPerTeam[team.id] || []
        }));
        setTeamStatuses(updatedTeams);
      },
      (error) => console.error('Error fetching incidents:', error)
    );
    return () => unsubscribe();
  }, [teamsData]); // This effect re-runs when teamsData changes

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem', overflowY: 'auto' }} className="team-missions-dashboard">
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
        <i className="fas fa-chart-bar" style={{ marginRight: '0.5rem', color: '#3b82f6' }}></i>
        Team Missions Dashboard
      </h2>

      {loading ? (
        <div style={{
          backgroundColor: 'white',
          padding: '3rem',
          borderRadius: '0.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem', color: '#3b82f6' }}></i>
          Loading team missions...
        </div>
      ) : teamStatuses.length === 0 && teamsData && Object.keys(teamsData).length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '3rem',
          borderRadius: '0.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <i className="fas fa-users" style={{ fontSize: '3rem', color: '#d1d5db', marginBottom: '1rem' }}></i>
          <p>No teams found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {teamStatuses.map(team => (
            <div key={team.id} style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{team.name}</h3>
                <span>{team.missions.length} mission(s)</span>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
                <strong>Team Members ({Object.keys(team.members || {}).length}):</strong>
                <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>
                  {Object.entries(team.members || {}).map(([role, member], index) => (
                    member ? <li key={index}>{role}: {member.fullName || member}</li> : null
                  ))}
                </ul>
              </div>

              <div style={{ marginTop: '0.5rem' }}>
                <strong>Active Missions:</strong>
                {team.missions.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>No active missions</p>
                ) : (
                  <ul style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>
                    {team.missions.map((mission, idx) => (
                      <li key={idx} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <strong>{mission.reportId}</strong> - {mission.locationText || mission.description}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamStatusView;