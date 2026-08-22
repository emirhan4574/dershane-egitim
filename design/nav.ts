/** Ortak menü ikon eşlemesi (mobil + masaüstü kabuk) */
export const NAV_ICONS: Record<string, string> = {
  Home: 'home',
  Institutions: 'business',
  Classes: 'school',
  MyClasses: 'school',
  Teachers: 'people',
  Students: 'person',
  Chat: 'chatbubbles',
  Deneme: 'document-text',
  Homework: 'clipboard',
  Schedule: 'calendar',
  Attendance: 'clipboard',
  Profile: 'settings',
};

export function roleLabelText(
  role: string | undefined,
  isManager: boolean,
  isMuhasebe?: boolean
): string {
  if (role === 'superadmin') return 'Platform yönetimi';
  if (role === 'muhasebe') return 'Muhasebe';
  if (role === 'teacher') {
    if (isManager && isMuhasebe) return 'Yönetici · Muhasebe';
    if (isMuhasebe) return 'Öğretmen · Muhasebe';
    return isManager ? 'Yönetici öğretmen' : 'Öğretmen';
  }
  return 'Öğrenci';
}
