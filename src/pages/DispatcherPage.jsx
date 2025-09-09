import React, { useRef, useState, useEffect } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import alertSound from '../assets/alertSound.mp3';
import LiveMapView from './DispatcherViews/LiveMapView';
import NotificationsView from './DispatcherViews/NotificationsView';
import ReportLogsView from './DispatcherViews/ReportLogsView';
import TeamOrganizerView from './DispatcherViews/TeamOrganizerView';
import IncidentHistoryView from './DispatcherViews/IncidentHistoryView';
import TeamStatusView from './DispatcherViews/TeamStatusView';
import '../pages/DispatcherViews/DispatchStyle/DispatcherPage.css';
import '../App.css';
import CreateRescueModal from '../components/CreateReportModal';
import Logo from '../assets/GoRescueLogo.webp';
import L from 'leaflet';
import { emergencySeverityMap } from '../constants/dispatchConstants';
import { useNavigate } from 'react-router-dom';

export default function DispatcherPage() {
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('map-view');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  const [notifications, setNotifications] = useState([]);
  const [reportLogs, setReportLogs] = useState(() => {
    const saved = localStorage.getItem('reportLogs');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map(r => ({
        ...r,
        location: typeof r.location === 'string' ? JSON.parse(r.location) : r.location,
      }));
    } catch {
      return [];
    }
  });
  const [highlightedNotifIds, setHighlightedNotifIds] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, menuItem: null });
  const acknowledgedSeen = useRef(new Set());

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
  const [toasts, setToasts] = useState([]);
  const lastIncidentStatusRef = useRef({});

  const showToast = (payload) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const normalized = typeof payload === 'string' ? { text: payload } : (payload || {});
    const toast = {
      id,
      text: normalized.text || '',
      type: normalized.type || 'info', // info | success | warning | danger
      severity: normalized.severity || null, // critical | high | moderate | low
      onClick: typeof normalized.onClick === 'function' ? normalized.onClick : null,
      duration: Number(normalized.duration) > 0 ? Number(normalized.duration) : 5000
    };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const formatTeamLabel = (teamKey) => {
    if (!teamKey) return null;
    const lower = String(teamKey).toLowerCase();
    if (lower.startsWith('team ')) return teamKey;
    const base = String(teamKey).split('-')[0];
    if (!base) return null;
    return `Team ${base.charAt(0).toUpperCase() + base.slice(1)}`;
  };

  // Restore data from sessionStorage on load
  useEffect(() => {
    const restoreData = () => {
      try {
        const savedData = sessionStorage.getItem('dispatcherData');
        if (savedData) {
          const data = JSON.parse(savedData);
          const dataAge = Date.now() - (data.timestamp || 0);
          
          // Only restore if data is less than 30 minutes old
          if (dataAge < 30 * 60 * 1000) {
            if (data.notifications) {
              setNotifications(data.notifications);
            }
            if (data.reportLogs) {
              const restoredLogs = data.reportLogs.map(r => ({
                ...r,
                location: typeof r.location === 'string' ? JSON.parse(r.location) : r.location,
              }));
              setReportLogs(restoredLogs);
            }
            if (data.teams) {
              setTeams(data.teams);
            }
            if (data.currentTeam) {
              setCurrentTeam(data.currentTeam);
            }
            console.log('✅ Restored dispatcher data from session');
          } else {
            // Remove old data
            sessionStorage.removeItem('dispatcherData');
          }
        }
      } catch (error) {
        console.warn('Could not restore dispatcher data:', error);
        sessionStorage.removeItem('dispatcherData');
      }
    };

    restoreData();
  }, []); // Run once on mount

  // Periodic data persistence and sync with other tabs
  useEffect(() => {
    const syncInterval = setInterval(() => {
      // Update sessionStorage with current data
      const persistData = {
        notifications: notifications,
        reportLogs: reportLogs.map(r => ({
          ...r,
          location: JSON.stringify(r.location)
        })),
        teams: teams,
        currentTeam: currentTeam,
        timestamp: Date.now()
      };
      
      try {
        sessionStorage.setItem('dispatcherData', JSON.stringify(persistData));
      } catch (error) {
        console.warn('Could not persist data to sessionStorage:', error);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(syncInterval);
  }, [notifications, reportLogs, teams, currentTeam]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const auth = getAuth();
    const handleStorageChange = (e) => {
      // Check for the logout flag first
      if (e.key === 'logoutEvent' && e.newValue) {
        console.log('Detected logout event from another tab. Logging out...');
        // Sign out from Firebase and clear the flag
        signOut(auth).then(() => {
            localStorage.removeItem('logoutEvent');
            window.location.href = '/';
        }).catch((error) => {
            console.error('Error signing out:', error);
            localStorage.removeItem('logoutEvent');
            window.location.href = '/';
        });
      }

      if (e.key === 'dispatcherData' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          const dataAge = Date.now() - (data.timestamp || 0);
          
          // Only sync if data is recent and from another tab
          if (dataAge < 60000 && e.storageArea === sessionStorage) {
            if (data.notifications && JSON.stringify(data.notifications) !== JSON.stringify(notifications)) {
              setNotifications(data.notifications);
            }
            if (data.reportLogs) {
              const restoredLogs = data.reportLogs.map(r => ({
                ...r,
                location: typeof r.location === 'string' ? JSON.parse(r.location) : r.location,
              }));
              if (JSON.stringify(restoredLogs) !== JSON.stringify(reportLogs)) {
                setReportLogs(restoredLogs);
              }
            }
            if (data.teams && JSON.stringify(data.teams) !== JSON.stringify(teams)) {
              setTeams(data.teams);
            }
            if (data.currentTeam && JSON.stringify(data.currentTeam) !== JSON.stringify(currentTeam)) {
              setCurrentTeam(data.currentTeam);
            }
          }
        } catch (error) {
          console.warn('Could not sync data from other tab:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [notifications, reportLogs, teams, currentTeam]);

  // Check user role
  useEffect(() => {
    const auth = getAuth();
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
  }, [db]);

  useEffect(() => {
    const auth = getAuth();
    const checkUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "mdrrmo-users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          console.log("✅ User profile:", data);
          setUserName(data.fullName || user.displayName || "Dispatcher");
        }
      } catch (error) {
        console.error("🔥 Error fetching user profile:", error.message);
      }
    };
    checkUserProfile();
  }, [db]);


  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ show: false, x: 0, y: 0, menuItem: null });
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // Track viewport width for responsive behaviors (e.g., sidebar backdrop)
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobileSidebarOpen = !sidebarCollapsed && viewportWidth <= 1024;

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

  // Notification effect
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
        fillColor: '#e74c4c',
        fillOpacity: 0.2,
        radius: 20
      }).addTo(map);
    }, 400);
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
      contact: notification.reporterContact || notification.contact,
      timestamp: new Date().toISOString(),
      emergencySeverity: notification.severity,
      location: typeof notification.location === 'string' ? JSON.parse(notification.location) : notification.location,
      details: notification.details,
      respondingTeam: `Team ${teamId.charAt(0).toUpperCase() + teamId.slice(1)} - ${
        emergencySeverityMap[notification.severity]?.label || ''
      }`,
      status: 'in-progress'
    };

    setReportLogs(prev => {
      const updatedLogs = [...prev, newLog];
      // Save to both localStorage and sessionStorage
      const logsToSave = updatedLogs.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      }));
      localStorage.setItem('reportLogs', JSON.stringify(logsToSave));
      
      // Also update sessionStorage for cross-tab sync
      const currentData = JSON.parse(sessionStorage.getItem('dispatcherData') || '{}');
      sessionStorage.setItem('dispatcherData', JSON.stringify({
        ...currentData,
        reportLogs: logsToSave,
        timestamp: Date.now()
      }));
      
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
    setTeams(prev => ({
      ...prev,
      [teamName]: [teamDeck],
    }));
  };

  const formatDateTime = (datetimeStr) => {
    if (!datetimeStr) return 'N/A';
    const date = new Date(datetimeStr);
    if (isNaN(date)) return 'Invalid Date';
    return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  };

  // This function will handle the new data from the modal
  const handleReportCreated = (newReport) => {
    if (newReport && newReport.id) {
      setReportLogs(prevLogs => {
        // Check if we are editing an existing report
        const existingIndex = prevLogs.findIndex(log => log.id === newReport.id);
        if (existingIndex > -1) {
          // Update the existing report in the log
          const updatedLogs = [...prevLogs];
          updatedLogs[existingIndex] = newReport;
          return updatedLogs;
        } else {
          // Add a new report to the log
          return [...prevLogs, newReport];
        }
      });
      showToast(`✅ Report ${newReport.id} saved successfully!`);
    } else {
      console.error("handleReportCreated received an invalid report object:", newReport);
      showToast("❌ An error occurred while saving the report.");
    }
  };
  
  // Firestore realtime fetch report logs
  useEffect(() => {
    const incidentsRef = collection(db, 'incidents');
    const q = query(incidentsRef, where('status', 'in', ['Pending', 'Acknowledged', 'In Progress']));

    const unsubscribe = onSnapshot(q, snapshot => {
      const fetchedReports = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          location: typeof data.location === 'string' ? JSON.parse(data.location) : data.location,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : (data.timestamp || new Date().toISOString())
        };
      });
      
      setReportLogs(fetchedReports);
      
      // Save to both localStorage and sessionStorage
      const logsToSave = fetchedReports.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      }));
      localStorage.setItem('reportLogs', JSON.stringify(logsToSave));
      
      // Also update sessionStorage for cross-tab sync
      const currentData = JSON.parse(sessionStorage.getItem('dispatcherData') || '{}');
      sessionStorage.setItem('dispatcherData', JSON.stringify({
        ...currentData,
        reportLogs: logsToSave,
        timestamp: Date.now()
      }));
      
    }, error => {
      console.error('Error fetching incidents:', error);
    });

    return () => unsubscribe();
  }, [db]);

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  
  const confirmLogout = () => {
    const auth = getAuth();
    // Set a flag in localStorage to signal other tabs to log out.
    try {
      localStorage.setItem('logoutEvent', Date.now().toString());
    } catch (error) {
      console.warn('Could not set logout event in localStorage:', error);
    }
    
    // Sign out from Firebase and clear the flag
    signOut(auth).then(() => {
        setShowLogoutConfirm(false);
        window.location.href = '/';
    }).catch((error) => {
        console.error('Error signing out:', error);
        setShowLogoutConfirm(false);
        window.location.href = '/';
    });
  };

  const cancelLogout = () => setShowLogoutConfirm(false);

  // Handle context menu
  const handleContextMenu = (e, menuItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      menuItem: menuItem
    });
  };

  const handleContextMenuAction = (action) => {
    const { menuItem } = contextMenu;
    const baseUrl = window.location.origin;
    
    // Persist current data to sessionStorage before opening new tab/window
    const persistData = {
      notifications: notifications,
      reportLogs: reportLogs.map(r => ({
        ...r,
        location: JSON.stringify(r.location)
      })),
      teams: teams,
      currentTeam: currentTeam,
      timestamp: Date.now()
    };
    
    try {
      sessionStorage.setItem('dispatcherData', JSON.stringify(persistData));
    } catch (error) {
      console.warn('Could not persist data to sessionStorage:', error);
    }
    
    if (action === 'newTab') {
      if (menuItem.route) {
        window.open(`${baseUrl}${menuItem.route}`, '_blank');
      } else {
        // For views within dispatcher, open dispatcher page with hash
        window.open(`${baseUrl}/dispatcher#${menuItem.id}`, '_blank');
      }
    } else if (action === 'newWindow') {
      if (menuItem.route) {
        window.open(`${baseUrl}${menuItem.route}`, '_blank', 'width=1200,height=800');
      } else {
        window.open(`${baseUrl}/dispatcher#${menuItem.id}`, '_blank', 'width=1200,height=800');
      }
    }
    
    setContextMenu({ show: false, x: 0, y: 0, menuItem: null });
  };

  // Handle URL hash for direct view access
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && ['map-view', 'notifications-view', 'report-logs-view', 'team-organizer-view', 'incident-history-view', 'team-status-view'].includes(hash)) {
      setActiveView(hash);
    }
  }, []);

  useEffect(() => {
  const incidentsRef = collection(db, 'incidents');
  const ackQuery = query(incidentsRef, where('status', '==', 'Acknowledged'));

  const unsubscribe = onSnapshot(ackQuery, (snapshot) => {
    snapshot.docChanges().forEach((dc) => {
      const data = dc.doc.data();
      const docId = dc.doc.id;

      // Make a unique key per acknowledgement (doc + timestamp)
      const ackAtIso = data.acknowledgedAt?.toDate
        ? data.acknowledgedAt.toDate().toISOString()
        : (data.acknowledgedAt || '');
      const uniqueKey = `${docId}-${ackAtIso || 'noAckTime'}`;
      if (acknowledgedSeen.current.has(uniqueKey)) return;
      acknowledgedSeen.current.add(uniqueKey);

      // Normalize location: either `location` object or `latitude/longitude` strings
      const locFromField = typeof data.location === 'string' ? JSON.parse(data.location) : data.location;
      const locFromLatLng = (data.latitude && data.longitude)
        ? { lat: Number(data.latitude), lng: Number(data.longitude) }
        : undefined;
      const location = locFromField || locFromLatLng;

      const severity = data.emergencySeverity || data.severity || 'N/A';
      const reporter = data.reporter || 'Unknown';
      const acknowledgingUser = data.acknowledgedBy || 'Unknown';
      const emergencyType = data.emergencyType || 'Incident';

      // Push a notification item (appears in Notifications view)
      const notificationItem = {
        id: `ack-${docId}-${Date.now()}`,
        type: 'acknowledged',
        title: 'Responder Acknowledged',
        details: `${emergencyType} acknowledged by ${acknowledgingUser}`,
        severity,
        reporter,
        location,
        timestamp: ackAtIso || new Date().toISOString(),
        responded: true
      };
      setNotifications(prev => [...prev, notificationItem]);

      // Show a toast with formatted message
      const teamRaw = data.respondingTeam || data.assignedTeam;
      const teamLabel = formatTeamLabel(teamRaw) || 'Team';
      const reportLabel = data.reportId || docId;
      showToast({
        text: `${teamLabel} has acknowledged Report ${reportLabel}`,
        type: 'info',
        severity: (data.emergencySeverity || data.severity || '').toLowerCase(),
        onClick: () => {
          setActiveView('report-logs-view');
        }
      });
    });
  }, (error) => {
    console.error('Error listening for acknowledgements:', error);
  });

  return () => unsubscribe();
}, [db]);

  // Listen for general incident status changes to toast updates (en route, on scene, transferring, heading back, completed)
  useEffect(() => {
    const incidentsRef = collection(db, 'incidents');
    const unsubscribe = onSnapshot(incidentsRef, (snapshot) => {
      snapshot.docChanges().forEach((dc) => {
        const data = dc.doc.data() || {};
        const docId = dc.doc.id;
        const rawStatus = String(data.status || '').toLowerCase();
        const normalizedStatus = rawStatus
          .replace(/\s+/g, '-')
          .replace(/^in-progress$/, 'in-progress');

        const lastStatus = lastIncidentStatusRef.current[docId];
        if (lastStatus === normalizedStatus) return;
        lastIncidentStatusRef.current[docId] = normalizedStatus;

        // Map statuses of interest to human text
        const statusTextMap = {
          'acknowledged': 'has acknowledged',
          'en-route': 'is en route',
          'enroute': 'is en route',
          'on-scene': 'is on scene',
          'onscene': 'is on scene',
          'transferring': 'is transferring a patient',
          'heading-back': 'is heading back',
          'completed': 'has completed the mission',
          'resolved': 'has completed the mission'
        };

        if (!statusTextMap[normalizedStatus]) return;

        const teamLabel = formatTeamLabel(data.respondingTeam || data.assignedTeam) || 'Team';
        const reportLabel = data.reportId || docId;

        // Severity-driven toast type
        const sev = String(data.emergencySeverity || data.severity || '').toLowerCase();
        const sevType = sev === 'critical' ? 'danger' : (sev === 'high' ? 'warning' : 'info');

        showToast({
          text: `${teamLabel} ${statusTextMap[normalizedStatus]} for Report ${reportLabel}`,
          type: sevType,
          severity: sev,
          onClick: () => {
            setActiveView('report-logs-view');
          }
        });
      });
    }, (error) => {
      console.error('Error listening for incident updates:', error);
    });

    return () => unsubscribe();
  }, [db]);

  const menuItems = [
    { id: 'map-view', icon: 'fa-map', label: 'Live Map' },
    { id: 'notifications-view', icon: 'fa-bell', label: 'Notifications' },
    { id: 'report-logs-view', icon: 'fa-file-alt', label: 'Report Logs' },
    { id: 'team-organizer-view', icon: 'fa-users', label: 'Team Organizer' },
    { id: 'incident-history-view', icon: 'fa-history', label: 'Incident History' },
    { id: 'team-status-view', icon: 'fa-chart-bar', label: 'Team Status' }
  ];

  const viewConfig = {
    'map-view': <LiveMapView mapRef={mapRef} notifications={notifications} reportLogs={reportLogs} teams={teams} />,
    'notifications-view': <NotificationsView
      notifications={notifications}
      dispatchTeam={dispatchTeam}
      viewOnMap={viewNotificationOnMap}
      highlightedNotifIds={highlightedNotifIds}
      onHoverEnter={handleMouseEnter}
      onHoverLeave={handleMouseLeave}
      availableTeams={teams}
      createTeam={handleCreateTeam}
    />,
    'report-logs-view': <ReportLogsView reportLogs={reportLogs} setReportLogs={setReportLogs} formatDateTime={formatDateTime} />,
    'team-organizer-view': <TeamOrganizerView responders={currentTeam} />,
    'incident-history-view': <IncidentHistoryView reportLogs={reportLogs} formatDateTime={formatDateTime} />,
    'team-status-view': <TeamStatusView />
  };

  return (
    <div className='dispatcher-page'>
      <div className={`dispatcher-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="top-bar">
          <div className="menu-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar" role="button" tabIndex={0}><i className="fas fa-bars" /></div>
          <img src={Logo} alt="Victoria Rescue Logo" className="logo-small" />
          <div className="user-menu">
            <span className="user-name">
              <i className="fas fa-user-circle" style={{ marginRight: '6px' }} />
              {userName}
            </span>
            <button id="logout-btn" onClick={handleLogoutClick}>
              <i className="fas fa-sign-out-alt" /> Logout
            </button>
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-header"><h3>Dispatcher Dashboard</h3></div>
          <div className="sidebar-menu">
            {menuItems.map((menuItem) => (
              <div
                key={menuItem.id}
                className={`menu-item ${activeView === menuItem.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveView(menuItem.id);
                  window.location.hash = menuItem.id;
                  if (menuItem.id === 'notifications-view') {
                    notifCountRef.current = 0;
                    setNotifCount(0);
                  }
                  if (menuItem.id === 'team-organizer-view') {
                    const alpha = teams.alpha?.[0];
                    const bravo = teams.bravo?.[0];
                    const latest = bravo || alpha;
                    setCurrentTeam(latest);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, menuItem)}
              >
                <i className={`fas ${menuItem.icon}`} />
                <span>{menuItem.label}</span>
                {menuItem.id === 'notifications-view' && notifCount > 0 && (
                  <span className="notification-badge-sidebar">{notifCount}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar backdrop for mobile/tablet */}
        {isMobileSidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarCollapsed(true)}
            role="button"
            aria-label="Close sidebar"
          />
        )}

        <div className="main-content">
          <div className="content-view">{viewConfig[activeView]}</div>
        </div>

        {/* Context Menu */}
        {contextMenu.show && (
          <div
            className="context-menu"
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: '150px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="context-menu-item"
              style={{
                padding: '8px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee'
              }}
              onClick={() => handleContextMenuAction('newTab')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <i className="fas fa-external-link-alt" style={{ marginRight: '8px' }} />
              Open in New Tab
            </div>
            <div
              className="context-menu-item"
              style={{
                padding: '8px 16px',
                cursor: 'pointer'
              }}
              onClick={() => handleContextMenuAction('newWindow')}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <i className="fas fa-window-restore" style={{ marginRight: '8px' }} />
              Open in New Window
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <div className="fab-container" onClick={() => setShowReportModal(true)}>
          <div className="fab-icon"><i className="fas fa-file-alt"></i></div>
          <span className="fab-label">Create Report</span>
        </div>

        {/* Report Modal */}
        {showReportModal && <CreateRescueModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} onReportCreated={handleReportCreated} />}

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="modal-overlay">
            <div className="modal confirm-modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h2>Confirm Logout</h2>
                  <button className="close-btn" onClick={cancelLogout}>&times;</button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to log out?</p>
                </div>
                <div className="modal-footer">
                  <button className="cancel-btn" onClick={cancelLogout}>No</button>
                  <button className="submit-btn" onClick={confirmLogout}>Yes</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toasts */}
        {/* Toast styles for animation */}
        <style>
          {`
            @keyframes toastIn {
              from { opacity: 0; transform: translateY(8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}
        </style>

        <div
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 2000
          }}
        >
          {toasts.map((t, idx) => {
            const colorMap = {
              success: '#2ecc71',
              info: '#3498db',
              warning: '#f39c12',
              danger: '#e74c3c'
            };
            const severityColorMap = {
              critical: '#e74c3c',
              high: '#f39c12',
              moderate: '#3498db',
              low: '#2ecc71'
            };
            const iconMap = {
              success: 'fa-check-circle',
              info: 'fa-info-circle',
              warning: 'fa-exclamation-triangle',
              danger: 'fa-exclamation-circle'
            };
            const bg = (t.severity && severityColorMap[t.severity]) || colorMap[t.type] || colorMap.info;
            const icon = iconMap[t.type] || iconMap.info;
            return (
              <div
                key={t.id}
                style={{
                  background: bg,
                  color: 'white',
                  padding: '12px 16px',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  maxWidth: 360,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  animation: 'toastIn 180ms ease-out',
                  cursor: t.onClick ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (t.onClick) t.onClick();
                }}
              >
                <i className={`fas ${icon}`} style={{ marginTop: 2 }} />
                <div style={{ flex: 1, lineHeight: 1.3 }}>{t.text}</div>
                <button
                  onClick={() => dismissToast(t.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                  aria-label="Dismiss toast"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}