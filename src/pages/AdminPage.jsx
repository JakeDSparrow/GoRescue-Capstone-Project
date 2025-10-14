import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DashboardView from './AdminViews/DashBoardView';
import AnnouncementsView from './AdminViews/AnnouncementsView';
import RequestsView from './AdminViews/RequestsView';
import ArchivesView from './AdminViews/ArchivesView'; 
import UsersView from './AdminViews/UsersView';
import SettingsView from './AdminViews/SettingsView';
import Logo from '../assets/GoRescueLogo.webp';
import "../pages/AdminViews/AdminStyle/AdminPage.css";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('dashboard-view');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [now, setNow] = useState(new Date());

  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;

    console.log("Current ID:", auth.currentUser?.uid);

    if (user) {
      const checkRole = async () => {
        try {
          const userDoc = await getDoc(doc(db, "mdrrmo-users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data().role;
            console.log("User Role:", role);

            if (role !== "admin") {
              alert("Access denied. Only admins can view this page.");
              navigate("/");
            }
          } else {
            console.warn("No Firestore document found for this user.");
            alert("No user data found. Please contact admin.");
            navigate("/");
          }
        } catch (err) {
          console.error("Role check failed:", err);
          alert("Failed to verify admin privileges.");
          navigate("/");
        }
      };

      checkRole();
    } else {
      console.warn("Not signed in.");
      navigate("/");
    }
  }, [navigate]);

  // live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    const auth = getAuth();
    try {
      await auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout failed", error);
      alert("Logout failed.");
    }
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const renderView = () => {
    switch(activeView) {
      case 'dashboard-view':
        return <DashboardView />;
      case 'announcements-view':
        return <AnnouncementsView />;
      case 'requests-view':
        return <RequestsView />;
      case 'archives-view':
        return <ArchivesView />;
      case 'users-view':
        return <UsersView />;
      case 'settings-view':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="admin-page">
      <div className={`admin-dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Bar */}
        <div className="top-bar">
          <button 
            className="menu-toggle" 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label="Toggle menu"
          >
            <i className="fas fa-bars"></i>
          </button>
          <div className="time-date-display">
            <span className="time-date-text">{now.toLocaleString()}</span>
          </div>
          <div className="user-menu">
            <div className="user-avatar">AD</div>
            <button 
              className="logout-button"
              onClick={handleLogoutClick} // Use the new handler
              aria-label="Logout"
              title="Logout"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'active' : ''}`}>
          <div className="sidebar-header">
            <img src={Logo} alt="GoRescue" className="sidebar-logo" />
            <h3>Admin Dashboard</h3>
          </div>
          <nav className="sidebar-menu">
            <button
              className={`menu-item ${activeView === 'dashboard-view' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard-view')}
            >
              <i className="fas fa-chart-line"></i>
              <span>Dashboard</span>
            </button>
            <button
              className={`menu-item ${activeView === 'announcements-view' ? 'active' : ''}`}
              onClick={() => setActiveView('announcements-view')}
            >
              <i className="fas fa-bullhorn"></i>
              <span>Announcements</span>
            </button>
            <button
              className={`menu-item ${activeView === 'requests-view' ? 'active' : ''}`}
              onClick={() => setActiveView('requests-view')}
            >
              <i className="fas fa-file-alt"></i>
              <span>Requests</span>
            </button>
            <button
              className={`menu-item ${activeView === 'archives-view' ? 'active' : ''}`}
              onClick={() => setActiveView('archives-view')}
            >
              <i className="fas fa-archive"></i>
              <span>Archives</span>
            </button>
            <button
              className={`menu-item ${activeView === 'users-view' ? 'active' : ''}`}
              onClick={() => setActiveView('users-view')}
            >
              <i className="fas fa-users-cog"></i>
              <span>User Management</span>
            </button>
            <button
              className={`menu-item ${activeView === 'settings-view' ? 'active' : ''}`}
              onClick={() => setActiveView('settings-view')}
            >
              <i className="fas fa-cog"></i>
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Main Content Views */}
        <main className="main-content">
          {renderView()}
        </main>
      </div>

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
    </div>
  );
};

export default AdminDashboard;