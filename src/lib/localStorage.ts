const STORAGE_KEY = 'orot_yavne_schedule';

interface StoredData {
  selectedGrade?: string;
  selectedClass?: string;
  selectedStudent?: string;
}

export function saveToLocalStorage(data: Partial<StoredData>) {
  const existing = getFromLocalStorage();
  const updated = { ...existing, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function getFromLocalStorage(): StoredData {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function clearLocalStorage() {
  localStorage.removeItem(STORAGE_KEY);
}