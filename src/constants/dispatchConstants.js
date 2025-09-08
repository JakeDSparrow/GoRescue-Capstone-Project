// This file contains constants for various locations, including barangay data for both
// Victoria and Mangaldan, and a list of landmarks in Victoria.

// Victoria, Tarlac Barangays
export const victoriaBarangayData = [
    { "barangay": "Baculong", "latitude": 15.5443, "longitude": 120.6409 },
    { "barangay": "Balayang", "latitude": 15.5473, "longitude": 120.6954 },
    { "barangay": "Balbaloto", "latitude": 15.6073, "longitude": 120.6544 },
    { "barangay": "Bangar", "latitude": 15.5965, "longitude": 120.6650 },
    { "barangay": "Bantog", "latitude": 15.6191, "longitude": 120.6837 },
    { "barangay": "Batangbatang", "latitude": 15.5355, "longitude": 120.6890 },
    { "barangay": "Bulo", "latitude": 15.5696, "longitude": 120.6672 },
    { "barangay": "Cabuluan", "latitude": 15.5443, "longitude": 120.6799 },
    { "barangay": "Calibungan", "latitude": 15.5974, "longitude": 120.7241 },
    { "barangay": "Canarem", "latitude": 15.5970, "longitude": 120.7131 },
    { "barangay": "Cruz", "latitude": 15.5601, "longitude": 120.7016 },
    { "barangay": "Lalapac", "latitude": 15.5227, "longitude": 120.6787 },
    { "barangay": "Maluid", "latitude": 15.5615, "longitude": 120.6525 },
    { "barangay": "Mangolago", "latitude": 15.5798, "longitude": 120.7263 },
    { "barangay": "Masalasa", "latitude": 15.6154, "longitude": 120.7426 },
    { "barangay": "Palacpalac", "latitude": 15.5288, "longitude": 120.7065 },
    { "barangay": "San Agustin", "latitude": 15.5978, "longitude": 120.6813 },
    { "barangay": "San Andres", "latitude": 15.5840, "longitude": 120.6580 },
    { "barangay": "San Fernando", "latitude": 15.5740, "longitude": 120.6765 },
    { "barangay": "San Francisco", "latitude": 15.5552, "longitude": 120.6245 },
    { "barangay": "San Gavino", "latitude": 15.5743, "longitude": 120.6833 },
    { "barangay": "San Jacinto", "latitude": 15.5456, "longitude": 120.6666 },
    { "barangay": "San Nicolas", "latitude": 15.5795, "longitude": 120.6816 },
    { "barangay": "San Vicente", "latitude": 15.5882, "longitude": 120.6908 },
    { "barangay": "Santa Barbara", "latitude": 15.5760, "longitude": 120.6899 },
    { "barangay": "Santa Lucia", "latitude": 15.5781, "longitude": 120.6787 }
];

// Victoria, Tarlac Landmarks with coordinates and descriptions
export const victoriaLandmarks = [
  {
    name: "Victoria Public Market",
    latitude: 15.5767,
    longitude: 120.6840,
    description: "A bustling commercial area offering a variety of goods and services to the local community."
  },
  {
    name: "Victoria Public Cemetery",
    latitude: 15.5700,
    longitude: 120.6816,
    description: "A serene resting place for the departed, serving as a historical landmark in the town."
  },
  {
    name: "Victoria Municipal Hall",
    latitude: 15.5771,
    longitude: 120.6815,
    description: "The administrative center of the municipality, housing various local government offices."
  },
  {
    name: "Victoria Police Station",
    latitude: 15.5767,
    longitude: 120.68193,
    barangay: "San Gavino",
    description: "The primary law enforcement facility serving the municipality of Victoria, Tarlac."
  },
  {
    name: "Victoria Fire Station",
    latitude: 15.576683799723313,
    longitude: 120.67972663920636,
    barangay: "San Gavino",
    description: "The fire protection facility providing emergency response and fire safety services for Victoria, Tarlac."
  },
  {
    name: "Jose V. Yap Covered Court",
    latitude: 15.57722663984952,
    longitude: 120.68159504207355,
    description: "A multipurpose covered court named after former House Speaker Jose V. Yap, serving as a venue for various community events and sports activities."
  },
  {
    name: "Victoria Public Auditorium",
    latitude: 15.575990545915552,
    longitude: 120.68021394676198,
    description: "A public auditorium used for community events and gatherings."
  },
  {
    name: "Victoria Mini Forest",
    latitude: 15.575778618963989,
    longitude: 120.68008118418393,
    description: "A small urban forest providing green space for relaxation and recreation."
  },
  {
    name: "Victoria Town Park",
    latitude: 15.577012321346938,
    longitude: 120.68155528073162,
    description: "A public park offering open spaces for leisure and community activities."
  },
  {
    name: "Victoria Municipal Environment and Natural Resources Office (MENRO)",
    latitude: 15.576772481398102,
    longitude: 120.67986876405907,
    description: "The local government office responsible for environmental and natural resource management in Victoria, Tarlac."
  }
];

// Team configurations 
export const initialTeams = {
  alpha: {
    label: 'Team Alpha',
    members: {
      teamLeader: null,
      emt1: null,
      emt2: null,
      ambulanceDriver: null,
    },
  },
  bravo: {
    label: 'Team Bravo',
    members: {
      teamLeader: null,
      emt1: null,
      emt2: null,
      ambulanceDriver: null,
    },
  },
};

// Emergency type mappings (ONLY medical, accident, natural)
export const emergencyTypeMap = {
  medical: {
    icon: 'fa-plus-square',
    color: '#e74c3c',
    label: 'Medical Emergency',
  },
  accident: {
    icon: 'fa-car-crash',
    color: '#f39c12',
    label: 'Road Accident',
  },
  natural: {
    icon: 'fa-water',
    color: '#2980b9',
    label: 'Natural Disaster',
  },
};

// Severity mappings
export const emergencySeverityMap = {
  critical: {
    icon: 'fas fa-exclamation-triangle',
    color: '#e74c3c',
    label: 'Critical',
  },
  high: {
    icon: 'fas fa-exclamation-circle',
    color: '#e67e22',
    label: 'High',
  },
  moderate: {
    icon: 'fas fa-info-circle',
    color: '#f1c40f',
    label: 'Moderate',
  },
  low: {
    icon: 'fas fa-check-circle',
    color: '#2ecc71',
    label: 'Low',
  },
};

// Report status
export const statusMap = {
  pending: {
    color: '#f39c12',
    label: 'Pending',
  },
  acknowledged: {
    color: '#606cac',
    label: 'Acknowledged'
  },
  'in-progress': {
    color: '#3498db',
    label: 'In Progress',
  },
  responding: {
    color: '#9b59b6',
    label: 'Responding',
  },
  completed: {
    color: '#2ecc71',
    label: 'Completed',
  },
  resolved: {
    color: '#27ae60',
    label: 'Resolved',
  },
};

// === EMERGENCY CODE SYSTEM (manual input) ===

// Categories (reduced to Medical, Accident, Natural)
export const EMERGENCY_CATEGORIES = {
  'NA': { label: 'Natural Disasters', color: '#2980b9', icon: 'fa-water' },
  'AC': { label: 'Accidents', color: '#f39c12', icon: 'fa-car-crash' },
  'ME': { label: 'Medical', color: '#e74c3c', icon: 'fa-plus-square' },
};

// Subcategories for each category
export const EMERGENCY_SUBCATEGORIES = {
  'NA': {
    'EQ': 'Earthquake',
    'FL': 'Flood',
    'LS': 'Landslide',
    'TY': 'Typhoon',
    'ST': 'Storm',
    'DR': 'Drought',
    'VE': 'Volcanic Eruption'
  },
  'AC': {
    'VC': 'Vehicle Crash',
    'FA': 'Fall Accident',
    'WA': 'Work Accident',
    'TR': 'Traffic Accident',
    'CO': 'Collision',
    'OT': 'Other Accident'
  },
  'ME': {
    'CA': 'Cardiac Arrest',
    'BR': 'Breathing Problem',
    'IN': 'Injury',
    'SE': 'Seizure',
    'UN': 'Unconscious',
    'PO': 'Poisoning',
    'AL': 'Allergic Reaction',
    'BI': 'Bite/Sting'
  },
};

// Casualty codes
export const CASUALTY_CODES = {
  '00': 'No Casualties',
  '01': 'Minor Injuries',
  '0X': 'Multiple Casualties',
  'XX': 'Mass Casualties',
  'FA': 'Fatality'
};

// Severity codes
export const SEVERITY_CODES = {
  '@L': { label: 'Low', color: '#2ecc71', priority: 1, icon: 'fas fa-check-circle' },
  '@M': { label: 'Moderate', color: '#f1c40f', priority: 2, icon: 'fas fa-info-circle' },
  '@H': { label: 'High', color: '#e67e22', priority: 3, icon: 'fas fa-exclamation-circle' },
  '@C': { label: 'Critical', color: '#e74c3c', priority: 4, icon: 'fas fa-exclamation-triangle' }
};

// === CODE UTILITIES ===

// Parse emergency code back to components
export const parseEmergencyCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  
  const parts = code.split('-');
  if (parts.length !== 3) return null;
  
  const categorySubtype = parts[0];
  const casualty = parts[1];
  const severity = parts[2];
  
  if (categorySubtype.length !== 4) return null;
  
  const category = categorySubtype.substring(0, 2);
  const subtype = categorySubtype.substring(2, 4);
  
  return {
    category,
    subtype,
    casualty,
    severity,
    categoryInfo: EMERGENCY_CATEGORIES[category],
    subtypeInfo: EMERGENCY_SUBCATEGORIES[category]?.[subtype],
    casualtyInfo: CASUALTY_CODES[casualty],
    severityInfo: SEVERITY_CODES[severity]
  };
};

// Convert legacy emergency type to new system
export const convertLegacyToNewType = (legacyType) => {
  const mapping = {
    'medical': { category: 'ME', subtype: 'IN' },
    'accident': { category: 'AC', subtype: 'VC' },
    'natural': { category: 'NA', subtype: 'FL' },
  };
  return mapping[legacyType] || { category: 'ME', subtype: 'IN' };
};

// Convert legacy severity to new system
export const convertLegacySeverity = (legacySeverity) => {
  const mapping = {
    'critical': '@C',
    'high': '@H',
    'moderate': '@M',
    'low': '@L'
  };
  return mapping[legacySeverity] || '@L';
};
