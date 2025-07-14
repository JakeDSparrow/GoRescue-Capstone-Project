import React, { useState } from 'react';
import { useCalendar } from '../../hooks/useCalendar';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer
} from 'recharts';


const DashboardView = () => {
  const { currentWeekStart, currentWeekEnd, changeWeek, renderWeekDays } = useCalendar();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleAddEvent = () => alert("Add Event clicked!");
  const handleAddAnnouncement = () => alert("Add Announcement clicked!");

  const [events] = useState([
    { id: 1, date: new Date(2023, 6, 3), title: 'Rescue Operation', type: 'operation' },
    { id: 2, date: new Date(2023, 6, 10), title: 'Volunteer Training', type: 'training' },
    { id: 3, date: new Date(2023, 6, 15), title: 'Equipment Maintenance', type: 'maintenance' },
  ]);

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysFromPrevMonth = firstDay;
    const daysFromNextMonth = 42 - (daysInMonth + daysFromPrevMonth);
    const days = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      days.push(<div key={`prev-${i}`} className="calendar-day other-month"><div className="calendar-day-number">{prevMonthDays - i}</div></div>);
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      const isToday = dayDate.toDateString() === today.toDateString();
      const dayEvents = events.filter(event =>
        event.date.getDate() === i &&
        event.date.getMonth() === month &&
        event.date.getFullYear() === year
      );

      days.push(
        <div key={`current-${i}`} className={`calendar-day ${isToday ? 'today' : ''}`}>
          <div className="calendar-day-number">{i}</div>
          <div className="calendar-events">
            {dayEvents.map(event => (
              <div key={event.id} className={`calendar-event ${event.type}`}>{event.title}</div>
            ))}
          </div>
        </div>
      );
    }

    for (let i = 1; i <= daysFromNextMonth; i++) {
      days.push(<div key={`next-${i}`} className="calendar-day other-month"><div className="calendar-day-number">{i}</div></div>);
    }

    return days;
  };

  return (
    <div className="dashboard-container">

      {/* === TOP STATS === */}
      <div className="stats-grid">
        {[
          { icon: 'users', label: 'Total Users', value: '1,248' },
          { icon: 'ambulance', label: 'Active Responders', value: '86' },
          { icon: 'clock', label: 'Pending Requests', value: '24' },
          { icon: 'check-circle', label: 'Resolved Today', value: '18' }
        ].map((stat, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-label">
              <i className={`fas fa-${stat.icon}`}></i> {stat.label}
            </div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* === MIDDLE GRID === */}
      <div className="middle-grid">
        {/* Recent Activity */}
        <div className="card activity-card">
          <div className="card-header">
            <div className="card-title">Recent Activity</div>
          </div>
          <div className="activity-list">
            <div className="activity-item">
              <div className="activity-time">10:30 AM</div>
              <div className="activity-description">New responder registered - John Doe</div>
            </div>
            <div className="activity-item">
              <div className="activity-time">09:15 AM</div>
              <div className="activity-description">Incident resolved - Brgy. Salvacion</div>
            </div>
          </div>
        </div>

        {/* Insights Charts */}
        <div className="card insights-card">
          <div className="card-header">
            <div className="card-title">Operational Insights</div>
          </div>
          <div className="insights-charts">
            <div className="chart-block">
              <h4>Incidents by Type</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={[
                      { name: "Medical", value: 14 },
                      { name: "Fire", value: 6 },
                      { name: "Flood", value: 3 },
                      { name: "Others", value: 1 }
                    ]}
                    outerRadius={70}
                    label
                  >
                    <Cell fill="#8884d8" />
                    <Cell fill="#82ca9d" />
                    <Cell fill="#ffc658" />
                    <Cell fill="#ff7f7f" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-block">
              <h4>Monthly Reports</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={[
                  { month: "Jan", reports: 20 },
                  { month: "Feb", reports: 34 },
                  { month: "Mar", reports: 45 },
                  { month: "Apr", reports: 28 },
                  { month: "May", reports: 39 },
                ]}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="reports" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* === CALENDAR SECTION === */}
      <div className="calendar-controls">
        <div className="calendar-range">
          Week of {currentWeekStart.toLocaleDateString()} - {currentWeekEnd.toLocaleDateString()}
        </div>
        <div className="calendar-actions">
          <button onClick={handleAddAnnouncement} className="btn btn-outline"><i className="fas fa-bullhorn"></i> Announcement</button>
          <button onClick={handleAddEvent} className="btn btn-primary"><i className="fas fa-plus"></i> Add Event</button>
        </div>
      </div>

      <div className="card calendar-card">
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={() => changeWeek(-1)}><i className="fas fa-chevron-left"></i></button>
          <button className="calendar-nav-btn" onClick={() => changeWeek(1)}><i className="fas fa-chevron-right"></i></button>
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
