import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCalendar } from '../../hooks/useCalendar';
import { db } from '../../firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area
} from 'recharts';

// Constants
const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  unknown: '#6b7280'
};

const ACTIVITY_ICONS = {
  dispatched: 'ambulance',
  pending: 'clock',
  resolved: 'check-circle',
  critical: 'exclamation-triangle',
  default: 'info-circle'
};

const ACTIVITY_TYPES = {
  resolved: 'success',
  dispatched: 'info',
  critical: 'danger',
  pending: 'warning',
  default: 'default'
};

const RECENT_ACTIVITIES_LIMIT = 10;
const WEEKLY_TREND_DAYS = 7;
const RESPONDERS_PER_TEAM_ESTIMATE = 3;

// Loading skeleton component
const LoadingSkeleton = ({ height = '20px', width = '100%' }) => (
  <div 
    className="loading-skeleton"
    style={{
      height,
      width,
      backgroundColor: '#f3f4f6',
      borderRadius: '4px',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}
  />
);

const DashboardView = () => {
  const { currentWeekStart, currentWeekEnd, changeWeek, renderWeekDays } = useCalendar();
  const [selectedMetric, setSelectedMetric] = useState('incidents');
  
  // Ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  // === States ===
  const [realTimeData, setRealTimeData] = useState({
    activeResponders: 0,
    pendingRequests: 0,
    resolvedToday: 0
  });

  const [events, setEvents] = useState([]);
  const [incidentData, setIncidentData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyTrendData, setWeeklyTrendData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  
  // Firebase data states
  const [users, setUsers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper functions with proper error handling
  const getActivityIcon = useCallback((status, severity) => {
    try {
      if (status === 'dispatched') return ACTIVITY_ICONS.dispatched;
      if (status === 'pending') return ACTIVITY_ICONS.pending;
      if (status === 'resolved') return ACTIVITY_ICONS.resolved;
      if (severity === 'critical') return ACTIVITY_ICONS.critical;
      return ACTIVITY_ICONS.default;
    } catch (err) {
      console.warn('Error getting activity icon:', err);
      return ACTIVITY_ICONS.default;
    }
  }, []);

  const getActivityType = useCallback((status, severity) => {
    try {
      if (status === 'resolved') return ACTIVITY_TYPES.resolved;
      if (status === 'dispatched') return ACTIVITY_TYPES.dispatched;
      if (severity === 'critical') return ACTIVITY_TYPES.critical;
      if (status === 'pending') return ACTIVITY_TYPES.pending;
      return ACTIVITY_TYPES.default;
    } catch (err) {
      console.warn('Error getting activity type:', err);
      return ACTIVITY_TYPES.default;
    }
  }, []);

  const getTimeAgo = useCallback((timestamp) => {
    try {
      if (!timestamp) return 'Unknown time';
      
      const now = new Date();
      const time = new Date(timestamp);
      
      // Validate date
      if (isNaN(time.getTime())) return 'Invalid date';
      
      const diffInMinutes = Math.floor((now - time) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch (err) {
      console.warn('Error calculating time ago:', err);
      return 'Unknown time';
    }
  }, []);

  // Validate incident data structure
  const validateIncident = useCallback((incident) => {
    if (!incident || typeof incident !== 'object') return false;
    
    // Check for required fields
    const hasTimestamp = incident.timestamp || incident.createdAt || incident.reportedAt;
    const hasStatus = typeof incident.status === 'string';
    
    return hasTimestamp && hasStatus;
  }, []);

  // Validate user data structure
  const validateUser = useCallback((user) => {
    if (!user || typeof user !== 'object') return false;
    return typeof user.role === 'string';
  }, []);

  // Fetch data from Firebase collections with error handling
  useEffect(() => {
    let unsubscribeUsers = null;
    let unsubscribeIncidents = null;

    const fetchData = async () => {
      try {
        if (!isMountedRef.current) return;
        
        setLoading(true);
        setError(null);
        
        // Fetch users from mdrrmo-users collection
        const usersSnapshot = await getDocs(collection(db, "mdrrmo-users"));
        const usersData = [];
        usersSnapshot.forEach((doc) => {
          const userData = { id: doc.id, ...doc.data() };
          if (validateUser(userData)) {
            usersData.push(userData);
          }
        });
        
        if (isMountedRef.current) {
          setUsers(usersData);
        }

        // Fetch incidents from incidents collection
        const incidentsSnapshot = await getDocs(collection(db, "incidents"));
        const incidentsData = [];
        incidentsSnapshot.forEach((doc) => {
          const incidentData = { id: doc.id, ...doc.data() };
          if (validateIncident(incidentData)) {
            incidentsData.push(incidentData);
          }
        });
        
        if (isMountedRef.current) {
          setIncidents(incidentsData);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching data from Firebase:", error);
        if (isMountedRef.current) {
          setError('Failed to load dashboard data. Please try again.');
          setLoading(false);
        }
      }
    };

    fetchData();

    // Set up real-time listeners for live updates
    try {
      unsubscribeUsers = onSnapshot(
        collection(db, "mdrrmo-users"), 
        (snapshot) => {
          if (!isMountedRef.current) return;
          
          const usersData = [];
          snapshot.forEach((doc) => {
            const userData = { id: doc.id, ...doc.data() };
            if (validateUser(userData)) {
              usersData.push(userData);
            }
          });
          setUsers(usersData);
        },
        (error) => {
          console.error("Error in users listener:", error);
          if (isMountedRef.current) {
            setError('Connection to user data lost. Some information may be outdated.');
          }
        }
      );

      unsubscribeIncidents = onSnapshot(
        collection(db, "incidents"), 
        (snapshot) => {
          if (!isMountedRef.current) return;
          
          const incidentsData = [];
          snapshot.forEach((doc) => {
            const incidentData = { id: doc.id, ...doc.data() };
            if (validateIncident(incidentData)) {
              incidentsData.push(incidentData);
            }
          });
          setIncidents(incidentsData);
        },
        (error) => {
          console.error("Error in incidents listener:", error);
          if (isMountedRef.current) {
            setError('Connection to incident data lost. Some information may be outdated.');
          }
        }
      );
    } catch (error) {
      console.error("Error setting up listeners:", error);
      if (isMountedRef.current) {
        setError('Failed to establish real-time connection.');
      }
    }

    // Cleanup listeners on component unmount
    return () => {
      isMountedRef.current = false;
      if (unsubscribeUsers) {
        try {
          unsubscribeUsers();
        } catch (err) {
          console.warn('Error unsubscribing from users:', err);
        }
      }
      if (unsubscribeIncidents) {
        try {
          unsubscribeIncidents();
        } catch (err) {
          console.warn('Error unsubscribing from incidents:', err);
        }
      }
    };
  }, [validateIncident, validateUser]);

  // Process Firebase data with memoization and error handling
  const processedData = useMemo(() => {
    try {
      if (!incidents || incidents.length === 0 || loading) {
        return {
          realTimeStats: { activeResponders: 0, pendingRequests: 0, resolvedToday: 0 },
          activities: [],
          incidentChartData: [],
          monthlyStats: [],
          weeklyStats: []
        };
      }

      // Calculate real-time stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayIncidents = incidents.filter(incident => {
        try {
          const incidentDate = new Date(incident.timestamp || incident.createdAt || incident.reportedAt);
          if (isNaN(incidentDate.getTime())) return false;
          incidentDate.setHours(0, 0, 0, 0);
          return incidentDate.getTime() === today.getTime();
        } catch (err) {
          console.warn('Error filtering today incidents:', err);
          return false;
        }
      });

      // Count pending requests
      const pendingCount = incidents.filter(incident => 
        ['pending', 'dispatched', 'responding'].includes(incident.status)
      ).length;

      // Count active responders
      const activeIncidents = incidents.filter(incident => 
        ['dispatched', 'responding'].includes(incident.status)
      );

      const activeTeams = new Set(
        activeIncidents
          .map(incident => incident.respondingTeam || incident.assignedTeam)
          .filter(team => team && team !== 'N/A' && team !== '')
      );

      let activeRespondersCount = 0;
      if (users && users.length > 0) {
        activeRespondersCount = users.filter(user => 
          user.role === 'responder' && 
          ['active', 'responding'].includes(user.status) &&
          (Array.from(activeTeams).some(team => 
            team.toLowerCase().includes(user.team?.toLowerCase() || '') ||
            user.assignedTeam?.toLowerCase() === team.toLowerCase()
          ) || user.currentlyResponding === true)
        ).length;
      } else {
        activeRespondersCount = activeTeams.size * RESPONDERS_PER_TEAM_ESTIMATE;
      }

      const resolvedToday = todayIncidents.filter(incident => incident.status === 'resolved').length;

      const realTimeStats = {
        activeResponders: activeRespondersCount,
        pendingRequests: pendingCount,
        resolvedToday
      };

      // Generate recent activities
      const activities = incidents
        .sort((a, b) => {
          const aTime = new Date(a.timestamp || a.createdAt || a.reportedAt);
          const bTime = new Date(b.timestamp || b.createdAt || b.reportedAt);
          return bTime - aTime;
        })
        .slice(0, RECENT_ACTIVITIES_LIMIT)
        .map(incident => {
          try {
            const statusMessages = {
              pending: 'New emergency report',
              dispatched: 'Team dispatched',
              responding: 'Team responding',
              resolved: 'Emergency resolved'
            };

            return {
              time: getTimeAgo(incident.timestamp || incident.createdAt || incident.reportedAt),
              description: `${statusMessages[incident.status] || 'Status updated'} - ${incident.reporter || incident.reporterName || 'Unknown'}`,
              type: getActivityType(incident.status, incident.emergencySeverity || incident.severity),
              icon: getActivityIcon(incident.status, incident.emergencySeverity || incident.severity),
              reportId: incident.reportId || incident.id,
              severity: incident.emergencySeverity || incident.severity
            };
          } catch (err) {
            console.warn('Error processing activity:', err);
            return null;
          }
        })
        .filter(Boolean);

      // Generate incident data for pie chart
      const severityCounts = incidents.reduce((acc, incident) => {
        try {
          const severity = incident.emergencySeverity || incident.severity || 'unknown';
          acc[severity] = (acc[severity] || 0) + 1;
          return acc;
        } catch (err) {
          console.warn('Error counting severity:', err);
          return acc;
        }
      }, {});

      const incidentChartData = Object.entries(severityCounts).map(([severity, count]) => ({
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: count,
        color: SEVERITY_COLORS[severity] || SEVERITY_COLORS.unknown
      }));

      // Generate monthly data
      const monthlyStats = incidents.reduce((acc, incident) => {
        try {
          const date = new Date(incident.timestamp || incident.createdAt || incident.reportedAt);
          if (isNaN(date.getTime())) return acc;
          
          const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
          
          if (!acc[monthKey]) {
            acc[monthKey] = { month: monthKey, resolved: 0, pending: 0, dispatched: 0, responding: 0 };
          }
          
          const status = incident.status;
          if (['resolved', 'pending', 'dispatched', 'responding'].includes(status)) {
            acc[monthKey][status]++;
          }
          
          return acc;
        } catch (err) {
          console.warn('Error processing monthly data:', err);
          return acc;
        }
      }, {});

      // Generate weekly trend data
      const weeklyStats = Array.from({ length: WEEKLY_TREND_DAYS }, (_, i) => {
        try {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          
          const dayIncidents = incidents.filter(incident => {
            try {
              const incidentDate = new Date(incident.timestamp || incident.createdAt || incident.reportedAt);
              if (isNaN(incidentDate.getTime())) return false;
              return incidentDate.toDateString() === date.toDateString();
            } catch (err) {
              console.warn('Error filtering day incidents:', err);
              return false;
            }
          });

          return {
            day: dayName,
            incidents: dayIncidents.length,
            responses: dayIncidents.filter(incident => incident.status !== 'pending').length
          };
        } catch (err) {
          console.warn('Error generating weekly stats:', err);
          return { day: 'Unknown', incidents: 0, responses: 0 };
        }
      }).reverse();

      return {
        realTimeStats,
        activities,
        incidentChartData,
        monthlyStats: Object.values(monthlyStats),
        weeklyStats
      };
    } catch (error) {
      console.error('Error processing data:', error);
      return {
        realTimeStats: { activeResponders: 0, pendingRequests: 0, resolvedToday: 0 },
        activities: [],
        incidentChartData: [],
        monthlyStats: [],
        weeklyStats: []
      };
    }
  }, [incidents, users, loading, getTimeAgo, getActivityType, getActivityIcon]);

  // Update states when processed data changes
  useEffect(() => {
    if (!loading && processedData) {
      setRealTimeData(processedData.realTimeStats);
      setRecentActivities(processedData.activities);
      setIncidentData(processedData.incidentChartData);
      setMonthlyData(processedData.monthlyStats);
      setWeeklyTrendData(processedData.weeklyStats);
    }
  }, [processedData, loading]);

  // Event handlers with useCallback
  const handleAddEvent = useCallback(() => {
    alert("Add Event clicked!");
  }, []);
  
  const handleAddAnnouncement = useCallback(() => {
    alert("Add Announcement clicked!");
  }, []);

  const handleMetricChange = useCallback((metric) => {
    setSelectedMetric(metric);
  }, []);

  // Stats data with proper error handling
  const statsData = useMemo(() => [
    { 
      icon: 'ambulance', 
      label: 'Active Responders', 
      value: realTimeData.activeResponders?.toString() || '0', 
      trend: '0%', 
      positive: true,
      description: 'Currently responding to emergencies'
    },
    { 
      icon: 'clock', 
      label: 'Pending Requests', 
      value: realTimeData.pendingRequests?.toString() || '0', 
      trend: '0%', 
      positive: (realTimeData.pendingRequests || 0) === 0,
      description: 'Awaiting response or in progress'
    },
    { 
      icon: 'check-circle', 
      label: 'Resolved Today', 
      value: realTimeData.resolvedToday?.toString() || '0', 
      trend: '0%', 
      positive: true,
      description: 'Successfully completed today'
    }
  ], [realTimeData]);

  const CustomTooltip = useCallback(({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip" role="tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, []);

  // Error boundary component
  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state" role="alert">
          <div className="error-icon">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <h3>Dashboard Error</h3>
          <p>{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
            aria-label="Reload dashboard"
          >
            <i className="fas fa-refresh"></i> Reload Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" role="main" aria-label="Emergency Response Dashboard">
      {loading && (
        <div 
          className="loading-overlay" 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            color: 'white',
            fontSize: '18px'
          }}
          role="status"
          aria-live="polite"
          aria-label="Loading dashboard data"
        >
          <div>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }} aria-hidden="true"></i>
            Loading dashboard data...
          </div>
        </div>
      )}

      {/* === TOP STATS === */}
      <section className="stats-grid" aria-label="Key Statistics">
        {statsData.map((stat, i) => (
          <div className="stat-card" key={i} role="article" aria-labelledby={`stat-${i}-label`}>
            <div className="stat-header">
              <div>
                <div className="stat-label" id={`stat-${i}-label`}>
                  <i className={`fas fa-${stat.icon}`} aria-hidden="true"></i> {stat.label}
                </div>
                <div className="stat-value" aria-label={`${stat.label}: ${stat.value}`}>
                  {loading ? <LoadingSkeleton height="32px" width="60px" /> : stat.value}
                </div>
                <div className="stat-description">{stat.description}</div>
                <div className="stat-trend">
                  <i className={`fas fa-arrow-${stat.positive ? 'up' : 'down'} trend-icon ${stat.positive ? 'trend-positive' : 'trend-negative'}`} aria-hidden="true"></i>
                  <span className={stat.positive ? 'trend-positive' : 'trend-negative'}>{stat.trend}</span>
                  <span style={{ color: 'var(--gray)', marginLeft: '0.25rem' }}>this month</span>
                </div>
              </div>
              <div className="stat-icon" aria-hidden="true">
                <i className={`fas fa-${stat.icon}`}></i>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* === MIDDLE GRID === */}
      <div className="middle-grid">
        {/* Recent Activity */}
        <section className="card activity-card" aria-labelledby="recent-activity-title">
          <div className="card-header">
            <div className="card-title" id="recent-activity-title">
              <i className="fas fa-clock" aria-hidden="true"></i>
              Recent Activity
            </div>
          </div>
          <div className="activity-list" role="log" aria-live="polite">
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="activity-item">
                  <LoadingSkeleton height="40px" />
                </div>
              ))
            ) : recentActivities.length === 0 ? (
              <p className="empty-state" role="status">No recent activities</p>
            ) : (
              recentActivities.map((activity, index) => (
                <div key={index} className="activity-item" role="listitem">
                  <div className={`activity-icon ${activity.type}`} aria-hidden="true">
                    <i className={`fas fa-${activity.icon}`}></i>
                  </div>
                  <div className="activity-content">
                    <div className="activity-time">{activity.time}</div>
                    <div className="activity-description">
                      {activity.description}
                      {activity.reportId && (
                        <span className="activity-meta"> (#{activity.reportId})</span>
                      )}
                      {activity.severity === 'critical' && (
                        <span className="critical-badge" role="status" aria-label="Critical incident">CRITICAL</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Insights Charts */}
        <section className="card insights-card" aria-labelledby="insights-title">
          <div className="card-header">
            <div className="card-title" id="insights-title">
              <i className="fas fa-chart-bar" aria-hidden="true"></i>
              Operational Insights
            </div>
            <div className="insights-header" role="tablist">
              <button 
                onClick={() => handleMetricChange('incidents')}
                className={`metric-tab ${selectedMetric === 'incidents' ? 'active' : ''}`}
                role="tab"
                aria-selected={selectedMetric === 'incidents'}
                aria-controls="incidents-panel"
              >
                Incidents
              </button>
              <button 
                onClick={() => handleMetricChange('trends')}
                className={`metric-tab ${selectedMetric === 'trends' ? 'active' : ''}`}
                role="tab"
                aria-selected={selectedMetric === 'trends'}
                aria-controls="trends-panel"
              >
                Trends
              </button>
            </div>
          </div>
          <div className="insights-charts">
            {selectedMetric === 'incidents' ? (
              <div id="incidents-panel" role="tabpanel" aria-labelledby="insights-title">
                <div className="charts-grid">
                  <div className="chart-block">
                    <h4>Incidents by Severity</h4>
                    {loading ? (
                      <LoadingSkeleton height="250px" />
                    ) : incidentData.length === 0 ? (
                      <p className="empty-state" role="status">No data available</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            dataKey="value"
                            data={incidentData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {incidentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="chart-block">
                    <h4>Monthly Reports</h4>
                    {loading ? (
                      <LoadingSkeleton height="250px" />
                    ) : monthlyData.length === 0 ? (
                      <p className="empty-state" role="status">No data available</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlyData}>
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="resolved" fill="var(--success)" name="Resolved" />
                          <Bar dataKey="pending" fill="var(--warning)" name="Pending" />
                          <Bar dataKey="dispatched" fill="var(--info)" name="Dispatched" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div id="trends-panel" role="tabpanel" aria-labelledby="insights-title">
                <div className="chart-block">
                  <h4>Weekly Response Trends</h4>
                  {loading ? (
                    <LoadingSkeleton height="300px" />
                  ) : weeklyTrendData.length === 0 ? (
                    <p className="empty-state" role="status">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={weeklyTrendData}>
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="incidents" 
                          stackId="1" 
                          stroke="#ef4444" 
                          fill="rgba(239, 68, 68, 0.2)" 
                          name="Incidents"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="responses" 
                          stackId="1" 
                          stroke="var(--success)" 
                          fill="rgba(34, 197, 94, 0.2)" 
                          name="Responses"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* === CALENDAR SECTION === */}
      <section aria-label="Calendar and Events">
        <div className="calendar-controls">
          <div className="calendar-range" aria-live="polite">
            <i className="fas fa-calendar-alt" aria-hidden="true"></i> 
            Week of {currentWeekStart.toLocaleDateString()} - {currentWeekEnd.toLocaleDateString()}
          </div>
          <div className="calendar-actions">
            <button 
              onClick={handleAddAnnouncement} 
              className="btn btn-outline"
              aria-label="Add new announcement"
            >
              <i className="fas fa-bullhorn" aria-hidden="true"></i> Announcement
            </button>
            <button 
              onClick={handleAddEvent} 
              className="btn btn-primary"
              aria-label="Add new event"
            >
              <i className="fas fa-plus" aria-hidden="true"></i> Add Event
            </button>
          </div>
        </div>

        <div className="calendar-card">
          <div className="calendar-nav" role="navigation" aria-label="Calendar navigation">
            <button 
              className="calendar-nav-btn" 
              onClick={() => changeWeek(-1)}
              aria-label="Previous week"
            >
              <i className="fas fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button 
              className="today-btn" 
              onClick={() => changeWeek(0)}
              aria-label="Go to current week"
            >
              Today
            </button>
            <button 
              className="calendar-nav-btn" 
              onClick={() => changeWeek(1)}
              aria-label="Next week"
            >
              <i className="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
          <div className="week-grid" role="grid" aria-label="Weekly calendar">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
              <div key={day} className="week-day-header" role="columnheader">{day}</div>
            ))}
            {renderWeekDays()}
          </div>
        </div>
      </section>
    </div>
  );
};

export default DashboardView;