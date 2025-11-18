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

      <main className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור לבחירה
          </Button>

          <Card className="p-4 card-elevated">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeDate(1)}
                className="transition-transform hover:scale-110"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <div className="text-center flex-1">
                <p className="text-sm text-muted-foreground">תאריך</p>
                <p className="text-xl font-bold text-foreground">{formatDate(currentDate)}</p>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => changeDate(-1)}
                className="transition-transform hover:scale-110"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </Card>
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
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => {
              const content = getHourContent(hour);
              const isEmpty = !content || content.trim() === '';

              return (
                <Card
                  key={hour}
                  className="p-4 card-elevated transition-all duration-300 animate-fade-in"
                  style={{ animationDelay: `${hour * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary">{hour}</span>
                    </div>
                    <div className="flex-1 min-h-[3rem] flex items-center">
                      {isEmpty ? (
                        <p className="text-lg text-muted-foreground italic">חלון</p>
                      ) : (
                        <p className="text-base text-foreground leading-relaxed">{content}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}