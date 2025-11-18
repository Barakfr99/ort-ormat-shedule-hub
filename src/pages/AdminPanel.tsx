import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Users, Calendar as CalendarIcon } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [hourContents, setHourContents] = useState<{ [key: number]: string }>({});
  
  const [rangeText, setRangeText] = useState('');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('8');
  
  const [resetDate, setResetDate] = useState<Date>(new Date());

  useEffect(() => {
    const isAuth = sessionStorage.getItem('adminAuth');
    if (!isAuth) {
      navigate('/admin-login');
    }
  }, [navigate]);

  // Clear selected students when grade or class changes
  useEffect(() => {
    setSelectedStudents([]);
  }, [selectedGrade, selectedClass]);

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

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
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

      if (updates.length === 0) return;

      const { error } = await supabase
        .from('schedule_overrides')
        .upsert(updates, {
          onConflict: 'student_id,date,hour_number',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'המערכת עודכנה בהצלחה',
      });
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
      setHourContents({});
    },
    onError: () => {
      toast({
        title: 'שגיאה בעדכון המערכת',
        variant: 'destructive',
      });
    },
  });

  const applyRangeMutation = useMutation({
    mutationFn: async () => {
      const start = parseInt(rangeStart);
      const end = parseInt(rangeEnd);
      
      if (isNaN(start) || isNaN(end) || start < 1 || end > 8 || start > end) {
        throw new Error('טווח שעות לא תקין');
      }

      const updates = [];
      for (const studentName of selectedStudents) {
        for (let hour = start; hour <= end; hour++) {
          updates.push({
            student_id: studentName,
            date: formatDateForDB(editDate),
            hour_number: hour,
            override_text: rangeText,
          });
        }
      }

      const { error } = await supabase
        .from('schedule_overrides')
        .upsert(updates, {
          onConflict: 'student_id,date,hour_number',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'הטווח עודכן בהצלחה',
      });
      queryClient.invalidateQueries({ queryKey: ['overrides'] });
      setRangeText('');
    },
    onError: (error: Error) => {
      toast({
        title: error.message || 'שגיאה בעדכון הטווח',
        variant: 'destructive',
      });
    },
  });

  const setResetDateMutation = useMutation({
    mutationFn: async () => {
      const updates = selectedStudents.map((studentName) => ({
        student_id: studentName,
        reset_date: formatDateForDB(resetDate),
      }));

      const { error } = await supabase
        .from('reset_dates')
        .upsert(updates, {
          onConflict: 'student_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'תאריך האיפוס נקבע בהצלחה',
      });
      queryClient.invalidateQueries({ queryKey: ['resetDate'] });
    },
    onError: () => {
      toast({
        title: 'שגיאה בקביעת תאריך האיפוס',
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

        <Tabs defaultValue="edit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">
              <CalendarIcon className="ml-2 h-4 w-4" />
              עריכת מערכת
            </TabsTrigger>
            <TabsTrigger value="reset">
              <Users className="ml-2 h-4 w-4" />
              איפוס למערכת בסיס
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-6">
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-3 mb-4">
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

              <Button
                onClick={() => saveScheduleMutation.mutate()}
                disabled={selectedStudents.length === 0 || saveScheduleMutation.isPending}
                className="w-full gradient-primary"
              >
                <Save className="ml-2 h-4 w-4" />
                שמור שינויים
              </Button>
            </Card>

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

                <Button
                  onClick={() => applyRangeMutation.mutate()}
                  disabled={selectedStudents.length === 0 || !rangeText || applyRangeMutation.isPending}
                  className="w-full gradient-primary"
                >
                  החל על השעות
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="reset">
            <Card className="p-6 card-elevated">
              <h3 className="text-xl font-bold mb-4 text-foreground">איפוס למערכת בסיס</h3>
              <p className="text-muted-foreground mb-6">
                קבע תאריך איפוס. עד ליום זה (כולל) ישמרו השינויים שביצעת. מהיום שאחריו המערכת תחזור
                אוטומטית למערכת הבסיס מהאקסל.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2 text-foreground">תאריך איפוס</label>
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
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedStudents.length > 0 && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-foreground">
                    נבחרו {selectedStudents.length} תלמידים מהכיתה {selectedClass}
                  </p>
                </div>
              )}

              <Button
                onClick={() => setResetDateMutation.mutate()}
                disabled={selectedStudents.length === 0 || setResetDateMutation.isPending}
                className="w-full gradient-primary"
              >
                קבע תאריך איפוס
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}