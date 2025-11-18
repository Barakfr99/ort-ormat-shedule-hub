import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Calendar as CalendarIcon } from 'lucide-react';
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
import { useScheduleData } from '@/hooks/useScheduleData';
import { formatDate, formatDateForDB } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AdminPanel() {
  const navigate = useNavigate();
  const { data } = useScheduleData();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  
  const [editMode, setEditMode] = useState<'daily' | 'range'>('daily');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [hourContents, setHourContents] = useState<{ [key: number]: string }>({});
  
  const [rangeText, setRangeText] = useState('');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('8');
  const [rangeDates, setRangeDates] = useState<Date[]>([new Date()]);
  const [isFullDay, setIsFullDay] = useState(false);
  
  const [shouldSetResetDate, setShouldSetResetDate] = useState(false);
  const [isPermanentChange, setIsPermanentChange] = useState(false);
  const [resetDate, setResetDate] = useState<Date>(new Date());

  // Update reset date default when edit mode or dates change
  useEffect(() => {
    if (editMode === 'daily') {
      setResetDate(editDate);
    } else if (editMode === 'range' && rangeDates.length > 0) {
      // Set to the latest date in the range
      const latestDate = rangeDates.reduce((latest, current) => 
        current > latest ? current : latest, rangeDates[0]
      );
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

  const filteredClasses = selectedGrade
    ? data?.classes.filter((c) => c.startsWith(selectedGrade))
    : data?.classes || [];

  const filteredStudents = selectedClass
    ? data?.students.filter((s) => s.class === selectedClass).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : selectedGrade
    ? data?.students.filter((s) => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name, 'he'))
    : data?.students.sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];

  const toggleStudent = (studentName: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentName)
        ? prev.filter((s) => s !== studentName)
        : [...prev, studentName]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudents(filteredStudents.map((s) => s.name));
  };

  const saveChangesMutation = useMutation({
    mutationFn: async () => {
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
                override_text: content,
              });
            }
          }
        }
      } else {
        // Range update
        const start = isFullDay ? 1 : parseInt(rangeStart);
        const end = isFullDay ? 8 : parseInt(rangeEnd);
        
        if (!isFullDay && (isNaN(start) || isNaN(end) || start < 1 || end > 8 || start > end)) {
          throw new Error('טווח שעות לא תקין');
        }

        for (const studentName of selectedStudents) {
          for (const date of rangeDates) {
            for (let hour = start; hour <= end; hour++) {
              updates.push({
                student_id: studentName,
                date: formatDateForDB(date),
                hour_number: hour,
                override_text: rangeText,
              });
            }
          }
        }
      }

      if (updates.length > 0) {
        const { error: overridesError } = await supabase
          .from('schedule_overrides')
          .upsert(updates, {
            onConflict: 'student_id,date,hour_number',
          });

        if (overridesError) throw overridesError;
      }

      // Handle reset date if not permanent change
      if (!isPermanentChange && shouldSetResetDate) {
        const resetUpdates = selectedStudents.map((studentName) => ({
          student_id: studentName,
          reset_date: formatDateForDB(resetDate),
        }));

        const { error: resetError } = await supabase
          .from('reset_dates')
          .upsert(resetUpdates, {
            onConflict: 'student_id',
          });

        if (resetError) throw resetError;
      } else if (isPermanentChange) {
        // If permanent change, delete any existing reset dates
        for (const studentName of selectedStudents) {
          await supabase
            .from('reset_dates')
            .delete()
            .eq('student_id', studentName);
        }
      }
    },
    onSuccess: () => {
      toast({
        title: '✅ המערכת עודכנה בהצלחה',
        description: `השינויים נשמרו עבור ${selectedStudents.length} תלמידים`,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
      queryClient.invalidateQueries({ queryKey: ['resetDate'] });
      setHourContents({});
      setRangeText('');
    },
    onError: (error: Error) => {
      toast({
        title: error.message || 'שגיאה בשמירת השינויים',
        variant: 'destructive',
      });
    },
  });

  const resetToBaseMutation = useMutation({
    mutationFn: async () => {
      // Delete all overrides for selected students
      for (const studentName of selectedStudents) {
        const { error: overridesError } = await supabase
          .from('schedule_overrides')
          .delete()
          .eq('student_id', studentName);

        if (overridesError) throw overridesError;

        // Delete reset date
        const { error: resetError } = await supabase
          .from('reset_dates')
          .delete()
          .eq('student_id', studentName);

        if (resetError) throw resetError;
      }
    },
    onSuccess: () => {
      toast({
        title: '✅ האיפוס בוצע בהצלחה',
        description: `${selectedStudents.length} תלמידים אופסו למערכת הבסיס`,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
      queryClient.invalidateQueries({ queryKey: ['resetDate'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'שגיאה באיפוס למערכת בסיס',
        description: error.message || 'נסה שוב',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="ניהול מערכות – אורות יבנה" />

      <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
        <Button
          variant="outline"
          onClick={() => {
            sessionStorage.removeItem('adminAuth');
            navigate('/');
          }}
          className="mb-6"
        >
          <ArrowRight className="ml-2 h-4 w-4" />
          התנתק וחזור
        </Button>

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
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
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
              </div>

              {filteredStudents.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-foreground">תלמידים</label>
                    <Button variant="outline" size="sm" onClick={selectAllStudents}>
                      בחר את כולם
                    </Button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {filteredStudents.map((student) => (
                      <div key={student.name} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedStudents.includes(student.name)}
                          onCheckedChange={() => toggleStudent(student.name)}
                        />
                        <label className="text-sm text-foreground cursor-pointer">
                          {student.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    נבחרו {selectedStudents.length} תלמידים
                  </p>
                </div>
              )}
            </Card>

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">בחר סוג עריכה</h3>
              
              <RadioGroup value={editMode} onValueChange={(value: 'daily' | 'range') => setEditMode(value)}>
                <div className="flex items-center space-x-2 space-x-reverse mb-2">
                  <RadioGroupItem value="daily" id="daily" />
                  <Label htmlFor="daily" className="cursor-pointer">עריכת מערכת לפי יום</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="range" id="range" />
                  <Label htmlFor="range" className="cursor-pointer">עדכון טווח שעות</Label>
                </div>
              </RadioGroup>
            </Card>

            {editMode === 'daily' && (
              <Card className="p-6 card-elevated">
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
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={(date) => date && setEditDate(date)}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => (
                    <div key={hour}>
                      <label className="block text-sm font-medium mb-1 text-foreground">
                        שעה {hour}
                      </label>
                      <Input
                        value={hourContents[hour] || ''}
                        onChange={(e) =>
                          setHourContents((prev) => ({ ...prev, [hour]: e.target.value }))
                        }
                        placeholder="תוכן השעה"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {editMode === 'range' && (
              <Card className="p-6 card-elevated">
                <h3 className="text-xl font-bold mb-4 text-foreground">עדכון טווח שעות</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      טקסט לשעות
                    </label>
                    <Input
                      value={rangeText}
                      onChange={(e) => setRangeText(e.target.value)}
                      placeholder="הכנס טקסט"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">תאריכים</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {rangeDates.length === 1 
                            ? formatDate(rangeDates[0])
                            : `${rangeDates.length} ימים נבחרו`
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="multiple"
                          selected={rangeDates}
                          onSelect={(dates) => dates && setRangeDates(dates)}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={isFullDay}
                      onCheckedChange={(checked) => setIsFullDay(checked === true)}
                      id="full-day"
                    />
                    <label htmlFor="full-day" className="text-sm font-medium text-foreground cursor-pointer">
                      יום מלא (כל 8 השעות)
                    </label>
                  </div>

                  {!isFullDay && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          מ-שעה
                        </label>
                        <Select value={rangeStart} onValueChange={setRangeStart}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground">
                          עד-שעה
                        </label>
                        <Select value={rangeEnd} onValueChange={setRangeEnd}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                              <SelectItem key={h} value={h.toString()}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">הגדרות איפוס</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isPermanentChange}
                    onCheckedChange={(checked) => {
                      setIsPermanentChange(checked === true);
                      if (checked) setShouldSetResetDate(false);
                    }}
                    id="permanent-change"
                  />
                  <label htmlFor="permanent-change" className="text-sm font-medium text-foreground cursor-pointer">
                    שינוי מערכת קבוע (השינויים יישארו לצמיתות)
                  </label>
                </div>

                {!isPermanentChange && (
                  <>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={shouldSetResetDate}
                        onCheckedChange={(checked) => setShouldSetResetDate(checked === true)}
                        id="set-reset-date"
                      />
                      <label htmlFor="set-reset-date" className="text-sm font-medium text-foreground cursor-pointer">
                        הגדר תאריך איפוס (המערכת תחזור אוטומטית למערכת בסיס אחרי תאריך זה)
                      </label>
                    </div>

                    {shouldSetResetDate && (
                      <div>
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
                            <Calendar
                              mode="single"
                              selected={resetDate}
                              onSelect={(date) => date && setResetDate(date)}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </>
                )}

                <Button
                  onClick={() => saveChangesMutation.mutate()}
                  disabled={
                    selectedStudents.length === 0 || 
                    (editMode === 'range' && (!rangeText || rangeDates.length === 0)) ||
                    saveChangesMutation.isPending
                  }
                  className="w-full gradient-primary"
                >
                  <Save className="ml-2 h-4 w-4" />
                  שמור שינויים
                </Button>
              </div>
            </Card>

            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">איפוס למערכת בסיס</h3>
              <p className="text-muted-foreground mb-6">
                מחיקת כל השינויים והחזרה למערכת הבסיס מהאקסל עבור התלמידים הנבחרים.
              </p>

              {selectedStudents.length > 0 && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground">
                    נבחרו {selectedStudents.length} תלמידים
                  </p>
                </div>
              )}

              <Button
                onClick={() => resetToBaseMutation.mutate()}
                disabled={selectedStudents.length === 0 || resetToBaseMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                איפוס למערכת בסיס
              </Button>
            </Card>
          </div>
        </main>

        <Footer />
      </div>
    );
  }