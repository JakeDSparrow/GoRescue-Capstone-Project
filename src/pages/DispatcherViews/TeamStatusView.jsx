import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db, auth } from "../../firebase";

// Helper to map Firestore keys to display names
const roleDisplayNames = {
  teamLeader: "Team Leader",
  emt1: "EMT 1",
  emt2: "EMT 2",
  ambulanceDriver: "Ambulance Driver",
};

// Helper to determine responder status based on active missions and team acknowledgments
const getResponderStatus = (missions, teamName) => {
  const activeMissions = missions.filter((m) => m.status !== "completed");
  const inProgressMissions = missions.filter((m) => m.status === "in-progress");
  
  // Check if this team has acknowledged any of their assigned missions
  const teamAcknowledgedMissions = activeMissions.filter((m) => {
    if (m.teamAcknowledgments && m.teamAcknowledgments[teamName]) {
      return m.teamAcknowledgments[teamName].acknowledged;
    }
    // Fallback to legacy status check
    return m.status === "acknowledged" || m.status === "en-route" || m.status === "in-progress";
  });

  if (inProgressMissions.length > 0) {
    return { status: "responding", label: "Responding", color: "danger" };
  } else if (teamAcknowledgedMissions.length > 0) {
    return { status: "dispatched", label: "Dispatched", color: "warning" };
  } else if (activeMissions.length > 0) {
    return { status: "pending", label: "Pending", color: "info" };
  } else {
    return { status: "available", label: "Available", color: "success" };
  }
};

const TeamStatusView = () => {
  const [teamStatuses, setTeamStatuses] = useState([]);
  // Removed reportLogs state: status-only view
  const [loading, setLoading] = useState(true);
  const [expandedTeams, setExpandedTeams] = useState(new Set());
  const [userId, setUserId] = useState(null);
  const [teamsData, setTeamsData] = useState(null);
  const [filter, setFilter] = useState("all"); // all, available, dispatched, responding

  // Normalize various team key formats to match Firestore team doc ids
  const normalizeTeamId = (raw) => {
    if (!raw || typeof raw !== "string") return null;
    let value = raw.trim();

    // Remove leading label variants like "Team Alpha" -> "alpha"
    value = value.replace(/^team\s+/i, "");

    // Strip appended descriptors like " - Critical" or other suffixes
    value = value.replace(/\s-\s.*$/, "");

    // Lowercase and remove extra spaces
    value = value.toLowerCase().replace(/\s+/g, "");

    // Handle All Responders variants
    if (value.replace(/\s+/g, "-") === "all-responders") {
      return "all-responders";
    }

    // Unify shift casing and separators
    value = value
      .replace("dayshift", "-dayshift")
      .replace("nightshift", "-nightshift")
      .replace("--", "-");

    // Fix common camelCase inputs like dayShift/nightShift
    value = value
      .replace("dayshift", "dayshift")
      .replace("nightshift", "nightshift");

    // Ensure single hyphen between team and shift (e.g., alpha-dayshift)
    if (!value.includes("-dayshift") && !value.includes("-nightshift")) {
      // nothing to do; may be a team id without shift
    }

    return value;
  };

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
          const originalId = doc.id;
          const normalizedId = normalizeTeamId(originalId) || originalId;
          const [teamBaseRaw] = originalId.split("-");
          const teamBase = teamBaseRaw
            ? teamBaseRaw.charAt(0).toUpperCase() + teamBaseRaw.slice(1)
            : originalId;

          // Add ☀️ for day shift, 🌙 for night shift based on original id
          const lowerId = originalId.toLowerCase();
          const shiftIcon = lowerId.includes("dayshift")
            ? "☀️"
            : lowerId.includes("nightshift")
            ? "🌙"
            : "";

          const displayName = `Team ${teamBase} ${shiftIcon}`.trim();

          teams[normalizedId] = {
            id: normalizedId,
            name: displayName,
            members: doc.data(),
            missions: [],
            reports: [],
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

  // Removed report logs listener: status-only view

  // Incidents listener
  useEffect(() => {
    if (!teamsData) return;

    const unsubscribe = onSnapshot(
      // Include all incidents; we'll normalize/filter in code to avoid case mismatches
      query(collection(db, "incidents")),
      (snapshot) => {
        const missionsPerTeam = {};
        const placeholderTeamIds = new Set();
        Object.keys(teamsData).forEach((id) => {
          missionsPerTeam[id] = [];
        });

        snapshot.forEach((doc) => {
          const incident = {
            ...doc.data(),
            id: doc.id,
            timestamp: doc.data().timestamp?.toDate() || new Date(),
            type: "mission",
          };
          // Normalize status to lowercase with hyphens
          if (incident.status && typeof incident.status === "string") {
            const s = incident.status.toLowerCase().replace(/\s+/g, "-");
            incident.status = s;
          }

          // Handle both legacy single team and new multiple teams format
          const respondingTeams = incident.respondingTeams || incident.respondingTeam;
          
          if (Array.isArray(respondingTeams)) {
            // New multiple teams format
            respondingTeams.forEach(teamIdRaw => {
              const teamId = normalizeTeamId(teamIdRaw);
              if (teamId === "all-responders") {
                Object.keys(teamsData).forEach((id) => {
                  missionsPerTeam[id].push(incident);
                });
              } else if (teamId) {
                if (!missionsPerTeam[teamId]) {
                  missionsPerTeam[teamId] = [];
                  placeholderTeamIds.add(teamId);
                }
                missionsPerTeam[teamId].push(incident);
              }
            });
          } else {
            // Legacy single team format
            const teamIdRaw = respondingTeams || incident.assignedTeam;
            const teamId = normalizeTeamId(teamIdRaw);
            if (teamId === "all-responders") {
              Object.keys(teamsData).forEach((id) => {
                missionsPerTeam[id].push(incident);
              });
            } else if (teamId) {
              if (!missionsPerTeam[teamId]) {
                missionsPerTeam[teamId] = [];
                placeholderTeamIds.add(teamId);
              }
              missionsPerTeam[teamId].push(incident);
            }
          }
        });

        // Report logs removed from Team Status aggregation

        // Sort by severity priority (Critical > High > Moderate > Low), then by timestamp
        const severityPriority = {
          'critical': 4,
          'high': 3,
          'moderate': 2,
          'low': 1
        };
        
        Object.keys(missionsPerTeam).forEach((teamId) => {
          try {
            missionsPerTeam[teamId].sort((a, b) => {
              // Get severity for both items
              const severityA = (a.emergencySeverity || a.priority || 'low').toLowerCase();
              const severityB = (b.emergencySeverity || b.priority || 'low').toLowerCase();
              
              // Get priority values
              const priorityA = severityPriority[severityA] || 1;
              const priorityB = severityPriority[severityB] || 1;
              
              // Sort by priority first (higher priority first)
              if (priorityA !== priorityB) {
                return priorityB - priorityA;
              }
              
              // If same priority, sort by timestamp (most recent first)
              try {
                const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                return timeB - timeA;
              } catch (timestampError) {
                console.warn('Error processing timestamp in sort:', timestampError);
                return 0; // Keep original order if timestamp is invalid
              }
            });
          } catch (sortError) {
            console.error('Error sorting missions for team:', teamId, sortError);
          }
        });

        const baseTeams = Object.values(teamsData).map((team) => ({
          ...team,
          missions: (missionsPerTeam[team.id] || []).filter((m) => m.status === "pending" || m.status === "in-progress"),
        }));

        // Create placeholder teams for any unknown team ids that received missions/logs
        const extraTeams = Array.from(placeholderTeamIds).map((id) => {
          const [teamBaseRaw] = id.split("-");
          const teamBase = teamBaseRaw
            ? teamBaseRaw.charAt(0).toUpperCase() + teamBaseRaw.slice(1)
            : id;
          const lowerId = id.toLowerCase();
          const shiftIcon = lowerId.includes("dayshift") ? "☀️" : lowerId.includes("nightshift") ? "🌙" : "";
          const displayName = `Team ${teamBase} ${shiftIcon}`.trim();
          return {
            id,
            name: displayName,
            members: {},
            missions: (missionsPerTeam[id] || []).filter((m) => m.status === "pending" || m.status === "in-progress"),
            reports: [],
          };
        });

        const updatedTeams = [...baseTeams, ...extraTeams].sort((a, b) => a.name.localeCompare(b.name));

        setTeamStatuses(updatedTeams);
      },
      (error) => console.error("Error fetching incidents:", error)
    );
    return () => unsubscribe();
  }, [teamsData]);

  const recallIncident = async (incidentId) => {
    try {
      const confirmed = window.confirm(
        "Recall this mission? This will cancel it for the team."
      );
      if (!confirmed) return;

      const incidentRef = doc(db, "incidents", incidentId);
      await updateDoc(incidentRef, {
        status: "cancelled",
        subStatus: "Cancelled by dispatcher",
        responderId: null,           // ensure reassignment elsewhere doesn’t keep it active on mobile
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cancelledBy: auth.currentUser?.uid || "dispatcher",
      });
    } catch (err) {
      console.error("Failed to recall mission:", err);
      alert("Failed to recall mission. Please try again.");
    }
};

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

  const getPriorityBadge = (priority) =>
    priority ? (
      <span className={`priority-badge priority-${priority.toLowerCase()}`}>
        {priority.toUpperCase()}
      </span>
    ) : null;

  const getStatusBadge = (status) =>
    status ? (
      <span className={`status-badge status-${status.replace("-", "")}`}>
        {status.replace("-", " ").toUpperCase()}
      </span>
    ) : null;

  const formatTime = (timestamp) =>
    timestamp
      ? new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      : "";

  const formatDate = (timestamp) =>
    timestamp
      ? new Date(timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";

  // Filter teams based on status
  const filteredTeams = teamStatuses.filter((team) => {
    const responderStatus = getResponderStatus(team.missions, team.name);

    switch (filter) {
      case "available":
        return responderStatus.status === "available";
      case "dispatched":
        return responderStatus.status === "dispatched";
      case "responding":
        return responderStatus.status === "responding";
      case "pending":
        return responderStatus.status === "pending";
      default:
        return true;
    }
  });

  const stats = {
    total: teamStatuses.length,
    available: teamStatuses.filter(
      (t) => getResponderStatus(t.missions, t.name).status === "available"
    ).length,
    dispatched: teamStatuses.filter(
      (t) => getResponderStatus(t.missions, t.name).status === "dispatched"
    ).length,
    responding: teamStatuses.filter(
      (t) => getResponderStatus(t.missions, t.name).status === "responding"
    ).length,
    pending: teamStatuses.filter(
      (t) => getResponderStatus(t.missions, t.name).status === "pending"
    ).length,
    totalMissions: teamStatuses.reduce(
      (total, team) =>
        total + team.missions.filter((m) => m.status !== "completed").length,
      0
    ),
    completedToday: teamStatuses.reduce(
      (total, team) =>
        total +
        team.missions.filter(
          (m) =>
            m.status === "completed" &&
            m.timestamp &&
            m.timestamp.toDateString() === new Date().toDateString()
        ).length,
      0
    ),
  };

  return (
    <div className="dispatcher-page">
      <div className="team-missions-dashboard">
        {/* Header removed per request */}

        {/* Loading State */}
        {loading ? (
          <div className="team-dashboard-loading">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>Loading team status...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="team-stats-grid">
              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon available">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.available}</div>
                    <div className="stat-label">Available Teams</div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon warning">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.dispatched}</div>
                    <div className="stat-label">Dispatched</div>
                  </div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-content">
                  <div className="stat-icon danger">
                    <i className="fas fa-ambulance"></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.responding}</div>
                    <div className="stat-label">Responding</div>
                  </div>
                </div>
              </div>

              
            </div>

            {/* Filter Buttons */}
            <div className="filter-buttons">
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All Teams ({teamStatuses.length})
              </button>
              <button
                className={filter === "available" ? "active" : ""}
                onClick={() => setFilter("available")}
              >
                Available ({stats.available})
              </button>
              <button
                className={filter === "dispatched" ? "active" : ""}
                onClick={() => setFilter("dispatched")}
              >
                Dispatched ({stats.dispatched})
              </button>
              <button
                className={filter === "responding" ? "active" : ""}
                onClick={() => setFilter("responding")}
              >
                Responding ({stats.responding})
              </button>
              <button
                className={filter === "pending" ? "active" : ""}
                onClick={() => setFilter("pending")}
              >
                Pending ({stats.pending})
              </button>
            </div>

            {/* Team Cards Grid */}
            <div className="team-cards-grid">
              {filteredTeams.map((team) => {
                const isExpanded = expandedTeams.has(team.id);
                const responderStatus = getResponderStatus(team.missions, team.name);
                const missions = team.missions; // already filtered to pending/in-progress

                return (
                  <div key={team.id} className={`team-card status-${responderStatus.status}`}>
                    {/* Card Header */}
                    <div className="team-card-header">
                      <div className="team-title-section">
                        <h3>{team.name}</h3>
                        <div className={`responder-status status-${responderStatus.color}`}>
                          <i
                            className={`fas ${
                              responderStatus.status === "available"
                                ? "fa-check-circle"
                                : responderStatus.status === "dispatched"
                                ? "fa-clock"
                                : "fa-ambulance"
                            }`}
                          ></i>
                          {responderStatus.label}
                        </div>
                      </div>
                      <div className="team-badges">
                        {missions.filter((m) => m.status === "in-progress").length > 0 && (
                          <span className="mission-count active">
                            {missions.filter((m) => m.status === "in-progress").length} Active Missions
                          </span>
                        )}
                        {missions.filter((m) => m.status === "pending").length > 0 && (
                          <span className="mission-count pending">
                            {missions.filter((m) => m.status === "pending").length} Pending
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

                    {/* Missions and Reports */}
                    <div className="team-card-missions">
                      <div
                        className="missions-header"
                        onClick={() => toggleTeamExpansion(team.id)}
                      >
                        <div className="missions-title">
                          <i className="fas fa-tasks"></i>
                          <strong>Tasks ({team.missions.length})</strong>
                          
                        </div>
                        {team.missions.length > 0 && (
                          <i
                            className={`fas fa-chevron-${isExpanded ? "up" : "down"} expand-icon`}
                          ></i>
                        )}
                      </div>

                      {team.missions.length === 0 ? (
                        <div className="no-missions">
                          <i className="fas fa-inbox"></i>
                          <p>No active tasks</p>
                          <p className="sub-text">This team is available for dispatch</p>
                        </div>
                      ) : (
                        <div className="missions-content">
                          <div className="missions-list">
                            {(isExpanded ? team.missions : team.missions.slice(0, 5)).map((item) => (
                              <div key={item.id} className={`mission-item`}>
                                <div className="mission-header">
                                  <div className="mission-id-priority">
                                    <strong className="mission-id">
                                      {item.reportId || item.incidentId || item.id}
                                    </strong>
                                    <span className={`type-badge type-mission`}>
                                      MISSION
                                    </span>
                                    {getPriorityBadge(item.emergencySeverity || item.priority)}
                                  </div>
                                  <div className="mission-time">
                                    <i className="fas fa-clock"></i>
                                    <span className="time">{formatTime(item.timestamp)}</span>
                                    <span className="date">{formatDate(item.timestamp)}</span>
                                  </div>
                                </div>

                                <div className="mission-location">
                                  <i className="fas fa-map-marker-alt"></i>
                                  {item.locationText ||
                                    item.location ||
                                    item.address ||
                                    "Location not specified"}
                                </div>

                                {item.emergencyType && (
                                  <div className="mission-description">
                                    {item.emergencyType}
                                  </div>
                                )}

                                <div className="mission-footer">
                                  {getStatusBadge(item.status)}
                                  <div className="mission-actions">
                                    <button className="recall-button" onClick={() => recallIncident(item.id)}>
                                      Recall
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {team.missions.length > 5 && !isExpanded && (
                            <div className="show-more-button">
                              <button onClick={() => toggleTeamExpansion(team.id)}>
                                Show {team.missions.length - 5} more tasks
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

            {filteredTeams.length === 0 && (
              <div className="no-teams-message">
                <i className="fas fa-search"></i>
                <h3>No teams found</h3>
                <p>No teams match the current filter criteria.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TeamStatusView;
