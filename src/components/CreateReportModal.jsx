import React, { useState } from 'react'; 
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import './modalstyles/CreateReportStyles.css';

const GEOAPIFY_API_KEY = '499958bc884b4b8cae36c651db0a3d7d';

const CreateRescueModal = ({ isOpen, onClose, onReportCreated }) => {
  const db = getFirestore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    reporterName: '',
    contact: '',
    location: '',
    notes: '',
    respondingTeam: '',
    severity: ''
  });

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
        return parts[1].trim(); // Return part after the keyword
      }
    }
    return text;
  };

  // Helper: Select best feature by rank from Geoapify results
  const selectBestFeature = (features) => {
    if (!features || features.length === 0) return null;
    // Sort features by rank (lower rank means better relevance)
    const sorted = features.sort((a, b) => {
      const rankA = a.properties.rank?.importance ?? 0;
      const rankB = b.properties.rank?.importance ?? 0;
      return rankB - rankA; // higher importance first
    });
    return sorted[0];
  };

  try {
    const place = extractPlace(locationText);
    console.log("Location Text:", locationText);
    console.log("Extracted Place:", place);

    // Try full text search
    let response = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(locationText)}&apiKey=${GEOAPIFY_API_KEY}`
    );
    let data = await response.json();

    console.log("Geocoding Response (full text):", data);

    let bestFeature = selectBestFeature(data.features);
    if (bestFeature) {
      const { lat, lon } = bestFeature.properties;
      return { lat, lng: lon };
    }

    // Fallback: try extracted place only
    if (place !== locationText) {
      response = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(place)}&apiKey=${GEOAPIFY_API_KEY}`
      );
      data = await response.json();

      console.log("Geocoding Response (extracted place):", data);

      bestFeature = selectBestFeature(data.features);
      if (bestFeature) {
        const { lat, lon } = bestFeature.properties;
        return { lat, lng: lon };
      }
    }

    // No valid feature found
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

  const handleSubmit = async () => {
    if (!form.severity || !form.reporterName || !form.contact || !form.location || !form.respondingTeam) {
      alert("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const coords = await geocodeLocation(form.location);
      if (!coords) {
        alert("Failed to find coordinates for the location. Please provide a more specific location.");
        setLoading(false);
        return;
      }

      // Generate reportId (MMYY-XXXX)
      const now = new Date();
      const MM = String(now.getMonth() + 1).padStart(2, '0'); // e.g. "08"
      const YY = String(now.getFullYear()).slice(-2);         // e.g. "25"
      const prefix = MM + YY;

      // Query reports in current month/year to count existing ones
      const incidentsRef = collection(db, "incidents");
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const q = query(
        incidentsRef,
        where('timestamp', '>=', startOfMonth),
        where('timestamp', '<', startOfNextMonth)
      );
      const snapshot = await getDocs(q);
      const count = snapshot.size;

      const incrementalNumber = (count + 1).toString().padStart(4, '0'); // e.g. "0001"
      const reportId = `${prefix}-${incrementalNumber}`;                 // e.g. "0825-0001"

      const docRef = await addDoc(incidentsRef, {
        reportId,   // <-- add this field!
        emergencySeverity: form.severity.toLowerCase(),
        reporter: form.reporterName,
        contact: form.contact,
        location: JSON.stringify(coords),  // store coordinates as JSON string
        locationText: form.location,       // also store original text
        notes: form.notes || "",
        status: "pending",
        timestamp: serverTimestamp(),
        respondingTeam: form.respondingTeam
      });

      if (onReportCreated) {
        onReportCreated({
          id: docRef.id,
          reportId,  // pass it here too
          emergencySeverity: form.severity.toLowerCase(),
          reporter: form.reporterName,
          contact: form.contact,
          location: coords,             // pass coords object here
          locationText: form.location,
          notes: form.notes || "",
          status: 'pending',
          timestamp: new Date().toISOString(),
          respondingTeam: form.respondingTeam
        });
      }

      onClose();
      setForm({ reporterName: '', contact: '', location: '', notes: '', respondingTeam: '', severity: '' });
    } catch (error) {
      console.error("Error adding rescue report: ", error);
      alert("Failed to create report.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal rescue-modal">
        <div className="modal-header">
          <h2>Create Rescue Report</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <label>Reporter Name *</label>
          <input type="text" name="reporterName" value={form.reporterName} onChange={handleChange} />

          <label>Contact Number *</label>
          <input type="text" name="contact" value={form.contact} onChange={handleChange} />

          <label>Location *</label>
          <input type="text" name="location" value={form.location} onChange={handleChange} />

          <label>Notes (Description of incident)</label>
          <textarea name="notes" value={form.notes} onChange={handleChange}></textarea>

          <label>Assign Responding Team *</label>
          <select name="respondingTeam" value={form.respondingTeam} onChange={handleChange}>
            <option value="">Select Team</option>
            <option value="Team Alpha">Team Alpha</option>
            <option value="Team Bravo">Team Bravo</option>
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
          <button
            onClick={handleSubmit}
            className="primary-btn"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save & Dispatch"}
          </button>
          <button onClick={onClose} className="secondary-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default CreateRescueModal;
