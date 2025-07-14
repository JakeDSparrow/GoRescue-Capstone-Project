import { useState } from 'react';

export function useCalendar() {
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));

  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Make Monday first
    return new Date(d.setDate(diff));
  }

  function isSameDay(date1, date2) {
    return (
      date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
    );
  }

  function changeWeek(offset) {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + offset * 7);
    setCurrentWeekStart(getStartOfWeek(newStart));
  }

  function renderWeekDays() {
    const days = [];
    const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(currentWeekStart.getDate() + i);

      const isToday = isSameDay(dayDate, new Date());
      const dayName = weekdayNames[dayDate.getDay()];
      const dayNum = dayDate.getDate();

      days.push(
        <div key={dayName} className={`calendar-day ${isToday ? 'today' : ''}`}>
          <div className="calendar-day-name">{dayName}</div>
          <div className="calendar-day-number">{dayNum}</div>
        </div>
      );
    }

    return days;
  }


  return {
    currentWeekStart,
    currentWeekEnd,
    changeWeek,
    renderWeekDays,
  };
}
