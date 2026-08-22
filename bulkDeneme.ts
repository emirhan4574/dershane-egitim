import { callGeminiJsonFromImage } from './aiDeneme';
import {
  ClassGrade,
  ClassTrack,
  DenemeRank,
  DenemeSubjectScore,
  UserAccount,
  parseClassFromOptikLabel,
} from './types';

export type BulkListMeta = {
  examTitle: string;
  examType?: string;
  date: string;
  schoolName?: string;
  participation?: {
    school?: number;
    district?: number;
    province?: number;
    general?: number;
  };
};

export type BulkListRow = {
  studentName: string;
  classLabel?: string;
  classGrade?: ClassGrade;
  classSection?: string;
  classTrack?: ClassTrack;
  listRank?: number;
  net: number;
  score: number;
  generalRank?: number;
  subjects: DenemeSubjectScore[];
};

export type ParsedBulkList = {
  meta: BulkListMeta;
  rows: BulkListRow[];
};

export type MatchStatus = 'matched' | 'unmatched' | 'ambiguous';

export type MatchedBulkRow = {
  row: BulkListRow;
  status: MatchStatus;
  studentId?: string;
  studentFullName?: string;
  candidates?: { id: string; fullName: string; className?: string }[];
};

function parseTrNumber(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw * 1000) / 1000;
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
}

/** Türkçe isim karşılaştırma için normalize. */
export function normalizeName(name: string): string {
  return String(name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/[^a-zçğıöşü0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAverageRow(name: string): boolean {
  const n = normalizeName(name);
  return (
    n.includes('genel ortalama') ||
    n.includes('okul ortalam') ||
    n.includes('sinif ortalam') ||
    n.includes('sınıf ortalam') ||
    n === 'ortalama'
  );
}

function mapSubjects(raw: unknown): DenemeSubjectScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const r = item as Record<string, unknown>;
      const subject = String(r.subject || r.name || '').trim();
      if (!subject) return null;
      const correct = Math.round(parseTrNumber(r.correct ?? r.D ?? r.d) || 0);
      const wrong = Math.round(parseTrNumber(r.wrong ?? r.Y ?? r.y) || 0);
      const blank = Math.round(parseTrNumber(r.blank) || 0);
      const net = parseTrNumber(r.net ?? r.N ?? r.n);
      if (!Number.isFinite(net) && correct === 0 && wrong === 0) return null;
      return {
        subject,
        correct,
        wrong,
        blank,
        net: Number.isFinite(net) ? Math.round(net * 100) / 100 : Math.round((correct - wrong / 4) * 100) / 100,
      } as DenemeSubjectScore;
    })
    .filter((x): x is DenemeSubjectScore => !!x);
}

function softClassMatch(listClass: string | undefined, studentClass: string | undefined): boolean {
  if (!listClass || !studentClass) return false;
  const a = normalizeName(listClass).replace(/-/g, '');
  const b = normalizeName(studentClass).replace(/-/g, '');
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

const BULK_PROMPT = `Bu bir Türkçe okul deneme NET LİSTESİ veya OPTİK sonuç tablosu.
Tüm ÖĞRENCİ satırlarını oku. "Genel Ortalama", "Okul Ortalaması" satırlarını ATLA.
SADECE geçerli JSON döndür (markdown yok).

Şema:
{
  "examTitle": string,
  "examType": "TYT" | "AYT" | "",
  "date": "YYYY-MM-DD" veya "",
  "schoolName": string,
  "participation": { "school": number, "district": number, "province": number, "general": number },
  "students": [
    {
      "studentName": string,
      "classLabel": string,
      "grade": "mezun" | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | null,
      "section": "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "",
      "track": "sayisal" | "sozel" | "esit_agirlik" | "dil" | "ortaokul" | "",
      "listRank": number,
      "net": number,
      "score": number,
      "generalRank": number,
      "subjects": [
        { "subject": string, "correct": number, "wrong": number, "blank": number, "net": number }
      ]
    }
  ]
}

Kurallar:
- examTitle = Sınav Adı.
- net = Toplam N (toplam net).
- score = TYT/AYT Puan.
- classLabel = optikte/listede yazan sınıf metni (örn: 12-A Sayısal, Mezun-B).
- grade / section / track: optikte işaretlenen veya listede yazan sınıftan çıkar.
  grade: mezun veya 5-12. section: A-H. track: sayisal|sozel|esit_agirlik|dil|ortaokul.
- Öğrenci optikte sınıf/şube/bölüm işaretlediyse MUTLAKA oku; uydurma.
- Sayıları noktalı ondalık yaz.
- Görünen HER öğrenci satırını ekle; uydurma isim ekleme.`;

function coerceGrade(raw: unknown): ClassGrade | undefined {
  if (raw === 'mezun' || raw === 'Mezun') return 'mezun';
  const n = Number(raw);
  if ([5, 6, 7, 8, 9, 10, 11, 12].includes(n)) return n as ClassGrade;
  return undefined;
}

function coerceTrack(raw: unknown): ClassTrack | undefined {
  const t = String(raw || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, '_');
  if (t === 'sayisal' || t === 'sayısal') return 'sayisal';
  if (t === 'sozel' || t === 'sözel') return 'sozel';
  if (t === 'esit_agirlik' || t === 'eşit_ağırlık' || t.includes('esit') || t.includes('eşit'))
    return 'esit_agirlik';
  if (t === 'dil') return 'dil';
  if (t === 'ortaokul') return 'ortaokul';
  return undefined;
}

function coerceSection(raw: unknown): string | undefined {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  if (/^[A-H]$/.test(s)) return s;
  return undefined;
}

export async function parseBulkDenemeList(
  uri: string,
  opts?: { onProgress?: (msg: string) => void }
): Promise<ParsedBulkList> {
  const raw = (await callGeminiJsonFromImage(uri, BULK_PROMPT, {
    onProgress: opts?.onProgress,
    maxWidth: 2400,
  })) as Record<string, unknown>;

  const today = new Date().toISOString().slice(0, 10);
  const examTypeRaw = String(raw.examType || '').toUpperCase();
  const examType = examTypeRaw.includes('AYT')
    ? 'AYT'
    : examTypeRaw.includes('TYT') || /tyt/i.test(String(raw.examTitle || ''))
      ? 'TYT'
      : undefined;

  const participationRaw = (raw.participation || {}) as Record<string, unknown>;
  const studentsRaw = (Array.isArray(raw.students) ? raw.students : Array.isArray(raw.rows) ? raw.rows : []) as unknown[];

  const rows: BulkListRow[] = [];
  for (const item of studentsRaw) {
    const r = item as Record<string, unknown>;
    const studentName = String(r.studentName || r.name || r.isim || '').trim();
    if (!studentName || isAverageRow(studentName)) continue;
    const net = parseTrNumber(r.net);
    const score = parseTrNumber(r.score ?? r.puan);
    if (!Number.isFinite(net) && !Number.isFinite(score)) continue;
    const listRank = parseTrNumber(r.listRank ?? r.sira ?? r.rank);
    const generalRank = parseTrNumber(r.generalRank ?? r.genel);
    const classLabel = String(r.classLabel || r.className || r.sinif || '').trim() || undefined;
    const parsedLabel = parseClassFromOptikLabel(classLabel);
    const classGrade = coerceGrade(r.grade) ?? parsedLabel.grade;
    const classSection = coerceSection(r.section) ?? parsedLabel.section;
    const classTrack = coerceTrack(r.track) ?? parsedLabel.track;
    rows.push({
      studentName,
      classLabel,
      classGrade,
      classSection,
      classTrack,
      listRank: Number.isFinite(listRank) ? Math.round(listRank) : undefined,
      net: Number.isFinite(net) ? net : 0,
      score: Number.isFinite(score) ? score : 0,
      generalRank: Number.isFinite(generalRank) ? Math.round(generalRank) : undefined,
      subjects: mapSubjects(r.subjects),
    });
  }

  if (!rows.length) {
    throw new Error('Listeden öğrenci satırı okunamadı. Daha net bir görsel deneyin.');
  }

  return {
    meta: {
      examTitle: String(raw.examTitle || raw.title || '').trim() || 'Kurum Denemesi',
      examType,
      date: String(raw.date || '').slice(0, 10) || today,
      schoolName: String(raw.schoolName || '').trim() || undefined,
      participation: {
        school: Number.isFinite(parseTrNumber(participationRaw.school))
          ? Math.round(parseTrNumber(participationRaw.school))
          : undefined,
        district: Number.isFinite(parseTrNumber(participationRaw.district))
          ? Math.round(parseTrNumber(participationRaw.district))
          : undefined,
        province: Number.isFinite(parseTrNumber(participationRaw.province))
          ? Math.round(parseTrNumber(participationRaw.province))
          : undefined,
        general: Number.isFinite(parseTrNumber(participationRaw.general))
          ? Math.round(parseTrNumber(participationRaw.general))
          : undefined,
      },
    },
    rows,
  };
}

export function matchStudentsToRows(
  rows: BulkListRow[],
  students: UserAccount[]
): MatchedBulkRow[] {
  const pool = students.filter((s) => s.role === 'student');

  return rows.map((row) => {
    const key = normalizeName(row.studentName);
    const exact = pool.filter((s) => normalizeName(s.fullName) === key);

    let hits = exact;
    if (hits.length === 0) {
      // soyisim+isim kelime seti eşitliği
      hits = pool.filter((s) => {
        const a = new Set(normalizeName(s.fullName).split(' ').filter(Boolean));
        const b = new Set(key.split(' ').filter(Boolean));
        if (a.size < 2 || b.size < 2 || a.size !== b.size) return false;
        for (const w of a) if (!b.has(w)) return false;
        return true;
      });
    }

    if (hits.length > 1 && row.classLabel) {
      const byClass = hits.filter((s) => softClassMatch(row.classLabel, s.className));
      if (byClass.length === 1) hits = byClass;
    }

    if (hits.length === 1) {
      return {
        row,
        status: 'matched' as const,
        studentId: hits[0].id,
        studentFullName: hits[0].fullName,
      };
    }
    if (hits.length > 1) {
      return {
        row,
        status: 'ambiguous' as const,
        candidates: hits.map((h) => ({
          id: h.id,
          fullName: h.fullName,
          className: h.className,
        })),
      };
    }
    return { row, status: 'unmatched' as const };
  });
}

export function ranksFromBulkRow(row: BulkListRow, meta: BulkListMeta): DenemeRank[] {
  const ranks: DenemeRank[] = [];
  const p = meta.participation || {};
  if (row.listRank && p.school) {
    ranks.push({ scope: 'institution', label: 'Kurum', rank: row.listRank, total: p.school });
  }
  if (row.generalRank && p.general) {
    ranks.push({ scope: 'general', label: 'Genel', rank: row.generalRank, total: p.general });
  } else if (row.generalRank) {
    ranks.push({ scope: 'general', label: 'Genel', rank: row.generalRank, total: row.generalRank });
  }
  return ranks;
}
