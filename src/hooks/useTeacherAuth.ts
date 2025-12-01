import { useEffect, useState, useCallback } from "react";
import { TEACHER_STORAGE_KEY, Teacher } from "@/lib/teachers";

export interface TeacherSession {
  name: string;
  idCode: string;
}

export function getStoredTeacher(): TeacherSession | null {
  const raw = sessionStorage.getItem(TEACHER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TeacherSession;
    if (parsed?.name && parsed?.idCode) {
      return parsed;
    }
  } catch {
    sessionStorage.removeItem(TEACHER_STORAGE_KEY);
  }

  return null;
}

export function persistTeacherSession(teacher: Teacher | TeacherSession) {
  const session: TeacherSession = {
    name: teacher.name,
    idCode: teacher.idCode,
  };

  sessionStorage.setItem(TEACHER_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearTeacherSession() {
  sessionStorage.removeItem(TEACHER_STORAGE_KEY);
}

export function useTeacherAuth() {
  const [teacher, setTeacher] = useState<TeacherSession | null>(() => getStoredTeacher());

  useEffect(() => {
    setTeacher(getStoredTeacher());
  }, []);

  const logout = useCallback(() => {
    clearTeacherSession();
    setTeacher(null);
  }, []);

  const refresh = useCallback(() => {
    setTeacher(getStoredTeacher());
  }, []);

  return {
    teacher,
    isAuthenticated: Boolean(teacher),
    logout,
    refresh,
  };
}

