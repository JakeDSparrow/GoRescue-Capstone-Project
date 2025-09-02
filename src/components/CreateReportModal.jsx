import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  updateDoc,
} from 'firebase/firestore';
import './modalstyles/CreateReportStyles.css';
import {
  emergencySeverityMap,
  emergencyTypeMap,
  parseEmergencyCode,
  EMERGENCY_CATEGORIES,
  EMERGENCY_SUBCATEGORIES,
  CASUALTY_CODES,
  SEVERITY_CODES,
  convertLegacyToNewType,
  convertLegacySeverity,
  victoriaBarangayData,
  victoriaLandmarks
} from '../constants/dispatchConstants';

export { emergencySeverityMap, emergencyTypeMap };

const ROLE_KEYS = ['teamLeader', 'emt1', 'emt2', 'ambulanceDriver'];

const findSingleLocationCoords = async (locationText, barangayData, landmarkData) => {
  const normalizedText = locationText.toLowerCase().trim();
  let bestMatch = null;
  let highestScore = 0;

  // --- Landmark Matching with Scoring ---
  if (landmarkData && Array.isArray(landmarkData)) {
    for (const landmark of landmarkData) {
      const landmarkName = landmark.name.toLowerCase();
      let currentScore = 0;

      // 1. Perfect Match (highest score)
      if (normalizedText.includes(landmarkName)) {
        currentScore = 100; // Give a very high score for a full name match
      }
      // 2. Partial Keyword Match (lower score)
      else {
        const keywords = landmarkName.split(' ').filter(word => 
          word.length > 3 && !['the', 'and', 'of', 'in', 'at', 'for', 'with'].includes(word)
        );
        
        let matchedKeywords = 0;
        for (const keyword of keywords) {
          if (normalizedText.includes(keyword)) {
            matchedKeywords++;
          }
        }
        
        // Score based on the percentage of matched keywords
        if (keywords.length > 0) {
          currentScore = (matchedKeywords / keywords.length) * 10;
        }
      }

      // If this landmark has a better score than the previous best, update it
      if (currentScore > highestScore) {
        highestScore = currentScore;
        bestMatch = {
          lat: landmark.latitude,
          lng: landmark.longitude,
          precision: currentScore === 100 ? 'exact-landmark' : 'landmark-partial',
          matchedLocation: `${landmark.name} ${landmark.barangay ? `(${landmark.barangay})` : ''}`
        };
      }
    }
  }

  // If we found a good landmark match, return it.
  // The threshold (e.g., > 1) prevents very weak matches.
  if (bestMatch && highestScore > 1) {
    return bestMatch;
  }

  // --- Barangay Matching (Fallback) ---
  if (barangayData && Array.isArray(barangayData)) {
    for (const barangay of barangayData) {
      const barangayName = barangay.barangay.toLowerCase();
      
      if (normalizedText.includes(barangayName) || 
          normalizedText.includes(`brgy ${barangayName}`) ||
          normalizedText.includes(`barangay ${barangayName}`)) {
        // Return immediately as barangay match is a clear fallback
        return { 
          lat: barangay.latitude, 
          lng: barangay.longitude,
          precision: 'barangay',
          matchedLocation: `Barangay ${barangay.barangay}`
        };
      }
    }
  }

  return null; // Return null if no suitable match is found
};

const geocodeLocation = async (locationText) => {
  if (!locationText || typeof locationText !== 'string') {
    return null;
  }

  const normalizedText = locationText.toLowerCase().trim();
  const barangayData = victoriaBarangayData || [];
  const landmarkData = victoriaLandmarks || [];

  try {
    // Handle "between X and Y" queries
    const betweenMatch = normalizedText.match(/(?:between|in between)\s+(.+?)\s+and\s+(.+)/);
    if (betweenMatch) {
      const loc1 = betweenMatch[1].trim();
      const loc2 = betweenMatch[2].trim();
      
      const coords1 = await findSingleLocationCoords(loc1, barangayData, landmarkData);
      const coords2 = await findSingleLocationCoords(loc2, barangayData, landmarkData);
      
      if (coords1 && coords2) {
        const midpointLat = (coords1.lat + coords2.lat) / 2;
        const midpointLng = (coords1.lng + coords2.lng) / 2;
        return {
          lat: midpointLat,
          lng: midpointLng,
          precision: 'between',
          matchedLocation: `Between ${coords1.matchedLocation} and ${coords2.matchedLocation}`
        };
      }
      return coords1 || coords2;
    }

    // Handle "near X" queries with offset
    const nearMatch = normalizedText.match(/^near\s+(.+)/);
    if (nearMatch) {
      const targetLocation = nearMatch[1].trim();
      const baseCoords = await findSingleLocationCoords(targetLocation, barangayData, landmarkData);
      if (baseCoords) {
        const offsetLat = (Math.random() - 0.5) * 0.001;
        const offsetLng = (Math.random() - 0.5) * 0.001;
        return {
          lat: baseCoords.lat + offsetLat,
          lng: baseCoords.lng + offsetLng,
          precision: 'near',
          matchedLocation: `Near ${baseCoords.matchedLocation}`
        };
      }
      return null;
    }

    // Handle "at X" or "in X" queries - exact location
    const atInMatch = normalizedText.match(/^(?:at|in)\s+(.+)/);
    if (atInMatch) {
      const targetLocation = atInMatch[1].trim();
      return await findSingleLocationCoords(targetLocation, barangayData, landmarkData);
    }

    // Handle direct location queries
    return await findSingleLocationCoords(normalizedText, barangayData, landmarkData);
    
  } catch (error) {
    console.error('Error in geocodeLocation:', error);
    return null;
  }
};

const parseLocation = (locationObj) => {
  try {
    if (!locationObj) return null;
    
    if (typeof locationObj === 'string') {
      const parsed = JSON.parse(locationObj);
      return (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') ? parsed : null;
    }
    
    if (typeof locationObj === 'object') {
      const lat = Number(locationObj.lat || locationObj.latitude);
      const lng = Number(locationObj.lng || locationObj.lon || locationObj.longitude);
      return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing location:', error);
    return null;
  }
};

const formatReportId = (count) => {
  const date = new Date();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const countStr = count.toString().padStart(4, '0');
  return `${month}${day}-${countStr}`;
};

const initialFormState = {
  reporterName: '',
  contact: '',
  location: '',
  notes: '',
  respondingTeam: '',
  incidentCode: '',
  emergencyCategory: '',
  emergencySubtype: '',
  casualtyCode: '',
  severityCode: '',
};

const CreateRescueModal = ({ isOpen, onClose, onReportCreated, reportToEdit }) => {
  const db = getFirestore();
  const [teams, setTeams] = useState({});
  const [allResponders, setAllResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [calculatedCoords, setCalculatedCoords] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isCodeManuallyTyped, setIsCodeManuallyTyped] = useState(false);

  // Populate form if editing
  useEffect(() => {
    if (!isOpen) return;

    if (reportToEdit) {
      const parsed = parseEmergencyCode(reportToEdit.incidentCode);
      if (parsed) {
        setForm({
          reporterName: reportToEdit.reporter || '',
          contact: reportToEdit.contact || '',
          location: reportToEdit.locationText || '',
          notes: reportToEdit.notes || '',
          respondingTeam: reportToEdit.respondingTeam || '',
          incidentCode: reportToEdit.incidentCode,
          emergencyCategory: parsed.category,
          emergencySubtype: parsed.subtype,
          casualtyCode: parsed.casualty,
          severityCode: parsed.severity,
        });
      } else {
        const newType = convertLegacyToNewType(reportToEdit.emergencyType);
        const newSeverity = convertLegacySeverity(reportToEdit.emergencySeverity);
        setForm({
          reporterName: reportToEdit.reporter || '',
          contact: reportToEdit.contact || '',
          location: reportToEdit.locationText || '',
          notes: reportToEdit.notes || '',
          respondingTeam: reportToEdit.respondingTeam || '',
          incidentCode: '',
          emergencyCategory: newType.category,
          emergencySubtype: newType.subtype,
          casualtyCode: '00',
          severityCode: newSeverity,
        });
      }
      if (reportToEdit.location) {
        const coords = parseLocation(reportToEdit.location);
        if (coords) {
          setCalculatedCoords(coords);
        }
      }
    } else {
      setForm(initialFormState);
      setCalculatedCoords(null);
    }
    setStatusMessage('');
    setIsCodeManuallyTyped(false);
  }, [reportToEdit, isOpen]);

  // Fetch teams and responders
  useEffect(() => {
    const fetchTeamsAndResponders = async () => {
      try {
        const teamsSnapshot = await getDocs(collection(db, 'teams'));
        const teamsData = {};
        teamsSnapshot.forEach((docSnap) => {
          const id = docSnap.id;
          const raw = docSnap.data();
          const parts = id.split('-');
          const teamKey = (parts[0] || '').toLowerCase();
          let shiftPart = parts.slice(1).join('-') || '';
          if (/dayshift/i.test(shiftPart)) shiftPart = 'dayShift';
          else if (/nightshift/i.test(shiftPart)) shiftPart = 'nightShift';
          if (!teamKey) return;
          teamsData[teamKey] = teamsData[teamKey] || {};
          teamsData[teamKey][shiftPart || 'unknown'] = raw;
        });
        ['alpha', 'bravo'].forEach((k) => {
          teamsData[k] = teamsData[k] || {};
          teamsData[k].dayShift = teamsData[k].dayShift || {};
          teamsData[k].nightShift = teamsData[k].nightShift || {};
        });
        setTeams(teamsData);

        const respondersQuery = query(
          collection(db, 'mdrrmo-users'),
          where('role', '==', 'responder')
        );
        const respondersSnapshot = await getDocs(respondersQuery);
        setAllResponders(respondersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Failed to fetch teams or responders:', err);
        setStatusMessage('Error loading teams data. Please refresh and try again.');
      }
    };
    
    if (isOpen) {
      fetchTeamsAndResponders();
    }
  }, [db, isOpen]);

  // Auto-build incident code from dropdowns
  useEffect(() => {
    if (isCodeManuallyTyped) return;
    
    if (form.emergencyCategory && form.emergencySubtype && form.casualtyCode && form.severityCode) {
      const newCode = `${form.emergencyCategory}${form.emergencySubtype}-${form.casualtyCode}-${form.severityCode}`;
      if (newCode !== form.incidentCode) {
        setForm(prev => ({ ...prev, incidentCode: newCode }));
      }
    }
  }, [
    form.emergencyCategory, 
    form.emergencySubtype, 
    form.casualtyCode, 
    form.severityCode, 
    form.incidentCode,
    isCodeManuallyTyped
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'incidentCode') {
      setIsCodeManuallyTyped(value.trim() !== '');
      const parsed = parseEmergencyCode(value.trim().toUpperCase());
      if (parsed) {
        setForm(prev => ({
          ...prev,
          incidentCode: value.trim().toUpperCase(),
          emergencyCategory: parsed.category,
          emergencySubtype: parsed.subtype,
          casualtyCode: parsed.casualty,
          severityCode: parsed.severity,
        }));
      } else {
        setForm(prev => ({ ...prev, incidentCode: value }));
      }
      return;
    }

    if (['emergencyCategory','emergencySubtype','casualtyCode','severityCode'].includes(name)) {
      setIsCodeManuallyTyped(false);
    }

    setForm(prev => ({ ...prev, [name]: value }));

    if (name === 'emergencyCategory') {
      setForm(prev => ({ ...prev, emergencySubtype: '' }));
    }

    // Clear coordinates when location changes
    if (name === 'location') {
      setCalculatedCoords(null);
    }
  };

  // Manual geocoding button - ONLY manual now
  const handleManualGeocode = async () => {
    if (!form.location.trim()) {
      setStatusMessage('⚠️ Please enter a location first');
      return;
    }
    
    setLoading(true);
    
    try {
      const coords = await geocodeLocation(form.location.trim());
      if (coords) {
        setCalculatedCoords(coords);
        setStatusMessage(`✅ Location found: ${coords.matchedLocation}`);
      } else {
        setCalculatedCoords(null);
        setStatusMessage('❌ Location not recognized. Try landmark names, barangay names, or common locations.');
      }
    } catch (error) {
      console.error('Manual geocoding error:', error);
      setCalculatedCoords(null);
      setStatusMessage('❌ Error calculating coordinates.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.reporterName || !form.contact || !form.location || !form.respondingTeam || !form.incidentCode) {
      setStatusMessage('❌ Please fill in all required fields and ensure a valid Incident Code is generated.');
      return;
    }

    if (!calculatedCoords) {
      setStatusMessage('❌ Please calculate coordinates for the location first using the map button.');
      return;
    }

    setLoading(true);
    setStatusMessage('💾 Saving report...');

    try {
      let teamData;
      if (form.respondingTeam === 'all-responders') {
        teamData = {
          teamName: 'All Responders',
          members: allResponders.map(r => ({ uid: r.uid, fullName: r.fullName }))
        };
      } else {
        const [teamKey, shiftKey] = form.respondingTeam.split('-');
        const teamDetails = teams[teamKey] && teams[teamKey][shiftKey];
        if (!teamDetails) {
          setStatusMessage(`❌ Selected team (${teamKey} - ${shiftKey}) is not available.`);
          setLoading(false);
          return;
        }
        teamData = {
          teamName: `${teamKey?.toUpperCase()} - ${shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}`,
          members: ROLE_KEYS.map(role => teamDetails?.[role]).filter(m => m),
        };
      }

      const categoryMap = { 'ME': 'medical', 'AC': 'accident', 'NA': 'natural' };
      const severityMap = { '@C': 'critical', '@H': 'high', '@M': 'moderate', '@L': 'low' };

      const incidentData = {
        incidentCode: form.incidentCode,
        emergencyType: categoryMap[form.emergencyCategory] || 'medical',
        emergencySeverity: severityMap[form.severityCode] || 'low',
        reporter: form.reporterName,
        contact: form.contact,
        location: { 
          lat: calculatedCoords.lat, 
          lng: calculatedCoords.lng 
        },
        locationText: form.location,
        locationPrecision: calculatedCoords.precision || 'unknown',
        matchedLocation: calculatedCoords.matchedLocation || form.location,
        notes: form.notes || '',
        status: reportToEdit?.status || 'pending',
        timestamp: serverTimestamp(),
        respondingTeam: form.respondingTeam,
        teamData,
      };

      let savedReport;
      if (reportToEdit?.id) {
        const docRef = doc(db, 'incidents', reportToEdit.id);
        await updateDoc(docRef, incidentData);
        savedReport = { ...incidentData, id: reportToEdit.id, reportId: reportToEdit.reportId };
        setStatusMessage('✅ Report updated successfully!');
      } else {
        const incidentsRef = collection(db, 'incidents');
        const countSnapshot = await getDocs(incidentsRef);
        const reportId = formatReportId(countSnapshot.size + 1);
        const docRef = await addDoc(incidentsRef, { ...incidentData, reportId });
        savedReport = { ...incidentData, id: docRef.id, reportId };
        setStatusMessage('✅ Report created successfully!');
      }

      onReportCreated?.(savedReport);
      setTimeout(() => {
        onClose();
        setStatusMessage('');
      }, 2000);
      
    } catch (err) {
      console.error('Error saving report:', err);
      setStatusMessage('❌ Error saving report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const isEditing = !!reportToEdit;
  const availableSubtypes = EMERGENCY_SUBCATEGORIES[form.emergencyCategory] || {};

  return (
    <div className="create-modal-overlay" role="dialog" aria-modal="true">
      <div className="create-modal">
        <div className="create-modal-header">
          <h2>{isEditing ? 'Edit Rescue Report' : 'Create Rescue Report'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div 
            className="create-modal-body"
            style={{
              maxHeight: '70vh',
              overflowY: 'auto',
              scrollBehavior: 'smooth'
            }}
          >
            <div className="form-group">
              <label htmlFor="reporterName">Reporter Name *</label>
              <input 
                id="reporterName"
                type="text" 
                name="reporterName" 
                value={form.reporterName} 
                onChange={handleChange} 
                required 
                disabled={loading}
                placeholder="Enter reporter's full name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="contact">Contact Number *</label>
              <input 
                id="contact"
                type="tel" 
                name="contact" 
                value={form.contact} 
                onChange={handleChange} 
                required 
                disabled={loading}
                placeholder="e.g., 09123456789"
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Location *</label>
              <div className="location-input-container">
                <input
                  id="location"
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  disabled={isEditing || loading}
                  placeholder="e.g., 'Victoria Public Market', 'Canarem Lake', 'Barangay Bulo'"
                  className="location-input"
                />
                <button
                  type="button"
                  className="geocode-button"
                  onClick={handleManualGeocode}
                  disabled={loading || !form.location.trim() || isEditing}
                  title="Calculate coordinates for this location"
                  aria-label="Calculate coordinates"
                >
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-map-marker-alt'}`}></i>
                </button>
              </div>
              
              {calculatedCoords && (
                <div className="coords-display">
                  <span className="coords-success">
                    ✅ <strong>{calculatedCoords.matchedLocation}</strong>
                  </span>
                  <span className="coords-values">
                    ({calculatedCoords.lat.toFixed(4)}, {calculatedCoords.lng.toFixed(4)})
                  </span>
                </div>
              )}
            </div>

            <hr className="form-divider" />
            <h4>Incident Details</h4>

            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="emergencyCategory">Category *</label>
                <select 
                  id="emergencyCategory"
                  name="emergencyCategory" 
                  value={form.emergencyCategory} 
                  onChange={handleChange} 
                  required 
                  disabled={isEditing || isCodeManuallyTyped || loading}
                >
                  <option value="">Select Category...</option>
                  {Object.entries(EMERGENCY_CATEGORIES).map(([code, { label }]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="emergencySubtype">Subtype *</label>
                <select 
                  id="emergencySubtype"
                  name="emergencySubtype" 
                  value={form.emergencySubtype} 
                  onChange={handleChange} 
                  required 
                  disabled={isEditing || isCodeManuallyTyped || !form.emergencyCategory || loading}
                >
                  <option value="">Select Subtype...</option>
                  {Object.entries(availableSubtypes).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="casualtyCode"> Casualty *</label>
                <select 
                  id="casualtyCode"
                  name="casualtyCode" 
                  value={form.casualtyCode} 
                  onChange={handleChange} 
                  required 
                  disabled={isEditing || isCodeManuallyTyped || loading}
                >
                  <option value="">Select Casualty...</option>
                  {Object.entries(CASUALTY_CODES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="severityCode">Severity *</label>
                <select 
                  id="severityCode"
                  name="severityCode" 
                  value={form.severityCode} 
                  onChange={handleChange} 
                  required 
                  disabled={isEditing || isCodeManuallyTyped || loading}
                >
                  <option value="">Select Severity...</option>
                  {Object.entries(SEVERITY_CODES).map(([code, { label }]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="incidentCode"></label>
              <input 
                id="incidentCode"
                type="text" 
                name="incidentCode" 
                value={form.incidentCode} 
                onChange={handleChange} 
                placeholder="e.g., MEIN-0X-@H" 
                required 
                className="incident-code-input"
                disabled={isEditing || (!isCodeManuallyTyped && form.emergencyCategory && form.emergencySubtype && form.casualtyCode && form.severityCode) || loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes (Optional)</label>
              <textarea 
                id="notes"
                name="notes" 
                value={form.notes} 
                onChange={handleChange} 
                rows="3" 
                disabled={isEditing || loading}
                placeholder="Additional details about the emergency..."
              />
            </div>

            <div className="form-group">
              <label htmlFor="respondingTeam">Responding Team *</label>
              <select 
                id="respondingTeam"
                name="respondingTeam" 
                value={form.respondingTeam} 
                onChange={handleChange} 
                required 
                disabled={isEditing || loading}
              >
                <option value="">Select Team</option>
                <option value="all-responders">All Responders</option>
                {Object.entries(teams).flatMap(([teamKey, shifts]) =>
                  Object.entries(shifts).map(([shiftKey]) => (
                    <option key={`${teamKey}-${shiftKey}`} value={`${teamKey}-${shiftKey}`}>
                      {teamKey.toUpperCase()} - {shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}
                    </option>
                  ))
                )}
              </select>
            </div>

            {isEditing && (
              <div className="edit-notice">
                <i className="fas fa-info-circle"></i>
                <small>Location, incident details, and team assignment cannot be changed when editing.</small>
              </div>
            )}
          </div>

          <div className="create-modal-footer">
            <div className="modal-buttons">
              <button 
                type="button" 
                className="create-cancel-btn"
                onClick={onClose} 
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="create-submit-btn"
                disabled={loading || !calculatedCoords}
                title={!calculatedCoords ? "Please calculate coordinates first using the map button" : ""}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {isEditing ? ' Updating...' : ' Creating...'}
                  </>
                ) : (
                  isEditing ? 'Update Report' : 'Create Report'
                )}
              </button>
            </div>
            
            {statusMessage && (
              <div className={`status-message ${
                statusMessage.includes('✅') ? 'success' : 
                statusMessage.includes('❌') ? 'error' : 
                'info'
              }`} role="status" aria-live="polite">
                {statusMessage}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRescueModal;