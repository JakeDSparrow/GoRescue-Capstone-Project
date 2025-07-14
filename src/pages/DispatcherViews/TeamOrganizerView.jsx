import React from 'react';

export default function TeamOrganizerView({ teams, openTeamEditor }) {
  return (
    <div className="card">
      <h2>Team Organizer</h2>
      <div className="teams-container">
        {Object.entries(teams).map(([teamName, members]) => (
          <div key={teamName} className="team-card">
            <div className="team-card-header">
              <h3>Team {teamName.charAt(0).toUpperCase() + teamName.slice(1)}</h3>
              <button className="edit-button" onClick={() => openTeamEditor(teamName)}>
                <i className="fas fa-edit"></i> Edit
              </button>
            </div>
            <div className="team-card-body">
              {members.length === 0 ? (
                <p className="no-members"><em>No members assigned</em></p>
              ) : (
                <ul className="member-list">
                  {members.map((member, index) => (
                    <li key={index}>{member}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
