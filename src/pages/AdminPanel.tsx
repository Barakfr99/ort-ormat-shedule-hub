import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Save, Calendar as CalendarIcon, Upload, Download, Pencil, Trash2 } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogAction } from '@/components/ui/alert-dialog';

import { useScheduleData } from '@/hooks/useScheduleData';
import { formatDate, formatDateForDB } from '@/lib/excelParser';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { normalizeIdCode } from '@/lib/teachers';

const DAY_OPTIONS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

type LessonContent = {
  subject: string;
  teacher: string;
  room: string;
};

type TeacherRow = Tables<'teachers'>;

const EMPTY_LESSON_CONTENT: LessonContent = {
  subject: '',
  teacher: '',
  room: '',
};

const PERMANENT_PASSWORD = import.meta.env.VITE_PERMANENT_CHANGE_PASSWORD || '';

function normalizeLessonContent(content?: LessonContent): LessonContent {
  if (!content) return { ...EMPTY_LESSON_CONTENT };
  return {
    subject: content.subject ?? '',
    teacher: content.teacher ?? '',
    room: content.room ?? '',
  };
}

function buildLessonText(content: LessonContent) {
  const trimmed = {
    subject: content.subject.trim(),
    teacher: content.teacher.trim(),
    room: content.room.trim(),
  };
  return `${trimmed.subject} / ${trimmed.teacher} / ${trimmed.room}`;
}

function hasValidLessonContent(content?: LessonContent) {
  return Boolean(content && content.subject.trim());
}

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
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [hourContents, setHourContents] = useState<Record<number, LessonContent>>({});
  const [rangeContent, setRangeContent] = useState<LessonContent>({ ...EMPTY_LESSON_CONTENT });
  const [rangeDates, setRangeDates] = useState<Date[]>([new Date()]);
  const [adminTab, setAdminTab] = useState<'specific' | 'permanent' | 'teachers'>('specific');
  const [permanentStudent, setPermanentStudent] = useState('');
  const [permanentDay, setPermanentDay] = useState<string>(DAY_OPTIONS[0]);
  const [permanentHour, setPermanentHour] = useState<number>(1);
  const [permanentSubject, setPermanentSubject] = useState('');
  const [permanentTeacher, setPermanentTeacher] = useState('');
  const [permanentRoom, setPermanentRoom] = useState('');
  const [permanentPassword, setPermanentPassword] = useState('');
  const [teacherForm, setTeacherForm] = useState<{
    id: string | null;
    name: string;
    idCode: string;
  }>({
    id: null,
    name: '',
    idCode: '',
  });
  const resetTeacherForm = () => setTeacherForm({ id: null, name: '', idCode: '' });
  const updateHourContent = (hour: number, field: keyof LessonContent, value: string) => {
    setHourContents(prev => ({
      ...prev,
      [hour]: {
        ...normalizeLessonContent(prev[hour]),
        [field]: value,
      }
    }));
  };
  const updateRangeContent = (field: keyof LessonContent, value: string) => {
    setRangeContent(prev => ({
      ...prev,
      [field]: value,
    }));
  };
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState({
    title: '',
    description: ''
  });

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
  const filteredStudents = selectedClass ? data?.students.filter(s => s.class === selectedClass).sort((a, b) => a.name.localeCompare(b.name, 'he')) : selectedGrade ? data?.students.filter(s => s.grade === selectedGrade).sort((a, b) => a.name.localeCompare(b.name, 'he')) : data?.students?.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];
  const allStudentsSorted = data?.students?.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')) || [];
  const permanentStudentOptions = filteredStudents.length > 0 ? filteredStudents : allStudentsSorted;
  const { data: teacherRows = [], isLoading: teachersLoading } = useQuery<TeacherRow[]>({
    queryKey: ['teachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('*').order('name', { ascending: true });
      if (error) {
        throw error;
      }
      return data ?? [];
    }
  });
  
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

      const updates = [];
      if (editMode === 'daily') {
        for (const studentName of selectedStudents) {
          for (const hour of HOUR_OPTIONS) {
            const content = normalizeLessonContent(hourContents[hour]);
            if (hasValidLessonContent(content)) {
              updates.push({
                student_id: studentName,
                date: formatDateForDB(editDate),
                hour_number: hour,
                override_text: buildLessonText(content)
              });
            }
          }
        }
      } else if (editMode === 'range') {
        if (!hasValidLessonContent(rangeContent)) {
          throw new Error('יש למלא לפחות מקצוע אחד לעדכון יום מלא');
        }
        const formattedRangeContent = buildLessonText(normalizeLessonContent(rangeContent));
        for (const studentName of selectedStudents) {
          for (const date of rangeDates) {
            for (const hour of HOUR_OPTIONS) {
              updates.push({
                student_id: studentName,
                date: formatDateForDB(date),
                hour_number: hour,
                override_text: formattedRangeContent
              });
            }
          }
        }
      }

      if (updates.length > 0) {
        const { error: overridesError } = await supabase.from('schedule_overrides').upsert(updates, {
          onConflict: 'student_id,date,hour_number'
        });
        if (overridesError) throw overridesError;
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
        queryKey: ['scheduleData']
      });
      setHourContents({});
      setRangeContent({ ...EMPTY_LESSON_CONTENT });
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
  const savePermanentChangeMutation = useMutation({
    mutationFn: async () => {
      if (!PERMANENT_PASSWORD) {
        throw new Error('לא הוגדרה סיסמה לשינויים קבועים (VITE_PERMANENT_CHANGE_PASSWORD)');
      }

      if (permanentPassword.trim() !== PERMANENT_PASSWORD) {
        throw new Error('סיסמה שגויה לשינויים קבועים');
      }

      if (!permanentStudent) {
        throw new Error('יש לבחור תלמיד/ה לשינוי קבוע');
      }

      if (!permanentSubject.trim()) {
        throw new Error('שם השיעור הוא שדה חובה');
      }

      const { error } = await supabase
        .from('permanent_schedule_changes')
        .upsert({
          student_id: permanentStudent,
          day_of_week: permanentDay,
          hour_number: permanentHour,
          subject: permanentSubject.trim(),
          teacher: permanentTeacher.trim(),
          room: permanentRoom.trim(),
        }, {
          onConflict: 'student_id,day_of_week,hour_number'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMessage({
        title: 'השינוי הקבוע נשמר',
        description: `המערכת של ${permanentStudent} עודכנה ביום ${permanentDay} שעה ${permanentHour}.`
      });
      setShowSuccessDialog(true);
      setPermanentSubject('');
      setPermanentTeacher('');
      setPermanentRoom('');
      setPermanentPassword('');
      queryClient.invalidateQueries({ queryKey: ['permanentChanges'] });
      queryClient.invalidateQueries({ queryKey: ['scheduleData'] });
    },
    onError: (error: Error) => {
      console.error('שגיאה בשינוי קבוע', error);
      setSuccessMessage({
        title: 'שגיאה בשינוי הקבוע',
        description: error.message || 'נסה שוב'
      });
      setShowSuccessDialog(true);
    }
  });
  const upsertTeacherMutation = useMutation({
    mutationFn: async () => {
      const name = teacherForm.name.trim();
      const idCodeRaw = teacherForm.idCode.trim();
      if (!name) {
        throw new Error('שם המורה הוא שדה חובה');
      }
      if (!idCodeRaw) {
        throw new Error('מספר תעודת זהות הוא שדה חובה');
      }
      const normalizedCode = normalizeIdCode(idCodeRaw);
      if (normalizedCode.length < 5) {
        throw new Error('מספר תעודת זהות קצר מדי');
      }

      const payload = {
        id: teacherForm.id ?? undefined,
        name,
        id_code: idCodeRaw,
        normalized_id_code: normalizedCode,
      };

      const { error } = await supabase
        .from('teachers')
        .upsert(payload, { onConflict: 'normalized_id_code' });

      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMessage({
        title: teacherForm.id ? 'פרטי המורה עודכנו' : 'מורה חדש נוסף',
        description: teacherForm.id
          ? 'הנתונים נשמרו בהצלחה.'
          : 'המורה הוסף למערכת בהצלחה.',
      });
      setShowSuccessDialog(true);
      resetTeacherForm();
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: Error) => {
      console.error('שגיאה בניהול מורים', error);
      setSuccessMessage({
        title: 'שגיאה בשמירת המורה',
        description: error.message || 'נסה שוב',
      });
      setShowSuccessDialog(true);
    },
  });
  
  const teacherSubmitLabel = teacherForm.id
    ? (upsertTeacherMutation.isPending ? 'מעדכן...' : 'עדכן מורה')
    : (upsertTeacherMutation.isPending ? 'שומר...' : 'הוסף מורה');

  const deleteTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.from('teachers').delete().eq('id', teacherId);
      if (error) throw error;
    },
    onSuccess: () => {
      setSuccessMessage({
        title: 'המורה הוסר',
        description: 'הרשומה נמחקה מהמערכת.',
      });
      setShowSuccessDialog(true);
      if (teacherForm.id) {
        resetTeacherForm();
      }
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error: Error) => {
      console.error('שגיאה במחיקת מורה', error);
      setSuccessMessage({
        title: 'שגיאה במחיקת מורה',
        description: error.message || 'נסה שוב',
      });
      setShowSuccessDialog(true);
    },
  });
  const handleEditTeacher = (teacher: TeacherRow) => {
    setTeacherForm({
      id: teacher.id,
      name: teacher.name,
      idCode: teacher.id_code,
    });
  };
  const handleDeleteTeacher = (teacherId: string) => {
    deleteTeacherMutation.mutate(teacherId);
  };

  const exportExcelMutation = useMutation({
    mutationFn: async () => {
      // Use direct fetch to get binary response properly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/export-updated-excel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error: ${response.status}`);
      }
      
      // Get the binary data as blob
      const blob = await response.blob();
      
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
        <div className="flex gap-4 mb-6 flex-wrap flex-row-reverse">
          <Button variant="outline" onClick={() => navigate('/upload-excel')}>
            <Upload className="mr-2 h-4 w-4" />
            העלאת קובץ אקסל
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => exportExcelMutation.mutate()}
            disabled={exportExcelMutation.isPending}
          >
            <Download className="mr-2 h-4 w-4" />
            {exportExcelMutation.isPending ? 'מייצא...' : 'ייצוא מערכת מעודכנת'}
          </Button>
          
          <Button variant="outline" onClick={() => {
            sessionStorage.removeItem('adminAuth');
            navigate('/');
          }}>
            <ArrowRight className="mr-2 h-4 w-4" />
            התנתק וחזור
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="p-6 card-elevated">
            <h3 className="text-xl font-bold mb-4 text-foreground text-right">סינון תלמידים</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-foreground text-right">שכבה</label>
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
                  <label className="block text-sm font-medium mb-2 text-foreground text-right">כיתה</label>
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
                    {filteredStudents.map(student => <div key={student.name} className="flex items-center gap-2 flex-row-reverse justify-end">
                        <label className="text-sm text-foreground cursor-pointer">
                          {student.name}
                        </label>
                        <Checkbox checked={selectedStudents.includes(student.name)} onCheckedChange={() => toggleStudent(student.name)} />
                      </div>)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    נבחרו {selectedStudents.length} תלמידים
                  </p>
                </div>}
            </Card>

            <Tabs value={adminTab} onValueChange={value => setAdminTab(value as 'specific' | 'permanent' | 'teachers')} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="teachers">ניהול מורים</TabsTrigger>
                <TabsTrigger value="permanent">שינויים קבועים</TabsTrigger>
                <TabsTrigger value="specific">שינויים לתאריכים ספציפיים</TabsTrigger>
              </TabsList>

              <TabsContent value="specific" className="space-y-6">
                <Card className="p-6 card-elevated" dir="rtl">
                  <h3 className="text-xl font-bold mb-4 text-foreground">בחר סוג עריכה</h3>
                  
                  <RadioGroup value={editMode} onValueChange={(value: 'daily' | 'range') => setEditMode(value)} className="space-y-2 text-right">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily" className="cursor-pointer">עריכת מערכת לפי יום</Label>
                    </div>
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <RadioGroupItem value="range" id="range" />
                      <Label htmlFor="range" className="cursor-pointer">עדכון יום מלא</Label>
                    </div>
                  </RadioGroup>
                </Card>

                {editMode === 'daily' && <Card className="p-6 card-elevated">
                    <h3 className="text-xl font-bold mb-4 text-foreground text-right">עריכת מערכת לפי יום</h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">תאריך לעריכה</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-end text-right flex-row-reverse">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formatDate(editDate)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={editDate} onSelect={date => date && setEditDate(date)} className="pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-4">
                      {HOUR_OPTIONS.map(hour => {
                        const content = normalizeLessonContent(hourContents[hour]);
                        return (
                          <div key={hour} className="space-y-2 border border-border rounded-lg p-3">
                            <p className="text-sm font-semibold text-foreground text-right">שעה {hour}</p>
                            <div className="flex flex-col sm:flex-row gap-2" dir="rtl">
                              <Input
                                value={content.subject}
                                onChange={e => updateHourContent(hour, 'subject', e.target.value)}
                                placeholder="שם המקצוע *"
                                className="text-right flex-1"
                              />
                              <Input
                                value={content.teacher}
                                onChange={e => updateHourContent(hour, 'teacher', e.target.value)}
                                placeholder="שם המורה"
                                className="text-right flex-1"
                              />
                              <Input
                                value={content.room}
                                onChange={e => updateHourContent(hour, 'room', e.target.value)}
                                placeholder="חדר"
                                className="text-right flex-1"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>}

                {editMode === 'range' && <Card className="p-6 card-elevated">
                    <h3 className="text-xl font-bold mb-4 text-foreground text-right">עדכון יום מלא</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground text-right">
                          תוכן אחיד לכל השעות
                        </label>
                        <div className="flex flex-col md:flex-row gap-2" dir="rtl">
                          <Input
                            value={rangeContent.subject}
                            onChange={e => updateRangeContent('subject', e.target.value)}
                            placeholder="שם המקצוע *"
                            className="text-right flex-1"
                          />
                          <Input
                            value={rangeContent.teacher}
                            onChange={e => updateRangeContent('teacher', e.target.value)}
                            placeholder="שם המורה"
                            className="text-right flex-1"
                          />
                          <Input
                            value={rangeContent.room}
                            onChange={e => updateRangeContent('room', e.target.value)}
                            placeholder="חדר"
                            className="text-right flex-1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-foreground text-right">תאריכים</label>
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
                        השינוי יחול על כל 8 השעות ביום ובמבנה מקצוע / מורה / חדר.
                      </p>
                    </div>
                  </Card>}

                <Card className="p-6 card-elevated space-y-4">
                  <div dir="rtl" className="text-right">
                    <h3 className="text-xl font-bold text-foreground">שמירת שינויים</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      השינויים יחולו רק על התאריכים שנבחרו ויישארו זמינים להיסטוריה.
                    </p>
                  </div>
                  <Button
                    onClick={() => saveChangesMutation.mutate()}
                    disabled={
                      selectedStudents.length === 0 ||
                      (editMode === 'range' && (!hasValidLessonContent(rangeContent) || rangeDates.length === 0)) ||
                      saveChangesMutation.isPending
                    }
                    className="w-full gradient-primary flex-row-reverse"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saveChangesMutation.isPending ? 'שומר...' : 'שמור שינויים'}
                  </Button>
                </Card>
              </TabsContent>

              <TabsContent value="permanent">
                <Card className="p-6 card-elevated space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground text-right">שינויים קבועים (מוגן בסיסמה)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      שינוי זה יחול על מערכת הבסיס של התלמיד/ה מן התאריך הנוכחי ואילך. ניתן להשאיר שם מורה או חדר ריק.
                    </p>
                    {!PERMANENT_PASSWORD && (
                      <p className="text-xs text-destructive mt-1">
                        ⚠️ יש להגדיר את המשתנה VITE_PERMANENT_CHANGE_PASSWORD כדי לאפשר שמירת שינויים קבועים.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">סיסמה</label>
                      <Input
                        type="password"
                        value={permanentPassword}
                        onChange={e => setPermanentPassword(e.target.value)}
                        placeholder="הזן סיסמת מנהל"
                        className="text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">בחר תלמיד/ה</label>
                      <Select
                        value={permanentStudent || undefined}
                        onValueChange={value => setPermanentStudent(value)}
                        disabled={permanentStudentOptions.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תלמיד/ה מהרשימה המסוננת" />
                        </SelectTrigger>
                        <SelectContent>
                          {permanentStudentOptions.map(student => (
                            <SelectItem key={student.name} value={student.name}>
                              {student.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">ניתן להשתמש במסנני השכבה/כיתה למעלה לצמצום הרשימה.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">יום בשבוע</label>
                      <Select value={permanentDay} onValueChange={value => setPermanentDay(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר יום" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAY_OPTIONS.map(day => (
                            <SelectItem key={day} value={day}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">שעה</label>
                      <Select value={String(permanentHour)} onValueChange={value => setPermanentHour(Number(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר שעה" />
                        </SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map(hour => (
                            <SelectItem key={hour} value={String(hour)}>
                              שעה {hour}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4" dir="rtl">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">שם השיעור *</label>
                      <Input
                        value={permanentSubject}
                        onChange={e => setPermanentSubject(e.target.value)}
                        placeholder="לדוגמה: מתמטיקה מתקדמת"
                        className="text-right"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">שם המורה (אופציונלי)</label>
                      <Input
                        value={permanentTeacher}
                        onChange={e => setPermanentTeacher(e.target.value)}
                        placeholder="לדוגמה: כהן אלון"
                        className="text-right"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">חדר (אופציונלי)</label>
                      <Input
                        value={permanentRoom}
                        onChange={e => setPermanentRoom(e.target.value)}
                        placeholder="לדוגמה: 305"
                        className="text-right"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => savePermanentChangeMutation.mutate()}
                    disabled={
                      !permanentStudent ||
                      !permanentSubject.trim() ||
                      permanentPassword.length === 0 ||
                      savePermanentChangeMutation.isPending
                    }
                    className="w-full gradient-primary"
                  >
                    {savePermanentChangeMutation.isPending ? 'שומר שינוי קבוע...' : 'שמור שינוי קבוע'}
                  </Button>
                </Card>
              </TabsContent>

              <TabsContent value="teachers" className="space-y-6">
                <Card className="p-6 card-elevated space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground text-right">
                      {teacherForm.id ? 'עריכת מורה' : 'הוספת מורה חדש'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 text-right" dir="rtl">
                      הנתונים משמשים להתחברות המורים ולסנכרון המערכת.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">מספר ת"ז *</label>
                      <Input
                        value={teacherForm.idCode}
                        onChange={e => setTeacherForm(prev => ({ ...prev, idCode: e.target.value }))}
                        placeholder="הקלד מספר מלא (ניתן להתחיל ב-0)"
                        className="text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-foreground text-right">שם המורה *</label>
                      <Input
                        value={teacherForm.name}
                        onChange={e => setTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="לדוגמה: כהן אלון"
                        className="text-right"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 flex-row-reverse">
                    <Button
                      onClick={() => upsertTeacherMutation.mutate()}
                      disabled={upsertTeacherMutation.isPending}
                      className="flex-1 sm:flex-none sm:w-auto gradient-primary"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {teacherSubmitLabel}
                    </Button>
                    {teacherForm.id && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetTeacherForm}
                        disabled={upsertTeacherMutation.isPending}
                      >
                        בטל עריכה
                      </Button>
                    )}
                  </div>
                </Card>

                <Card className="p-6 card-elevated">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground text-right">רשימת המורים</h3>
                      <p className="text-sm text-muted-foreground">
                        {teachersLoading ? 'טוען נתונים...' : `סה\"כ ${teacherRows.length} מורים`}
                      </p>
                    </div>
                  </div>

                  {teachersLoading ? (
                    <p className="text-center text-muted-foreground py-6">טוען נתונים...</p>
                  ) : teacherRows.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6">
                      לא קיימים מורים במערכת. הוסף מורה חדש באמצעות הטופס למעלה.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm" dir="rtl">
                        <thead>
                          <tr className="bg-muted/40">
                            <th className="p-2 text-right font-semibold">פעולות</th>
                            <th className="p-2 text-right font-semibold">מספר ת\"ז</th>
                            <th className="p-2 text-right font-semibold">שם המורה</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacherRows.map(teacher => (
                            <tr key={teacher.id} className="border-b border-border">
                              <td className="p-2 text-right">
                                <div className="flex items-center gap-2 flex-row-reverse justify-end">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleEditTeacher(teacher)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDeleteTeacher(teacher.id)}
                                    disabled={deleteTeacherMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                              <td className="p-2 text-right text-muted-foreground">{teacher.id_code}</td>
                              <td className="p-2 text-right">{teacher.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
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