import React, { useRef, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import alertSound from '../assets/alertSound.mp3';
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
  const [reportLogs, setReportLogs] = useState(() => {
    const saved = localStorage.getItem('reportLogs');
    return saved ? JSON.parse(saved) : [];
  });
  const [isMapReady, setIsMapReady] = useState(false);
  const [highlightedNotifIds, setHighlightedNotifIds] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const notificationAudio = useRef(new Audio(alertSound));
  const mapRef = useRef(null);
  const originalTitle = useRef(document.title);
  const flashInterval = useRef(null);
  const prevNotifCount = useRef(0);
  const notifCountRef = useRef(0);
  const highlightTimers = useRef({});
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teams, setTeams] = useState({
    alpha: [],
    bravo: [],
  });
  const [deployedNotifs, setDeployedNotifs] = useState(() => {
    const saved = localStorage.getItem('deployedNotifs');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();

    const checkRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log("Not logged in");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "mdrrmo-users", user.uid));
        if (userDoc.exists()) {
          console.log("✅ User role:", userDoc.data().role);
        } else {
          console.warn("⚠️ User not found in mdrrmo-users");
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

  const handleMouseLeave = (id) => {
    startHighlightTimer(id);
  };

  useEffect(() => {
    const fakeNotifications = [
      {
        id: 'notif-001',
        type: 'accident',
        location: 'Brgy. San Vicente (Poblacion), Victoria',
        reporter: 'Juan Dela Cruz',
        reporterContact: '09171234567',
        details: 'Motorbike collision near municipal hall, minor injuries.',
        coordinates: JSON.stringify({ lat: 15.5781, lng: 120.6819 }),
        status: 'pending',
        read: false,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'notif-002',
        type: 'medical',
        location: 'Brgy. Canarem, Victoria',
        reporter: 'Maria Santos',
        reporterContact: '09987654321',
        details: 'Unconscious senior citizen reported at Canarem plaza.',
        coordinates: JSON.stringify({ lat: 15.5970, lng: 120.7131 }),
        status: 'pending',
        read: false,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'notif3',
        type: 'natural',
        location: 'Barangay Baculong',
        reporter: 'Maria Santos',
        reporterContact: '09987654321',
        details: 'Fallen trees due to strong winds caused by storm.',
        coordinates: { lat: 15.5801, lng: 120.6843 },
        read: false,
        timestamp: new Date().toISOString(),
      }
    ];

    setNotifications(fakeNotifications);

  }, []);

  useEffect(() => {
    if (notifications.length > prevNotifCount.current) {
      notificationAudio.current.play().catch((err) => {
        console.warn('Failed to play sound:', err);
      });

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
          html: '<div style="background-color: #e74c3c; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px;"><i class="fas fa-exclamation"></i></div>',
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

    setReportLogs(prev => {
      const updatedLogs = [...prev, newLog];
      localStorage.setItem('reportLogs', JSON.stringify(updatedLogs));
      console.log("📝 Saved report log:", newLog);
      return updatedLogs;
    });
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

    setReportLogs(prev => {
        const updatedLogs = [...prev, newLog];
        localStorage.setItem('reportLogs', JSON.stringify(updatedLogs));
        console.log("📝 Saved report log:", newLog);
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
      [teamName]: [teamDeck], // wrap in array if you want to support multiple decks per team
    }));
  };

  const handleDeployAll = (notif) => {
    dispatchAllResponders(notif.id); // Create log + update notification
    markAsDeployed(notif.id);        // Mark as deployed
  };

  const handleDeployAlpha = (notif) => {
    dispatchTeam(notif.id, 'alpha'); // Create log + update notification
    markAsDeployed(notif.id);        // Mark as deployed
  };

  const handleDeployBravo = (notif) => {
    dispatchTeam(notif.id, 'bravo'); // Create log + update notification
    markAsDeployed(notif.id);        // Mark as deployed
  };

  const formatDateTime = (datetimeStr) => {
    const date = new Date(datetimeStr);
    return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const viewConfig = {
    'map-view': <LiveMapView mapRef={mapRef} onMapReady={() => setIsMapReady(true)} notifications={notifications} />,
    'notifications-view': (
      <NotificationsView
        notifications={notifications}
        dispatchTeam={dispatchTeam}
        dispatchAllResponders={dispatchAllResponders}
        handleDeployAll={handleDeployAll}
        handleDeployAlpha={handleDeployAlpha}
        handleDeployBravo={handleDeployBravo}
        viewOnMap={viewNotificationOnMap}
        highlightedNotifIds={highlightedNotifIds}
        onHoverEnter={handleMouseEnter}
        onHoverLeave={handleMouseLeave}
        availableTeams={teams}
        createTeam={handleCreateTeam}
      />
    ),
    'report-logs-view': (
      <ReportLogsView 
      reportLogs={reportLogs}
      setReportLogs={setReportLogs} 
      formatDateTime={formatDateTime} />
    ),
    'team-organizer-view': (
      <TeamOrganizerView responders={currentTeam}/>
    ),
    'incident-history-view': (
      <IncidentHistoryView reportLogs={reportLogs} />
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
                    // Choose latest non-empty team from alpha or bravo
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
                  <span className="notification-badge-sidebar">
                    {notifCount}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="main-content">
          <div className="content-view">{viewConfig[activeView]}</div>
        </div>
      </div>
    </div>
  );
}
