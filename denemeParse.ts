import { ClassGrade, ClassTrack, DenemeRank, DenemeSubjectScore } from './types';

export type ParsedDeneme = {
  title: string;
  date: string;
  net: number;
  score: number;
  studentName?: string;
  examType?: string;
  averageScore?: number;
  ranks: DenemeRank[];
  subjects: DenemeSubjectScore[];
  note: string;
  confidence: 'high' | 'low' | 'none';
  classLabel?: string;
  classGrade?: ClassGrade;
  classSection?: string;
  classTrack?: ClassTrack;
};

function parseTrNumber(raw: string): number {
  const cleaned = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
}

const SUBJECT_PATTERNS: { label: string; match: RegExp }[] = [
  { label: 'Türkçe', match: /^(t[uü]rk[cç]e|turkce)\b/i },
  { label: 'Tarih-1', match: /^tarih[\s\-]*1?\b/i },
  { label: 'Coğrafya-1', match: /^(co[gğ]rafya|cografya)[\s\-]*1?\b/i },
  { label: 'Felsefe', match: /^felsefe(?!\s*\(se[cç])/i },
  { label: 'Din Kül. ve Ahl. Bil.', match: /^din\b/i },
  { label: 'Felsefe (Seçmeli)', match: /^felsefe\s*\(se[cç]/i },
  { label: 'TYT Sosyal', match: /^tyt\s*sosyal\b/i },
  { label: 'Matematik-1', match: /^matematik[\s\-]*1?\b/i },
  { label: 'Geometri', match: /^geometri\b/i },
  { label: 'TYT Matematik', match: /^tyt\s*matematik\b/i },
  { label: 'Fizik', match: /^fizik\b/i },
  { label: 'Kimya', match: /^kimya\b/i },
  { label: 'Biyoloji', match: /^biyoloji\b/i },
  { label: 'TYT Fen', match: /^tyt\s*fen\b/i },
  { label: 'Toplam', match: /^(toplam|total)\b/i },
];

function extractRowNumbers(line: string): number[] {
  const matches = line.match(/\d+(?:[.,]\d+)?/g) || [];
  return matches.map(parseTrNumber).filter((n) => Number.isFinite(n));
}

function findSubject(line: string) {
  const trimmed = line.trim();
  for (const s of SUBJECT_PATTERNS) {
    if (s.match.test(trimmed)) return s.label;
  }
  return null;
}

function parseRanks(text: string): DenemeRank[] {
  const ranks: DenemeRank[] = [];
  const specs: { scope: DenemeRank['scope']; label: string; re: RegExp }[] = [
    { scope: 'class', label: 'Sınıf', re: /(?:snf|s[iı]n[iı]f)\D{0,12}(\d{1,5})\D{0,16}(\d{1,6})/i },
    { scope: 'institution', label: 'Kurum', re: /kurum\D{0,12}(\d{1,5})\D{0,16}(\d{1,6})/i },
    { scope: 'district', label: 'İlçe', re: /il[cç]e\D{0,12}(\d{1,5})\D{0,16}(\d{1,6})/i },
    { scope: 'province', label: 'İl', re: /(?:^|[^\wçğıöşü])il\D{0,12}(\d{1,5})\D{0,16}(\d{1,6})/i },
    { scope: 'general', label: 'Genel', re: /genel(?!\s*ortalama)\D{0,12}(\d{1,6})\D{0,16}(\d{1,7})/i },
  ];

  // Alternatif: dereceler satırı "1 1 1 5 544" + katılımlar "33 33 33 124 14690"
  const degBlock = text.match(/derece[^\n]{0,80}/i);
  const katBlock = text.match(/kat[iı]l[iı]m[^\n]{0,80}/i);
  if (degBlock && katBlock) {
    const deg = extractRowNumbers(degBlock[0]);
    const kat = extractRowNumbers(katBlock[0]);
    const labels: { scope: DenemeRank['scope']; label: string }[] = [
      { scope: 'class', label: 'Sınıf' },
      { scope: 'institution', label: 'Kurum' },
      { scope: 'district', label: 'İlçe' },
      { scope: 'province', label: 'İl' },
      { scope: 'general', label: 'Genel' },
    ];
    if (deg.length >= 5 && kat.length >= 5) {
      return labels.map((l, i) => ({
        scope: l.scope,
        label: l.label,
        rank: Math.round(deg[i]),
        total: Math.round(kat[i]),
      }));
    }
  }

  for (const s of specs) {
    const m = text.match(s.re);
    if (!m) continue;
    const rank = Math.round(parseTrNumber(m[1]));
    const total = Math.round(parseTrNumber(m[2]));
    if (rank > 0 && total >= rank) {
      ranks.push({ scope: s.scope, label: s.label, rank, total });
    }
  }
  return ranks;
}

export function parseDenemeFromDocument(input: {
  fileName?: string;
  rawText?: string;
}): ParsedDeneme {
  const today = new Date().toISOString().slice(0, 10);
  const text = (input.rawText || '').replace(/\r/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const subjects: DenemeSubjectScore[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const label = findSubject(line);
    if (!label || seen.has(label)) continue;
    const nums = extractRowNumbers(line);
    if (nums.length < 4) continue;

    let soru = nums[0];
    let dogru = nums[1];
    let yanlis = nums[2];
    let net = nums[3];
    let successPercent: number | undefined;
    let classAvg: number | undefined;
    let institutionAvg: number | undefined;
    let generalAvg: number | undefined;

    if (dogru + yanlis > soru + 1 && nums.length >= 5) {
      soru = nums[1];
      dogru = nums[2];
      yanlis = nums[3];
      net = nums[4];
      if (nums.length >= 8) {
        successPercent = nums[5];
        classAvg = nums[6];
        institutionAvg = nums[7];
        generalAvg = nums[8];
      }
    } else if (nums.length >= 8) {
      successPercent = nums[4];
      classAvg = nums[5];
      institutionAvg = nums[6];
      generalAvg = nums[7];
    }

    const blank = Math.max(0, Math.round(soru - dogru - yanlis));
    subjects.push({
      subject: label,
      correct: Math.round(dogru),
      wrong: Math.round(yanlis),
      blank,
      net: Math.round(net * 100) / 100,
      successPercent,
      classAvg,
      institutionAvg,
      generalAvg,
    });
    seen.add(label);
  }

  let score = NaN;
  const joined = lines.join(' | ');
  const puanNear = joined.match(/puan[^0-9]{0,40}(\d{2,3}[.,]\d{1,3})/i);
  if (puanNear) score = parseTrNumber(puanNear[1]);
  if (!Number.isFinite(score)) {
    const candidates = (joined.match(/\b([1-4]\d{2}[.,]\d{2,3})\b/g) || [])
      .map(parseTrNumber)
      .filter((n) => n >= 100 && n <= 500);
    if (candidates.length) score = candidates[0];
  }

  let averageScore = NaN;
  const avgMatch = joined.match(/genel\s*ortalama[^0-9]{0,20}(\d{2,3}[.,]\d{1,3})/i);
  if (avgMatch) averageScore = parseTrNumber(avgMatch[1]);

  const totalRow = subjects.find((s) => s.subject === 'Toplam');
  let net = totalRow?.net ?? NaN;
  if (!Number.isFinite(net)) {
    const toplamLine = lines.find((l) => /^toplam\b/i.test(l));
    if (toplamLine) {
      const nums = extractRowNumbers(toplamLine);
      if (nums.length >= 4) net = nums[3];
    }
  }
  if (!Number.isFinite(net)) {
    const main = subjects.filter((s) =>
      ['Türkçe', 'TYT Sosyal', 'TYT Matematik', 'TYT Fen'].includes(s.subject)
    );
    if (main.length) net = Math.round(main.reduce((a, s) => a + s.net, 0) * 100) / 100;
  }

  const studentMatch = text.match(
    /[öo][gğ]renci\s*[:\-]?\s*([A-ZÇĞİÖŞÜa-zçğıöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğıöşü]+)+)/i
  );
  const examType = /\btyt\b/i.test(text) ? 'TYT' : /\bayt\b/i.test(text) ? 'AYT' : undefined;
  const ranks = parseRanks(text);

  const titleFromFile = (input.fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();

  const confidence: ParsedDeneme['confidence'] =
    subjects.length >= 4 && Number.isFinite(net) && Number.isFinite(score)
      ? 'high'
      : subjects.length > 0
        ? 'low'
        : 'none';

  return {
    title: examType ? `${examType} Denemesi` : titleFromFile || 'Kurum Denemesi',
    date: today,
    net: Number.isFinite(net) ? net : 0,
    score: Number.isFinite(score) ? score : 0,
    studentName: studentMatch?.[1]?.trim(),
    examType,
    averageScore: Number.isFinite(averageScore) ? averageScore : undefined,
    ranks,
    subjects,
    note:
      confidence === 'none'
        ? 'Belgeden ders satırları okunamadı. OCR metnini kontrol edin veya alanları elle girin.'
        : confidence === 'high'
          ? 'SONUÇ BELGESİ otomatik okundu'
          : 'Kısmen okundu — net/puanı kontrol edin',
    confidence,
  };
}
