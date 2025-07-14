import React, { useState } from 'react';

const SettingsView = () => {
  const [account, setAccount] = useState({
    username: 'admin@gov.ph',
    role: 'Admin',
    notifications: true,
    darkMode: false
  });

  const handleToggle = (key) => {
    setAccount((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
      </div>

      {/* Account Info Section */}
      <div className="settings-section">
        <h3>Account</h3>
        <div className="setting-item">
          <label>Username</label>
          <span>{account.username}</span>
        </div>
        <div className="setting-item">
          <label>Role</label>
          <span>{account.role}</span>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="settings-section">
        <h3>Notifications</h3>
        <div className="setting-item">
          <label>Email Alerts</label>
          <input
            type="checkbox"
            checked={account.notifications}
            onChange={() => handleToggle('notifications')}
          />
        </div>
      </div>

      {/* Appearance Section */}
      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-item">
          <label>Dark Mode</label>
          <input
            type="checkbox"
            checked={account.darkMode}
            onChange={() => handleToggle('darkMode')}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="settings-section">
        <button className="btn btn-danger w-100">
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>

      {/* Version */}
      <div className="settings-version">
        GoRescue Admin Dashboard v1.0.0 © 2025
      </div>
    </div>
  );
};

export default SettingsView;
