import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useCalendar } from '../../hooks/useCalendar';
import { db } from '../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, AreaChart, Area
} from 'recharts';


const DashboardView = () => {
  const { currentWeekStart, currentWeekEnd, changeWeek, renderWeekDays } = useCalendar();

  const handleAddEvent = () => alert("Add Event clicked!");
  const handleAddAnnouncement = () => alert("Add Announcement clicked!");

  // Selection for insights
  const [selectedMetric, setSelectedMetric] = useState('incidents');

  // Firebase-backed state
  const [users, setUsers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derived UI state
  const [realTimeData, setRealTimeData] = useState({
    activeResponders: 0,
    pendingRequests: 0,
    resolvedToday: 0
  });
  const [incidentData, setIncidentData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [weeklyTrendData, setWeeklyTrendData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  // Monthly inputs
  const [monthlyYearFilter, setMonthlyYearFilter] = useState('all');
  const [monthlyStatusFilter, setMonthlyStatusFilter] = useState('all'); // all|resolved|pending|dispatched|responding

  // Helpers
  const toDate = useCallback((value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate();
    return new Date(value);
  }, []);

  const startOfDay = useCallback((date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const getActivityIcon = useCallback((status, severity) => {
    if (status === 'dispatched') return 'ambulance';
    if (status === 'pending') return 'clock';
    if (status === 'resolved') return 'check-circle';
    if (severity === 'critical') return 'exclamation-triangle';
    return 'info-circle';
  }, []);

  const getActivityType = useCallback((status, severity) => {
    if (status === 'resolved') return 'success';
    if (status === 'dispatched') return 'info';
    if (severity === 'critical') return 'danger';
    if (status === 'pending') return 'warning';
    return 'default';
  }, []);

  const getTimeAgo = useCallback((timestamp) => {
    const now = new Date();
    const time = toDate(timestamp);
    if (!time) return '';
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }, [toDate]);

  // Realtime listeners only
  useEffect(() => {
    let gotUsers = false;
    let gotIncidents = false;
    setLoading(true);

    const unsubUsers = onSnapshot(collection(db, 'mdrrmo-users'), (snapshot) => {
      setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      gotUsers = true;
      if (gotUsers && gotIncidents) setLoading(false);
    }, () => {
      gotUsers = true;
      if (gotUsers && gotIncidents) setLoading(false);
    });

    const unsubIncidents = onSnapshot(collection(db, 'incidents'), (snapshot) => {
      setIncidents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      gotIncidents = true;
      if (gotUsers && gotIncidents) setLoading(false);
    }, () => {
      gotIncidents = true;
      if (gotUsers && gotIncidents) setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubIncidents();
    };
  }, []);

  // Derive dashboard data from incidents/users
  useEffect(() => {
    if (loading) return;

    const today = startOfDay(new Date());

    const todayIncidents = incidents.filter(incident => {
      const d = toDate(incident.timestamp || incident.createdAt || incident.reportedAt);
      if (!d) return false;
      return startOfDay(d).getTime() === today.getTime();
    });

    const pendingCount = incidents.filter(incident =>
      incident.status === 'pending' ||
      incident.status === 'dispatched' ||
      incident.status === 'responding'
    ).length;

    const activeIncidents = incidents.filter(incident =>
      incident.status === 'dispatched' || incident.status === 'responding'
    );

    const activeTeams = new Set(
      activeIncidents
        .map(i => i.respondingTeam || i.assignedTeam)
        .filter(team => typeof team === 'string' && team.trim() !== '' && team !== 'N/A')
    );

    let activeRespondersCount = 0;
    if (Array.isArray(users) && users.length > 0) {
      activeRespondersCount = users.filter(user => {
        const userTeam = user.team?.toLowerCase();
        const userAssigned = user.assignedTeam?.toLowerCase();
        const isResponderActive = user.role === 'responder' && (user.status === 'active' || user.status === 'responding' || user.currentlyResponding === true);
        if (!isResponderActive || (!userTeam && !userAssigned)) return false;
        return Array.from(activeTeams).some(team => {
          const t = String(team).toLowerCase();
          return (userTeam && t.includes(userTeam)) || (userAssigned && userAssigned === t);
        });
      }).length;
    } else {
      activeRespondersCount = activeTeams.size * 3;
    }

    const resolvedToday = todayIncidents.filter(i => i.status === 'resolved').length;
    setRealTimeData({
      activeResponders: activeRespondersCount,
      pendingRequests: pendingCount,
      resolvedToday
    });

    // Recent activities
    const dateOf = (i) => toDate(i.timestamp || i.createdAt || i.reportedAt)?.getTime() ?? 0;
    const activities = [...incidents]
      .sort((a, b) => dateOf(b) - dateOf(a))
      .slice(0, 10)
      .map(incident => ({
        time: getTimeAgo(incident.timestamp || incident.createdAt || incident.reportedAt),
        description: `${incident.status === 'pending' ? 'New emergency report' :
          incident.status === 'dispatched' ? 'Team dispatched' :
          incident.status === 'responding' ? 'Team responding' :
          incident.status === 'resolved' ? 'Emergency resolved' : 'Status updated'} - ${incident.reporter || incident.reporterName || 'Unknown'}`,
        type: getActivityType(incident.status, incident.emergencySeverity || incident.severity),
        icon: getActivityIcon(incident.status, incident.emergencySeverity || incident.severity),
        reportId: incident.reportId || incident.id,
        severity: incident.emergencySeverity || incident.severity
      }));
    setRecentActivities(activities);

    // Incident pie by severity
    const severityCounts = incidents.reduce((acc, incident) => {
      const severity = incident.emergencySeverity || incident.severity || 'unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});
    const severityColors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#22c55e',
      unknown: '#6b7280'
    };
    const incidentChartData = Object.entries(severityCounts).map(([severity, count]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: count,
      color: severityColors[severity] || '#6b7280'
    }));
    setIncidentData(incidentChartData);

    // Monthly grouped with year (unfiltered base)
    const monthlyStatsMap = incidents.reduce((acc, i) => {
      const d = toDate(i.timestamp || i.createdAt || i.reportedAt);
      if (!d) return acc;
      const key = `${d.getFullYear()}-${d.toLocaleString('en-US', { month: 'short' })}`;
      if (!acc[key]) acc[key] = { month: key, resolved: 0, pending: 0, dispatched: 0, responding: 0 };
      if (i.status === 'resolved') acc[key].resolved++;
      else if (i.status === 'pending') acc[key].pending++;
      else if (i.status === 'dispatched') acc[key].dispatched++;
      else if (i.status === 'responding') acc[key].responding++;
      return acc;
    }, {});
    setMonthlyData(Object.values(monthlyStatsMap));

    // Weekly trend (last 7 days)
    const weeklyStats = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d).getTime();
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayIncidents = incidents.filter(incident => {
        const idate = toDate(incident.timestamp || incident.createdAt || incident.reportedAt);
        if (!idate) return false;
        return startOfDay(idate).getTime() === dayStart;
      });
      return {
        day: dayName,
        incidents: dayIncidents.length,
        responses: dayIncidents.filter(incident => incident.status !== 'pending').length
      };
    }).reverse();
    setWeeklyTrendData(weeklyStats);
  }, [incidents, users, loading, getActivityIcon, getActivityType, getTimeAgo, startOfDay, toDate]);

  const statsData = useMemo(() => ([
    {
      icon: 'ambulance',
      label: 'Active Responders',
      value: String(realTimeData.activeResponders),
      trend: '0%',
      positive: true,
      description: 'Currently responding to emergencies'
    },
    {
      icon: 'clock',
      label: 'Pending Requests',
      value: String(realTimeData.pendingRequests),
      trend: '0%',
      positive: realTimeData.pendingRequests === 0,
      description: 'Awaiting response or in progress'
    },
    {
      icon: 'check-circle',
      label: 'Resolved Today',
      value: String(realTimeData.resolvedToday),
      trend: '0%',
      positive: true,
      description: 'Successfully completed today'
    }
  ]), [realTimeData]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry?.payload?.color || entry?.fill }}>
              {`${entry.dataKey}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard-container">
      {loading && (
        <div className="loading-overlay" role="status" aria-live="polite" style={{
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
        }}>
          <div>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: '10px' }}></i>
            Loading dashboard data...
          </div>
        </div>
      )}

      {/* === TOP STATS === */}
      <div className="stats-grid">
        {statsData.map((stat) => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-header">
              <div>
                <div className="stat-label">
                  <i className={`fas fa-${stat.icon}`}></i> {stat.label}
                </div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-description">{stat.description}</div>
                <div className="stat-trend">
                  <i className={`fas fa-arrow-${stat.positive ? 'up' : 'down'} trend-icon ${stat.positive ? 'trend-positive' : 'trend-negative'}`}></i>
                  <span className={stat.positive ? 'trend-positive' : 'trend-negative'}>{stat.trend}</span>
                  <span style={{ color: 'var(--gray)', marginLeft: '0.25rem' }}>this month</span>
                </div>
              </div>
              <div className="stat-icon">
                <i className={`fas fa-${stat.icon}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* === MIDDLE GRID === */}
      <div className="middle-grid">
        {/* Recent Activity */}
        <div className="card activity-card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-clock"></i>
              Recent Activity
            </div>
          </div>
          <div className="activity-list">
            {recentActivities.length === 0 ? (
              <p className="empty-state">No recent activities</p>
            ) : (
              recentActivities.map((activity) => (
                <div key={`${activity.reportId}-${activity.time}`} className="activity-item">
                  <div className={`activity-icon ${activity.type}`}>
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
                        <span className="critical-badge">CRITICAL</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Insights Charts */}
        <div className="card insights-card">
          <div className="card-header">
            <div className="card-title">
              <i className="fas fa-chart-bar"></i>
              Operational Insights
            </div>
            <div className="insights-header">
              <button
                onClick={() => setSelectedMetric('incidents')}
                className={`metric-tab ${selectedMetric === 'incidents' ? 'active' : ''}`}
              >
                Incidents
              </button>
              <button
                onClick={() => setSelectedMetric('trends')}
                className={`metric-tab ${selectedMetric === 'trends' ? 'active' : ''}`}
              >
                Trends
              </button>
            </div>
          </div>
          <div className="insights-charts">
            {selectedMetric === 'incidents' ? (
              <div className="charts-grid">
                <div className="chart-block">
                  <h4>Incidents by Severity</h4>
                  {incidentData.length === 0 ? (
                    <p className="empty-state">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={incidentData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${Number.isFinite(percent) ? (percent * 100).toFixed(0) : 0}%`}
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

                
              </div>
            ) : (
              <div className="chart-block">
                <h4>Weekly Response Trends</h4>
                {weeklyTrendData.length === 0 ? (
                  <p className="empty-state">No data</p>
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
            )}
          </div>
        </div>
      </div>

      {/* === CALENDAR SECTION === */}
      <div className="calendar-controls">
        <div className="calendar-range">
          <i className="fas fa-calendar-alt"></i> Week of {currentWeekStart.toLocaleDateString()} - {currentWeekEnd.toLocaleDateString()}
        </div>
        <div className="calendar-actions"></div>
      </div>

      <div className="calendar-card">
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={() => changeWeek(-1)}>
            <i className="fas fa-chevron-left"></i>
          </button>
          <button className="today-btn" onClick={() => changeWeek(0)}>
            Today
          </button>
          <button className="calendar-nav-btn" onClick={() => changeWeek(1)}>
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>
        <div className="week-grid">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
            <div key={day} className="week-day-header">{day}</div>
          ))}
          {renderWeekDays()}
        </div>
      </div>
    </div>
  );
};

export default DashboardView;