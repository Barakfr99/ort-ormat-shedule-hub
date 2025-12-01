import { useState, useEffect } from 'react';
import { ParsedScheduleData, parseExcelFile } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';

export function useScheduleData() {
  const [data, setData] = useState<ParsedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Get public URL from Supabase Storage
        const { data: urlData } = supabase.storage
          .from('excel-files')
          .getPublicUrl('students.xlsx');
        
        const storageUrl = urlData?.publicUrl;
        console.log('Loading Excel from Storage:', storageUrl);
        
        if (!storageUrl) {
          throw new Error('Could not get storage URL');
        }
        
        // Add cache-busting parameter to force fresh load
        const urlWithCacheBust = `${storageUrl}?t=${Date.now()}`;
        
        // Load base schedule data from Excel file in Storage
        const excelData = await parseExcelFile(urlWithCacheBust);
        
        console.log('Loaded students:', excelData.students.length);
        console.log('Grades:', excelData.grades);
        console.log('Classes:', excelData.classes);
        
        setData(excelData);
        setError(null);
      } catch (err) {
        console.error('Failed to load schedule data:', err);
        
        // Fallback to local file if Storage fails
        try {
          console.log('Falling back to local file...');
          const excelData = await parseExcelFile('/data/students.xlsx');
          setData(excelData);
          setError(null);
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
          setError('שגיאה בטעינת הנתונים');
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error };
}
