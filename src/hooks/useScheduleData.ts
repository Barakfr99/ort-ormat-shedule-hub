import { useState, useEffect } from 'react';
import { ParsedScheduleData, parseExcelFile } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type PermanentChangeRow = Tables<'permanent_schedule_changes'>;

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

        let permanentChanges: PermanentChangeRow[] = [];
        try {
          const { data: permanentData, error: permanentError } = await supabase
            .from('permanent_schedule_changes')
            .select('*');
          if (permanentError) {
            console.error('Failed to load permanent schedule changes:', permanentError);
          } else {
            permanentChanges = permanentData ?? [];
          }
        } catch (permanentErr) {
          console.error('Failed to load permanent schedule changes:', permanentErr);
        }

        const mergedData =
          permanentChanges.length > 0
            ? applyPermanentChangesToSchedule(excelData, permanentChanges)
            : excelData;
        
        setData(mergedData);
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

function applyPermanentChangesToSchedule(
  baseData: ParsedScheduleData,
  changes: PermanentChangeRow[]
): ParsedScheduleData {
  if (changes.length === 0) {
    return baseData;
  }

  const changesByStudent = changes.reduce<Map<string, PermanentChangeRow[]>>((map, change) => {
    const existing = map.get(change.student_id) ?? [];
    existing.push(change);
    map.set(change.student_id, existing);
    return map;
  }, new Map());

  const updatedStudents = baseData.students.map((student) => {
    const studentChanges = changesByStudent.get(student.name);
    if (!studentChanges || studentChanges.length === 0) {
      return student;
    }

    const updatedSchedule = { ...student.schedule };

    studentChanges.forEach((change) => {
      const dayKey = change.day_of_week;
      const hourKey = change.hour_number.toString();
      const daySchedule = updatedSchedule[dayKey]
        ? { ...updatedSchedule[dayKey] }
        : {};

      daySchedule[hourKey] = formatPermanentContent(change);
      updatedSchedule[dayKey] = daySchedule;
    });

    return {
      ...student,
      schedule: updatedSchedule,
    };
  });

  return {
    ...baseData,
    students: updatedStudents,
  };
}

function formatPermanentContent(change: PermanentChangeRow) {
  return [change.subject, change.teacher || '', change.room || ''].join(' / ');
}
