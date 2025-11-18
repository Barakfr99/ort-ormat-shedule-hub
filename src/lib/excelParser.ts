import * as XLSX from 'xlsx';

export interface StudentSchedule {
  name: string;
  class: string;
  grade: string;
  schedule: {
    [day: string]: {
      [hour: string]: string;
    };
  };
}

export interface ParsedScheduleData {
  students: StudentSchedule[];
  grades: string[];
  classes: string[];
}

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const HOURS_PER_DAY = 8;

export async function parseExcelFile(file: File | string): Promise<ParsedScheduleData> {
  let workbook: XLSX.WorkBook;

  if (typeof file === 'string') {
    // Load from URL/path
    const response = await fetch(file);
    const arrayBuffer = await response.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  } else {
    // Load from File object
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

  const students: StudentSchedule[] = [];
  const gradesSet = new Set<string>();
  const classesSet = new Set<string>();

  // Skip header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0] || !row[1]) continue; // Skip empty rows

    const studentName = String(row[0]).trim();
    const classInfo = String(row[1]).trim();
    
    // Extract grade from class (e.g., "י' 2" -> "י'", "י"א 1" -> "י"א", "י"ב 3" -> "י"ב")
    const gradeMatch = classInfo.match(/^(?:[א-ת]+'|[א-ת]+"[א-ת])/);
    const grade = gradeMatch ? gradeMatch[0] : '';
    
    console.log('Parsing student:', studentName, 'class:', classInfo, 'extracted grade:', grade);
    
    gradesSet.add(grade);
    classesSet.add(classInfo);

    const schedule: StudentSchedule['schedule'] = {};

    // Parse schedule: 2 columns for name+class, then 8 hours × 5 days = 40 columns
    let colIndex = 2;
    for (const day of DAYS) {
      schedule[day] = {};
      for (let hour = 1; hour <= HOURS_PER_DAY; hour++) {
        const cellValue = row[colIndex] ? String(row[colIndex]).trim() : '';
        schedule[day][hour.toString()] = cellValue;
        colIndex++;
      }
    }

    students.push({
      name: studentName,
      class: classInfo,
      grade,
      schedule,
    });
  }

  return {
    students,
    grades: Array.from(gradesSet).sort(),
    classes: Array.from(classesSet).sort(),
  };
}

export function getStudentScheduleForDate(
  student: StudentSchedule,
  date: Date
): { [hour: string]: string } {
  // Convert date to Hebrew day name
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const hebrewDay = dayNames[dayOfWeek];

  return student.schedule[hebrewDay] || {};
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateForDB(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}