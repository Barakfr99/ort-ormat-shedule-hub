import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Delete existing file if exists
    console.log('Removing existing file...');
    await supabase.storage
      .from('excel-files')
      .remove(['students.xlsx']);

    // Upload the new Excel file to Storage
    console.log('Uploading new Excel file to Storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('excel-files')
      .upload('students.xlsx', fileData, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      throw uploadError;
    }

    console.log('File uploaded successfully:', uploadData);

    // Parse the Excel to count students for feedback
    const XLSX = await import('https://esm.sh/xlsx@0.18.5');
    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

    const studentCount = data.length - 1; // Subtract header row
    console.log('Excel contains', studentCount, 'students');

    console.log('Upload completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'הקובץ עודכן בהצלחה',
        stats: {
          students: studentCount,
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
