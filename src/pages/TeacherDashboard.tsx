import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  CalendarDays,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTeacherAuth } from "@/hooks/useTeacherAuth";
import { useScheduleData } from "@/hooks/useScheduleData";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateForDB } from "@/lib/excelParser";
import { normalizeTeacherName } from "@/lib/teachers";
import type { StudentSchedule } from "@/lib/excelParser";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

interface TeacherLessonStudent {
  name: string;
  class: string;
  grade: string;
}

interface TeacherLessonDetails {
  subject: string;
  room: string;
  students: TeacherLessonStudent[];
}

interface TeacherLessonSlot {
  hour: number;
  label: string;
  time: string;
  lesson: TeacherLessonDetails | null;
}

interface AttendanceEntry {
  studentName: string;
  studentClass: string;
  studentGrade: string;
  isPresent: boolean;
  isJustified: boolean;
}

interface AttendanceRecordRow {
  id: string;
  teacher_id: string;
  student_name: string;
  student_class: string;
  student_grade: string;
  date: string;
  hour_number: number;
  is_present: boolean;
  is_justified: boolean;
  created_at: string;
}

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const HOUR_TIMES = [
  { hour: 1, time: "08:45-09:15", label: "שעה 1" },
  { hour: 2, time: "09:15-10:00", label: "שעה 2" },
  { hour: 3, time: "10:20-11:05", label: "שעה 3" },
  { hour: 4, time: "11:05-11:50", label: "שעה 4" },
  { hour: 5, time: "12:05-12:50", label: "שעה 5" },
  { hour: 6, time: "12:50-13:30", label: "שעה 6" },
  { hour: 7, time: "14:00-14:45", label: "שעה 7" },
  { hour: 8, time: "14:45-15:30", label: "שעה 8" },
];

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { teacher, logout } = useTeacherAuth();
  const { data, loading } = useScheduleData();
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedSlot, setSelectedSlot] = useState<TeacherLessonSlot | null>(null);
  const [sortField, setSortField] = useState<"name" | "class">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceEntry>>({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [activeTab, setActiveTab] = useState<"schedule" | "attendance">("schedule");
  const [reportStudent, setReportStudent] = useState<string>("all");
  const [reportClass, setReportClass] = useState<string>("all");
  const [reportGrade, setReportGrade] = useState<string>("all");
  const [justificationFilter, setJustificationFilter] = useState<"all" | "justified" | "unjustified">("all");
  const [reportFromDate, setReportFromDate] = useState<Date>(() => {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return start;
  });
  const [reportToDate, setReportToDate] = useState<Date>(() => new Date());
  const { toast } = useToast();

  useEffect(() => {
    if (!teacher) {
      navigate("/teacher-login", { replace: true });
    }
  }, [teacher, navigate]);

  const formattedDbDate = useMemo(() => formatDateForDB(currentDate), [currentDate]);

  const normalizedTeacherName = useMemo(
    () => (teacher ? normalizeTeacherName(teacher.name) : ""),
    [teacher]
  );

  const teacherStudents = useMemo(() => {
    if (!teacher || !data || !normalizedTeacherName) return [];
    return data.students
      .filter((student) => studentHasTeacher(student, normalizedTeacherName))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [teacher, data, normalizedTeacherName]);

  const allStudentOptions = useMemo(() => {
    const base = teacherStudents.length > 0 ? teacherStudents : data?.students ?? [];
    return [...base].sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [teacherStudents, data?.students]);

  const classOptions = useMemo(() => {
    const unique = new Set(allStudentOptions.map((student) => student.class));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "he"));
  }, [allStudentOptions]);

  const gradeOptions = useMemo(() => {
    const unique = new Set(allStudentOptions.map((student) => student.grade));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "he"));
  }, [allStudentOptions]);

  const studentOptions = useMemo(() => {
    let filtered = [...allStudentOptions];
    if (reportClass !== "all") {
      filtered = filtered.filter((student) => student.class === reportClass);
    }
    if (reportGrade !== "all") {
      filtered = filtered.filter((student) => student.grade === reportGrade);
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [allStudentOptions, reportClass, reportGrade]);

  const { data: overrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ["teacherOverrides", formattedDbDate],
    enabled: Boolean(teacher),
    queryFn: async () => {
      const { data: response, error } = await supabase
        .from("schedule_overrides")
        .select("*")
        .eq("date", formattedDbDate);

      if (error) {
        throw error;
      }

      return response ?? [];
    },
  });

  const { data: resetDates = [], isLoading: resetLoading } = useQuery({
    queryKey: ["teacherResetDates"],
    enabled: Boolean(teacher),
    queryFn: async () => {
      const { data: response, error } = await supabase.from("reset_dates").select("*");
      if (error) {
        throw error;
      }
      return response ?? [];
    },
  });

  const schedule = useMemo<TeacherLessonSlot[]>(() => {
    if (!teacher || !data) {
      return HOUR_TIMES.map(({ hour, time, label }) => ({
        hour,
        time,
        label,
        lesson: null,
      }));
    }

    return buildTeacherSchedule({
      teacherName: teacher.name,
      students: data.students,
      dayName: DAY_NAMES[currentDate.getDay()],
      overrides,
      resetDates,
      currentDate,
    });
  }, [teacher, data, overrides, resetDates, currentDate]);

  const teacherIdentifier = teacher?.idCode || teacher?.name || "";

  const {
    data: attendanceReport = [],
    isLoading: attendanceReportLoading,
  } = useQuery<AttendanceRecordRow[]>({
    queryKey: [
      "attendanceReport",
      teacherIdentifier,
      reportStudent,
      reportClass,
      reportGrade,
      justificationFilter,
      reportFromDate.toISOString(),
      reportToDate.toISOString(),
    ],
    enabled: Boolean(teacherIdentifier) && activeTab === "attendance",
    queryFn: async () => {
      if (!teacherIdentifier) return [];

      let query = (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("teacher_id", teacherIdentifier);

      if (reportFromDate) {
        query = query.gte("date", formatDateForDB(reportFromDate));
      }

      if (reportToDate) {
        query = query.lte("date", formatDateForDB(reportToDate));
      }

      if (reportStudent !== "all") {
        query = query.eq("student_name", reportStudent);
      }

      if (reportClass !== "all") {
        query = query.eq("student_class", reportClass);
      }

      if (reportGrade !== "all") {
        query = query.eq("student_grade", reportGrade);
      }

      const { data, error } = await query
        .order("date", { ascending: false })
        .order("hour_number", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as unknown as AttendanceRecordRow[];
    },
  });

  const attendanceSummary = useMemo(() => {
    const totalLessonsCount = attendanceReport.length;
    const totalAbsences = attendanceReport.filter((record) => !record.is_present).length;
    const filteredAbsences =
      justificationFilter === "all"
        ? totalAbsences
        : attendanceReport.filter(
            (record) =>
              !record.is_present &&
              (justificationFilter === "justified" ? record.is_justified : !record.is_justified)
          ).length;
    const absencePercentage =
      totalLessonsCount === 0 ? 0 : Math.round((filteredAbsences / totalLessonsCount) * 100);

    return {
      totalLessons: totalLessonsCount,
      filteredAbsences,
      absencePercentage,
    };
  }, [attendanceReport, justificationFilter]);

  const filteredReportRows = useMemo(() => {
    if (justificationFilter === "all") {
      return attendanceReport;
    }

    return attendanceReport.filter((record) => {
      if (!record.is_present) {
        return justificationFilter === "justified" ? record.is_justified : !record.is_justified;
      }
      return false;
    });
  }, [attendanceReport, justificationFilter]);

  if (!teacher) {
    return null;
  }

  const dayName = DAY_NAMES[currentDate.getDay()];
  const isWeekend = currentDate.getDay() === 5 || currentDate.getDay() === 6;
  const isLoadingState = loading || overridesLoading || resetLoading;
  const activeLessons = schedule.filter((slot) => slot.lesson);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const changeDate = (days: number) => {
    const updated = new Date(currentDate);
    updated.setDate(updated.getDate() + days);
    setCurrentDate(updated);
  };

  const openStudentsDialog = (slot: TeacherLessonSlot) => {
    if (!slot.lesson) return;
    setSelectedSlot(slot);
  };

  const closeDialog = () => setSelectedSlot(null);
  const uniqueClasses = useMemo(() => {
    const entries = Object.values(attendanceState);
    const set = new Set(entries.map((entry) => entry.studentClass));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
  }, [attendanceState]);

  const filteredAndSortedStudents = useMemo(() => {
    const entries = Object.values(attendanceState);
    if (entries.length === 0) return [];

    let result = [...entries];

    if (selectedClasses.length > 0) {
      result = result.filter((student) => selectedClasses.includes(student.studentClass));
    }

    result.sort((a, b) => {
      if (sortField === "class") {
        const classComparison = a.studentClass.localeCompare(b.studentClass, "he");
        if (classComparison !== 0) {
          return sortDirection === "asc" ? classComparison : -classComparison;
        }
        const nameComparison = a.studentName.localeCompare(b.studentName, "he");
        return sortDirection === "asc" ? nameComparison : -nameComparison;
      }

      const nameComparison = a.studentName.localeCompare(b.studentName, "he");
      return sortDirection === "asc" ? nameComparison : -nameComparison;
    });

    return result;
  }, [attendanceState, selectedClasses, sortDirection, sortField]);

  const updateAttendanceEntry = (studentName: string, changes: Partial<AttendanceEntry>) => {
    setAttendanceState((prev) => {
      const current = prev[studentName];
      if (!current) return prev;
      return {
        ...prev,
        [studentName]: {
          ...current,
          ...changes,
        },
      };
    });
  };

  const setAllPresence = (isPresent: boolean) => {
    setAttendanceState((prev) => {
      const updatedEntries = Object.entries(prev).map(([name, entry]) => [
        name,
        {
          ...entry,
          isPresent,
          isJustified: isPresent ? false : entry.isJustified,
        },
      ]);
      return Object.fromEntries(updatedEntries);
    });
  };

  const handleSaveAttendance = async () => {
    if (!teacher || !selectedSlot?.lesson) return;
    const entries = Object.values(attendanceState);

    if (entries.length === 0) {
      toast({
        title: "אין נתונים לשמירה",
        description: "לא נמצאו תלמידים לשמירת נוכחות.",
      });
      return;
    }

    setSavingAttendance(true);
    try {
      const payload = entries.map((entry) => ({
        teacher_id: teacher.idCode || teacher.name,
        student_name: entry.studentName,
        student_class: entry.studentClass,
        student_grade: entry.studentGrade,
        date: formattedDbDate,
        hour_number: selectedSlot.hour,
        is_present: entry.isPresent,
        is_justified: entry.isJustified,
      }));

      const { error } = await (supabase as any)
        .from("attendance_records")
        .upsert(payload, {
          onConflict: "teacher_id,student_name,date,hour_number",
        });

      if (error) {
        throw error;
      }

      toast({
        title: "הנוכחות נשמרה",
        description: "הנתונים עודכנו בהצלחה.",
      });
    } catch (error) {
      console.error("Failed to save attendance", error);
      toast({
        title: "שגיאה בשמירת הנוכחות",
        description:
          error instanceof Error ? error.message : "אירעה שגיאה לא צפויה, נסה שוב.",
        variant: "destructive",
      });
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleResetReportFilters = () => {
    setReportStudent("all");
    setReportClass("all");
    setReportGrade("all");
    setJustificationFilter("all");
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    setReportFromDate(startOfDay(weekAgo));
    setReportToDate(startOfDay(today));
  };

  const handleFromDateChange = (date?: Date) => {
    if (!date) return;
    const normalized = startOfDay(date);
    if (normalized > reportToDate) {
      setReportToDate(normalized);
    }
    setReportFromDate(normalized);
  };

  const handleToDateChange = (date?: Date) => {
    if (!date) return;
    const normalized = startOfDay(date);
    if (normalized < reportFromDate) {
      setReportFromDate(normalized);
    }
    setReportToDate(normalized);
  };

  useEffect(() => {
    if (selectedSlot?.lesson) {
      const initialState: Record<string, AttendanceEntry> = {};
      selectedSlot.lesson.students.forEach((student) => {
        initialState[student.name] = {
          studentName: student.name,
          studentClass: student.class,
          studentGrade: student.grade,
          isPresent: true,
          isJustified: false,
        };
      });
      setAttendanceState(initialState);
      setSortField("name");
      setSortDirection("asc");
      setSelectedClasses([]);
    } else {
      setAttendanceState({});
    }
  }, [selectedSlot?.hour, selectedSlot?.lesson]);

  useEffect(() => {
    if (selectedClasses.length > 0) {
      if (sortField !== "name") {
        setSortField("name");
      }
      if (sortDirection !== "asc") {
        setSortDirection("asc");
      }
    }
  }, [selectedClasses, sortField, sortDirection]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header title="מערכת שעות למורים" />
      <main className="flex-1 container mx-auto px-2 sm:px-4 py-4 max-w-5xl">
        <div className="flex flex-wrap gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowRight className="ml-2 h-4 w-4" />
            חזרה לעמוד הראשי
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="ml-2 h-4 w-4" />
            התנתק/י
          </Button>
        </div>

        <Card className="p-4 sm:p-6 card-elevated mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">מחובר/ת כמורה</p>
              <h2 className="text-2xl font-bold text-foreground">{teacher.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                {activeLessons.reduce((total, slot) => total + (slot.lesson?.students.length ?? 0), 0)}{" "}
                תלמידים ביום הנוכחי
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 w-full">
              <Button variant="secondary" size="sm" onClick={() => changeDate(-1)}>
                <ChevronRight className="h-4 w-4" />
                אתמול
              </Button>

              <div className="flex-1 text-center min-w-[140px]">
                <p className="text-lg font-bold text-primary">{dayName}</p>
                <p className="text-sm text-muted-foreground">{formatDate(currentDate)}</p>
              </div>

              <Button variant="secondary" size="sm" onClick={() => changeDate(1)}>
                מחר
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "schedule" | "attendance")}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="attendance">נוכחות</TabsTrigger>
            <TabsTrigger value="schedule">מערכת יומית</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            {isLoadingState ? (
              <Card className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">טוען נתונים...</p>
              </Card>
            ) : isWeekend ? (
              <Card className="p-8 text-center space-y-2">
                <CalendarDays className="h-10 w-10 text-primary mx-auto" />
                <p className="text-lg text-muted-foreground">אין לימודים בסוף השבוע.</p>
              </Card>
            ) : activeLessons.length === 0 ? (
              <Card className="p-8 text-center space-y-2">
                <p className="text-lg text-muted-foreground">אין שיעורים משובצים ליום זה.</p>
                <p className="text-sm text-muted-foreground">
                  אם צפית בשינויים לאחרונה, נסה/י לרענן את העמוד או לבדוק תאריך אחר.
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden card-elevated">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/40">
                        <th className="p-2 text-right font-bold text-foreground">פרטי השיעור</th>
                        <th className="p-2 text-center font-bold text-foreground w-20">שעה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((slot) => (
                        <tr
                          key={slot.hour}
                          className={`border-b border-border align-middle ${
                            slot.lesson ? "cursor-pointer hover:bg-muted/30" : ""
                          }`}
                          onClick={() => slot.lesson && openStudentsDialog(slot)}
                        >
                          <td className="p-3 text-right align-middle">
                            {slot.lesson ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-foreground">{slot.lesson.subject}</p>
                                {slot.lesson.room && (
                                  <p className="text-sm text-primary">חדר: {slot.lesson.room}</p>
                                )}
                                <p className="text-sm text-muted-foreground flex items-center justify-end gap-1 text-right">
                                  <Users className="h-4 w-4" />
                                  {slot.lesson.students.length} תלמידים משובצים
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  לחיצה על השעה תציג את רשימת התלמידים המלאה.
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground italic text-center">אין שיעור</p>
                            )}
                          </td>
                          <td className="p-2 text-center align-middle bg-muted/50">
                            <div className="font-bold text-foreground">{slot.hour}</div>
                            <div className="text-xs text-muted-foreground">{slot.time}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="p-4 sm:p-6 card-elevated space-y-6 text-right">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground">דוח נוכחות</h3>
                  <p className="text-sm text-muted-foreground">
                    בחר תלמיד, כיתה, שכבה וטווח תאריכים לצפייה בסטטיסטיקות החיסורים.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleResetReportFilters}>
                  נקה פילטרים
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">תלמיד/ה</p>
                  <Select
                    value={reportStudent}
                    onValueChange={(value) => setReportStudent(value)}
                    disabled={studentOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          studentOptions.length === 0 ? "אין תלמידים זמינים" : "בחר תלמיד או הצג את כולם"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל התלמידים</SelectItem>
                      {studentOptions.map((student) => (
                        <SelectItem key={student.name} value={student.name}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">כיתה</p>
                  <Select
                    value={reportClass}
                    onValueChange={(value) => {
                      setReportClass(value);
                      setReportStudent("all");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר כיתה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל הכיתות</SelectItem>
                      {classOptions.map((className) => (
                        <SelectItem key={className} value={className}>
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">שכבה</p>
                  <Select
                    value={reportGrade}
                    onValueChange={(value) => {
                      setReportGrade(value);
                      setReportStudent("all");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר שכבה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל השכבות</SelectItem>
                      {gradeOptions.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">סוג חיסור</p>
                  <Select
                    value={justificationFilter}
                    onValueChange={(value) => setJustificationFilter(value as "all" | "justified" | "unjustified")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר פילטר" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">כל השיעורים</SelectItem>
                      <SelectItem value="justified">חיסורים מוצדקים בלבד</SelectItem>
                      <SelectItem value="unjustified">חיסורים לא מוצדקים בלבד</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">עד תאריך</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-right">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {formatDate(reportToDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportToDate}
                        onSelect={handleToDateChange}
                        disabled={(date) => date < reportFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2 text-foreground">מתאריך</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-right">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {formatDate(reportFromDate)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reportFromDate}
                        onSelect={handleFromDateChange}
                        disabled={(date) => date > reportToDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-4 bg-muted/50 border border-border text-right">
                  <p className="text-sm text-muted-foreground">אחוז חיסורים</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {attendanceSummary.absencePercentage}%
                  </p>
                </Card>
                <Card className="p-4 bg-muted/50 border border-border text-right">
                  <p className="text-sm text-muted-foreground">חיסורים בטווח הנבחר</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {attendanceSummary.filteredAbsences}
                  </p>
                </Card>
                <Card className="p-4 bg-muted/50 border border-border text-right">
                  <p className="text-sm text-muted-foreground">שיעורים שהתקיימו</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {attendanceSummary.totalLessons}
                  </p>
                </Card>
              </div>

              {attendanceReportLoading ? (
                <Card className="p-8 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">טוען דוח נוכחות...</p>
                </Card>
              ) : filteredReportRows.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  לא נמצאו רשומות נוכחות התואמות לפילטרים שנבחרו.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="p-2 text-right font-semibold">תאריך</th>
                        <th className="p-2 text-right font-semibold w-24">שעה</th>
                        <th className="p-2 text-right font-semibold">תלמיד/ה</th>
                        <th className="p-2 text-right font-semibold">כיתה</th>
                        <th className="p-2 text-center font-semibold">סטטוס</th>
                        <th className="p-2 text-center font-semibold">מוצדק</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReportRows.map((record) => (
                        <tr
                          key={`${record.student_name}-${record.date}-${record.hour_number}`}
                          className="border-b border-border"
                        >
                          <td className="p-2 text-right">{formatDate(new Date(record.date))}</td>
                          <td className="p-2 text-right text-muted-foreground">שעה {record.hour_number}</td>
                          <td className="p-2 text-right">{record.student_name}</td>
                          <td className="p-2 text-right text-muted-foreground">{record.student_class}</td>
                          <td className="p-2 text-center">
                            <span
                              className={`font-semibold ${
                                record.is_present ? "text-emerald-600" : "text-red-500"
                              }`}
                            >
                              {record.is_present ? "נוכח" : "לא נוכח"}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {!record.is_present ? (record.is_justified ? "מוצדק" : "לא מוצדק") : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />

      <Dialog open={Boolean(selectedSlot)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          {selectedSlot && selectedSlot.lesson && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {selectedSlot.lesson.subject} – שעה {selectedSlot.hour}
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground mb-4">
                תאריך: {formatDate(currentDate)} | חדר:{" "}
                {selectedSlot.lesson.room ? selectedSlot.lesson.room : "ללא שיבוץ חדר"}
              </p>
              <div className="space-y-4 mb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">מיון ראשי</p>
                    <Select value={sortField} onValueChange={(value) => setSortField(value as "name" | "class")}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר שדה" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">שם</SelectItem>
                        <SelectItem value="class">כיתה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">כיוון מיון</p>
                    <Select
                      value={sortDirection}
                      onValueChange={(value) => setSortDirection(value as "asc" | "desc")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="בחר כיוון" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc">עולה</SelectItem>
                        <SelectItem value="desc">יורד</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">סינון לפי כיתה</p>
                    {selectedClasses.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClasses([])}
                        className="text-xs"
                      >
                        נקה סינון
                      </Button>
                    )}
                  </div>
                  {uniqueClasses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">אין כיתות נוספות לסינון.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 max-h-32 overflow-y-auto pr-1">
                      {uniqueClasses.map((className) => (
                        <label
                          key={className}
                          className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedClasses.includes(className)}
                            onCheckedChange={(checked) => {
                              setSelectedClasses((prev) =>
                                checked === true
                                  ? [...prev, className]
                                  : prev.filter((item) => item !== className)
                              );
                            }}
                          />
                          {className}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {filteredAndSortedStudents.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button variant="secondary" size="sm" onClick={() => setAllPresence(true)}>
                    סמן את כולם כנוכחים
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAllPresence(false)}>
                    סמן את כולם כלא נוכחים
                  </Button>
                </div>
              )}

              {filteredAndSortedStudents.length === 0 ? (
                <p className="text-center text-muted-foreground">אין תלמידים משובצים לשיעור זה.</p>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="p-2 text-right font-semibold">שם התלמיד/ה</th>
                          <th className="p-2 text-right font-semibold">כיתה</th>
                          <th className="p-2 text-center font-semibold w-40">סטטוס</th>
                          <th className="p-2 text-center font-semibold w-32">מוצדק</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedStudents.map((student) => (
                          <tr
                            key={`${student.studentName}-${student.studentClass}`}
                            className="border-b border-border"
                          >
                            <td className="p-2">{student.studentName}</td>
                            <td className="p-2 text-muted-foreground">{student.studentClass}</td>
                            <td className="p-2">
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "h-7 px-3 rounded-full text-xs font-semibold border-2",
                                    student.isPresent
                                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500"
                                      : "bg-red-500/10 text-red-700 border-red-500"
                                  )}
                                  onClick={() =>
                                    updateAttendanceEntry(student.studentName, {
                                      isPresent: !student.isPresent,
                                      isJustified: student.isPresent ? student.isJustified : false,
                                    })
                                  }
                                >
                                  {student.isPresent ? "נוכח" : "לא נוכח"}
                                </Button>
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <Checkbox
                                disabled={student.isPresent}
                                checked={student.isJustified}
                                onCheckedChange={(checked) =>
                                  updateAttendanceEntry(student.studentName, {
                                    isJustified: checked === true,
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    onClick={handleSaveAttendance}
                    disabled={savingAttendance}
                    className="w-full gradient-primary mt-4"
                  >
                    {savingAttendance ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        שומר נוכחות...
                      </>
                    ) : (
                      "שמור נוכחות"
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function parseLesson(content: string) {
  if (!content || content.trim() === "") {
    return null;
  }

  const parts = content.split("/").map((part) => part.trim());
  return {
    subject: parts[0] || "",
    teacher: parts[1] || "",
    room: parts[2] || "",
  };
}

function studentHasTeacher(student: StudentSchedule, normalizedTeacherName: string) {
  const dayKeys = Object.keys(student.schedule);
  for (const day of dayKeys) {
    const hours = student.schedule[day];
    for (const hourKey of Object.keys(hours)) {
      const parsed = parseLesson(hours[hourKey]);
      if (!parsed) continue;
      if (normalizeTeacherName(parsed.teacher) === normalizedTeacherName) {
        return true;
      }
    }
  }
  return false;
}

function buildTeacherSchedule({
  teacherName,
  students,
  dayName,
  overrides,
  resetDates,
  currentDate,
}: {
  teacherName: string;
  students: StudentSchedule[];
  dayName: string;
  overrides: Array<{ student_id: string; hour_number: number; override_text: string }>;
  resetDates: Array<{ student_id: string; reset_date: string }>;
  currentDate: Date;
}): TeacherLessonSlot[] {
  const normalizedTeacherName = normalizeTeacherName(teacherName);
  const resetsMap = new Map(resetDates.map((entry) => [entry.student_id, startOfDay(entry.reset_date)]));
  const overridesMap = new Map(
    overrides.map((entry) => [`${entry.student_id}-${entry.hour_number}`, entry.override_text])
  );

  const lessonsMap = new Map<number, TeacherLessonDetails>();
  const currentDay = startOfDay(currentDate);

  for (const student of students) {
    const dailySchedule = student.schedule[dayName];
    if (!dailySchedule) continue;

    const resetDate = resetsMap.get(student.name);

    for (const { hour } of HOUR_TIMES) {
      const hourKey = hour.toString();
      const baseContent = dailySchedule[hourKey] || "";
      const overrideKey = `${student.name}-${hour}`;
      const hasOverride = overridesMap.has(overrideKey);
      const overrideContent = hasOverride ? overridesMap.get(overrideKey) ?? "" : undefined;
      const effectiveContent = getEffectiveContent({
        baseContent,
        overrideContent,
        resetDate,
        currentDay,
      });

      if (!effectiveContent || effectiveContent.trim() === "") continue;

      const parsedLesson = parseLesson(effectiveContent);
      if (!parsedLesson) continue;

      if (normalizeTeacherName(parsedLesson.teacher) !== normalizedTeacherName) {
        continue;
      }

      const existing = lessonsMap.get(hour);
      const studentsList: TeacherLessonStudent[] = existing?.students ?? [];
      studentsList.push({
        name: student.name,
        class: student.class,
        grade: student.grade,
      });

      lessonsMap.set(hour, {
        subject: existing?.subject || parsedLesson.subject,
        room: existing?.room || parsedLesson.room,
        students: studentsList.sort((a, b) => a.name.localeCompare(b.name, "he")),
      });
    }
  }

  return HOUR_TIMES.map(({ hour, time, label }) => ({
    hour,
    time,
    label,
    lesson: lessonsMap.get(hour) ?? null,
  }));
}

function getEffectiveContent({
  baseContent,
  overrideContent,
  resetDate,
  currentDay,
}: {
  baseContent: string;
  overrideContent: string | undefined;
  resetDate: Date | undefined;
  currentDay: Date;
}) {
  if (resetDate && currentDay > resetDate) {
    return baseContent;
  }

  if (overrideContent !== undefined) {
    return overrideContent;
  }

  return baseContent;
}

function startOfDay(date: Date | string) {
  const parsedDate = new Date(date);
  parsedDate.setHours(0, 0, 0, 0);
  return parsedDate;
}

