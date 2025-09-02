// src/components/DispatcherViews/TeamStatusView.jsx
import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth } from "../../firebase";

// Helper to map Firestore keys to display names
const roleDisplayNames = {
  teamLeader: "Team Leader",
  emt1: "EMT 1",
  emt2: "EMT 2",
  ambulanceDriver: "Ambulance Driver",
};

const TeamStatusView = () => {
  const [teamStatuses, setTeamStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [teamsData, setTeamsData] = useState(null);

  // Firebase anonymous auth
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        try {
          const userCredential = await signInAnonymously(auth);
          setUserId(userCredential.user.uid);
        } catch (error) {
          console.error("Firebase anonymous sign-in error:", error);
          setLoading(false);
        }
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Teams listener
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "teams"),
      (snapshot) => {
        const teams = {};
        snapshot.forEach((doc) => {
          teams[doc.id] = {
            id: doc.id,
            name: doc.id.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
            members: doc.data(),
            missions: [],
          };
        });
        setTeamsData(teams);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching teams:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [userId]);

  // Incidents listener
  useEffect(() => {
    if (!teamsData) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "incidents"),
        where("status", "in", ["pending", "in-progress", "completed"])
      ),
      (snapshot) => {
        const missionsPerTeam = {};
        Object.keys(teamsData).forEach(id => {
          missionsPerTeam[id] = [];
        });

        snapshot.forEach((doc) => {
          const incident = {
            ...doc.data(),
            id: doc.id,
            timestamp: doc.data().timestamp?.toDate() || new Date(),
          };

          const teamId = incident.respondingTeam;
          if (teamId === "all-responders") {
            Object.keys(teamsData).forEach((id) => {
              missionsPerTeam[id].push(incident);
            });
          } else if (teamId && missionsPerTeam[teamId]) {
            missionsPerTeam[teamId].push(incident);
          }
        });

        Object.keys(missionsPerTeam).forEach((teamId) => {
          missionsPerTeam[teamId].sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
          );
        });

        const updatedTeams = Object.values(teamsData).map((team) => ({
          ...team,
          missions: missionsPerTeam[team.id] || [],
        })).sort((a,b) => a.name.localeCompare(b.name));
        
        setTeamStatuses(updatedTeams);
      },
      (error) => console.error("Error fetching incidents:", error)
    );
    return () => unsubscribe();
  }, [teamsData]);

  const toggleTeamExpansion = (teamId) => {
    setExpandedTeams((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      if (newExpanded.has(teamId)) {
        newExpanded.delete(teamId);
      } else {
        newExpanded.add(teamId);
      }
      return newExpanded;
    });
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return null;
    return (
      <span className={`priority-badge priority-${priority.toLowerCase()}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    if (!status) return null;
    return (
      <span className={`status-badge status-${status.replace("-", "")}`}>
        {status.replace("-", " ").toUpperCase()}
      </span>
    );
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="dispatcher-page">
      <div className="team-missions-dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-title">
            <div className="header-icon">
              <i className="fas fa-chart-bar"></i>
            </div>
            <h1>Team Missions Dashboard</h1>
          </div>
          <p className="header-subtitle">
            Live overview of team missions and statuses
          </p>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="team-dashboard-loading">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>Loading team missions...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="team-stats-grid">
              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon in-progress">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">
                      {teamStatuses.reduce(
                        (total, team) =>
                          total +
                          team.missions.filter((m) => m.status === "in-progress")
                            .length,
                        0
                      )}
                    </div>
                    <div className="stat-label">In Progress</div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon completed">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">
                       {teamStatuses.reduce(
                        (total, team) =>
                          total +
                          team.missions.filter((m) => m.status === "completed")
                            .length,
                        0
                      )}
                    </div>
                    <div className="stat-label">Completed</div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon available">
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">
                      {
                        teamStatuses.filter(
                          (team) =>
                            team.missions.filter((m) => m.status !== "completed")
                              .length === 0
                        ).length
                      }
                    </div>
                    <div className="stat-label">Available</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Cards Grid */}
            <div className="team-cards-grid">
              {teamStatuses.map((team) => {
                const isExpanded = expandedTeams.has(team.id);
                const activeMissionsCount = team.missions.filter(
                  (m) => m.status !== "completed"
                ).length;

                return (
                  <div
                    key={team.id}
                    className={`team-card ${
                      activeMissionsCount > 0 ? "has-missions" : "no-missions"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="team-card-header">
                      <h3>{team.name}</h3>
                      <div className="team-badges">
                         {team.missions.filter((m) => m.status === "in-progress")
                          .length > 0 && (
                          <span className="mission-count active">
                            {
                              team.missions.filter(
                                (m) => m.status === "in-progress"
                              ).length
                            }{" "}
                            Active
                          </span>
                        )}
                        {team.missions.filter((m) => m.status === "pending")
                          .length > 0 && (
                          <span className="mission-count pending">
                            {
                              team.missions.filter(
                                (m) => m.status === "pending"
                              ).length
                            }{" "}
                            Pending
                          </span>
                        )}
                        {activeMissionsCount === 0 && (
                          <span className="mission-count available">
                            Available
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Members */}
                    <div className="team-card-members">
                      <div className="members-header">
                        <i className="fas fa-user-friends"></i>
                        <p className="members-title">Team Members</p>
                      </div>
                      <div className="members-grid">
                        {Object.entries(roleDisplayNames).map(([key, role]) =>
                          team.members[key] ? (
                            <div key={key} className="member-item">
                              <span className="member-role">{role}:</span>
                              <span className="member-name">
                                {team.members[key].fullName || "N/A"}
                              </span>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>

                    {/* Missions */}
                    <div className="team-card-missions">
                      <div
                        className="missions-header"
                        onClick={() => toggleTeamExpansion(team.id)}
                      >
                        <div className="missions-title">
                          <i className="fas fa-tasks"></i>
                          <strong>
                            Missions ({team.missions.length})
                          </strong>
                        </div>
                        {team.missions.length > 0 && (
                          <i
                            className={`fas fa-chevron-${
                              isExpanded ? "up" : "down"
                            } expand-icon`}
                          ></i>
                        )}
                      </div>

                      {team.missions.length === 0 ? (
                        <div className="no-missions">
                          <i className="fas fa-inbox"></i>
                          <p>No active missions</p>
                          <p className="sub-text">This team is currently free</p>
                        </div>
                      ) : (
                        <div className="missions-content">
                           <div className="missions-list">
                            {(isExpanded ? team.missions : team.missions.slice(0, 5)).map((mission) => (
                                <div key={mission.id} className="mission-item">
                                  <div className="mission-header">
                                    <div className="mission-id-priority">
                                      <strong className="mission-id">
                                        {mission.reportId || mission.id}
                                      </strong>
                                      {getPriorityBadge(mission.emergencySeverity)}
                                    </div>
                                    <div className="mission-time">
                                      <i className="fas fa-clock"></i>
                                      {formatTime(mission.timestamp)}
                                    </div>
                                  </div>

                                  <div className="mission-location">
                                    <i className="fas fa-map-marker-alt"></i>
                                    {mission.locationText || "Location not specified"}
                                  </div>

                                  {mission.notes && (
                                    <div className="mission-description">
                                      {mission.notes}
                                    </div>
                                  )}

                                  <div className="mission-status">
                                    {getStatusBadge(mission.status)}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                          
                          {team.missions.length > 5 && !isExpanded && (
                            <div className="show-more-button">
                              <button
                                onClick={() => toggleTeamExpansion(team.id)}
                              >
                                Show {team.missions.length - 5} more missions
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamStatusView;