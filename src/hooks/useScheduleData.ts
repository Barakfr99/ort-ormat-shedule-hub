import { useState, useEffect } from 'react';
import { parseExcelFile, ParsedScheduleData } from '@/lib/excelParser';

export function useScheduleData() {
  const [data, setData] = useState<ParsedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const parsed = await parseExcelFile('/data/students.xlsx');
        setData(parsed);
        setError(null);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
        setError('שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error };
}