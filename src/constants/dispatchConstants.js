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

export const emergencyTypes = {
  medical: {
    icon: 'fa-plus-square',
    color: '#e74c3c',
    label: 'Medical Assistance',
    responseTeam: 'Medical Team',
  },
  natural: {
    icon: 'fa-cloud-showers-heavy',
    color: '#3498db',
    label: 'Natural Disaster',
    responseTeam: 'Rescue Team',
  },
  accident: {
    icon: 'fa-car-crash',
    color: '#f39c12',
    label: 'Road Accident',
    responseTeam: 'Accident Response Team',
  },
};

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

export const statusMap = {
  pending: {
    color: '#f39c12',
    label: 'Pending',
  },
  'in-progress': {
    color: '#3498db',
    label: 'In Progress',
  },
  completed: {
    color: '#2ecc71',
    label: 'Completed',
  },
};
