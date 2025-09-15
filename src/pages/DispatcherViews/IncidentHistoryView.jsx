import React, { useState, useMemo, useEffect } from 'react';
import { emergencySeverityMap } from '../../constants/dispatchConstants';
import useFormatDate from '../../hooks/useFormatDate';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function IncidentHistoryView() {
  const { formatDateTime } = useFormatDate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch incidents from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "incidents")),
      (snapshot) => {
        const incidentsData = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          incidentsData.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date(),
            acknowledgedAt: data.acknowledgedAt?.toDate() || null,
            completedAt: data.completedAt?.toDate() || null,
            createdAt: data.createdAt ? new Date(data.createdAt) : null,
          });
        });
        setIncidents(incidentsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching incidents:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter logs based on selected criteria
  const filteredLogs = useMemo(() => {
    return incidents.filter((log) => {
      const logDate = new Date(log.timestamp || log.createdAt);
      const yearMatch = logDate.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'All' || logDate.getMonth() === parseInt(selectedMonth);
      const severityMatch = selectedSeverity === 'All' || log.emergencySeverity?.toLowerCase() === selectedSeverity.toLowerCase();
      return yearMatch && monthMatch && severityMatch;
    });
  }, [incidents, selectedYear, selectedMonth, selectedSeverity]);

  // Get completed operations only
  const completedOperations = useMemo(() => {
    return filteredLogs
      .filter(log => {
        const status = log.status?.toLowerCase();
        const hasCompletedAt = log.completedAt;
        return status === 'completed' || status === 'resolved' || hasCompletedAt;
      })
      .sort((a, b) => {
        // Sort by completedAt if available, otherwise by timestamp
        const dateA = a.completedAt || a.timestamp || a.createdAt;
        const dateB = b.completedAt || b.timestamp || b.createdAt;
        return new Date(dateB) - new Date(dateA);
      });
  }, [filteredLogs]);

  // Calculate statistics for charts
  const chartData = useMemo(() => {
    const severityCounts = {};
    const monthlyCounts = {};
    const statusCounts = {};

    filteredLogs.forEach(log => {
      // Severity distribution
      const severity = log.emergencySeverity?.toLowerCase() || 'unknown';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      // Monthly distribution
      const month = new Date(log.timestamp).getMonth();
      const monthName = new Date(0, month).toLocaleString('default', { month: 'short' });
      monthlyCounts[monthName] = (monthlyCounts[monthName] || 0) + 1;

      // Status distribution
      const status = log.status?.toLowerCase() || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return { severityCounts, monthlyCounts, statusCounts };
  }, [filteredLogs]);

  // Get unique severities for filter
  const availableSeverities = useMemo(() => {
    const severities = [...new Set(incidents.map(log => log.emergencySeverity).filter(Boolean))];
    return severities;
  }, [incidents]);

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#ef4444',
      high: '#f97316',
      moderate: '#eab308',
      low: '#22c55e',
      unknown: '#6b7280'
    };
    return colors[severity?.toLowerCase()] || '#6b7280';
  };

  // Prepare data for pie charts
  const severityPieData = Object.entries(chartData.severityCounts).map(([severity, count]) => ({
    name: emergencySeverityMap[severity]?.label || severity.toUpperCase(),
    value: count,
    fill: getSeverityColor(severity)
  }));

  const monthlyBarData = Object.entries(chartData.monthlyCounts)
    .sort(([a], [b]) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.indexOf(a) - months.indexOf(b);
    })
    .map(([month, count]) => ({
      month,
      incidents: count
    }));

  if (loading) {
    return (
      <div className="dispatcher-page">
        <div className="team-missions-dashboard">
          <div className="dashboard-header">
            <div className="header-title">
              <div className="header-icon">
              </div>
              <h1>Incident History & Analytics</h1>
            </div>
            <p className="header-subtitle">
              Comprehensive overview of rescue operations and incident patterns
            </p>
          </div>
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div className="loading-spinner" style={{ 
              width: '3rem', 
              height: '3rem', 
              border: '2px solid #e5e7eb', 
              borderTop: '2px solid #2563eb', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem auto'
            }}></div>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading incident data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatcher-page">
      <div className="team-missions-dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-title">
            <div className="header-icon">
              <i className="fas fa-chart-line"></i>
            </div>
            <h1>Incident History & Analytics</h1>
          </div>
          <p className="header-subtitle">
            Comprehensive overview of rescue operations and incident patterns
          </p>
        </div>

        {/* Filters */}
        <div className="filter-buttons">
          <div className="filter-group">
            <label>Year:</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Month:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="All">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>Severity:</label>
            <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)}>
              <option value="All">All Severities</option>
              {availableSeverities.map(severity => (
                <option key={severity} value={severity}>
                  {emergencySeverityMap[severity?.toLowerCase()]?.label || severity}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="team-stats-grid">
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-icon info">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">{filteredLogs.length}</div>
                <div className="stat-label">Total Incidents</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-icon success">
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">{completedOperations.length}</div>
                <div className="stat-label">Completed Operations</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-icon danger">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {chartData.severityCounts.critical || 0}
                </div>
                <div className="stat-label">Critical Incidents</div>
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-card-content">
              <div className="stat-icon warning">
                <i className="fas fa-clock"></i>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {completedOperations.length > 0 ? 
                    Math.round(completedOperations.reduce((acc, op) => {
                      const start = new Date(op.timestamp);
                      const end = new Date(op.completedAt || op.timestamp);
                      return acc + (end - start) / (1000 * 60); // minutes
                    }, 0) / completedOperations.length) : 0
                  }m
                </div>
                <div className="stat-label">Avg Response Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          {/* Severity Distribution Pie Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3>Incident Severity Distribution</h3>
              <p>Breakdown of incidents by severity level</p>
            </div>
            <div className="chart-content">
              {severityPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">
                  <i className="fas fa-chart-pie"></i>
                  <p>No data available for the selected period</p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Trends Bar Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3>Monthly Incident Trends</h3>
              <p>Incident frequency by month</p>
            </div>
            <div className="chart-content" style={{ height: '350px' }}>
              {monthlyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyBarData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="incidents" fill="#667eea" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">
                  <i className="fas fa-chart-bar"></i>
                  <p>No data available for the selected period</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completed Operations Table */}
        <div className="completed-operations-section">
          <div className="section-header">
            <h2>Completed Operations</h2>
            <p>Summary of completed rescue missions</p>
          </div>
          
          {completedOperations.length === 0 ? (
            <div className="no-teams-message">
              <i className="fas fa-check-circle"></i>
              <h3>No Completed Operations</h3>
              <p>No rescue operations have been completed for the selected period.</p>
            </div>
          ) : (
            <div className="operations-table">
              <div className="table-header">
                <div className="table-cell">Report ID</div>
                <div className="table-cell">Incident Code</div>
                <div className="table-cell">Completion Time</div>
                <div className="table-cell">Location</div>
              </div>
              
              {completedOperations.map((operation) => (
                <div key={operation.id} className="table-row">
                  <div className="table-cell">
                    <span className="report-id">
                      {operation.reportId || operation.id}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span className="incident-code">
                      {operation.incidentCode || 'N/A'}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span className="completion-time">
                      {formatDateTime(operation.completedAt || operation.timestamp)}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span className="location">
                      {operation.locationText || operation.matchedLocation || 
                       (operation.location?.lat && operation.location?.lng ? 
                        `${operation.location.lat.toFixed(4)}, ${operation.location.lng.toFixed(4)}` : 
                        'Location not specified')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}