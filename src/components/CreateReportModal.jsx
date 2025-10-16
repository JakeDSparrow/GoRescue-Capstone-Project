import React, { useState, useEffect, useRef } from 'react';
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
  getDoc,
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
} from '../constants/dispatchConstants';
import { useAuth } from '../context/AuthContext';

export { emergencySeverityMap, emergencyTypeMap };

const ROLE_KEYS = ['teamLeader', 'emt1', 'emt2', 'ambulanceDriver'];
// Map severity code (e.g., '@H') to string key used across app ('high')
const severityCodeToKey = (code) => {
  const normalized = String(code || '').toUpperCase();
  const map = { '@C': 'critical', '@H': 'high', '@M': 'moderate', '@L': 'low' };
  return map[normalized] || 'low';
};

// Map category code to legacy type key used in app ('medical' | 'accident' | 'natural')
const categoryCodeToType = (categoryCode) => {
  const c = String(categoryCode || '').toUpperCase();
  const map = { ME: 'medical', AC: 'accident', NA: 'natural' };
  return map[c] || 'medical';
};



// Helper function to safely convert various date formats to JavaScript Date
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  try {
    // If it's a Firestore Timestamp
    if (dateValue && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    // If it's a string or number, try to parse it
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (error) {
    console.warn('Failed to parse date:', dateValue, error);
    return null;
  }
};

// Helper function to check if a responder is within their shift
const isWithinShift = (responder) => {
  if (!responder) return false;

  const now = new Date();
  const shiftStart = parseDate(responder.shiftStart);
  const shiftEnd = parseDate(responder.shiftEnd);

  // If no shift info, assume they're available
  if (!shiftStart || !shiftEnd) {
    return true;
  }

  // Check if current time is within shift
  return now >= shiftStart && now <= shiftEnd;
};

// Helper function to check if responder is active/available
const isResponderAvailable = (responder) => {
  if (!responder) return false;
  
  // Normalize status casing
  const status = (responder.status || '').toLowerCase();
  const validStatuses = ['active'];
  
  return validStatuses.includes(status) && isWithinShift(responder);
};

// Google Maps geocoding function
const geocodeWithGoogleMaps = async (locationText) => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.maps) {
      reject(new Error('Google Maps API not loaded'));
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode(
      { 
        address: locationText,
        region: 'PH', // Bias results to Philippines
        componentRestrictions: {
          country: 'PH',
        },
      },
      (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];
          const location = result.geometry.location;
          
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            precision: 'google-geocoded',
            matchedLocation: result.formatted_address,
            placeId: result.place_id,
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      },
    );
  });
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
  respondingTeams: [], 
  incidentCode: '',
  emergencyCategory: '',
  emergencySubtype: '',
  casualtyCode: '',
  severityCode: '',
};

const CreateRescueModal = ({ isOpen, onClose, onReportCreated, reportToEdit }) => {
  const db = getFirestore();
  const { currentUser } = useAuth(); // Get current user for createdBy field
  const [teams, setTeams] = useState({});
  const [allResponders, setAllResponders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [calculatedCoords, setCalculatedCoords] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isCodeManuallyTyped, setIsCodeManuallyTyped] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 16.2304, lng: 120.4822 }); // Victoria, Tarlac
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [currentUserFullName, setCurrentUserFullName] = useState('');
  
  // Refs for Google Maps components
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const autocompleteRef = useRef(null);
  const searchInputRef = useRef(null);

  // Initialize Google Maps
  useEffect(() => {
    if (!isOpen) return;

    const initializeMap = () => {
      if (!window.google || !window.google.maps) {
        console.error('Google Maps API not loaded');
        return;
      }

      // Initialize map
      if (mapRef.current && !mapInstanceRef.current) {
        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
          center: mapCenter,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        // Add click listener to map
        mapInstanceRef.current.addListener('click', (event) => {
          const lat = event.latLng.lat();
          const lng = event.latLng.lng();
          
          updateMarker(lat, lng);
          reverseGeocode(lat, lng);
        });
      }

      // Initialize Places Autocomplete
      if (searchInputRef.current && !autocompleteRef.current) {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          searchInputRef.current,
          {
            componentRestrictions: { country: 'PH' },
            fields: ['place_id', 'geometry', 'name', 'formatted_address'],
            types: ['establishment', 'geocode'],
          },
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          
          if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            
            setSelectedPlace(place);
            setForm(prev => ({ ...prev, location: place.formatted_address || place.name }));
            setCalculatedCoords({
              lat,
              lng,
              precision: 'google-places',
              matchedLocation: place.formatted_address || place.name,
              placeId: place.place_id,
            });
            
            updateMarker(lat, lng);
            mapInstanceRef.current.panTo({ lat, lng });
            mapInstanceRef.current.setZoom(16);
            
            setStatusMessage('✅ Location selected from search');
          }
        });
      }
    };

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap();
    } else {
      // Wait for Google Maps to load
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initializeMap();
        }
      }, 100);

      return () => clearInterval(checkGoogleMaps);
    }
  }, [isOpen, mapCenter]);

  const updateMarker = (lat, lng) => {
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    markerRef.current = new window.google.maps.Marker({
      position: { lat, lng },
      map: mapInstanceRef.current,
      title: 'Emergency Location',
      animation: window.google.maps.Animation.DROP,
    });

    setCalculatedCoords({
      lat,
      lng,
      precision: 'user-selected',
      matchedLocation: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    });
  };

  const reverseGeocode = async (lat, lng) => {
    if (!window.google || !window.google.maps) return;

    const geocoder = new window.google.maps.Geocoder();
    
    try {
      const results = await new Promise((resolve, reject) => {
        geocoder.geocode(
          { location: { lat, lng } },
          (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
              resolve(results);
            } else {
              reject(new Error(`Reverse geocoding failed: ${status}`));
            }
          },
        );
      });

      const address = results[0].formatted_address;
      setForm(prev => ({ ...prev, location: address }));
      setCalculatedCoords(prev => ({
        ...prev,
        matchedLocation: address,
        placeId: results[0].place_id,
      }));
      setStatusMessage('✅ Address found for selected location');
      
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      setForm(prev => ({ ...prev, location: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
    }
  };

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
          respondingTeams: reportToEdit.respondingTeams || (reportToEdit.respondingTeam ? [reportToEdit.respondingTeam] : []),
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
          respondingTeams: reportToEdit.respondingTeams || (reportToEdit.respondingTeam ? [reportToEdit.respondingTeam] : []),
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
          setMapCenter(coords);
          // Update map and marker when editing
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.panTo(coords);
              mapInstanceRef.current.setZoom(16);
              updateMarker(coords.lat, coords.lng);
            }
          }, 100);
        }
      }
    } else {
      setForm(initialFormState);
      setCalculatedCoords(null);
      setSelectedPlace(null);
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    }
    setStatusMessage('');
    setIsCodeManuallyTyped(false);
  }, [reportToEdit, isOpen]);

  // Fetch current user's fullName
  useEffect(() => {
    const fetchCurrentUserInfo = async () => {
      if (currentUser?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'mdrrmo-users', currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setCurrentUserFullName(userData.fullName || 'Unknown User');
          } else {
            setCurrentUserFullName('Unknown User');
          }
        } catch (error) {
          console.error('Error fetching current user info:', error);
          setCurrentUserFullName('Unknown User');
        }
      }
    };

    if (isOpen && currentUser) {
      fetchCurrentUserInfo();
    }
  }, [db, isOpen, currentUser]);

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
          where('role', '==', 'responder'),
        );
        const respondersSnapshot = await getDocs(respondersQuery);
        setAllResponders(
          respondersSnapshot.docs
            .map(doc => ({ uid: doc.id, ...doc.data() }))
            .filter(isResponderAvailable),
        );
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
    isCodeManuallyTyped,
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

    // Clear coordinates when location changes manually
    if (name === 'location' && !selectedPlace) {
      setCalculatedCoords(null);
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    }
  };

  // Handle team checkbox changes
  const handleTeamChange = (teamId, isChecked) => {
    setForm(prev => {
      if (isChecked) {
        return {
          ...prev,
          respondingTeams: [...prev.respondingTeams, teamId]
        };
      } else {
        return {
          ...prev,
          respondingTeams: prev.respondingTeams.filter(id => id !== teamId)
        };
      }
    });
  };

  // Manual geocoding with Google Maps
  const handleManualGeocode = async () => {
    if (!form.location.trim()) {
      setStatusMessage('⚠️ Please enter a location first');
      return;
    }
    
    setLoading(true);
    setStatusMessage('🔍 Searching location...');
    
    try {
      const coords = await geocodeWithGoogleMaps(form.location.trim());
      if (coords) {
        setCalculatedCoords(coords);
        setMapCenter({ lat: coords.lat, lng: coords.lng });
        setStatusMessage(`✅ Location found: ${coords.matchedLocation}`);
        
        // Update map view and add marker
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat: coords.lat, lng: coords.lng });
          mapInstanceRef.current.setZoom(16);
          updateMarker(coords.lat, coords.lng);
        }
      }
    } catch (error) {
      console.error('Manual geocoding error:', error);
      setCalculatedCoords(null);
      setStatusMessage('❌ Location not found. Try searching with a more specific address.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!form.reporterName || !form.contact || !form.location || form.respondingTeams.length === 0 || !form.incidentCode) {
    setStatusMessage('❌ Please fill in all required fields, select at least one team, and ensure a valid Incident Code is generated.');
    return;
  }

  if (!calculatedCoords) {
    setStatusMessage('❌ Please select a location on the map or search for a location first.');
    return;
  }

  setLoading(true);
  setStatusMessage('💾 Saving report...');

  try {
    // Build a quick lookup for responder profiles
    const responderByUid = Object.fromEntries(allResponders.map(r => [r.uid, r]));

    // Process multiple teams
    const allTeamData = [];
    const allMembers = [];

    for (const teamId of form.respondingTeams) {
      if (teamId === 'all-responders') {
        allTeamData.push({
          teamName: 'All Responders',
          members: allResponders.map(r => ({ uid: r.uid, fullName: r.fullName })),
        });
        allMembers.push(...allResponders.map(r => ({ uid: r.uid, fullName: r.fullName })));
      } else {
        const [teamKey, shiftKey] = teamId.split('-');
        const teamDetails = teams[teamKey] && teams[teamKey][shiftKey];
        if (!teamDetails) {
          setStatusMessage(`❌ Selected team (${teamKey} - ${shiftKey}) is not available.`);
          setLoading(false);
          return;
        }
        const teamMembers = ROLE_KEYS
          .map(role => teamDetails?.[role])
          .filter(member => {
            const profile = member?.uid ? responderByUid[member.uid] : null;
            return profile && isResponderAvailable(profile);
          })
          .map(member => {
            const profile = responderByUid[member.uid];
            return { uid: member.uid, fullName: profile?.fullName || member.fullName || 'Unknown' };
          });

        allTeamData.push({
          teamName: `${teamKey?.toUpperCase()} - ${shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}`,
          members: teamMembers,
        });
        allMembers.push(...teamMembers);
      }
    }

    // Create team acknowledgment tracking structure
    const teamAcknowledgments = {};
    allTeamData.forEach(team => {
      teamAcknowledgments[team.teamName] = {
        acknowledged: false,
        acknowledgedBy: null,
        acknowledgedAt: null,
        members: team.members
      };
    });

    if (allTeamData.length === 0) {
      setStatusMessage('❌ The selected teams have no available responders to notify. Please select different teams.');
      setLoading(false);
      return;
    }

    // New: drive in-app notifications via assignedResponderUids
    const assignedResponderUids = Array.from(new Set(allMembers.map(m => m.uid)));

    // choose primary team (first selected) and its leader uid
    const primaryTeamId = form.respondingTeams[0] || null;
    let teamLeaderUid = null;
    if (primaryTeamId) {
      const [teamKey, shiftKey] = primaryTeamId.split('-');
      const teamDetails = teams[teamKey] && teams[teamKey][shiftKey];
      teamLeaderUid = teamDetails?.teamLeader?.uid || null;
    }

    const incidentData = {
      incidentCode: form.incidentCode,
      emergencyType: categoryCodeToType(form.emergencyCategory),
      emergencySeverity: severityCodeToKey(form.severityCode),
      reporter: form.reporterName,
      contact: form.contact,
      location: {
        lat: calculatedCoords.lat,
        lng: calculatedCoords.lng,
      },
      locationText: form.location,
      locationPrecision: calculatedCoords.precision || 'unknown',
      matchedLocation: calculatedCoords.matchedLocation || form.location,
      placeId: calculatedCoords.placeId || null,
      notes: form.notes || '',
      status: reportToEdit?.status || 'Pending',
      timestamp: serverTimestamp(),
      respondingTeams: form.respondingTeams,     // array of team IDs
      teamData: allTeamData,                     // array of team data
      teamAcknowledgments: teamAcknowledgments,  // per-team ack state
      createdBy: currentUser?.uid || null,
      createdByName: currentUserFullName || 'Unknown User',
      createdAt: new Date().toISOString(),
      assignedResponderUids, 
      assignedTeamId: primaryTeamId,
      teamLeaderUid: teamLeaderUid,
      assignedResponderUids: teamLeaderUid ? [teamLeaderUid] : [],                    // <-- key for mobile in-app notifications
    };

    let savedReport;
    if (reportToEdit?.id) {
      const docRef = doc(db, 'incidents', reportToEdit.id);
      const updateData = {
        ...incidentData,
        updatedAt: new Date().toISOString(),
      };
      delete updateData.timestamp;
      delete updateData.createdAt;

      await updateDoc(docRef, updateData);
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
    }, 3000);
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
              scrollBehavior: 'smooth',
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
                  ref={searchInputRef}
                  id="location"
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  disabled={isEditing || loading}
                  placeholder="Search for places, addresses, or landmarks..."
                  className="location-input"
                />
                <button
                  type="button"
                  className="geocode-button"
                  onClick={handleManualGeocode}
                  disabled={loading || !form.location.trim() || isEditing}
                  title="Search for this location"
                  aria-label="Search location"
                >
                  <i className={`fas ${loading ? 'fa-spinner fa-spin' : 'fa-search'}`}></i>
                </button>
              </div>
              
              {calculatedCoords && (
                <div className="coords-display">
                  <span className="coords-success">
                    ✅ <strong>{calculatedCoords.matchedLocation}</strong>
                  </span>
                  <span className="coords-values">
                    ({calculatedCoords.lat.toFixed(6)}, {calculatedCoords.lng.toFixed(6)})
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
                <label htmlFor="casualtyCode">Casualty *</label>
                <select 
                  id="casualtyCode"
                  name="casualtyCode" 
                  value={form.casualtyCode} 
                  onChange={handleChange} 
                  required 
                  disabled={isEditing || isCodeManuallyTyped || loading}
                >
                  <option value="">Select Casualty...</option>
                  {Object.entries(CASUALTY_CODES)
                    .filter(([code]) => code !== '0X')
                    .map(([code, label]) => (
                      <option key={code} value={code}>{code === '00' ? 'No Injuries/Casualties' : label}</option>
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
              <label>Responding Teams *</label>
              <div className="team-checkboxes">
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={form.respondingTeams.includes('all-responders')}
                      onChange={(e) => handleTeamChange('all-responders', e.target.checked)}
                      disabled={isEditing || loading}
                    />
                    <span className="checkbox-text">All Responders</span>
                  </label>
                </div>
                
                {Object.entries(teams).map(([teamKey, shifts]) =>
                  Object.entries(shifts).map(([shiftKey]) => (
                    <div key={`${teamKey}-${shiftKey}`} className="checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={form.respondingTeams.includes(`${teamKey}-${shiftKey}`)}
                          onChange={(e) => handleTeamChange(`${teamKey}-${shiftKey}`, e.target.checked)}
                          disabled={isEditing || loading}
                        />
                        <span className="checkbox-text">
                          {teamKey.toUpperCase()} - {shiftKey === 'dayShift' ? 'Day Shift' : 'Night Shift'}
                        </span>
                      </label>
                    </div>
                  )),
                )}
              </div>
              {form.respondingTeams.length > 0 && (
                <div className="selected-teams-info">
                  <small>Selected: {form.respondingTeams.length} team(s)</small>
                </div>
              )}
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
                title={!calculatedCoords ? "Please select a location on the map or search for a location first" : ""}
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