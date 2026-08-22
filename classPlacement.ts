import {
  ClassGrade,
  ClassRoom,
  ClassTrack,
  UserAccount,
  isOrtaokulGrade,
} from './types';
import { MatchedBulkRow } from './bulkDeneme';

const SECTION_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type PlacementMove = {
  studentId: string;
  studentName: string;
  grade: ClassGrade;
  track: ClassTrack;
  rankInGroup: number;
  score: number;
  net: number;
  fromClassId?: string;
  fromClassName?: string;
  toClassId: string;
  toClassName: string;
  toSection: string;
  changed: boolean;
};

export type PlacementSkip = {
  studentName: string;
  reason: string;
};

export type PlacementPlan = {
  moves: PlacementMove[];
  skipped: PlacementSkip[];
  summaries: string[];
};

function groupKey(grade: ClassGrade, track: ClassTrack) {
  return `${grade}|${track}`;
}

function resolveMeta(
  row: MatchedBulkRow['row'],
  student: UserAccount | undefined,
  classes: ClassRoom[]
): { grade: ClassGrade; track: ClassTrack } | null {
  const cls = student?.classId ? classes.find((c) => c.id === student.classId) : undefined;
  const grade = row.classGrade ?? cls?.grade;
  if (grade == null) return null;
  let track: ClassTrack =
    row.classTrack ||
    cls?.track ||
    (isOrtaokulGrade(grade) ? 'ortaokul' : 'sayisal');
  if (isOrtaokulGrade(grade)) track = 'ortaokul';
  return { grade, track };
}

function findTargetClass(
  classes: ClassRoom[],
  grade: ClassGrade,
  track: ClassTrack,
  section: string
): ClassRoom | undefined {
  const sec = section.toUpperCase();
  return classes.find((c) => {
    if (c.grade !== grade) return false;
    if ((c.section || '').toUpperCase() !== sec) return false;
    if (isOrtaokulGrade(grade)) {
      return c.track === 'ortaokul' || !c.track;
    }
    return c.track === track;
  });
}

/**
 * Liste sırasına / puana göre her (sınıf seviyesi + bölüm) grubunu
 * N’er kişilik dilimlere bölüp A, B, C… şubelerine yerleştirir.
 */
export function buildClassPlacementPlan(input: {
  matches: MatchedBulkRow[];
  students: UserAccount[];
  classes: ClassRoom[];
  groupSize: number;
}): PlacementPlan {
  const n = Math.max(1, Math.round(input.groupSize) || 10);
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const skipped: PlacementSkip[] = [];
  const buckets = new Map<
    string,
    {
      grade: ClassGrade;
      track: ClassTrack;
      items: {
        studentId: string;
        studentName: string;
        score: number;
        net: number;
        listRank?: number;
        fromClassId?: string;
        fromClassName?: string;
      }[];
    }
  >();

  for (const m of input.matches) {
    if (m.status !== 'matched' || !m.studentId) {
      skipped.push({
        studentName: m.row.studentName,
        reason: m.status === 'ambiguous' ? 'İsim belirsiz' : 'Öğrenci bulunamadı',
      });
      continue;
    }
    const st = byId.get(m.studentId);
    const meta = resolveMeta(m.row, st, input.classes);
    if (!meta) {
      skipped.push({
        studentName: m.studentFullName || m.row.studentName,
        reason: 'Listede / kayıtta sınıf seviyesi yok',
      });
      continue;
    }
    const key = groupKey(meta.grade, meta.track);
    if (!buckets.has(key)) {
      buckets.set(key, { grade: meta.grade, track: meta.track, items: [] });
    }
    buckets.get(key)!.items.push({
      studentId: m.studentId,
      studentName: m.studentFullName || m.row.studentName,
      score: m.row.score,
      net: m.row.net,
      listRank: m.row.listRank,
      fromClassId: st?.classId,
      fromClassName: st?.className,
    });
  }

  const moves: PlacementMove[] = [];
  const summaries: string[] = [];

  for (const bucket of buckets.values()) {
    const sorted = [...bucket.items].sort((a, b) => {
      if (a.listRank != null && b.listRank != null) return a.listRank - b.listRank;
      if (a.listRank != null) return -1;
      if (b.listRank != null) return 1;
      if (b.score !== a.score) return b.score - a.score;
      return b.net - a.net;
    });

    const sectionUsed = new Set<string>();
    let placed = 0;

    sorted.forEach((item, index) => {
      const sectionIdx = Math.floor(index / n);
      if (sectionIdx >= SECTION_ORDER.length) {
        skipped.push({
          studentName: item.studentName,
          reason: `Şube kotası doldu (max ${SECTION_ORDER.length} şube × ${n})`,
        });
        return;
      }
      const section = SECTION_ORDER[sectionIdx];
      const target = findTargetClass(input.classes, bucket.grade, bucket.track, section);
      if (!target) {
        skipped.push({
          studentName: item.studentName,
          reason: `Hedef sınıf yok: ${bucket.grade === 'mezun' ? 'Mezun' : bucket.grade}-${section}${
            bucket.track !== 'ortaokul' ? ` ${bucket.track}` : ''
          }`,
        });
        return;
      }
      sectionUsed.add(section);
      placed += 1;
      const changed = item.fromClassId !== target.id;
      moves.push({
        studentId: item.studentId,
        studentName: item.studentName,
        grade: bucket.grade,
        track: bucket.track,
        rankInGroup: index + 1,
        score: item.score,
        net: item.net,
        fromClassId: item.fromClassId,
        fromClassName: item.fromClassName,
        toClassId: target.id,
        toClassName: target.name,
        toSection: section,
        changed,
      });
    });

    const gradeLabel = bucket.grade === 'mezun' ? 'Mezun' : `${bucket.grade}. sınıf`;
    const trackPart =
      bucket.track && bucket.track !== 'ortaokul' ? ` · ${bucket.track}` : '';
    summaries.push(
      `${gradeLabel}${trackPart}: ${placed} öğrenci → şube ${[...sectionUsed].join(', ')} (${n}’erli)`
    );
  }

  return { moves, skipped, summaries };
}
