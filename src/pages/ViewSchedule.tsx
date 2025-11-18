import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useScheduleData } from '@/hooks/useScheduleData';
import { getStudentScheduleForDate, formatDate, formatDateForDB } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const HOUR_TIMES = [
  { hour: 1, time: '08:45-09:15', label: 'שעה 1' },
  { hour: 2, time: '09:15-10:00', label: 'שעה 2' },
  { hour: 3, time: '10:20-11:05', label: 'שעה 3' },
  { hour: 4, time: '11:05-11:50', label: 'שעה 4' },
  { hour: 5, time: '12:05-12:50', label: 'שעה 5' },
  { hour: 6, time: '12:50-13:30', label: 'שעה 6' },
  { hour: 7, time: '14:00-14:45', label: 'שעה 7' },
  { hour: 8, time: '14:45-15:30', label: 'שעה 8' },
];

function parseHourContent(content: string) {
  if (!content || content.trim() === '') {
    return null;
  }

  // Try to parse the content format: "Subject / Teacher / Room"
  const parts = content.split('/').map(part => part.trim());
  
  if (parts.length >= 1) {
    return {
      subject: parts[0] || '',
      teacher: parts[1] || '',
      room: parts[2] || ''
    };
  }
  
  return {
    subject: content,
    teacher: '',
    room: ''
  };
}

export default function ViewSchedule() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data } = useScheduleData();

  const studentName = searchParams.get('student') || '';
  const dateParam = searchParams.get('date');
  const [currentDate, setCurrentDate] = useState(dateParam ? new Date(dateParam) : new Date());

  const student = data?.students.find((s) => s.name === studentName);

  const { data: overrides } = useQuery({
    queryKey: ['overrides', studentName, formatDateForDB(currentDate)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_overrides')
        .select('*')
        .eq('student_id', studentName)
        .eq('date', formatDateForDB(currentDate));

      if (error) throw error;
      return data || [];
    },
    enabled: !!studentName,
  });

  const { data: resetDate } = useQuery({
    queryKey: ['resetDate', studentName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reset_dates')
        .select('*')
        .eq('student_id', studentName)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!studentName,
  });

  const dailySchedule = student ? getStudentScheduleForDate(student, currentDate) : {};

  const getHourContent = (hourNumber: number): string => {
    const hourStr = hourNumber.toString();
    
    // Check if date is after reset date - if so, show base schedule
    if (resetDate && new Date(currentDate) > new Date(resetDate.reset_date)) {
      return dailySchedule[hourStr] || '';
    }

    // Check for override
    const override = overrides?.find((o) => o.hour_number === hourNumber);
    if (override) {
      return override.override_text;
    }

    // Return base schedule
    return dailySchedule[hourStr] || '';
  };

  const changeDate = (days: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + days);
    setCurrentDate(newDate);
  };

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="מערכת שעות" />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="p-8 text-center">
            <p className="text-lg text-muted-foreground mb-4">אנא בחר תלמיד</p>
            <Button onClick={() => navigate('/')}>חזור לבחירה</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const dayOfWeek = currentDate.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title={`מערכת שעות של ${studentName}`} />

      <main className="flex-1 container mx-auto px-2 sm:px-4 py-3 sm:py-6 max-w-4xl">
        <div className="mb-3 sm:mb-6 space-y-2 sm:space-y-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="w-full sm:w-auto text-sm"
            size="sm"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור לבחירה
          </Button>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => changeDate(-1)}
              className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-4"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="hidden sm:inline">היום הקודם</span>
            </Button>

            <div className="text-center flex-1">
              <p className="text-lg sm:text-3xl font-bold text-primary">
                {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][currentDate.getDay()]}
              </p>
              <p className="text-xs sm:text-lg text-muted-foreground mt-0.5 sm:mt-1">{formatDate(currentDate)}</p>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => changeDate(1)}
              className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-4"
            >
              <span className="hidden sm:inline">היום הבא</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isWeekend ? (
          <Card className="p-8 text-center">
            <p className="text-lg text-muted-foreground">אין לימודים בסוף שבוע</p>
          </Card>
        ) : Object.keys(dailySchedule).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg text-muted-foreground">לא נמצאה מערכת ליום זה</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="p-1.5 sm:p-3 text-center font-bold text-foreground bg-blue-100 dark:bg-blue-950 border-l border-border w-16 sm:w-24">
                      <div className="text-xs sm:text-sm">שעה</div>
                    </th>
                    <th className="p-1.5 sm:p-3 text-center font-bold text-foreground bg-blue-100 dark:bg-blue-950">
                      <div className="text-sm sm:text-base">
                        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][currentDate.getDay()]}
                      </div>
                      <span className="text-xs sm:text-sm text-primary font-normal hidden sm:inline">{formatDate(currentDate)}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {HOUR_TIMES.map(({ hour, time, label }) => {
                    const content = getHourContent(hour);
                    const isEmpty = !content || content.trim() === '';
                    const parsedContent = isEmpty ? null : parseHourContent(content);

                    return (
                      <tr 
                        key={hour}
                        className="border-b border-border transition-colors hover:bg-muted/30"
                      >
                        <td className="p-1.5 sm:p-3 border-l border-border bg-blue-100 dark:bg-blue-950">
                          <div className="text-center">
                            <div className="font-bold text-xs sm:text-base text-foreground">{hour}</div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{time}</div>
                          </div>
                        </td>
                        <td className={`p-2 sm:p-3 ${
                          isEmpty 
                            ? 'bg-white dark:bg-background' 
                            : 'bg-amber-50 dark:bg-amber-950/30'
                        }`}>
                          {isEmpty || !parsedContent ? (
                            <div className="text-center text-muted-foreground italic py-1 sm:py-2 text-xs sm:text-sm">חלון</div>
                          ) : (
                            <div className="space-y-0.5 sm:space-y-1 py-1 sm:py-2">
                              <div className="font-semibold text-xs sm:text-sm text-foreground leading-tight">
                                {parsedContent.subject}
                              </div>
                              {parsedContent.teacher && (
                                <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                                  {parsedContent.teacher}
                                </div>
                              )}
                              {parsedContent.room && (
                                <div className="text-[10px] sm:text-xs text-primary leading-tight">
                                  כיתת לימוד: {parsedContent.room}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}