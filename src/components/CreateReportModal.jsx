import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import './modalstyles/CreateReportStyles.css';

const GEOAPIFY_API_KEY = '499958bc884b4b8cae36c651db0a3d7d';
const ROLE_KEYS = ['teamLeader', 'emt1', 'emt2', 'ambulanceDriver'];

const CreateRescueModal = ({ isOpen, onClose, onReportCreated, reportToEdit }) => {
  const db = getFirestore();
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reporterName: '',
    contact: '',
    location: '',
    notes: '',
    respondingTeam: '',
    severity: '',
  });

  // Prefill form when editing
  useEffect(() => {
    if (reportToEdit) {
      setForm({
        reporterName: reportToEdit.reporter || '',
        contact: reportToEdit.contact || '',
        location: reportToEdit.locationText || '',
        notes: reportToEdit.notes || '',
        respondingTeam: reportToEdit.respondingTeam || '',
        severity: reportToEdit.emergencySeverity || '',
      });
    } else {
      setForm({
        reporterName: '',
        contact: '',
        location: '',
        notes: '',
        respondingTeam: '',
        severity: '',
      });
    }
  }, [reportToEdit, isOpen]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'teams'));
        const data = {};

        snapshot.forEach((docSnap) => {
          const id = docSnap.id;
          const raw = docSnap.data();
          const parts = id.split('-');
          const teamKey = (parts[0] || '').toLowerCase();
          let shiftPart = parts.slice(1).join('-') || '';

          if (/dayshift/i.test(shiftPart)) shiftPart = 'dayShift';
          else if (/nightshift/i.test(shiftPart)) shiftPart = 'nightShift';
          if (!teamKey) return;

          data[teamKey] = data[teamKey] || {};
          data[teamKey][shiftPart || 'unknown'] = raw;
        });

        ['alpha', 'bravo'].forEach((k) => {
          data[k] = data[k] || {};
          data[k].dayShift = data[k].dayShift || {};
          data[k].nightShift = data[k].nightShift || {};
        });

        setTeams(data);
      } catch (err) {
        console.error('Failed to fetch teams:', err);
      }
    };

    fetchTeams();
  }, [db]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const geocodeLocation = async (locationText) => {
    if (!locationText) return null;

    const extractPlace = (text) => {
      const keywords = ['near', 'at'];
      for (const kw of keywords) {
        if (text.toLowerCase().includes(kw)) {
          const parts = text.toLowerCase().split(kw);
          return parts[1].trim();
        }
      }
      return text;
    };

    const selectBestFeature = (features) => {
      if (!features || features.length === 0) return null;
      return features.sort((a, b) => (b.properties.rank?.importance ?? 0) - (a.properties.rank?.importance ?? 0))[0];
    };

    try {
      const place = extractPlace(locationText);
      let response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(locationText)}&apiKey=${GEOAPIFY_API_KEY}`
      );
      let data = await response.json();
      let bestFeature = selectBestFeature(data.features);
      if (bestFeature) return { lat: bestFeature.properties.lat, lng: bestFeature.properties.lon };

      if (place !== locationText) {
        response = await fetch(
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(place)}&apiKey=${GEOAPIFY_API_KEY}`
        );
        data = await response.json();
        bestFeature = selectBestFeature(data.features);
        if (bestFeature) return { lat: bestFeature.properties.lat, lng: bestFeature.properties.lon };
      }

      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!form.severity || !form.reporterName || !form.contact || !form.location || !form.respondingTeam) {
      alert('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const coords = await geocodeLocation(form.location);
      if (!coords) {
        alert('Failed to find coordinates for the location.');
        setLoading(false);
        return;
      }

      if (reportToEdit) {
        // TODO: implement Firestore update logic here for editing
        onReportCreated({ ...reportToEdit, ...form, location: coords });
      } else {
        const now = new Date();
        const prefix = String(now.getMonth() + 1).padStart(2, '0') + String(now.getFullYear()).slice(-2);
        const incidentsRef = collection(db, 'incidents');
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const q = query(incidentsRef, where('timestamp', '>=', startOfMonth), where('timestamp', '<', startOfNextMonth));
        const snapshot = await getDocs(q);
        const reportId = `${prefix}-${String(snapshot.size + 1).padStart(4, '0')}`;

        const docRef = await addDoc(incidentsRef, {
          reportId,
          emergencySeverity: form.severity.toLowerCase(),
          reporter: form.reporterName,
          contact: form.contact,
          location: JSON.stringify(coords),
          locationText: form.location,
          notes: form.notes || '',
          status: 'pending',
          timestamp: serverTimestamp(),
          respondingTeam: form.respondingTeam,
        });

        onReportCreated({
          id: docRef.id,
          reportId,
          emergencySeverity: form.severity.toLowerCase(),
          reporter: form.reporterName,
          contact: form.contact,
          location: coords,
          locationText: form.location,
          notes: form.notes || '',
          status: 'pending',
          timestamp: new Date().toISOString(),
          respondingTeam: form.respondingTeam,
        });
      }

      onClose();
      setForm({
        reporterName: '',
        contact: '',
        location: '',
        notes: '',
        respondingTeam: '',
        severity: '',
      });
    } catch (error) {
      console.error('Error adding/editing report:', error);
      alert('Failed to save report.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal rescue-modal">
        <div className="modal-header">
          <h2>{reportToEdit ? 'Edit Rescue Report' : 'Create Rescue Report'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>Reporter Name *</label>
          <input type="text" name="reporterName" value={form.reporterName} onChange={handleChange} />

          <label>Contact Number *</label>
          <input type="text" name="contact" value={form.contact} onChange={handleChange} />

          <label>Location *</label>
          <input type="text" name="location" value={form.location} onChange={handleChange} />

          <label>Notes (Description)</label>
          <textarea name="notes" value={form.notes} onChange={handleChange}></textarea>

          <label>Assign Responding Team *</label>
          <select name="respondingTeam" value={form.respondingTeam} onChange={handleChange}>
            <option value="">Select Team & Shift</option>
            {Object.entries(teams).map(([teamKey, teamShifts]) =>
              ['dayShift', 'nightShift'].map((shiftKey) => {
                const shift = teamShifts[shiftKey] || {};
                const hasMembers = ROLE_KEYS.some(
                  (rk) => shift[rk] && (shift[rk].uid || shift[rk].fullName || shift[rk].name)
                );
                const formattedTeam = teamKey.charAt(0).toUpperCase() + teamKey.slice(1);
                return (
                  <option key={`${teamKey}-${shiftKey}`} value={`${teamKey}-${shiftKey}`} disabled={!hasMembers}>
                    {`Team ${formattedTeam}`}
                  </option>
                );
              })
            )}
          </select>

          <label>Incident Severity *</label>
          <select name="severity" value={form.severity} onChange={handleChange}>
            <option value="">Select Severity</option>
            <option value="Critical">Critical (Highest Priority)</option>
            <option value="High">High</option>
            <option value="Moderate">Moderate</option>
            <option value="Low">Low (Lowest Priority)</option>
          </select>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? (reportToEdit ? 'Updating...' : 'Creating...') : reportToEdit ? 'Update Report' : 'Create Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRescueModal;