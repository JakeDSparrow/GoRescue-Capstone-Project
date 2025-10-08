import React, { useState, useMemo, useEffect } from 'react';
import { emergencySeverityMap, emergencyTypeMap } from '../../constants/dispatchConstants';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [attachmentTooltip, setAttachmentTooltip] = useState({ show: false, content: '', x: 0, y: 0 });

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

  // Helper function to check if incident has attachments
  const hasAttachments = (incident) => {
    // Check various possible attachment fields
    const attachmentFields = [
      incident.attachments,
      incident.files,
      incident.images,
      incident.documents,
      incident.media
    ];
    
    return attachmentFields.some(field => {
      if (Array.isArray(field)) {
        return field.length > 0;
      }
      if (typeof field === 'object' && field !== null) {
        return Object.keys(field).length > 0;
      }
      return false;
    });
  };

  // Helper function to get attachment count
  const getAttachmentCount = (incident) => {
    let count = 0;
    const attachmentFields = [
      incident.attachments,
      incident.files,
      incident.images,
      incident.documents,
      incident.media
    ];
    
    attachmentFields.forEach(field => {
      if (Array.isArray(field)) {
        count += field.length;
      } else if (typeof field === 'object' && field !== null) {
        count += Object.keys(field).length;
      }
    });
    
    return count;
  };

  // Helper function to get attachment types
  const getAttachmentTypes = (incident) => {
    const types = [];
    if (incident.attachments?.length > 0) types.push('attachments');
    if (incident.files?.length > 0) types.push('files');
    if (incident.images?.length > 0) types.push('images');
    if (incident.documents?.length > 0) types.push('documents');
    if (incident.media?.length > 0) types.push('media');
    return types;
  };

  // Handle attachment icon hover
  const handleAttachmentHover = (event, incident) => {
    const count = getAttachmentCount(incident);
    const types = getAttachmentTypes(incident);
    const rect = event.target.getBoundingClientRect();
    
    setAttachmentTooltip({
      show: true,
      content: `${count} attachment${count !== 1 ? 's' : ''} (${types.join(', ')})`,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
  };

  const handleAttachmentLeave = () => {
    setAttachmentTooltip({ show: false, content: '', x: 0, y: 0 });
  };

  // Normalize a single date source for filtering and charts
  const getPrimaryDate = (log) => {
    // Prefer completedAt, then timestamp, then createdAt
    return log.completedAt || log.timestamp || log.createdAt || null;
  };

  // Filter logs based on selected criteria
  const filteredLogs = useMemo(() => {
    return incidents.filter((log) => {
      const dateValue = getPrimaryDate(log);
      if (!dateValue) return false;
      const logDate = new Date(dateValue);
      if (isNaN(logDate.getTime())) return false;

      const yearMatch = logDate.getFullYear().toString() === selectedYear;
      const monthMatch = selectedMonth === 'All' || logDate.getMonth() === parseInt(selectedMonth, 10);
      const severityMatch = selectedSeverity === 'All' || (log.emergencySeverity || '').toLowerCase() === (selectedSeverity || '').toLowerCase();
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

  // Pagination derived data for completed operations
  const completedTotalPages = Math.max(1, Math.ceil(completedOperations.length / pageSize));
  const completedStartIdx = (page - 1) * pageSize;
  const completedPageItems = completedOperations.slice(completedStartIdx, completedStartIdx + pageSize);

  useEffect(() => { setPage(1); }, [filteredLogs, pageSize]);

  // Calculate statistics for charts
  const chartData = useMemo(() => {
    const severityCounts = {};
    const monthlyCounts = {};
    const statusCounts = {};
    const typeCounts = {};

    filteredLogs.forEach(log => {
      // Severity distribution
      const severity = log.emergencySeverity?.toLowerCase() || 'unknown';
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      // Monthly distribution
      const baseDate = new Date(getPrimaryDate(log));
      if (isNaN(baseDate.getTime())) return;
      const month = baseDate.getMonth();
      const monthName = new Date(0, month).toLocaleString('default', { month: 'short' });
      monthlyCounts[monthName] = (monthlyCounts[monthName] || 0) + 1;

      // Status distribution
      const status = log.status?.toLowerCase() || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      // Emergency type distribution (medical, accident, natural)
      const eType = (log.emergencyType || '').toLowerCase();
      if (eType) {
        typeCounts[eType] = (typeCounts[eType] || 0) + 1;
      } else {
        typeCounts.unknown = (typeCounts.unknown || 0) + 1;
      }
    });

    return { severityCounts, monthlyCounts, statusCounts, typeCounts };
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

  const typePieData = Object.entries(chartData.typeCounts).map(([type, count]) => ({
    name: emergencyTypeMap[type]?.label || (type ? type.toUpperCase() : 'UNKNOWN'),
    value: count,
    fill: emergencyTypeMap[type]?.color || '#6b7280'
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
        {/* Header removed per request */}

        {/* Stats Cards */}

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

        {/* Filters moved under the operations cards and styled to match system */}
        <div 
          className="filter-buttons"
          style={{
            marginTop: '12px',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#374151', fontWeight: 600 }}>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                backgroundColor: '#111827',
                color: '#f9fafb',
                border: '1px solid #374151',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              {Array.from({ length: 5 }, (_, i) => {
                const year = new Date().getFullYear() - i;
                return <option key={year} value={year}>{year}</option>;
              })}
            </select>
          </div>
          
          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#374151', fontWeight: 600 }}>Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                backgroundColor: '#111827',
                color: '#f9fafb',
                border: '1px solid #374151',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <option value="All">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          
          <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ color: '#374151', fontWeight: 600 }}>Severity:</label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              style={{
                backgroundColor: '#111827',
                color: '#f9fafb',
                border: '1px solid #374151',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <option value="All">All Severities</option>
              {availableSeverities.map(severity => (
                <option key={severity} value={severity}>
                  {emergencySeverityMap[severity?.toLowerCase()]?.label || severity}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          {/* Emergency Type Distribution Pie Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <h3>Emergency Type Distribution</h3>
              <p>Breakdown of incidents by type</p>
            </div>
            <div className="chart-content">
              {typePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={typePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typePieData.map((entry, index) => (
                        <Cell key={`type-cell-${index}`} fill={entry.fill} />
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-outline" style={{ padding: '4px 8px' }}>Prev</button>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Page {page} / {completedTotalPages}</span>
            <button onClick={() => setPage((p) => Math.min(completedTotalPages, p + 1))} disabled={page === completedTotalPages} className="btn-outline" style={{ padding: '4px 8px' }}>Next</button>
            <label style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>Rows:</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ padding: '4px 8px' }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
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
                <div className="table-cell">Attachments</div>
              </div>
              
              {completedPageItems.map((operation) => (
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
                  <div className="table-cell">
                    <div className="attachment-indicator">
                      {hasAttachments(operation) ? (
                        <i 
                          className="fas fa-paperclip attachment-icon has-attachments"
                          onMouseEnter={(e) => handleAttachmentHover(e, operation)}
                          onMouseLeave={handleAttachmentLeave}
                          style={{
                            color: '#2563eb',
                            fontSize: '16px',
                            cursor: 'pointer',
                            transition: 'color 0.2s ease'
                          }}
                          title="Has attachments - hover for details"
                        />
                      ) : (
                        <i 
                          className="fas fa-paperclip attachment-icon no-attachments"
                          style={{
                            color: '#d1d5db',
                            fontSize: '16px',
                            cursor: 'default'
                          }}
                          title="No attachments"
                        />
                      )}
                      {hasAttachments(operation) && (
                        <span 
                          className="attachment-count"
                          style={{
                            marginLeft: '4px',
                            fontSize: '12px',
                            color: '#6b7280',
                            fontWeight: '500'
                          }}
                        >
                          ({getAttachmentCount(operation)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attachment Tooltip */}
        {attachmentTooltip.show && (
          <div 
            className="attachment-tooltip"
            style={{
              position: 'fixed',
              left: attachmentTooltip.x,
              top: attachmentTooltip.y,
              transform: 'translateX(-50%) translateY(-100%)',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            {attachmentTooltip.content}
            <div 
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid rgba(0, 0, 0, 0.9)'
              }}
            />
          </div>
        )}
      </div>
      
    </div>
  );
}