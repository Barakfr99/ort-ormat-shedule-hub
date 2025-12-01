import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Calendar as CalendarIcon, Upload, Download } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useScheduleData } from '@/hooks/useScheduleData';
import { formatDate, formatDateForDB } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
export default function AdminPanel() {
  const navigate = useNavigate();
  const {
    data
  } = useScheduleData();
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<'daily' | 'range'>('daily');
  const [permanentPassword, setPermanentPassword] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [hourContents, setHourContents] = useState<{
    [key: number]: string;
  }>({});
  const [rangeText, setRangeText] = useState('');
  const [rangeDates, setRangeDates] = useState<Date[]>([new Date()]);
  const [shouldSetResetDate, setShouldSetResetDate] = useState(false);
  const [isPermanentChange, setIsPermanentChange] = useState(false);
  const [resetDate, setResetDate] = useState<Date>(new Date());
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState({
    title: '',
    description: ''
  });

  // Update reset date default when edit mode or dates change
  useEffect(() => {
    if (editMode === 'daily') {
      setResetDate(editDate);
    } else if (editMode === 'range' && rangeDates.length > 0) {
      // Set to the latest date in the range
      const latestDate = rangeDates.reduce((latest, current) => current > latest ? current : latest, rangeDates[0]);
      setResetDate(latestDate);
    }
  }, [editMode, editDate, rangeDates]);
  useEffect(() => {
    const isAuth = sessionStorage.getItem('adminAuth');
    if (!isAuth) {
      navigate('/admin-login');
    }
  }, [navigate]);

  // Clear selected class and students when grade changes
  useEffect(() => {
    setSelectedClass('');
    setSelectedStudents([]);
  }, [selectedGrade]);

  // Clear selected students when class changes
  useEffect(() => {
    setSelectedStudents([]);
  }, [selectedClass]);
  const filteredClasses = selectedGrade ? data?.classes.filter(c => c.startsWith(selectedGrade)) : data?.classes || [];
  const filteredStudents = selectedClass ? data?.students.filter(s => s.class === selectedClass).sort((a, b) => a.name.localeCompare(b.name, 'he')) : selectedGrade ? data?.students.filter(s => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name, 'he')) : data?.students.sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];
  const toggleStudent = (studentName: string) => {
    setSelectedStudents(prev => prev.includes(studentName) ? prev.filter(s => s !== studentName) : [...prev, studentName]);
  };
  const selectAllStudents = () => {
    setSelectedStudents(filteredStudents.map(s => s.name));
  };
  const saveChangesMutation = useMutation({
    mutationFn: async () => {
      if (selectedStudents.length === 0) {
        throw new Error('לא נבחרו תלמידים');
      }

      // Check permanent password if permanent change
      if (isPermanentChange && permanentPassword !== '2002') {
        throw new Error('סיסמה שגויה לשינוי קבוע');
      }

      const updates = [];
      if (editMode === 'daily') {
        // Daily schedule editing
        for (const studentName of selectedStudents) {
          for (let hour = 1; hour <= 8; hour++) {
            const content = hourContents[hour];
            if (content !== undefined && content.trim() !== '') {
              updates.push({
                student_id: studentName,
                date: formatDateForDB(editDate),
                hour_number: hour,
                override_text: content
              });
            }
          }
        }
      } else if (editMode === 'range') {
        // Full day update - always 1-8
        const start = 1;
        const end = 8;
        for (const studentName of selectedStudents) {
          for (const date of rangeDates) {
            for (let hour = start; hour <= end; hour++) {
              updates.push({
                student_id: studentName,
                date: formatDateForDB(date),
                hour_number: hour,
                override_text: rangeText
              });
            }
          }
        }
      }

      if (updates.length > 0) {
        // Add is_permanent flag based on isPermanentChange
        const updatesWithPermanentFlag = updates.map(update => ({
          ...update,
          is_permanent: isPermanentChange
        }));
        
        const {
          error: overridesError
        } = await supabase.from('schedule_overrides').upsert(updatesWithPermanentFlag, {
          onConflict: 'student_id,date,hour_number'
        });
        if (overridesError) throw overridesError;
      }

      // Handle reset date if not permanent change
      if (!isPermanentChange && shouldSetResetDate) {
        const resetUpdates = selectedStudents.map(studentName => ({
          student_id: studentName,
          reset_date: formatDateForDB(resetDate)
        }));
        const {
          error: resetError
        } = await supabase.from('reset_dates').upsert(resetUpdates, {
          onConflict: 'student_id'
        });
        if (resetError) throw resetError;
      } else if (isPermanentChange) {
        // If permanent change, delete any existing reset dates
        for (const studentName of selectedStudents) {
          await supabase.from('reset_dates').delete().eq('student_id', studentName);
        }
      }
    },
    onSuccess: () => {
      console.log('שמירת שינויים הושלמה', {
        selectedStudents: selectedStudents.length
      });
      setSuccessMessage({
        title: 'השינויים נשמרו בהצלחה',
        description: `השינויים עבור ${selectedStudents.length} תלמידים נשמרו במערכת`
      });
      setShowSuccessDialog(true);
      queryClient.invalidateQueries({
        queryKey: ['overrides']
      });
      queryClient.invalidateQueries({
        queryKey: ['resetDate']
      });
      queryClient.invalidateQueries({
        queryKey: ['scheduleData']
      });
      setHourContents({});
      setRangeText('');
      setPermanentPassword('');
    },
    onError: (error: Error) => {
      console.error('שגיאה בשמירה', error);
      setSuccessMessage({
        title: 'שגיאה בשמירת השינויים',
        description: error.message || 'נסה שוב'
      });
      setShowSuccessDialog(true);
    }
  });
  const resetToBaseMutation = useMutation({
    mutationFn: async () => {
      // Delete all overrides for selected students
      for (const studentName of selectedStudents) {
        const {
          error: overridesError
        } = await supabase.from('schedule_overrides').delete().eq('student_id', studentName);
        if (overridesError) throw overridesError;

        // Delete reset date
        const {
          error: resetError
        } = await supabase.from('reset_dates').delete().eq('student_id', studentName);
        if (resetError) throw resetError;
      }
    },
    onSuccess: () => {
      console.log('איפוס בוצע בהצלחה', {
        selectedStudents: selectedStudents.length
      });
      setSuccessMessage({
        title: 'האיפוס בוצע בהצלחה',
        description: `${selectedStudents.length} תלמידים אופסו למערכת הבסיס`
      });
      setShowSuccessDialog(true);
      queryClient.invalidateQueries({
        queryKey: ['overrides']
      });
      queryClient.invalidateQueries({
        queryKey: ['resetDate']
      });
    },
    onError: (error: Error) => {
      console.error('שגיאה באיפוס', error);
      setSuccessMessage({
        title: 'שגיאה באיפוס למערכת בסיס',
        description: error.message || 'נסה שוב'
      });
      setShowSuccessDialog(true);
    }
  });

  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('export-updated-excel');
      
      if (error) throw error;
      
      // Create a blob from the response and download it
      const blob = new Blob([data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `מערכת_מעודכנת_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      setSuccessMessage({
        title: 'הייצוא הושלם בהצלחה',
        description: 'קובץ האקסל המעודכן הורד למחשב שלך'
      });
      setShowSuccessDialog(true);
    },
    onError: (error: Error) => {
      console.error('שגיאה בייצוא', error);
      setSuccessMessage({
        title: 'שגיאה בייצוא אקסל',
        description: error.message || 'נסה שוב'
      });
      setShowSuccessDialog(true);
    }
  });

  return <div className="min-h-screen flex flex-col bg-background">
      <Header title="ניהול מערכות – אורט אורמת" />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex gap-4 mb-6 flex-wrap">
          <Button variant="outline" onClick={() => navigate('/upload-excel')}>
            <Upload className="ml-2 h-4 w-4" />
            העלאת קובץ אקסל
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => exportExcelMutation.mutate()}
            disabled={exportExcelMutation.isPending}
          >
            <Download className="ml-2 h-4 w-4" />
            {exportExcelMutation.isPending ? 'מייצא...' : 'ייצוא מערכת מעודכנת'}
          </Button>
          
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('adminAuth');
            navigate('/');
          }}>
            <ArrowRight className="ml-2 h-4 w-4" />
            התנתק וחזור
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6 card-elevated">
            <h3 className="text-xl font-bold mb-4 text-foreground">סינון תלמידים</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">שכבה</label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר שכבה" />
                    </SelectTrigger>
                    <SelectContent>
                      {data?.grades.map(grade => <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground">כיתה</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר כיתה" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredClasses.map(className => <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filteredStudents.length > 0 && <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-foreground">תלמידים</label>
                    <Button variant="outline" size="sm" onClick={selectAllStudents}>
                      בחר את כולם
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {filteredStudents.map(student => <div key={student.name} className="flex items-center gap-2">
                        <Checkbox checked={selectedStudents.includes(student.name)} onCheckedChange={() => toggleStudent(student.name)} />
                        <label className="text-sm text-foreground cursor-pointer">
                          {student.name}
                        </label>
                      </div>)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    נבחרו {selectedStudents.length} תלמידים
                  </p>
                </div>}
            </Card>

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">בחר סוג עריכה</h3>
              
              <RadioGroup value={editMode} onValueChange={(value: 'daily' | 'range') => setEditMode(value)}>
                <div className="flex items-center space-x-2 space-x-reverse mb-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="cursor-pointer">עריכת מערכת לפי יום</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse mb-2">
                  <RadioGroupItem value="range" id="range" />
                  <Label htmlFor="range" className="cursor-pointer">עדכון יום מלא</Label>
                </div>
              </RadioGroup>
            </Card>

            {editMode === 'daily' && <Card className="p-6 card-elevated">
                <h3 className="text-xl font-bold mb-4 text-foreground">עריכת מערכת לפי יום</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-foreground">תאריך לעריכה</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-right">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {formatDate(editDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={editDate} onSelect={date => date && setEditDate(date)} className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(hour => <div key={hour}>
                      <label className="block text-sm font-medium mb-1 text-foreground">
                        שעה {hour}
                      </label>
                      <Input value={hourContents[hour] || ''} onChange={e => setHourContents(prev => ({
                ...prev,
                [hour]: e.target.value
              }))} placeholder="תוכן השעה" />
                    </div>)}
                </div>
              </Card>}

            {editMode === 'range' && <Card className="p-6 card-elevated">
                <h3 className="text-xl font-bold mb-4 text-foreground">עדכון יום מלא</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      טקסט לשעות
                    </label>
                    <Input value={rangeText} onChange={e => setRangeText(e.target.value)} placeholder="הכנס טקסט" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">תאריכים</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {rangeDates.length === 1 ? formatDate(rangeDates[0]) : `${rangeDates.length} ימים נבחרו`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar mode="multiple" selected={rangeDates} onSelect={dates => dates && setRangeDates(dates)} className="pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    השינוי יחול על כל 8 השעות ביום
                  </p>
                </div>
              </Card>}

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">הגדרות איפוס</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox checked={isPermanentChange} onCheckedChange={checked => {
                setIsPermanentChange(checked === true);
                if (checked) setShouldSetResetDate(false);
              }} id="permanent-change" />
                  <label htmlFor="permanent-change" className="text-sm font-medium text-foreground cursor-pointer">
                    שינוי מערכת קבוע (השינויים יישארו לצמיתות)
                  </label>
                </div>

                {!isPermanentChange && <>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={shouldSetResetDate} onCheckedChange={checked => setShouldSetResetDate(checked === true)} id="set-reset-date" />
                      <label htmlFor="set-reset-date" className="text-sm font-medium text-foreground cursor-pointer">
                        הגדר תאריך איפוס (המערכת תחזור אוטומטית למערכת בסיס אחרי תאריך זה)
                      </label>
                    </div>

                    {shouldSetResetDate && <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">תאריך איפוס</label>
                        <p className="text-xs text-muted-foreground mb-2">
                          ברירת מחדל: בתום היום האחרון של השינוי
                        </p>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-right">
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {formatDate(resetDate)}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={resetDate} onSelect={date => date && setResetDate(date)} className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>}
                  </>}

                <Button onClick={() => saveChangesMutation.mutate()} disabled={selectedStudents.length === 0 || editMode === 'range' && (!rangeText || rangeDates.length === 0) || saveChangesMutation.isPending} className="w-full gradient-primary">
                  <Save className="ml-2 h-4 w-4" />
                  שמור שינויים
                </Button>
              </div>
            </Card>

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">איפוס למערכת בסיס</h3>
              <p className="text-muted-foreground mb-6">
                מחיקת כל השינויים והחזרה למערכת הבסיס עבור התלמידים הנבחרים.
              </p>

              {selectedStudents.length > 0 && <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground">
                    נבחרו {selectedStudents.length} תלמידים
                  </p>
                </div>}

              <Button onClick={() => resetToBaseMutation.mutate()} disabled={selectedStudents.length === 0 || resetToBaseMutation.isPending} variant="destructive" className="w-full">
                איפוס למערכת בסיס
              </Button>
            </Card>
          </div>
        </main>

        <Footer />

        <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogTitle className="text-2xl font-bold text-center text-foreground">
              ✅ {successMessage.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-lg text-muted-foreground mt-4">
              {successMessage.description}
            </AlertDialogDescription>
            <AlertDialogAction onClick={() => setShowSuccessDialog(false)} className="w-full mt-6 gradient-primary">
              סגור
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      </div>;
}