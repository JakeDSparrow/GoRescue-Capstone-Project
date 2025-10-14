import React, { useEffect, useState } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const SettingsView = () => {
  // Appearance
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [followSystem, setFollowSystem] = useState(() => {
    try { return JSON.parse(localStorage.getItem('admin_follow_system') || 'true'); } catch { return true; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const stored = localStorage.getItem('admin_dark_mode');
      return stored !== null ? JSON.parse(stored) : prefersDark;
    } catch { return prefersDark; }
  });

  // Documents & PDFs settings (Option 1)
  const [docSettings, setDocSettings] = useState({
    retentionDays: 90,            // days before action
    autoGeneratePdf: true,        // generate PDFs on submit
    autoDeleteEnabled: false,     // auto-delete old docs
    autoArchiveEnabled: true      // auto-archive old docs (UI only for now)
  });
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  // Apply theme
  useEffect(() => {
    const apply = (isDark) => {
      if (isDark) document.body.classList.add('dark-mode');
      else document.body.classList.remove('dark-mode');
    };

    if (followSystem) {
      apply(prefersDark);
    } else {
      apply(darkMode);
    }
  }, [followSystem, darkMode, prefersDark]);

  // Persist appearance prefs
  useEffect(() => {
    try { localStorage.setItem('admin_follow_system', JSON.stringify(followSystem)); } catch {}
  }, [followSystem]);
  useEffect(() => {
    try { localStorage.setItem('admin_dark_mode', JSON.stringify(darkMode)); } catch {}
  }, [darkMode]);

  // Load settings from Firestore
  useEffect(() => {
    const load = async () => {
      try {
        const ref = doc(db, 'app_settings', 'global');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setDocSettings(prev => ({
            ...prev,
            retentionDays: Number(data.retentionDays ?? prev.retentionDays),
            autoGeneratePdf: Boolean(data.autoGeneratePdf ?? prev.autoGeneratePdf),
            autoDeleteEnabled: Boolean(data.autoDeleteEnabled ?? prev.autoDeleteEnabled),
            autoArchiveEnabled: Boolean(data.autoArchiveEnabled ?? prev.autoArchiveEnabled),
          }));
        }
      } catch (e) {
        console.error('Failed to load app settings', e);
      }
    };
    load();
  }, []);

  // Persist settings to Firestore (debounced by quick save indicator)
  const persistSettings = async (next) => {
    try {
      setSaving(true);
      const ref = doc(db, 'app_settings', 'global');
      await setDoc(ref, next, { merge: true });
      setSavedTick(true);
      setTimeout(() => setSavedTick(false), 1000);
    } catch (e) {
      console.error('Failed to save app settings', e);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDocChange = (partial) => {
    setDocSettings(prev => {
      const next = { ...prev, ...partial };
      // Persist immediately on change
      persistSettings(next);
      return next;
    });
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        {saving ? (
          <span style={{ fontSize: '0.9rem', color: '#6b7280' }}><i className="fas fa-spinner fa-spin"></i> Saving...</span>
        ) : savedTick ? (
          <span style={{ fontSize: '0.9rem', color: '#059669' }}><i className="fas fa-check"></i> Saved</span>
        ) : null}
      </div>

      {/* Documents & PDFs Section */}
      <div className="settings-section">
        <h3>Documents & PDFs</h3>
        <div className="setting-item">
          <label>Retention Period (days)</label>
          <input
            type="number"
            min={1}
            value={docSettings.retentionDays}
            onChange={(e) => handleDocChange({ retentionDays: Math.max(1, Number(e.target.value) || 1) })}
            style={{ width: 120 }}
          />
        </div>
        <div className="setting-item">
          <label>Auto-generate PDF on submit</label>
          <input
            type="checkbox"
            checked={docSettings.autoGeneratePdf}
            onChange={(e) => handleDocChange({ autoGeneratePdf: e.target.checked })}
          />
        </div>
        <div className="setting-item">
          <label>Auto-archive documents past retention</label>
          <input
            type="checkbox"
            checked={docSettings.autoArchiveEnabled}
            onChange={(e) => handleDocChange({ autoArchiveEnabled: e.target.checked })}
          />
        </div>
        <div className="setting-item">
          <label>Auto-delete documents past retention</label>
          <input
            type="checkbox"
            checked={docSettings.autoDeleteEnabled}
            onChange={(e) => handleDocChange({ autoDeleteEnabled: e.target.checked })}
          />
        </div>
        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
          Note: Auto-archive/delete will be enforced by a scheduled backend task. We can add a Cloud Function
          cron to move or remove old items in `saved_documents` and PDFs in Storage based on these settings.
        </div>
      </div>

      {/* Appearance Section */}
      <div className="settings-section">
        <h3>Appearance</h3>
        <div className="setting-item">
          <label>Follow system theme</label>
          <input
            type="checkbox"
            checked={followSystem}
            onChange={(e) => setFollowSystem(e.target.checked)}
          />
        </div>
        {!followSystem && (
          <div className="setting-item">
            <label>Dark Mode</label>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
          </div>
        )}
      </div>

      {/* Version */}
      <div className="settings-version">
        GoRescue Admin Dashboard v1.0.0 © 2025
      </div>
    </div>
  );
};

export default SettingsView;
