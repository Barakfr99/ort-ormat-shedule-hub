export interface Teacher {
  name: string;
  idCode: string;
}

export const TEACHERS: Teacher[] = [
  { name: "אלתר דנה", idCode: "36538213" },
  { name: "ארז עמירם", idCode: "56413776" },
  { name: "בוטרשווילי גבריאל", idCode: "14533434" },
  { name: "בינדר יפעת", idCode: "31922453" },
  { name: "בן דוד יוסי", idCode: "22182117" },
  { name: "בני משה יוסי", idCode: "22560569" },
  { name: "גבע צבי", idCode: "25383027" },
  { name: "דיאז עטאר אורלי", idCode: "43123496" },
  { name: "ורמיינקו אנה", idCode: "321789018" },
  { name: "חיון גבריאל", idCode: "36960441" },
  { name: "יצחק ואלרי", idCode: "212294433" },
  { name: "כהן אלון", idCode: "25623877" },
  { name: "כהן צפרירית", idCode: "32848517" },
  { name: "לוזיה ציון", idCode: "17937731" },
  { name: "לוי נחשון נעמה", idCode: "31397508" },
  { name: "ליכטמן ליאת", idCode: "33240961" },
  { name: "מדמון שלמה", idCode: "51301166" },
  { name: "מלוחה דניס", idCode: "319515383" },
  { name: "משי וולוביץ אסתר", idCode: "59202838" },
  { name: "סיני ירון", idCode: "37697414" },
  { name: "עטאר דורון", idCode: "33243940" },
  { name: "פרי שיר", idCode: "311354203" },
  { name: "פרידמן ברק", idCode: "26587501" },
  { name: "פרץ אדית", idCode: "27348036" },
  { name: "צברי רויטל", idCode: "22642730" },
  { name: "צדיק דורית", idCode: "58272840" },
  { name: "צנעני ליאור", idCode: "29039815" },
  { name: "קרויטורו נופר", idCode: "302922083" },
  { name: "קרופניק יקטרינה", idCode: "318053022" },
  { name: "קשרי אברהם", idCode: "34398149" },
  { name: "שטטר גל", idCode: "205858962" },
  { name: "שרעבי אוראל", idCode: "318501210" },
  { name: "שרעבי רויטל", idCode: "28429496" },
  { name: "תורגמן שמרית", idCode: "300070059" },
];

/**
 * Normalize teacher ID code by removing leading zeros and whitespace.
 */
export function normalizeIdCode(code: string): string {
  return code.trim().replace(/^0+/, '') || '0';
}

const teacherByCode = new Map(
  TEACHERS.map((teacher) => [normalizeIdCode(teacher.idCode), teacher])
);

/**
 * Normalize Hebrew names so comparison is resilient to spaces/punctuation.
 */
export function normalizeTeacherName(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

const teacherByNormalizedName = new Map(
  TEACHERS.map((teacher) => [normalizeTeacherName(teacher.name), teacher])
);

export function findTeacherByCode(code: string | null | undefined): Teacher | null {
  if (!code) {
    return null;
  }

  const normalizedCode = normalizeIdCode(code);
  return teacherByCode.get(normalizedCode) ?? null;
}

export function findTeacherByName(name: string | null | undefined): Teacher | null {
  if (!name) {
    return null;
  }

  return teacherByNormalizedName.get(normalizeTeacherName(name)) ?? null;
}

export const TEACHER_STORAGE_KEY = "teacherAuth";

