import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const HOURS_PER_DAY = 8;

const GRADE_ORDER: { [key: string]: number } = {
  "ט'": 1,
  "י'": 2,
  "י\"א": 3,
  "י\"ב": 4,
  "יא": 3,
  "יב": 4,
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Excel upload processing...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      throw new Error('No file provided');
    }

    console.log('File received:', file.name);

    // Import XLSX dynamically
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    console.log('Excel parsed, rows:', data.length);

    // Clear existing data
    console.log('Clearing existing data...');
    await supabase.from('base_schedule').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const studentsToInsert: any[] = [];
    const scheduleToInsert: any[] = [];
    const studentNamesSet = new Set<string>();

    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0] || !row[1]) continue;

      const studentName = String(row[0]).trim();
      const classInfo = String(row[1]).trim();

      // Skip duplicates
      if (studentNamesSet.has(studentName)) {
        console.log('Skipping duplicate:', studentName);
        continue;
      }
      studentNamesSet.add(studentName);

      // Extract grade from class
      const gradeMatch = classInfo.match(/^(?:[א-ת]+'|[א-ת]+"[א-ת])/);
      const grade = gradeMatch ? gradeMatch[0] : '';

      // Create unique student_id
      const studentId = `${studentName}_${classInfo}`;

      studentsToInsert.push({
        student_id: studentId,
        name: studentName,
        class: classInfo,
        grade: grade,
      });

      // Parse schedule
      let colIndex = 2;
      for (const day of DAYS) {
        for (let hour = 1; hour <= HOURS_PER_DAY; hour++) {
          const cellValue = row[colIndex] ? String(row[colIndex]).trim() : '';
          
          scheduleToInsert.push({
            student_id: studentId,
            day: day,
            hour_number: hour,
            content: cellValue || 'חלון',
          });
          
          colIndex++;
        }
      }
    }

    console.log('Inserting students:', studentsToInsert.length);
    
    // Insert students in batches
    const batchSize = 500;
    for (let i = 0; i < studentsToInsert.length; i += batchSize) {
      const batch = studentsToInsert.slice(i, i + batchSize);
      const { error: studentsError } = await supabase
        .from('students')
        .insert(batch);
      
      if (studentsError) {
        console.error('Error inserting students batch:', studentsError);
        throw studentsError;
      }
    }

    console.log('Inserting schedule entries:', scheduleToInsert.length);
    
    // Insert schedule in batches
    for (let i = 0; i < scheduleToInsert.length; i += batchSize) {
      const batch = scheduleToInsert.slice(i, i + batchSize);
      const { error: scheduleError } = await supabase
        .from('base_schedule')
        .insert(batch);
      
      if (scheduleError) {
        console.error('Error inserting schedule batch:', scheduleError);
        throw scheduleError;
      }
    }

    console.log('Upload completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'הקובץ עובד בהצלחה',
        stats: {
          students: studentsToInsert.length,
          scheduleEntries: scheduleToInsert.length,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing Excel:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});