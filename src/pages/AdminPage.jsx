import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import DashboardView from './AdminViews/DashBoardView';
import AnnouncementsView from './AdminViews/AnnouncementsView';
import ArchivesView from './AdminViews/ArchivesView'; 
import UsersView from './AdminViews/UsersView';
import SettingsView from './AdminViews/SettingsView';
import Logo from '../assets/GoRescueLogo.webp';
import "../pages/AdminViews/AdminStyle/AdminPage.css";

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('dashboard-view');



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
              window.location.href = "/"; // Redirect to home or login
            }
          } else {
            console.warn("No Firestore document found for this user.");
            alert("No user data found. Please contact admin.");
            window.location.href = "/";
          }
        } catch (err) {
          console.error("Role check failed:", err);
          alert("Failed to verify admin privileges.");
          window.location.href = "/";
        }
      };

      checkRole();
    } else {
      console.warn("Not signed in.");
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="admin-page">
      <div className="admin-dashboard">
        {/* Top Bar */}
        <div className="top-bar">
          <button 
            className="menu-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <i className="fas fa-bars"></i>
          </button>
          <img src={Logo} alt="GoRescue" className="logo" />
          <div className="user-menu">
            <div className="user-avatar">AD</div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? 'active' : ''}`}>
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
          {activeView === 'dashboard-view' && <DashboardView />}
          {activeView === 'announcements-view' && <AnnouncementsView />}
          {activeView === 'archives-view' && <ArchivesView />}
          {activeView === 'users-view' && <UsersView />}
          {activeView === 'settings-view' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
