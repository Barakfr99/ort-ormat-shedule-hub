import { useState, useEffect } from 'react';
import { ParsedScheduleData, parseExcelFile } from '@/lib/excelParser';

export function useScheduleData() {
  const [data, setData] = useState<ParsedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Load base schedule data from Excel file
        const excelData = await parseExcelFile('/data/students.xlsx');
        
        setData(excelData);
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