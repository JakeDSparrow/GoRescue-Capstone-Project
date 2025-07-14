import React, { useState } from 'react';

const ArchivesView = () => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedMonth, setSelectedMonth] = useState('All');

  const archiveReports = [
    {
      id: '1',
      title: 'Flood Response - Brgy. 5',
      date: '2024-06-14',
      team: 'Bravo Team',
      fileUrl: '/reports/flood-brgy5.pdf'
    },
    {
      id: '2',
      title: 'Fire Incident - Brgy. 3',
      date: '2024-05-08',
      team: 'Charlie Team',
      fileUrl: '/reports/fire-brgy3.pdf'
    }
  ];

  const filteredReports = archiveReports.filter((report) => {
    const reportDate = new Date(report.date);
    const yearMatch = reportDate.getFullYear().toString() === selectedYear;
    const monthMatch = selectedMonth === 'All' || reportDate.getMonth() === parseInt(selectedMonth);
    return yearMatch && monthMatch;
  });

  return (
    <div className="archives-container">
      <div className="archives-header">
        <h2>Archived Reports</h2>
        <div className="filters">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="All">All Months</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="archives-list">
        {filteredReports.map((report) => (
          <div key={report.id} className="archive-card">
            <h3>{report.title}</h3>
            <p><strong>Date:</strong> {new Date(report.date).toLocaleDateString()}</p>
            <p><strong>Team:</strong> {report.team}</p>
            <div className="actions">
              <a href={report.fileUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <i className="fas fa-file-alt"></i> Read
              </a>
              <a href={report.fileUrl} download className="btn btn-primary">
                <i className="fas fa-download"></i> Download
              </a>
              <button className="btn btn-danger">
                <i className="fas fa-trash-alt"></i> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchivesView;
