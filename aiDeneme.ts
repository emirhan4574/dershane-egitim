import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParsedDeneme } from './denemeParse';
import { ClassGrade, ClassTrack, DenemeRank, DenemeSubjectScore, parseClassFromOptikLabel } from './types';
import { isImageFile } from './ocr';

const STORAGE_KEY = 'gemini_api_key';
/**
 * Ücretsiz / düşük yoğunluk öncelikli model sırası.
 * 503 (yüksek talep) ve 429 için sıradaki modele + kısa bekleme uygulanır.
 */
const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
] as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number) {
  return status === 429 || status === 503 || status === 500;
}

type GeminiGenerateOpts = {
  body: Record<string, unknown>;
  onProgress?: (msg: string) => void;
  progressLabel?: string;
};

/** Model fallback + 503/429 için kısa retry */
async function callGeminiGenerate(opts: GeminiGenerateOpts): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API anahtarı yok. Aşağıya anahtarı yapıştırıp kaydedin (aistudio.google.com/apikey).'
    );
  }
  if (!apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.')) {
    // yine de dene; uyarı amaçlı değil, sadece geçersiz anahtarlarda erken net mesaj
  }

  let lastError = 'Gemini yanıt vermedi.';
  const label = opts.progressLabel || 'Yapay zeka okuyor';

  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    const model = MODELS[modelIndex];
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      opts.onProgress?.(
        attempt > 1
          ? `${label} (${model}, yeniden deneme ${attempt}/${maxAttempts})...`
          : `${label} (${model})...`
      );

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts.body),
        });
      } catch {
        lastError = 'İnternet / Gemini bağlantısı kurulamadı.';
        break;
      }

      const raw = await res.text().catch(() => '');

      if (!res.ok) {
        if (res.status === 400 || res.status === 403) {
          throw new Error(
            'Gemini anahtarı geçersiz veya yetkisiz. AI Studio’dan yeni anahtar alın (AIza… ile başlar).'
          );
        }
        if (res.status === 404) {
          lastError = `${model} bulunamadı, sıradaki model deneniyor...`;
          break;
        }
        if (isTransientStatus(res.status)) {
          const highDemand = /high demand|503|unavailable|overloaded/i.test(raw);
          lastError = highDemand
            ? `Gemini şu an yoğun (503). ${model} için bekleniyor...`
            : `${model} geçici kota/yoğunluk (${res.status}), bekleniyor...`;
          if (attempt < maxAttempts) {
            await sleep(1200 * attempt + Math.floor(Math.random() * 400));
            continue;
          }
          // bu modelde bitti → sonraki model
          break;
        }
        lastError = `Gemini hatası (${res.status}): ${raw.slice(0, 180) || res.statusText}`;
        break;
      }

      let json: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      try {
        json = JSON.parse(raw);
      } catch {
        lastError = 'Gemini yanıtı okunamadı.';
        break;
      }

      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('\n') || '';
      if (!text.trim()) {
        lastError = 'Gemini boş yanıt döndü.';
        if (attempt < maxAttempts) {
          await sleep(800 * attempt);
          continue;
        }
        break;
      }
      return text.trim();
    }
  }

  throw new Error(
    `${lastError} Gemini sunucusu geçici olarak yoğun olabilir. 20–30 sn sonra tekrar deneyin; olmazsa AI Studio’da yeni anahtar alın veya net/puanı elle girin.`
  );
}

export { isImageFile };

export async function getGeminiApiKey(): Promise<string> {
  const fromEnv = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
  if (fromEnv) return fromEnv;
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return (stored || '').trim();
}

export async function setGeminiApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, trimmed);
}

export async function hasGeminiApiKey(): Promise<boolean> {
  const key = await getGeminiApiKey();
  return key.length > 0;
}

async function uriToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Görsel dosyası okunamadı'));
    reader.readAsDataURL(blob);
  });
}

async function downscaleDataUrl(dataUrl: string, maxWidth = 1600): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function splitDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Görsel formatı desteklenmiyor');
  return { mime: m[1], base64: m[2] };
}

function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    // array root
    const aStart = cleaned.indexOf('[');
    const aEnd = cleaned.lastIndexOf(']');
    if (aStart >= 0 && aEnd > aStart) {
      return JSON.parse(cleaned.slice(aStart, aEnd + 1));
    }
    throw new Error('Yapay zeka geçerli JSON döndürmedi');
  }
}

/** Görsel + prompt → JSON (model fallback ile). */
export async function callGeminiJsonFromImage(
  uri: string,
  prompt: string,
  opts?: { onProgress?: (msg: string) => void; maxWidth?: number }
): Promise<unknown> {
  opts?.onProgress?.('Görsel hazırlanıyor...');
  const dataUrl = await downscaleDataUrl(await uriToDataUrl(uri), opts?.maxWidth ?? 1400);
  const { mime, base64 } = splitDataUrl(dataUrl);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mime, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  opts?.onProgress?.('Sonuçlar işleniyor...');
  const text = await callGeminiGenerate({
    body,
    onProgress: opts?.onProgress,
    progressLabel: 'Yapay zeka okuyor',
  });
  opts?.onProgress?.('Sonuçlar işleniyor...');
  return extractJsonObject(text);
}

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

function mapRanks(raw: unknown): DenemeRank[] {
  if (!Array.isArray(raw)) return [];
  const scopes: DenemeRank['scope'][] = ['class', 'institution', 'district', 'province', 'general'];
  const labels: Record<DenemeRank['scope'], string> = {
    class: 'Sınıf',
    institution: 'Kurum',
    district: 'İlçe',
    province: 'İl',
    general: 'Genel',
  };
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      let scope = String(row.scope || '').toLowerCase() as DenemeRank['scope'];
      if (!scopes.includes(scope)) {
        const label = String(row.label || '').toLowerCase();
        if (label.includes('sınıf') || label.includes('sinif')) scope = 'class';
        else if (label.includes('kurum')) scope = 'institution';
        else if (label.includes('ilçe') || label.includes('ilce')) scope = 'district';
        else if (label === 'il' || label.startsWith('il ')) scope = 'province';
        else if (label.includes('genel')) scope = 'general';
        else return null;
      }
      const rank = Math.round(parseTrNumber(row.rank));
      const total = Math.round(parseTrNumber(row.total));
      if (!(rank > 0) || !(total >= rank)) return null;
      return {
        scope,
        label: String(row.label || labels[scope]),
        rank,
        total,
      };
    })
    .filter((x): x is DenemeRank => !!x);
}

function mapSubjects(raw: unknown): DenemeSubjectScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const row = item as Record<string, unknown>;
      const subject = String(row.subject || '').trim();
      if (!subject) return null;
      const correct = Math.round(parseTrNumber(row.correct) || 0);
      const wrong = Math.round(parseTrNumber(row.wrong) || 0);
      const blank = Math.round(parseTrNumber(row.blank) || 0);
      const net = parseTrNumber(row.net);
      if (!Number.isFinite(net)) return null;
      const out: DenemeSubjectScore = {
        subject,
        correct,
        wrong,
        blank,
        net: Math.round(net * 100) / 100,
      };
      const successPercent = parseTrNumber(row.successPercent);
      const classAvg = parseTrNumber(row.classAvg);
      const institutionAvg = parseTrNumber(row.institutionAvg);
      const generalAvg = parseTrNumber(row.generalAvg);
      if (Number.isFinite(successPercent)) out.successPercent = successPercent;
      if (Number.isFinite(classAvg)) out.classAvg = classAvg;
      if (Number.isFinite(institutionAvg)) out.institutionAvg = institutionAvg;
      if (Number.isFinite(generalAvg)) out.generalAvg = generalAvg;
      return out;
    })
    .filter((x): x is DenemeSubjectScore => !!x);
}

function toParsedDeneme(data: Record<string, unknown>, fileName?: string): ParsedDeneme {
  const today = new Date().toISOString().slice(0, 10);
  const subjects = mapSubjects(data.subjects);
  const ranks = mapRanks(data.ranks);
  const net = parseTrNumber(data.net);
  const score = parseTrNumber(data.score);
  const averageScore = parseTrNumber(data.averageScore);
  const examTypeRaw = String(data.examType || '').toUpperCase();
  const examType = examTypeRaw.includes('AYT')
    ? 'AYT'
    : examTypeRaw.includes('TYT')
      ? 'TYT'
      : undefined;
  const titleFromFile = (fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const title =
    String(data.title || '').trim() ||
    (examType ? `${examType} Denemesi` : titleFromFile) ||
    'Kurum Denemesi';

  const confidence: ParsedDeneme['confidence'] =
    Number.isFinite(net) && Number.isFinite(score) && subjects.length >= 4
      ? 'high'
      : Number.isFinite(net) && Number.isFinite(score)
        ? 'low'
        : 'none';

  return {
    title,
    date: String(data.date || today).slice(0, 10) || today,
    net: Number.isFinite(net) ? net : 0,
    score: Number.isFinite(score) ? score : 0,
    studentName: String(data.studentName || '').trim() || undefined,
    examType,
    averageScore: Number.isFinite(averageScore) ? averageScore : undefined,
    ranks,
    subjects,
    note:
      confidence === 'high'
        ? 'Gemini ile otomatik okundu'
        : confidence === 'low'
          ? 'Gemini kısmen okudu — net/puanı kontrol edin'
          : 'Gemini net/puan bulamadı — elle girin',
    confidence,
    ...(() => {
      const classLabel =
        String(data.classLabel || data.className || data.sinif || '').trim() || undefined;
      const fromLabel = parseClassFromOptikLabel(classLabel);
      const gradeRaw = data.grade;
      let classGrade: ClassGrade | undefined = fromLabel.grade;
      if (gradeRaw === 'mezun') classGrade = 'mezun';
      else if ([5, 6, 7, 8, 9, 10, 11, 12].includes(Number(gradeRaw))) {
        classGrade = Number(gradeRaw) as ClassGrade;
      }
      const sec = String(data.section || '').trim().toUpperCase();
      const classSection = /^[A-H]$/.test(sec) ? sec : fromLabel.section;
      const trackRaw = String(data.track || '')
        .toLocaleLowerCase('tr')
        .replace(/\s+/g, '_');
      let classTrack: ClassTrack | undefined = fromLabel.track;
      if (trackRaw.includes('say')) classTrack = 'sayisal';
      else if (trackRaw.includes('soz') || trackRaw.includes('söz')) classTrack = 'sozel';
      else if (trackRaw.includes('esit') || trackRaw.includes('eşit')) classTrack = 'esit_agirlik';
      else if (trackRaw === 'dil') classTrack = 'dil';
      else if (trackRaw === 'ortaokul') classTrack = 'ortaokul';
      return { classLabel, classGrade, classSection, classTrack };
    })(),
  };
}

const PROMPT = `Bu bir Türkçe YKS/TYT/AYT SONUÇ BELGESİ veya OPTİK sonuç görseli.
Belgedeki tüm sayısal sonuçları ve optikte işaretlenen sınıf bilgisini oku.
SADECE geçerli JSON döndür (markdown yok, açıklama yok). Şema:
{
  "title": string,
  "date": "YYYY-MM-DD" veya boş,
  "studentName": string,
  "classLabel": string,
  "grade": "mezun" | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | null,
  "section": "A"|"B"|"C"|"D"|"E"|"F"|"G"|"H"| "",
  "track": "sayisal"|"sozel"|"esit_agirlik"|"dil"|"ortaokul"| "",
  "examType": "TYT" | "AYT" | "",
  "net": number,
  "score": number,
  "averageScore": number | null,
  "ranks": [{"scope":"class"|"institution"|"district"|"province"|"general","label":string,"rank":number,"total":number}],
  "subjects": [{"subject":string,"correct":number,"wrong":number,"blank":number,"net":number,"successPercent":number|null,"classAvg":number|null,"institutionAvg":number|null,"generalAvg":number|null}]
}
Kurallar:
- "net" = toplam net (Toplam satırı).
- "score" = öğrenci puanı (Puan alanı).
- grade/section/track: öğrencinin optikte işaretlediği sınıf-şube-bölüm. Mutlaka oku; uydurma.
- classLabel: optikte/listede görünen sınıf yazısı.
- Dereceler: Sınıf/Kurum/İlçe/İl/Genel sıra ve katılım.
- Ders satırlarını subjects içine yaz.
- Sayıları noktalı ondalık kullan.
- Okuyamadığın alanı null veya 0 yap; uydurma.`;

export async function parseDenemeWithAi(
  uri: string,
  opts?: { fileName?: string; onProgress?: (msg: string) => void }
): Promise<ParsedDeneme> {
  const parsed = (await callGeminiJsonFromImage(uri, PROMPT, {
    onProgress: opts?.onProgress,
    maxWidth: 1600,
  })) as Record<string, unknown>;
  return toParsedDeneme(parsed, opts?.fileName);
}

/** Filtrelenmiş sınıf deneme sonuçlarını metin olarak analiz eder. */
export async function analyzeDenemeGroupWithAi(input: {
  filterLabel: string;
  denemes: Array<{
    studentName: string;
    title: string;
    date: string;
    net: number;
    score: number;
    subjects?: { subject: string; net: number; correct: number; wrong: number; blank?: number }[];
  }>;
  onProgress?: (msg: string) => void;
}): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API anahtarı yok. Aşağıya anahtarı yapıştırıp kaydedin (aistudio.google.com/apikey).'
    );
  }
  if (!input.denemes.length) {
    throw new Error('Analiz için bu filtrede deneme sonucu yok.');
  }

  const compact = input.denemes.slice(0, 80).map((d) => ({
    ogrenci: d.studentName,
    deneme: d.title,
    tarih: d.date,
    net: d.net,
    puan: d.score,
    dersler: (d.subjects || []).slice(0, 12).map((s) => ({
      ders: s.subject,
      net: s.net,
      dogru: s.correct,
      yanlis: s.wrong,
    })),
  }));

  const prompt = [
    'Sen bir dershane akademik danışmanısın. Türkçe yanıt ver.',
    `Filtre: ${input.filterLabel}`,
    `Toplam sonuç sayısı: ${input.denemes.length}`,
    'Aşağıdaki deneme sonuçlarını analiz et:',
    '1) Genel net/puan özeti (ortalama, güçlü-zayıf öğrenci eğilimi)',
    '2) Ders bazlı güçlü ve zayıf alanlar',
    '3) Bu sınıf/şube/bölüm için somut çalışma önerileri (madde madde)',
    '4) Kısa aksiyon planı (1 haftalık)',
    'Abartma; veriden çıkaramadığını uydurma. Madde madde, net yaz.',
    'VERİ:',
    JSON.stringify(compact),
  ].join('\n');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.35 },
  };

  const text = await callGeminiGenerate({
    body,
    onProgress: input.onProgress,
    progressLabel: 'Analiz hazırlanıyor',
  });
  input.onProgress?.('Analiz tamamlandı.');
  return text;
}
