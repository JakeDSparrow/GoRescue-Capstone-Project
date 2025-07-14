import React, { useState } from 'react';

const AnnouncementsView = () => {
  const [announcements, setAnnouncements] = useState([
    {
      id: 1,
      title: "Rescue Team Training Session",
      eventDate: "2023-11-15",
      createdAt: "2023-11-01",
      status: "active",
      description: "Mandatory training for all rescue team members"
    },
    {
      id: 2,
      title: "Equipment Maintenance Day",
      eventDate: "2023-11-20",
      createdAt: "2023-11-05",
      status: "active",
      description: "All equipment will be inspected and maintained"
    },
    {
      id: 3,
      title: "Community Awareness Program",
      eventDate: "2023-12-05",
      createdAt: "2023-11-10",
      status: "upcoming",
      description: "Public event to promote safety awareness"
    }
  ]);

  const handleCancel = (id) => {
    setAnnouncements(announcements.map(ann =>
      ann.id === id ? { ...ann, status: "cancelled" } : ann
    ));
  };

  const handleReschedule = (id, newDate) => {
    setAnnouncements(announcements.map(ann =>
      ann.id === id ? { ...ann, eventDate: newDate } : ann
    ));
  };

  return (
    <div className="announcements-container">
      {/* Header */}
      <div className="announcement-header">
        <div className="announcement-title">Announcements</div>
        <button className="btn btn-primary">
          <i className="fas fa-plus"></i> Create Announcement
        </button>
      </div>  

      {/* Cards */}
      <div className="card-grid">
        {announcements.map((announcement) => (
          <div key={announcement.id} className={`announcement-card status-${announcement.status}`}>
            <div className="announcement-top">
              <h3>{announcement.title}</h3>
              <span className="status-tag">{announcement.status.toUpperCase()}</span>
            </div>

            <div className="announcement-details">
              <p>{announcement.description}</p>
              <div className="dates">
                <span><strong>Event:</strong> {new Date(announcement.eventDate).toLocaleDateString()}</span>
                <span><strong>Created:</strong> {new Date(announcement.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="announcement-actions">
              <button
                className="btn btn-outline"
                onClick={() => {
                  const newDate = prompt("Enter new date (YYYY-MM-DD):");
                  if (newDate) handleReschedule(announcement.id, newDate);
                }}
              >
                <i className="fas fa-calendar-alt"></i> Reschedule
              </button>

              <button
                className="btn btn-danger"
                onClick={() => handleCancel(announcement.id)}
              >
                <i className="fas fa-times"></i> Cancel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementsView;
