import React, { useRef, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import alertSound from '../assets/alertSound.mp3';
import LiveMapView from './DispatcherViews/LiveMapView';
import NotificationsView from './DispatcherViews/NotificationsView';
import ReportLogsView from './DispatcherViews/ReportLogsView';
import TeamOrganizerView from './DispatcherViews/TeamOrganizerView';
import IncidentHistoryView from './DispatcherViews/IncidentHistoryView';
import '../pages/DispatcherViews/DispatchStyle/DispatcherPage.css';
import '../App.css';
import CreateRescueModal from '../components/CreateReportModal';
import Logo from '../assets/GoRescueLogo.webp';
import L from 'leaflet';
import { emergencySeverityMap } from '../constants/dispatchConstants';

export default function DispatcherPage() {
  const [activeView, setActiveView] = useState('map-view');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [reportLogs, setReportLogs] = useState(() => {
    const saved = localStorage.getItem('reportLogs');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      // parse location if stored as stringified JSON
      return parsed.map(r => ({
        ...r,
        location:
          typeof r.location === 'string'
            ? JSON.parse(r.location)
            : r.location,
      }));
    } catch {
      return [];
    }
  });
  const [highlightedNotifIds, setHighlightedNotifIds] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const db = getFirestore();
  const notificationAudio = useRef(new Audio(alertSound));
  const mapRef = useRef(null);
  const originalTitle = useRef(document.title);
  const flashInterval = useRef(null);
  const prevNotifCount = useRef(0);
  const notifCountRef = useRef(0);
  const highlightTimers = useRef({});
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teams, setTeams] = useState({ alpha: [], bravo: [] });
  const [deployedNotifs, setDeployedNotifs] = useState(() => {
    const saved = localStorage.getItem('deployedNotifs');
    return saved ? JSON.parse(saved) : {};
  });

  // Check user role on load
  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "mdrrmo-users", user.uid));
        if (userDoc.exists()) {
          console.log("✅ User role:", userDoc.data().role);
        }
      } catch (error) {
        console.error("🔥 Error fetching user role:", error.message);
      }
    };
    checkRole();
  }, []);

  const markAsDeployed = (notifId) => {
    setDeployedNotifs((prev) => {
      const updated = { ...prev, [notifId]: true };
      localStorage.setItem('deployedNotifs', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  const startHighlightTimer = (id) => {
    if (highlightTimers.current[id]) return;
    highlightTimers.current[id] = setTimeout(() => {
      setHighlightedNotifIds(prev => prev.filter(nid => nid !== id));
      delete highlightTimers.current[id];
    }, 15000);
  };

  const handleMouseEnter = (id) => {
    if (highlightTimers.current[id]) {
      clearTimeout(highlightTimers.current[id]);
      delete highlightTimers.current[id];
    }
  };

  const handleMouseLeave = (id) => startHighlightTimer(id);

  // Notification arrival effect: play sound & flash title only on new notifications
  useEffect(() => {
    if (notifications.length > prevNotifCount.current) {
      notificationAudio.current.play().catch(() => {});
      const newNotifs = notifications.slice(prevNotifCount.current);
      const newIds = newNotifs.map(n => n.id);

      setHighlightedNotifIds(prev => [...prev, ...newIds]);
      newIds.forEach(startHighlightTimer);

      notifCountRef.current += newIds.length;
      setNotifCount(notifCountRef.current);

      let flashState = false;
      clearInterval(flashInterval.current);
      flashInterval.current = setInterval(() => {
        document.title = flashState ? '🚨 NEW NOTIFICATION!' : originalTitle.current;
        flashState = !flashState;
      }, 1000);

      setTimeout(() => {
        clearInterval(flashInterval.current);
        document.title = originalTitle.current;
      }, 15000);
    }
    prevNotifCount.current = notifications.length;
  }, [notifications]);

  // Parse coords and zoom map to notif location
  const viewNotificationOnMap = (coordsStr) => {
    const coords = typeof coordsStr === 'string' ? JSON.parse(coordsStr) : coordsStr;
    setActiveView('map-view');
    setTimeout(() => {
      const map = mapRef.current;
      if (!map || !coords?.lat || !coords?.lng) return;
      map.setView([coords.lat, coords.lng], 18);
      if (window.emergencyMarker) map.removeLayer(window.emergencyMarker);

      window.emergencyMarker = L.marker([coords.lat, coords.lng], {
        icon: L.divIcon({
          html: '<div style="background-color: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-exclamation"></i></div>',
          className: 'emergency-marker',
          iconSize: [30, 30]
        })
      }).addTo(map).openPopup();

      L.circle([coords.lat, coords.lng], {
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.2,
        radius: 20
      }).addTo(map);
    }, 400);
  };

  // Dispatch a team for a notification
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

    // Create new report log with parsed coords & timestamp
    const newLog = {
      id: `RPT-${new Date().getFullYear()}-${reportLogs.length + 1}`,
      reporter: notification.reporter,
      contact: notification.reporterContact || notification.contact,
      timestamp: new Date().toISOString(),
      emergencySeverity: notification.severity,
      location:
        typeof notification.location === 'string'
          ? JSON.parse(notification.location)
          : notification.location,
      details: notification.details,
      respondingTeam: `Team ${teamId.charAt(0).toUpperCase() + teamId.slice(1)} - ${
        emergencySeverityMap[notification.severity]?.label || ''
      }`,
      status: 'in-progress'
    };

    setReportLogs(prev => {
      const updatedLogs = [...prev, newLog];
      // Store stringified location to localStorage for persistence
      localStorage.setItem('reportLogs', JSON.stringify(updatedLogs.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      }))));
      return updatedLogs;
    });
  };

  const handleCreateTeam = (teamName) => {
    const teamDeck = {
      leader: { uid: Date.now(), name: `Leader ${teamName.toUpperCase()}` },
      driver: { uid: Date.now() + 1, name: `Driver ${teamName.toUpperCase()}` },
      medic: { uid: Date.now() + 2, name: `Medic ${teamName.toUpperCase()}` },
      support: { uid: Date.now() + 3, name: `Support ${teamName.toUpperCase()}` }
    };
    setTeams((prevTeams) => ({
      ...prevTeams,
      [teamName]: [teamDeck],
    }));
  };

  // Format datetime strings for UI
  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'N/A';
    const date = new Date(datetimeStr);
    if (isNaN(date)) return 'Invalid Date';
    return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // Add newly created reports from modal to reportLogs
  const handleReportCreated = (newReport) => {
    const normalizedReport = {
      ...newReport,
      reportId: newReport.reportId || newReport.id,
      id: newReport.id || `RPT-${new Date().getFullYear()}-${reportLogs.length + 1}`,
      reporter: newReport.reporterName || newReport.reporter,
      contact: newReport.contactNumber || newReport.contact,
      timestamp: newReport.timestamp || new Date().toISOString(),
      status: newReport.status || 'pending',
      location:
        typeof newReport.location === 'string'
          ? JSON.parse(newReport.location)
          : newReport.location || { lat: 0, lng: 0 },
    };

    setReportLogs((prevLogs) => {
      const updatedLogs = [...prevLogs, normalizedReport];
      localStorage.setItem('reportLogs', JSON.stringify(updatedLogs.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      }))));
      return updatedLogs;
    });
  };

  // Firestore realtime fetch report logs
  useEffect(() => {
    const incidentsRef = collection(db, 'incidents');
    const q = query(incidentsRef, where('status', 'in', ['pending', 'in-progress'])); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          location:
            typeof data.location === 'string'
              ? JSON.parse(data.location)
              : data.location,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : (data.timestamp || new Date().toISOString())
        };
      });
      setReportLogs(fetchedReports);
      localStorage.setItem('reportLogs', JSON.stringify(fetchedReports.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      }))));
    }, (error) => {
      console.error('Error fetching incidents:', error);
    });

    return () => unsubscribe();
  }, [db]);

  const viewConfig = {
    'map-view': (
      <LiveMapView
        mapRef={mapRef}
        notifications={notifications}
        reportLogs={reportLogs}
      />
    ),
    'notifications-view': (
      <NotificationsView
        notifications={notifications}
        dispatchTeam={dispatchTeam}
        viewOnMap={viewNotificationOnMap}
        highlightedNotifIds={highlightedNotifIds}
        onHoverEnter={handleMouseEnter}
        onHoverLeave={handleMouseLeave}
        availableTeams={teams}
        createTeam={handleCreateTeam}
      />
    ),
    'report-logs-view': (
      <ReportLogsView reportLogs={reportLogs} setReportLogs={setReportLogs} formatDateTime={formatDateTime} />
    ),
    'team-organizer-view': <TeamOrganizerView responders={currentTeam} />,
    'incident-history-view': (
      <IncidentHistoryView
        reportLogs={reportLogs}
        formatDateTime={formatDateTime}
      />
    )
  };

  return (
    <div className='dispatcher-page'>
      <div className={`dispatcher-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="top-bar">
          <div className="menu-toggle" onClick={toggleSidebar}><i className="fas fa-bars" /></div>
          <img src={Logo} alt="Victoria Rescue Logo" className="logo-small" />
          <div className="user-menu">
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
              <div
                key={id}
                className={`menu-item ${activeView === id ? 'active' : ''}`}
                onClick={() => {
                  setActiveView(id);
                  if (id === 'notifications-view') {
                    notifCountRef.current = 0;
                    setNotifCount(0);
                  }
                  if (id === 'team-organizer-view') {
                    const alpha = teams.alpha?.[0];
                    const bravo = teams.bravo?.[0];
                    const latest = bravo || alpha;
                    setCurrentTeam(latest);
                  }
                }}
              >
                <i className={`fas ${icon}`} />
                <span>{label}</span>
                {id === 'notifications-view' && notifCount > 0 && (
                  <span className="notification-badge-sidebar">{notifCount}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="main-content">
          <div className="content-view">{viewConfig[activeView]}</div>
        </div>

        {/* Floating Action Button */}
        <div
          className="fab-container"
          onClick={() => setShowReportModal(true)}
        >
          <div className="fab-icon">
            <i className="fas fa-file-alt"></i>
          </div>
          <span className="fab-label">Create Report</span>
        </div>

        {/* Report Modal */}
        {showReportModal && (
          <CreateRescueModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            onReportCreated={handleReportCreated}
          />
        )}
      </div>
    </div>
  );
}
