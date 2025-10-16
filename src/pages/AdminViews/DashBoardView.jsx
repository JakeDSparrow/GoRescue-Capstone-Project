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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    d.setDate(1); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,7); // YYYY-MM
  });

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

    const statusOf = (i) => String(i.status || '').toLowerCase();

    const todayIncidents = incidents.filter(incident => {
      const d = toDate(incident.timestamp || incident.createdAt || incident.reportedAt);
      if (!d) return false;
      return startOfDay(d).getTime() === today.getTime();
    });

    const pendingCount = incidents.filter(incident => {
      const s = statusOf(incident);
      return s === 'pending' || s === 'dispatched' || s === 'responding';
    }).length;

    const activeIncidents = incidents.filter(incident => {
      const s = statusOf(incident);
      return s === 'dispatched' || s === 'responding';
    });

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

    const resolvedToday = todayIncidents.filter(i => statusOf(i) === 'resolved').length;
    // Month filter window
    const [y, m] = selectedMonth.split('-').map(n => parseInt(n, 10));
    const monthStartSel = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const monthEndSel = new Date(y, m, 1, 0, 0, 0, 0);

    const inSelectedMonth = (i) => {
      const d = toDate(i.timestamp || i.createdAt || i.reportedAt);
      if (!d) return false;
      return d >= monthStartSel && d < monthEndSel;
    };

    const incidentsInMonth = incidents.filter(inSelectedMonth);
    const criticalInMonth = incidentsInMonth.filter(i => String(i.emergencySeverity || i.severity || '').toLowerCase() === 'critical').length;
    const resolvedInMonth = incidentsInMonth.filter(i => statusOf(i) === 'resolved').length;

    setRealTimeData({
      activeResponders: activeRespondersCount,
      criticalIncidents: criticalInMonth,
      resolvedThisMonth: resolvedInMonth
    });

    // Recent activities
    const dateOf = (i) => toDate(i.timestamp || i.createdAt || i.reportedAt)?.getTime() ?? 0;
    const activities = [...incidents]
      .sort((a, b) => dateOf(b) - dateOf(a))
      .slice(0, 10)
      .map(incident => ({
        time: getTimeAgo(incident.timestamp || incident.createdAt || incident.reportedAt),
        description: `${statusOf(incident) === 'pending' ? 'New emergency report' :
          statusOf(incident) === 'dispatched' ? 'Team dispatched' :
          statusOf(incident) === 'responding' ? 'Team responding' :
          statusOf(incident) === 'resolved' ? 'Emergency resolved' : 'Status updated'} - ${incident.reporter || incident.reporterName || 'Unknown'}`,
        type: getActivityType(statusOf(incident), incident.emergencySeverity || incident.severity),
        icon: getActivityIcon(statusOf(incident), incident.emergencySeverity || incident.severity),
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
      moderate: '#eab308',
      low: '#22c55e',
      unknown: '#6b7280'
    };
    const incidentChartData = Object.entries(severityCounts).map(([severity, count]) => ({
      name: severity.charAt(0).toUpperCase() + severity.slice(1),
      value: count,
      color: severityColors[severity] || '#6b7280'
    }));
    setIncidentData(incidentChartData);

    // Incidents by Type (e.g., medical, accident, natural)
    const typeCounts = incidents.reduce((acc, incident) => {
      const t = String(incident.emergencyType || incident.type || 'unknown').toLowerCase();
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const typeColors = {
      medical: '#2563eb',
      accident: '#10b981',
      natural: '#a855f7',
      unknown: '#6b7280'
    };
    const incidentTypeData = Object.entries(typeCounts).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
      color: typeColors[type] || '#6b7280'
    }));
    // Store alongside severity data
    // Reuse monthlyData state? Keep separate using local variable for rendering
    // We'll pass through closure below
    setMonthlyData(prev => prev); // no-op to keep dependencies
    
    // Attach to ref via closure by replacing setIncidentData usage in render
    // We'll augment render to compute from local scope
    
    // Weekly trend (last 7 days)

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

    // Monthly trend (last 12 months)
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      // Go back i months from current month
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - (11 - i));
      const monthStart = new Date(d);
      const monthEnd = new Date(d);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      const monthIncidents = incidents.filter(incident => {
        const idate = toDate(incident.timestamp || incident.createdAt || incident.reportedAt);
        if (!idate) return false;
        return idate >= monthStart && idate < monthEnd;
      });

      return {
        month: label,
        incidents: monthIncidents.length,
        responses: monthIncidents.filter(incident => statusOf(incident) !== 'pending').length
      };
    });
    setWeeklyTrendData(monthlyTrend);

    // Expose type data for render via state setter pattern
    setIncidentData(prev => prev); // no-op
    // Stash computed type data on an instance variable (closure). We'll render inline to avoid new state.
    DashboardView._lastIncidentTypeData = incidentTypeData;
  }, [incidents, users, loading, getActivityIcon, getActivityType, getTimeAgo, startOfDay, toDate]);

  const statsData = useMemo(() => ([
    {
      icon: 'ambulance',
      label: 'Active Responders',
      value: String(realTimeData.activeResponders || 0),
      trend: '—',
      positive: true,
      description: 'Currently responding to emergencies'
    },
    {
      icon: 'exclamation-triangle',
      label: 'Critical Incidents',
      value: String(realTimeData.criticalIncidents || 0),
      trend: '—',
      positive: false,
      description: 'In the selected month'
    },
    {
      icon: 'check-circle',
      label: 'Resolved This Month',
      value: String(realTimeData.resolvedThisMonth || 0),
      trend: '—',
      positive: true,
      description: 'Completed in the selected month'
    }
  ]), [realTimeData]);

  // Build a simple month calendar grid for the selected month with incident counts
  const monthCalendar = useMemo(() => {
    try {
      if (!selectedMonth) return { weeks: [] };
      const [y, m] = selectedMonth.split('-').map(n => parseInt(n, 10));
      const firstOfMonth = new Date(y, m - 1, 1);
      const daysInMonth = new Date(y, m, 0).getDate();
      const startWeekday = firstOfMonth.getDay(); // 0=Sun

      const counts = new Map();
      const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const monthEnd = new Date(y, m, 1, 0, 0, 0, 0);
      incidents.forEach(i => {
        const d = toDate(i.timestamp || i.createdAt || i.reportedAt);
        if (!d || d < monthStart || d >= monthEnd) return;
        const key = d.getDate();
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      const cells = [];
      // leading blanks
      for (let i = 0; i < startWeekday; i++) cells.push({ type: 'blank' });
      // days
      for (let day = 1; day <= daysInMonth; day++) {
        cells.push({ type: 'day', day, count: counts.get(day) || 0 });
      }
      // pad to full weeks
      while (cells.length % 7 !== 0) cells.push({ type: 'blank' });

      const weeks = [];
      for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
      }
      return { weeks };
    } catch {
      return { weeks: [] };
    }
  }, [incidents, selectedMonth, toDate]);

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

      {/* === TOP STATS + MONTH PICKER === */}
      <div className="stats-grid" style={{ alignItems: 'stretch' }}>
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
        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>
              <i className="fas fa-calendar-alt"></i> Select Month
            </div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
              aria-label="Select month for insights"
            />
          </div>
        </div>
      </div>

      {/* === MINI CALENDAR (Selected Month) === */}
      <div className="stats-grid" style={{ marginTop: 16 }}>
        <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
          <div className="stat-header" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">
                <i className="fas fa-calendar-alt"></i> {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <div className="stat-description">Daily incident counts</div>
            </div>
          </div>
          <div style={{ padding: '12px 4px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: '0 8px', marginBottom: 6, color: 'var(--gray)', fontWeight: 600, fontSize: '0.85rem' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (<div key={d} style={{ textAlign: 'center' }}>{d}</div>))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, padding: '0 8px' }}>
              {monthCalendar.weeks.flat().map((cell, idx) => (
                <div key={idx} style={{
                  minHeight: 56,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: cell.type === 'day' ? '#fff' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: cell.type === 'day' ? '#111827' : 'transparent'
                }}>
                  {cell.type === 'day' && (
                    <>
                      <div style={{ fontWeight: 600 }}>{cell.day}</div>
                      {cell.count > 0 && (
                        <div style={{
                          marginTop: 4,
                          fontSize: '0.75rem',
                          background: '#2563eb',
                          color: 'white',
                          padding: '2px 6px',
                          borderRadius: 999
                        }}>{cell.count}</div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
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

                <div className="chart-block">
                  <h4>Incidents by Type</h4>
                  {(!DashboardView._lastIncidentTypeData || DashboardView._lastIncidentTypeData.length === 0) ? (
                    <p className="empty-state">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          dataKey="value"
                          data={DashboardView._lastIncidentTypeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${Number.isFinite(percent) ? (percent * 100).toFixed(0) : 0}%`}
                        >
                          {DashboardView._lastIncidentTypeData.map((entry, index) => (
                            <Cell key={`type-cell-${index}`} fill={entry.color} />
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
                <h4>Monthly Response Trends</h4>
                {weeklyTrendData.length === 0 ? (
                  <p className="empty-state">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={weeklyTrendData}>
                      <XAxis dataKey="month" />
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

      {/* Calendar section removed to align with monthly trends */}
    </div>
  );
};

export default DashboardView;