import { useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useScheduleData } from '@/hooks/useScheduleData';
import { useToast } from '@/hooks/use-toast';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

interface ParsedLesson {
  subject: string;
  teacher: string;
  room: string;
}

function parseLesson(content: string): ParsedLesson | null {
  if (!content || content.trim() === '') {
    return null;
  }

  const parts = content.split('/').map(part => part.trim());
  
  return {
    subject: parts[0] || '',
    teacher: parts[1] || '',
    room: parts[2] || ''
  };
}

export default function WeeklySchedule() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data, loading } = useScheduleData();
  const { toast } = useToast();
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const studentName = searchParams.get('student') || '';
  const student = data?.students.find((s) => s.name === studentName);

  const handleDownload = async () => {
    if (!scheduleRef.current) return;

    setDownloading(true);
    try {
      const canvas = await html2canvas(scheduleRef.current, {
        scale: 3, // High resolution for printing
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `מערכת-שעות-${studentName}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();

      toast({
        title: 'המערכת הורדה בהצלחה',
        description: 'הקובץ נשמר כתמונה באיכות גבוהה',
      });
    } catch (error) {
      toast({
        title: 'שגיאה בהורדה',
        description: 'נסה שוב מאוחר יותר',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header title="מערכת שעות שבועית" />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="p-8 text-center">
            <p className="text-lg text-muted-foreground mb-4">לא נמצא תלמיד</p>
            <Button onClick={() => navigate('/')}>חזור לבחירה</Button>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="מערכת שעות שבועית" />

      <main className="flex-1 container mx-auto px-2 sm:px-4 py-4 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            size="sm"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            חזור לבחירה
          </Button>

          <Button 
            onClick={handleDownload}
            disabled={downloading}
            className="gradient-primary"
            size="sm"
          >
            {downloading ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="ml-2 h-4 w-4" />
            )}
            הורד כתמונה
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div 
            ref={scheduleRef} 
            className="min-w-[800px] bg-white p-6"
            style={{ direction: 'rtl' }}
          >
            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold text-center text-cyan-600 mb-6">
              מערכת שעות לתלמיד/ה: {studentName} ({student.class})
            </h1>

            {/* Schedule Table */}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-gray-300 bg-cyan-100 text-cyan-800 p-2 text-center font-bold w-20">
                    שעה/יום
                  </th>
                  {DAYS.map((day) => (
                    <th 
                      key={day} 
                      className="border border-gray-300 bg-cyan-100 text-cyan-800 p-2 text-center font-bold"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="border border-gray-300 bg-cyan-50 p-2 text-center font-bold text-gray-700">
                      {hour}
                    </td>
                    {DAYS.map((day) => {
                      const content = student.schedule[day]?.[hour.toString()] || '';
                      const lesson = parseLesson(content);
                      const isEmpty = !lesson;

                      return (
                        <td 
                          key={`${day}-${hour}`}
                          className={`border border-gray-300 p-2 align-top ${
                            isEmpty ? 'bg-white' : 'bg-white'
                          }`}
                          style={{ minWidth: '130px', height: '80px' }}
                        >
                          {lesson && (
                            <div className="space-y-0.5 text-center">
                              <div className="font-semibold text-gray-900 text-xs sm:text-sm leading-tight">
                                {lesson.subject}
                              </div>
                              {lesson.teacher && (
                                <div className="text-gray-600 text-xs leading-tight">
                                  {lesson.teacher}
                                </div>
                              )}
                              {lesson.room && (
                                <div className="text-gray-500 text-xs leading-tight">
                                  חדר: {lesson.room}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
