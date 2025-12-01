import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, UserCircle2, CalendarDays } from 'lucide-react';
import { useScheduleData } from '@/hooks/useScheduleData';
import { saveToLocalStorage, getFromLocalStorage } from '@/lib/localStorage';
import { formatDate } from '@/lib/excelParser';
import { useToast } from '@/hooks/use-toast';

export default function SelectSchedule() {
  const navigate = useNavigate();
  const { data, loading } = useScheduleData();
  const { toast } = useToast();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Load from localStorage on mount
  useEffect(() => {
    const stored = getFromLocalStorage();
    if (stored.selectedGrade) setSelectedGrade(stored.selectedGrade);
    if (stored.selectedClass) setSelectedClass(stored.selectedClass);
    if (stored.selectedStudent) setSelectedStudent(stored.selectedStudent);
  }, []);

  // Filter classes by matching grade (handle various Hebrew formats)
  const filteredClasses = selectedGrade
    ? data?.classes.filter((c) => {
        // Extract the grade part from class (before the space)
        const classGrade = c.split(' ')[0];
        return classGrade === selectedGrade;
      })
    : data?.classes || [];

  // Filter students by class, or by grade if only grade is selected
  const filteredStudents = selectedClass
    ? data?.students.filter((s) => s.class === selectedClass).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : selectedGrade
    ? data?.students.filter((s) => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : data?.students.sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];

  const handleShowSchedule = () => {
    if (!selectedStudent) {
      toast({
        title: 'אנא בחר תלמיד',
        variant: 'destructive',
      });
      return;
    }

    saveToLocalStorage({
      selectedGrade,
      selectedClass,
      selectedStudent,
    });

    navigate(`/schedule?student=${encodeURIComponent(selectedStudent)}&date=${selectedDate.toISOString()}`);
  };

  const handleShowWeeklySchedule = () => {
    if (!selectedStudent) {
      toast({
        title: 'אנא בחר תלמיד',
        variant: 'destructive',
      });
      return;
    }

    saveToLocalStorage({
      selectedGrade,
      selectedClass,
      selectedStudent,
    });

    navigate(`/weekly?student=${encodeURIComponent(selectedStudent)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="מערכת שעות- אורט אורמת" />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card className="p-6 md:p-8 card-elevated space-y-6">
          <div className="text-center mb-6">
            <UserCircle2 className="h-16 w-16 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">בחירת מערכת שעות</h2>
            <p className="text-muted-foreground">בחר תלמיד ותאריך להצגת המערכת</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">שכבה</label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר שכבה" />
                </SelectTrigger>
                <SelectContent>
                  {data?.grades.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">כיתה</label>
              <Select 
                value={selectedClass} 
                onValueChange={setSelectedClass}
                disabled={!selectedGrade}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר כיתה" />
                </SelectTrigger>
                <SelectContent>
                  {filteredClasses.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">תלמיד</label>
              <Select 
                value={selectedStudent} 
                onValueChange={setSelectedStudent}
                disabled={!selectedClass}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר תלמיד" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((student) => (
                    <SelectItem key={student.name} value={student.name}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">תאריך</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right font-normal">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {formatDate(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handleShowSchedule} 
              className="w-full gradient-primary text-lg h-12 mt-6"
            >
              הצג מערכת יומית
            </Button>

            <Button 
              onClick={handleShowWeeklySchedule}
              variant="secondary"
              className="w-full text-lg h-12 mt-3"
            >
              <CalendarDays className="ml-2 h-5 w-5" />
              הצג מערכת שבועית
            </Button>

            <div className="grid gap-3 sm:grid-cols-2 mt-4">
              <Button
                variant="outline"
                onClick={() => navigate('/teacher-login')}
                className="w-full"
              >
                כניסת מורים
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/admin-login')}
                className="w-full"
              >
                כניסת מנהלים
              </Button>
            </div>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}