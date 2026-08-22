import { AppDatabase, UserAccount } from './types';
import { uid } from './db';

/** TYT net listesindeki isimler (deneme eşleşmesi için) */
export const UZEL_LIST_STUDENT_NAMES = [
  'Bora Çolak',
  'Elif Nisa Yapıcı',
  'Büşra Bayram',
  'Melda Karaelek',
  'Özlem Tuncer',
  'Efecan Turhan',
  'Necati Yılmaz',
  'Yasir Karakuş',
  'Muhammed Aydemir',
  'Tuğba Doğan',
  'Umay Deniz',
  'Oğuz Altunöz',
  'Zeynep Eda Becerik',
  'Enes Korkmaz',
  'Elif Nazcan',
  'Yiğit Bağcacı',
  'Enes Ege Yörük',
  'Rana Daz',
  'Süleyman Öçal',
  'Belinay Akgün',
  'Kader Özdemir',
  'Ege Özer',
  'Arife Nur Aktaş',
  'Sevim Birge',
  'Ayşenur Sungur',
  'Nisan Zengin',
  'Ece Özer',
  'Meryem Uslu',
  'Nisa Nur Yetişen',
] as const;

/** 15’e tamamlamak için ek sahte isimler */
const PAD_NAMES = [
  'Ahmet Yıldız',
  'Ayşe Demir',
  'Mehmet Kaya',
  'Fatma Şahin',
  'Ali Çelik',
  'Zeynep Arslan',
  'Mustafa Aydın',
  'Emine Koç',
  'Hüseyin Kurt',
  'Hatice Özkan',
  'İbrahim Yavuz',
  'Elif Doğan',
  'Hasan Polat',
  'Merve Aksoy',
  'Can Öztürk',
  'Selin Erdoğan',
  'Burak Şimşek',
  'Deniz Acar',
  'Cemre Güneş',
  'Onur Bulut',
  'İrem Kara',
  'Kerem Taş',
  'Derya Çetin',
  'Baran Tekin',
  'Sude Avcı',
  'Emir Yalçın',
  'Gizem Bozkurt',
  'Furkan Aslan',
  'İlayda Koçak',
  'Berkay Mutlu',
];

function isUzelInstitution(name: string, code: string) {
  const n = `${name} ${code}`.toLocaleLowerCase('tr');
  return n.includes('uzel') || n.includes('üzel');
}

function makeTc(used: Set<string>, seed: number) {
  let n = 10000000000 + (seed % 89999999999);
  for (let i = 0; i < 10000; i++) {
    const tc = String(n).padStart(11, '0').slice(0, 11);
    if (/^\d{11}$/.test(tc) && !used.has(tc)) {
      used.add(tc);
      return tc;
    }
    n += 17;
  }
  const fallback = String(90000000000 + used.size).slice(0, 11);
  used.add(fallback);
  return fallback;
}

function makePhone(i: number) {
  return `05${String(300000000 + (i % 699999999)).slice(0, 9)}`;
}

/**
 * dershane uzel (veya ad/kodunda uzel geçen) kurumda
 * her sınıfa en az 15 öğrenci — önce liste isimleri, sonra pad.
 */
export function ensureUzelClassStudents(db: AppDatabase, perClass = 15): AppDatabase {
  const inst = (db.institutions || []).find((i) => isUzelInstitution(i.name, i.code));
  if (!inst) return db;

  const classList = (db.classes || []).filter((c) => c.institutionId === inst.id);
  if (!classList.length) return db;

  const usedTc = new Set(
    db.users
      .filter((u) => u.institutionId === inst.id)
      .map((u) => u.loginId)
  );

  const namePool = [...UZEL_LIST_STUDENT_NAMES, ...PAD_NAMES];
  let nameIdx = 0;
  let phoneIdx = 1;
  let tcSeed = 11111111101;
  const now = new Date().toISOString();
  const added: UserAccount[] = [];

  // Liste isimlerinin tamamı en az bir sınıfta olsun (deneme eşleşmesi)
  // Önce sınıflara round-robin dağıt, sonra 15’e tamamla.
  const planned: { classId: string; className: string; names: string[] }[] = classList.map(
    (c) => ({ classId: c.id, className: c.name, names: [] })
  );

  // Mevcut öğrencileri say
  const existingByClass = new Map<string, number>();
  for (const c of classList) {
    existingByClass.set(
      c.id,
      db.users.filter(
        (u) => u.role === 'student' && u.institutionId === inst.id && u.classId === c.id
      ).length
    );
  }

  // Liste isimlerini round-robin
  let ri = 0;
  for (const fullName of UZEL_LIST_STUDENT_NAMES) {
    if (!planned.length) break;
    planned[ri % planned.length].names.push(fullName);
    ri++;
  }

  // Her sınıfı 15’e tamamla
  for (const p of planned) {
    const existing = existingByClass.get(p.classId) || 0;
    const need = Math.max(0, perClass - existing);
    let guard = 0;
    while (p.names.length < need && guard < 500) {
      guard++;
      const nm = namePool[nameIdx % namePool.length];
      nameIdx++;
      if (p.names.includes(nm) && p.names.length < Math.min(need, namePool.length)) continue;
      p.names.push(nm);
    }
    p.names = p.names.slice(0, need);
  }

  for (const p of planned) {
    for (const fullName of p.names) {
      const tc = makeTc(usedTc, tcSeed++);
      const phone = makePhone(phoneIdx++);
      added.push({
        id: uid('usr'),
        role: 'student',
        institutionId: inst.id,
        fullName,
        loginId: tc,
        password: tc.slice(-6),
        phone,
        parentPhone: makePhone(phoneIdx++),
        classId: p.classId,
        className: p.className,
        points: 0,
        createdAt: now,
      });
    }
  }

  if (!added.length) return db;
  return { ...db, users: [...db.users, ...added] };
}
