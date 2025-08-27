import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from '../../firebase'; // Assuming your firebase config is here

// Load thresholds
const MAX_LOAD_AVAILABLE = 2;
const MAX_LOAD_BUSY = 4;
const MAX_LOAD_OVERLOADED = 5;

const TeamStatusView = () => {
  const [teamStatuses, setTeamStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Authenticate user anonymously if not already authenticated
  useEffect(() => {
    const setupAuth = async () => {
      try {
        onAuthStateChanged(auth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            // Sign in anonymously if no user is authenticated
            const userCredential = await signInAnonymously(auth);
            setUserId(userCredential.user.uid);
          }
        });
      } catch (error) {
        console.error('Firebase auth error:', error);
        setLoading(false); // Stop loading on auth error
      }
    };
    setupAuth();
  }, []);

  // Listen to teams and incidents in real-time
  useEffect(() => {
    if (!userId) return; // Only run if a user is authenticated

    setLoading(true);

    // This object will hold the current state of teams fetched from Firestore
    // It's updated by the teams listener and used by the incidents listener
    let teamsSnapshotData = {};

    // 1. Teams Listener: Fetches all teams and updates the base team data.
    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (teamsSnapshot) => {
      const teams = {};
      teamsSnapshot.forEach(doc => {
        const [teamKey, shiftKey] = doc.id.split('-');
        if (teamKey && shiftKey) {
          teams[doc.id] = {
            id: doc.id,
            // Format team name nicely, e.g., "Alpha Team (Day)"
            name: `${teamKey.charAt(0).toUpperCase() + teamKey.slice(1)} Team (${shiftKey.charAt(0).toUpperCase() + shiftKey.slice(1)})`,
            members: doc.data(), // Store all member data
            activeIncidents: 0, // Initialize incident count for each team
          };
        }
      });
      teamsSnapshotData = teams; // Update the reference for incidents listener
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false); // Stop loading on error
    });

    // 2. Incidents Listener: Fetches active incidents and updates the incident counts for teams.
    const unsubscribeIncidents = onSnapshot(
      query(collection(db, 'incidents'), where('status', 'in', ['pending', 'in-progress'])),
      (incidentsSnapshot) => {
        const incidentsCount = {}; // Temporary object to count incidents per team

        incidentsSnapshot.forEach(doc => {
          const incident = doc.data();
          const teamId = incident.respondingTeam; // The ID of the team assigned to this incident

          if (teamId === 'all-responders') {
            // If the incident is assigned to 'all-responders', increment count for all teams
            Object.keys(teamsSnapshotData).forEach(id => {
              incidentsCount[id] = (incidentsCount[id] || 0) + 1;
            });
          } else if (teamId && teamsSnapshotData[teamId]) {
            // If a specific team is assigned and exists, increment its count
            incidentsCount[teamId] = (incidentsCount[teamId] || 0) + 1;
          }
        });

        // Update the React state for team statuses based on the latest teams and incident counts
        const updatedTeams = Object.values(teamsSnapshotData).map(team => ({
          ...team,
          activeIncidents: incidentsCount[team.id] || 0 // Set incident count, default to 0 if none
        }));
        
        setTeamStatuses(updatedTeams);
      }, (error) => {
        console.error("Error fetching incidents:", error);
      }
    );

    // Cleanup function for listeners
    return () => {
      unsubscribeTeams();
      unsubscribeIncidents();
    };
  }, [userId]);

  // Helper functions for dynamic styling and text based on load
  const getStatusColor = (load) => {
    if (load <= MAX_LOAD_AVAILABLE) return '#22c55e'; // Green
    if (load <= MAX_LOAD_BUSY) return '#eab308'; // Yellow
    if (load <= MAX_LOAD_OVERLOADED) return '#f97316'; // Orange
    return '#ef4444'; // Red (Overloaded)
  };

  const getStatusText = (load) => {
    if (load <= MAX_LOAD_AVAILABLE) return 'Available';
    if (load <= MAX_LOAD_BUSY) return 'Busy';
    if (load <= MAX_LOAD_OVERLOADED) return 'High Load';
    return 'Overloaded';
  };

  const getStatusIcon = (load) => {
    if (load <= MAX_LOAD_AVAILABLE) return 'fa-check-circle'; // Available
    if (load <= MAX_LOAD_BUSY) return 'fa-clock'; // Busy/Pending
    if (load <= MAX_LOAD_OVERLOADED) return 'fa-exclamation-triangle'; // High Load
    return 'fa-exclamation-circle'; // Overloaded
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f8fafc', 
      overflowY: 'auto',
      padding: '2rem'
    }}>
      {/* Page Title and Description */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#1e293b', 
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <i className="fas fa-chart-bar" style={{ color: '#3b82f6' }}></i>
          Team Status Dashboard
        </h2>
        <p style={{ color: '#64748b', margin: 0 }}>
          Monitor active rescue operations and team availability across all units.
        </p>
      </div>

      {/* Status Legend */}
      <div style={{
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '0.5rem',
        marginBottom: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center'
              }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
          <i className="fas fa-info-circle" style={{ color: '#3b82f6' }}></i>
          <span>Status Legend:</span>
        </div>
        {[
          { status: 'Available', color: '#22c55e', threshold: `≤${MAX_LOAD_AVAILABLE}` },
          { status: 'Busy', color: '#eab308', threshold: `${MAX_LOAD_AVAILABLE + 1}-${MAX_LOAD_BUSY}` },
          { status: 'High Load', color: '#f97316', threshold: `${MAX_LOAD_BUSY + 1}-${MAX_LOAD_OVERLOADED}` },
          { status: 'Overloaded', color: '#ef4444', threshold: `>${MAX_LOAD_OVERLOADED}` }
        ].map(({ status, color, threshold }) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '12px',
              height: '12px',
              backgroundColor: color,
              borderRadius: '50%'
            }}></div>
            <span style={{ fontSize: '0.875rem', color: '#374151' }}>
              <strong>{status}</strong> ({threshold} incidents)
            </span>
          </div>
        ))}
      </div>

      {/* Conditional Rendering: Loading, No Teams, or Team Cards */}
      {loading ? (
        <div style={{
          backgroundColor: 'white',
          padding: '3rem',
          borderRadius: '0.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <i className="fas fa-spinner fa-spin" style={{ color: '#3b82f6' }}></i>
            <span style={{ color: '#64748b' }}>Loading team status...</span>
          </div>
        </div>
      ) : teamStatuses.length === 0 ? (
        <div style={{
          backgroundColor: 'white',
          padding: '3rem',
          borderRadius: '0.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <i className="fas fa-users" style={{ fontSize: '3rem', color: '#d1d5db', marginBottom: '1rem' }}></i>
          <p style={{ color: '#64748b', margin: 0 }}>No teams found in the system.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' 
        }}>
          {teamStatuses.map(team => {
            const statusColor = getStatusColor(team.activeIncidents);
            const statusText = getStatusText(team.activeIncidents);
            const statusIcon = getStatusIcon(team.activeIncidents);
            
            return (
              <div key={team.id} style={{
                backgroundColor: 'white',
                border: `2px solid ${statusColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out'
              }}>
                {/* Team Header: Name and Status Icon */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: '600',
                    color: '#1e293b',
                    margin: 0
                  }}>
                    {team.name}
                  </h3>
                  <i className={`fas ${statusIcon}`} style={{
                    color: statusColor,
                    fontSize: '1.25rem'
                  }}></i>
                </div>

                {/* Status Badge */}
                <div style={{
                  backgroundColor: statusColor,
                  color: 'white',
                  padding: '0.5rem 1rem',
                  borderRadius: '2rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '1rem'
                }}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem' }}></i>
                  {statusText}
                </div>

                {/* Incident Count and Progress Bar */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>
                      Active Incidents
                    </span>
                    <span style={{
                      color: '#1e293b',
                      fontSize: '1.125rem',
                      fontWeight: '600'
                    }}>
                      {team.activeIncidents} / {MAX_LOAD_OVERLOADED}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div style={{
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${Math.min((team.activeIncidents / MAX_LOAD_OVERLOADED) * 100, 100)}%`,
                      height: '100%',
                      backgroundColor: statusColor,
                      transition: 'width 0.3s ease'
                    }}></div>
                  </div>
                </div>

                {/* Team Members Info */}
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#64748b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fas fa-users"></i>
                    <span>Team Members: {Object.keys(team.members || {}).length}</span>
                  </div>
                </div>

                {/* Last Updated Indicator */}
                <div style={{
                  marginTop: '1rem',
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <i className="fas fa-clock"></i>
                  <span>Live updates</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Information */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
          <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }}></i>
          Data updates in real-time from Firebase
        </div>
        {userId && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            User ID: {userId.substring(0, 8)}...
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamStatusView;