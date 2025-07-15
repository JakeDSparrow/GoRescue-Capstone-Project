import React, { useRef, useState } from 'react';
import LiveMapView from './DispatcherViews/LiveMapView';
import NotificationsView from './DispatcherViews/NotificationsView';
import ReportLogsView from './DispatcherViews/ReportLogsView';
import TeamOrganizerView from './DispatcherViews/TeamOrganizerView';
import IncidentHistoryView from './DispatcherViews/IncidentHistoryView';
import '../pages/DispatcherViews/DispatchStyle/DispatcherPage.css';
import '../App.css';
import Logo from '../assets/GoRescueLogo.webp';
import L from 'leaflet';
import { emergencyTypes } from '../constants/dispatchConstants';

export default function DispatcherPage() {
  const [activeView, setActiveView] = useState('map-view');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [reportLogs, setReportLogs] = useState([]);
  const [teams, setTeams] = useState({ alpha: [], bravo: [] });
  const [currentTeam, setCurrentTeam] = useState(null);
  const mapRef = useRef(null);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  const openTeamEditor = (team) => {
    setCurrentTeam(team);
    document.getElementById('editor-title').textContent = `Edit ${team.charAt(0).toUpperCase() + team.slice(1)} Team`;
    document.getElementById('team-editor-overlay').style.display = 'flex';
  };

  const closeTeamEditor = () => {
    setCurrentTeam(null);
    document.getElementById('team-editor-overlay').style.display = 'none';
  };

  const saveTeamChanges = () => {
    closeTeamEditor();
  };

  const formatDateTime = (datetimeStr) => {
    const date = new Date(datetimeStr);
    return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const viewNotificationOnMap = (coordsStr) => {
    const map = mapRef.current;
    const coords = JSON.parse(coordsStr);
    if (map) {
      map.setView(coords, 18);

      if (window.emergencyMarker) {
        map.removeLayer(window.emergencyMarker);
      }

      window.emergencyMarker = L.marker(coords, {
        icon: L.divIcon({
          html: '<div style="background-color: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="fas fa-exclamation"></i></div>',
          className: 'emergency-marker',
          iconSize: [30, 30]
        })
      }).addTo(map).bindPopup('Emergency Location').openPopup();

      L.circle(coords, {
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.2,
        radius: 20
      }).addTo(map);
    }
    setActiveView('map-view');
  };

  const dispatchAllResponders = (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    const updatedNotification = {
      ...notification,
      responded: true,
      respondingTeam: 'ALL AVAILABLE UNITS',
      responseTime: new Date().toLocaleTimeString()
    };

    setNotifications(prev => prev.map(n => n.id === notificationId ? updatedNotification : n));

    alert(`All available units have been dispatched to ${notification.location}`);

    const newLog = {
      id: `RPT-${new Date().getFullYear()}-${reportLogs.length + 1}`,
      reporter: notification.reporter,
      contact: notification.reporterContact,
      timestamp: new Date().toISOString(),
      emergencyType: notification.type,
      location: notification.location,
      details: notification.details,
      respondingTeam: 'ALL AVAILABLE UNITS - FULL DEPLOYMENT',
      status: 'in-progress'
    };

    setReportLogs(prev => [...prev, newLog]);
  };

  const dispatchTeam = (notificationId, teamId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    const updatedNotification = {
      ...notification,
      responded: true,
      respondingTeam: `Team ${teamId.charAt(0).toUpperCase() + teamId.slice(1)}`,
      responseTime: new Date().toLocaleTimeString()
    };

    setNotifications(prev => prev.map(n => n.id === notificationId ? updatedNotification : n));

    const newLog = {
      id: `RPT-${new Date().getFullYear()}-${reportLogs.length + 1}`,
      reporter: notification.reporter,
      contact: notification.reporterContact,
      timestamp: new Date().toISOString(),
      emergencyType: notification.type,
      location: notification.location,
      details: notification.details,
      respondingTeam: `Team ${teamId.charAt(0).toUpperCase() + teamId.slice(1)} - ${emergencyTypes[notification.type].responseTeam}`,
      status: 'in-progress'
    };

    setReportLogs(prev => [...prev, newLog]);
  };

  const viewConfig = {
    'map-view': <LiveMapView mapRef={mapRef} />,
    'notifications-view': (
      <NotificationsView
        notifications={notifications}
        dispatchTeam={dispatchTeam}
        dispatchAllResponders={dispatchAllResponders}
        viewOnMap={viewNotificationOnMap}
      />
    ),
    'report-logs-view': (
      <ReportLogsView
        reportLogs={reportLogs}
        formatDateTime={formatDateTime}
      />
    ),
    'team-organizer-view': (
      <TeamOrganizerView
        teams={teams}
        openTeamEditor={openTeamEditor}
      />
    ),
    'incident-history-view': (
      <IncidentHistoryView
        reportLogs={reportLogs}
      />
    )
  };

  return (
    <div className='dispatcher-page'>
      {
        <div className={`dispatcher-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <div className="top-bar">
            <div className="menu-toggle" onClick={toggleSidebar}><i className="fas fa-bars" /></div>
            <img src={Logo} alt="Victoria Rescue Logo" className="logo-small" />
            <div className="user-menu">
              <div className="notification-icon">
                <i className="fas fa-bell" />
                <span className="notification-badge">{notifications.filter(n => !n.read).length}</span>
              </div>
              <button id="logout-btn" onClick={() => window.location.href = '/'}>
                <i className="fas fa-sign-out-alt" /> Logout
              </button>
            </div>
          </div>

          <div className="sidebar">
            <div className="sidebar-header"><h3>Dispatcher Dashboard</h3></div>
            <div className="sidebar-menu">
              {[
                { id: 'map-view', icon: 'fa-map', label: 'Live Map' },
                { id: 'notifications-view', icon: 'fa-bell', label: 'Notifications' },
                { id: 'report-logs-view', icon: 'fa-file-alt', label: 'Report Logs' },
                { id: 'team-organizer-view', icon: 'fa-users', label: 'Team Organizer' },
                { id: 'incident-history-view', icon: 'fa-history', label: 'Incident History' },
              ].map(({ id, icon, label }) => (
                <div key={id} className={`menu-item ${activeView === id ? 'active' : ''}`} onClick={() => setActiveView(id)}>
                  <i className={`fas ${icon}`} /><span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="main-content">
            <div className="content-view">
              {viewConfig[activeView]}
            </div>
          </div>
        </div>
      }
    </div>
  );
}
