import { useCallback } from 'react';

export default function useFormatDate() {
  const toJsDate = useCallback((timestamp) => {
    if (!timestamp) return null;
    if (typeof timestamp === 'object' && timestamp.toDate) {
      return timestamp.toDate(); // Handle Firestore Timestamp
    }
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date; // Check for valid date
  }, []);

  const formatDateTime = useCallback((timestamp) => {
    const date = toJsDate(timestamp);
    if (!date) return 'Invalid Date'; // Return a more informative message if needed
    return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  }, [toJsDate]);

  return { formatDateTime };
}
