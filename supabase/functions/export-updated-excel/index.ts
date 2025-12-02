import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting Excel export process...');

    // Dynamically import xlsx
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');

    // Fetch the base Excel file from Storage bucket
    const baseExcelUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/excel-files/students.xlsx`;
    console.log('Fetching base Excel from Storage:', baseExcelUrl);
    
    const baseExcelResponse = await fetch(baseExcelUrl);
    
    if (!baseExcelResponse.ok) {
      throw new Error(`Failed to fetch base Excel file: ${baseExcelResponse.status}`);
    }

    const arrayBuffer = await baseExcelResponse.arrayBuffer();
    
    // Read the workbook while preserving styles and formatting
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
      type: 'array',
      cellStyles: true,
      cellFormula: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`Base Excel loaded with ${range.e.r + 1} rows`);

    // Fetch all permanent changes
    const { data: permanentChanges, error: permanentError } = await supabaseClient
      .from('permanent_schedule_changes')
      .select('*');

    if (permanentError) {
      console.error('Error fetching permanent changes:', permanentError);
      throw permanentError;
    }

    console.log(`Found ${permanentChanges?.length || 0} permanent changes`);

    // Create a map of overrides by student name, day, and hour
    const overridesMap = new Map<string, string>();
    
    for (const change of permanentChanges || []) {
      const key = `${change.student_id}|${change.day_of_week}|${change.hour_number}`;
      const content = [change.subject, change.teacher || '', change.room || ''].join(' / ');
      overridesMap.set(key, content);
    }

    console.log('Processing rows and applying permanent overrides...');

    // Build a map of student names to row indices
    const studentRowMap = new Map<string, number>();
    for (let row = 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        studentRowMap.set(String(cell.v), row);
      }
    }

    // Apply permanent overrides directly to the worksheet cells
    for (const [key, overrideText] of overridesMap) {
      const [studentName, dayName, hourStr] = key.split('|');
      const hour = parseInt(hourStr);
      const dayIndex = DAYS.indexOf(dayName);
      
      if (dayIndex === -1) continue;
      
      const row = studentRowMap.get(studentName);
      if (row === undefined) continue;
      
      // Calculate the column index in the Excel file
      // Columns: Name (0), Class (1), Grade (2), then 8 hours per day
      const col = 2 + (dayIndex * 8) + (hour - 1);
      
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      
      // Preserve existing cell properties if they exist, just update the value
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].v = overrideText;
        worksheet[cellAddress].w = overrideText;
      } else {
        worksheet[cellAddress] = { t: 's', v: overrideText, w: overrideText };
      }
      
      console.log(`Applied override for ${studentName}, ${dayName}, hour ${hour} at cell ${cellAddress}`);
    }

    console.log('Writing workbook with preserved formatting...');

    // Write the workbook back, preserving the original format
    const excelBuffer = XLSX.write(workbook, { 
      type: 'array',
      bookType: 'xlsx',
      bookSST: true
    });

    console.log('Excel export completed successfully');

    const dateStr = new Date().toISOString().split('T')[0];
    const encodedFilename = encodeURIComponent(`מערכת_מעודכנת_${dateStr}.xlsx`);
    
    return new Response(new Uint8Array(excelBuffer), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="schedule_${dateStr}.xlsx"; filename*=UTF-8''${encodedFilename}`,
      },
    });

  } catch (error) {
    console.error('Error in export-updated-excel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
