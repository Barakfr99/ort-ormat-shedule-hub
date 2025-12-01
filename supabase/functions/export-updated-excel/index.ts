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
    const workbook = XLSX.read(arrayBuffer);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Base Excel loaded with ${jsonData.length} rows`);

    // Fetch all permanent overrides
    const { data: permanentOverrides, error: overridesError } = await supabaseClient
      .from('schedule_overrides')
      .select('*')
      .eq('is_permanent', true);

    if (overridesError) {
      console.error('Error fetching overrides:', overridesError);
      throw overridesError;
    }

    console.log(`Found ${permanentOverrides?.length || 0} permanent overrides`);

    // Create a map of overrides by student name, day, and hour
    const overridesMap = new Map<string, string>();
    
    for (const override of permanentOverrides || []) {
      // Parse date to get day of week
      const date = new Date(override.date);
      const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayName = DAYS[dayIndex === 0 ? 0 : dayIndex - 1]; // Adjust for Hebrew days
      
      const key = `${override.student_id}|${dayName}|${override.hour_number}`;
      overridesMap.set(key, override.override_text);
    }

    console.log('Processing rows and applying permanent overrides...');

    // Process each student row and apply permanent overrides
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length < 3) continue;

      const studentName = row[0];
      
      // For each day and hour, check if there's a permanent override
      for (let dayIndex = 0; dayIndex < DAYS.length; dayIndex++) {
        const dayName = DAYS[dayIndex];
        
        for (let hour = 1; hour <= 8; hour++) {
          const key = `${studentName}|${dayName}|${hour}`;
          const override = overridesMap.get(key);
          
          if (override) {
            // Calculate the column index in the Excel file
            // Columns: Name (0), Class (1), Grade (2), then 8 hours per day
            const columnIndex = 2 + (dayIndex * 8) + (hour - 1);
            row[columnIndex] = override;
            console.log(`Applied override for ${studentName}, ${dayName}, hour ${hour}`);
          }
        }
      }
    }

    console.log('Creating new workbook with updated data...');

    // Create a new worksheet with updated data
    const newWorksheet = XLSX.utils.aoa_to_sheet(jsonData);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, workbook.SheetNames[0]);

    // Generate Excel file
    const excelBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    console.log('Excel export completed successfully');

    const dateStr = new Date().toISOString().split('T')[0];
    const encodedFilename = encodeURIComponent(`מערכת_מעודכנת_${dateStr}.xlsx`);
    
    return new Response(excelBuffer, {
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
