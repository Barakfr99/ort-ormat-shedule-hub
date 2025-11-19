import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StudentSchedule, ParsedScheduleData } from '@/lib/excelParser';

export function useScheduleData() {
  const [data, setData] = useState<ParsedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Fetch students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .order('name');

        if (studentsError) throw studentsError;

        // Fetch base schedule (remove default limit to get all records)
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('base_schedule')
          .select('*')
          .limit(10000); // Increase limit to ensure we get all schedule data

        if (scheduleError) throw scheduleError;

        // Transform to the expected format
        const students: StudentSchedule[] = (studentsData || []).map(student => {
          const schedule: StudentSchedule['schedule'] = {};
          
          // Group schedule by day
          const studentSchedule = scheduleData?.filter(s => s.student_id === student.student_id) || [];
          
          studentSchedule.forEach(entry => {
            if (!schedule[entry.day]) {
              schedule[entry.day] = {};
            }
            schedule[entry.day][entry.hour_number.toString()] = entry.content;
          });

          return {
            name: student.name,
            class: student.class,
            grade: student.grade,
            schedule,
          };
        });

        // Extract unique grades and classes
        const gradesSet = new Set(studentsData?.map(s => s.grade) || []);
        const classesSet = new Set(studentsData?.map(s => s.class) || []);

        setData({
          students,
          grades: Array.from(gradesSet).sort(),
          classes: Array.from(classesSet).sort(),
        });
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