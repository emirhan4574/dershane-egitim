import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  PageHeader,
  Screen,
  SectionLabel,
  Segmented,
  Subtitle,
  Title,
} from './ui';
import { colors, fonts, space } from './theme';
import { pickAnyFile } from './filePick';
import {
  analyzeDenemeGroupWithAi,
  getGeminiApiKey,
  hasGeminiApiKey,
  isImageFile,
  parseDenemeWithAi,
  setGeminiApiKey,
} from './aiDeneme';
import {
  matchStudentsToRows,
  MatchedBulkRow,
  parseBulkDenemeList,
  ParsedBulkList,
  ranksFromBulkRow,
} from './bulkDeneme';
import { buildClassPlacementPlan } from './classPlacement';
import {
  ClassGrade,
  ClassTrack,
  DenemeRank,
  DenemeResult,
  DenemeSubjectScore,
  trackLabel,
} from './types';
import {
  ClassListFilter,
  dimsLabel,
  emptyClassDims,
  type ClassDims,
} from './design/ClassPicker';
import { DenemeSubParams } from './design/DenemeNavItem';

type FilterKey = 'all' | 'institution' | 'student';
type TeacherView = 'hub' | 'list' | 'create' | 'placement';

type Draft = {
  title: string;
  date: string;
  net: string;
  score: string;
  note: string;
  documentUri?: string;
  documentName?: string;
  subjects: DenemeSubjectScore[];
  studentName?: string;
  examType?: string;
  averageScore?: number;
  ranks: DenemeRank[];
  classGrade?: ClassGrade;
  classSection?: string;
  classTrack?: ClassTrack;
};

function listGradeTabLabel(g: ClassGrade) {
  return g === 'mezun' ? 'Mezun' : `${g}. Sınıf`;
}

function denemeSourceLabel(source?: string) {
  if (source === 'student') return 'Kendi denemen';
  return 'Kurum denemesi';
}

function isInstitutionDeneme(d: DenemeResult) {
  return (d.source || 'institution') === 'institution';
}

export default function DenemeScreen() {
  const route = useRoute();
  const {
    user,
    users,
    classes,
    denemes,
    addDeneme,
    addDenemesBulk,
    reassignStudentClasses,
    myClasses,
    isManager,
    institution,
  } = useAuth();

  const students = useMemo(() => {
    const all = users.filter((u) => u.role === 'student');
    if (user?.role !== 'teacher' || isManager) return all;
    const allowed = new Set(myClasses.map((c) => c.id));
    return all.filter((s) => s.classId && allowed.has(s.classId));
  }, [users, user, isManager, myClasses]);

  const [teacherView, setTeacherView] = useState<TeacherView>('hub');
  /** boş = tüm sınıflar */
  const [listDims, setListDims] = useState<ClassDims>(emptyClassDims());

  const classOptions = isManager ? classes : myClasses;

  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [showUpload, setShowUpload] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<DenemeResult | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  /** Sınıf belirleme (placement) toplu liste */
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkParsed, setBulkParsed] = useState<ParsedBulkList | null>(null);
  const [bulkMatches, setBulkMatches] = useState<MatchedBulkRow[]>([]);
  const [bulkDoc, setBulkDoc] = useState<{ uri: string; name: string } | null>(null);
  const [placementSize, setPlacementSize] = useState(
    String(institution?.classPlacementSize ?? 10)
  );

  /** Deneme sonucu ekle (create) toplu — placement state’inden ayrı */
  const [resultBulkBusy, setResultBulkBusy] = useState(false);
  const [resultBulkStatus, setResultBulkStatus] = useState<string | null>(null);
  const [resultBulkError, setResultBulkError] = useState<string | null>(null);
  const [resultBulkParsed, setResultBulkParsed] = useState<ParsedBulkList | null>(null);
  const [resultBulkMatches, setResultBulkMatches] = useState<MatchedBulkRow[]>([]);
  const [resultBulkDoc, setResultBulkDoc] = useState<{ uri: string; name: string } | null>(
    null
  );

  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const [ownTitle, setOwnTitle] = useState('');
  const [ownDate, setOwnDate] = useState(new Date().toISOString().slice(0, 10));
  const [ownNet, setOwnNet] = useState('');
  const [ownScore, setOwnScore] = useState('');

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const p = (route.params || {}) as Partial<DenemeSubParams>;
    if (p.section === 'create') {
      setTeacherView('create');
      setSelected(null);
      return;
    }
    if (p.section === 'placement') {
      setTeacherView('placement');
      setSelected(null);
      return;
    }
    if (p.section === 'list') {
      setTeacherView('list');
      setSelected(null);
      setListDims(emptyClassDims());
      setAiAnalysis(null);
      setAiError(null);
      setAiStatus(null);
      return;
    }
    setTeacherView('hub');
    setSelected(null);
  }, [route.params, user?.role]);

  useEffect(() => {
    if (!students.length) {
      if (studentId) setStudentId('');
      return;
    }
    if (!studentId || !students.some((s) => s.id === studentId)) {
      setStudentId(students[0].id);
    }
  }, [students, studentId]);

  useEffect(() => {
    void (async () => {
      const key = await getGeminiApiKey();
      setApiKeyInput(key);
      setApiKeySaved(!!key);
    })();
  }, []);

  useEffect(() => {
    if (institution?.classPlacementSize != null) {
      setPlacementSize(String(institution.classPlacementSize));
    }
  }, [institution?.classPlacementSize]);

  const classById = useMemo(() => {
    const map = new Map(classes.map((c) => [c.id, c]));
    return map;
  }, [classes]);

  const studentById = useMemo(() => {
    const map = new Map(users.filter((u) => u.role === 'student').map((s) => [s.id, s]));
    return map;
  }, [users]);

  const placementPlan = useMemo(
    () =>
      buildClassPlacementPlan({
        matches: bulkMatches,
        students,
        classes,
        groupSize: Number(placementSize) || 10,
      }),
    [bulkMatches, students, classes, placementSize]
  );

  /** Deneme kaydındaki damga veya öğrencinin güncel sınıfı */
  const resolveDenemeMeta = (d: DenemeResult) => {
    if (d.classGrade != null) {
      return {
        grade: d.classGrade,
        section: (d.classSection || '').toUpperCase(),
        track: d.classTrack,
      };
    }
    const st = studentById.get(d.studentId);
    const cls = st?.classId ? classById.get(st.classId) : undefined;
    return {
      grade: cls?.grade,
      section: (cls?.section || '').toUpperCase(),
      track: cls?.track,
    };
  };

  const denemeMatchesDims = (d: DenemeResult, dims: ClassDims) => {
    if (!dims.grade && !dims.section && !dims.track) return true;
    const meta = resolveDenemeMeta(d);
    if (dims.grade != null && meta.grade !== dims.grade) return false;
    if (dims.section && (meta.section || '') !== dims.section.toUpperCase()) return false;
    if (dims.track && dims.track !== 'ortaokul' && meta.track !== dims.track) return false;
    return true;
  };

  const teacherList = useMemo(() => {
    return denemes
      .filter((d) => isInstitutionDeneme(d))
      .filter((d) => {
        // Öğretmen kapsamı: yalnızca yetkili olduğu öğrencilerin sonuçları
        if (user?.role === 'teacher' && !isManager) {
          if (!students.some((s) => s.id === d.studentId)) return false;
        }
        if (!denemeMatchesDims(d, listDims)) return false;
        return true;
      })
      .map((d) => ({
        ...d,
        studentName:
          d.studentName || studentById.get(d.studentId)?.fullName || 'Öğrenci',
      }))
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate) return byDate;
        return (a.studentName || '').localeCompare(b.studentName || '', 'tr');
      });
  }, [denemes, listDims, user, isManager, students, studentById, classById]);

  const teacherListSummary = useMemo(() => {
    if (!teacherList.length) return { avgNet: 0, avgScore: 0 };
    const avgNet = teacherList.reduce((sum, d) => sum + d.net, 0) / teacherList.length;
    const avgScore = teacherList.reduce((sum, d) => sum + d.score, 0) / teacherList.length;
    return { avgNet, avgScore };
  }, [teacherList]);

  const filterLabel = useMemo(() => dimsLabel(listDims), [listDims]);

  const studentList = useMemo(() => {
    if (!user || user.role !== 'student') return [];
    return denemes
      .filter((d) => d.studentId === user.id)
      .filter((d) => {
        const source = d.source || 'institution';
        if (filter === 'all') return true;
        return source === filter;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [denemes, user, filter]);

  const changedMoves = useMemo(
    () => placementPlan.moves.filter((m) => m.changed),
    [placementPlan.moves]
  );

  const renderDetail = (item: DenemeResult) => {
    const ranks = item.ranks || [];
    const meta = resolveDenemeMeta(item);
    const classBits = [
      meta.grade != null ? listGradeTabLabel(meta.grade) : null,
      meta.section ? `Şube ${meta.section}` : null,
      meta.track && meta.track !== 'ortaokul' ? trackLabel(meta.track) : null,
    ].filter(Boolean);
    return (
      <Screen scroll>
        <Button title="← Listeye dön" variant="ghost" onPress={() => setSelected(null)} />
        <PageHeader
          title={item.title}
          subtitle={`${item.date} · ${denemeSourceLabel(item.source)}${
            item.studentName ? ` · ${item.studentName}` : ''
          }${classBits.length ? ` · ${classBits.join(' · ')}` : ''}`}
        />

        <View style={styles.scoreRow}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{item.net}</Text>
            <Text style={styles.scoreLabel}>NET</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{item.score}</Text>
            <Text style={styles.scoreLabel}>PUAN</Text>
          </View>
          {item.averageScore != null ? (
            <View style={styles.scoreBox}>
              <Text style={styles.scoreValue}>{item.averageScore}</Text>
              <Text style={styles.scoreLabel}>GENEL ORT.</Text>
            </View>
          ) : null}
        </View>

        {item.examType ? <Chip text={item.examType} tone="gold" /> : null}
        {item.note ? <Text style={styles.meta}>{item.note}</Text> : null}
        {item.documentName ? (
          <Button
            title={`Belge: ${item.documentName}`}
            variant="secondary"
            onPress={() =>
              item.documentUri && Linking.openURL(item.documentUri).catch(() => undefined)
            }
          />
        ) : null}

        <SectionLabel>Dereceler (kaçıncı olduğu)</SectionLabel>
        {ranks.length === 0 ? (
          <Empty text="Bu belgede derece bilgisi yok / okunamadı." />
        ) : (
          ranks.map((r) => (
            <Card key={r.scope}>
              <View style={styles.row}>
                <Text style={styles.name}>{r.label}</Text>
                <Chip text={`${r.rank} / ${r.total}`} tone="blue" />
              </View>
              <Text style={styles.meta}>
                {r.total} kişi içinde {r.rank}. sırada
              </Text>
            </Card>
          ))
        )}

        <SectionLabel>Ders ders sonuçlar</SectionLabel>
        {(item.subjects || []).length === 0 ? (
          <Empty text="Ders detayı yok." />
        ) : (
          (item.subjects || []).map((s) => (
            <Card key={s.subject}>
              <Text style={styles.name}>{s.subject}</Text>
              <Text style={styles.meta}>
                Doğru {s.correct} · Yanlış {s.wrong} · Boş {s.blank} · Net {s.net}
              </Text>
              {s.successPercent != null ? (
                <Text style={styles.meta}>Başarı %{s.successPercent}</Text>
              ) : null}
              {s.classAvg != null || s.institutionAvg != null || s.generalAvg != null ? (
                <Text style={styles.meta}>
                  Ort. — Sınıf: {s.classAvg ?? '-'} · Kurum: {s.institutionAvg ?? '-'} · Genel:{' '}
                  {s.generalAvg ?? '-'}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </Screen>
    );
  };

  if (selected) {
    return renderDetail(selected);
  }

  if (user?.role === 'teacher') {
    if (teacherView === 'hub') {
      return (
        <Screen>
          <Title>Denemeler</Title>
          <Subtitle>
            Sol menüde Denemeler’e tıklayın; kayıtlı denemeler, deneme sonucu ekle veya sınıf
            belirleme alt başlığını seçin.
          </Subtitle>
        </Screen>
      );
    }

    if (teacherView === 'list') {
      return (
        <Screen scroll>
          <PageHeader
            title="Kayıtlı denemeler"
            subtitle="Sınıfa göre filtreleyin; Tümü tüm kurum denemelerini gösterir."
          />

          <ClassListFilter
            classes={classOptions}
            value={listDims}
            onChange={(next) => {
              setListDims(next);
              setAiAnalysis(null);
              setAiError(null);
              setAiStatus(null);
            }}
          />

          <SectionLabel>
            {filterLabel} · {teacherList.length} sonuç · Ort. net{' '}
            {teacherList.length ? teacherListSummary.avgNet.toFixed(2) : '—'} · Ort. puan{' '}
            {teacherList.length ? teacherListSummary.avgScore.toFixed(2) : '—'}
          </SectionLabel>

          <Card>
            <Text style={styles.hint}>
              Ücretsiz yapay zeka anahtarı: aistudio.google.com/apikey
            </Text>
            <Field
              label="Yapay zeka API anahtarı (Gemini)"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="AIza... ile başlayan anahtar"
            />
            <Button
              title={apiKeySaved ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
              variant="ghost"
              disabled={aiBusy}
              onPress={async () => {
                await setGeminiApiKey(apiKeyInput);
                const ok = await hasGeminiApiKey();
                setApiKeySaved(ok);
                setAiStatus(ok ? 'API anahtarı kaydedildi.' : 'Anahtar silindi.');
                setAiError(null);
              }}
            />
            <Button
              title={aiBusy ? 'Analiz ediliyor...' : 'Bu filtreyi yapay zeka ile analiz et'}
              disabled={aiBusy || teacherList.length === 0}
              onPress={async () => {
                setAiError(null);
                setAiAnalysis(null);
                setAiBusy(true);
                try {
                  const text = await analyzeDenemeGroupWithAi({
                    filterLabel,
                    denemes: teacherList.map((d) => ({
                      studentName: d.studentName || studentById.get(d.studentId)?.fullName || 'Öğrenci',
                      title: d.title,
                      date: d.date,
                      net: d.net,
                      score: d.score,
                      subjects: d.subjects,
                    })),
                    onProgress: (msg) => setAiStatus(msg),
                  });
                  setAiAnalysis(text);
                  setAiStatus('Analiz tamamlandı.');
                } catch (e) {
                  setAiError(e instanceof Error ? e.message : 'Analiz yapılamadı.');
                  setAiStatus(null);
                } finally {
                  setAiBusy(false);
                }
              }}
            />
            {aiStatus ? <Text style={styles.info}>{aiStatus}</Text> : null}
            {aiError ? <Text style={styles.error}>{aiError}</Text> : null}
            {aiAnalysis ? (
              <Card>
                <Text style={styles.block}>Yapay zeka analizi</Text>
                <Text style={styles.meta}>{aiAnalysis}</Text>
              </Card>
            ) : null}
          </Card>

          {teacherList.length === 0 ? <Empty text="Bu filtrede kurum denemesi yok." /> : null}
          {teacherList.map((item) => {
            const meta = resolveDenemeMeta(item);
            const classBits = [
              meta.grade != null ? listGradeTabLabel(meta.grade) : null,
              meta.section ? `Şube ${meta.section}` : null,
              meta.track && meta.track !== 'ortaokul' ? trackLabel(meta.track) : null,
            ].filter(Boolean);
            return (
              <Card key={item.id} onPress={() => setSelected(item)}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.studentName || 'Öğrenci'}</Text>
                  <Chip text="Kurum denemesi" tone="gold" />
                </View>
                <Text style={styles.meta}>
                  {item.title} · {item.date}
                </Text>
                {classBits.length ? (
                  <Text style={styles.meta}>{classBits.join(' · ')}</Text>
                ) : null}
                <Text style={styles.meta}>
                  Net {item.net} · Puan {item.score}
                </Text>
                <Text style={styles.tap}>Öğrenci detayına bak →</Text>
              </Card>
            );
          })}
        </Screen>
      );
    }

    if (teacherView === 'create') {
      return (
        <Screen scroll>
          <PageHeader
            title="Deneme sonucu ekle"
            subtitle="Sınıf ataması yok; yalnızca deneme sonucu kaydı. Tek öğrenci belgesi veya toplu net listesi yükleyebilirsiniz."
          />

          <SectionLabel>Öğrenci seçin (tek belge için)</SectionLabel>
          <View style={styles.wrapChips}>
            {students.map((s) => (
              <Button
                key={s.id}
                title={s.className ? `${s.fullName} (${s.className})` : s.fullName}
                variant={studentId === s.id ? 'primary' : 'ghost'}
                onPress={() => setStudentId(s.id)}
              />
            ))}
          </View>
          {!students.length ? <Empty text="Kayıtlı öğrenci yok." /> : null}

          <Button
            title={showUpload ? 'Formu kapat' : 'Tek öğrenci belgesi yükle'}
            variant={showUpload ? 'ghost' : 'secondary'}
            onPress={() => {
              setShowUpload((v) => !v);
              setDraft(null);
              if (!showUpload) setShowBulk(false);
            }}
          />
          <Button
            title={showBulk ? 'Formu kapat' : 'Toplu net listesini yükle'}
            variant={showBulk ? 'ghost' : 'secondary'}
            onPress={() => {
              setShowBulk((v) => !v);
              setResultBulkParsed(null);
              setResultBulkMatches([]);
              setResultBulkError(null);
              setResultBulkStatus(null);
              if (!showBulk) setShowUpload(false);
            }}
          />

          {showBulk ? (
            <Card>
              <Text style={styles.hint}>
                Net listesi fotoğrafını yükleyin. Yapay zeka satırları okur; isimleri öğrencilerle
                eşleştirir. Onayda yalnızca deneme sonuçları kaydedilir (sınıf değişmez).
              </Text>
              <Text style={styles.hint}>
                Ücretsiz yapay zeka anahtarı almak için: aistudio.google.com/apikey
              </Text>
              <Field
                label="Yapay zeka API anahtarı (Gemini)"
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="AIza... ile başlayan anahtar"
              />
              <Button
                title={apiKeySaved ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
                variant="ghost"
                disabled={resultBulkBusy}
                onPress={async () => {
                  await setGeminiApiKey(apiKeyInput);
                  const ok = await hasGeminiApiKey();
                  setApiKeySaved(ok);
                  setResultBulkStatus(ok ? 'API anahtarı kaydedildi.' : 'Anahtar silindi.');
                }}
              />
              <Button
                title={resultBulkBusy ? 'Liste okunuyor...' : 'Net listesi seçin (PNG / JPG)'}
                disabled={resultBulkBusy}
                onPress={async () => {
                  setResultBulkError(null);
                  setResultBulkStatus(null);
                  const file = await pickAnyFile();
                  if (!file) return;
                  if (!(isImageFile(file.name, file.mimeType) || isImageFile(file.uri))) {
                    setResultBulkError('Yalnızca PNG veya JPG liste görselleri desteklenir.');
                    return;
                  }
                  if (!(await hasGeminiApiKey())) {
                    setResultBulkError('Önce yapay zeka API anahtarını kaydedin.');
                    return;
                  }
                  setResultBulkBusy(true);
                  setResultBulkParsed(null);
                  setResultBulkMatches([]);
                  setResultBulkDoc({ uri: file.uri, name: file.name });
                  try {
                    const parsed = await parseBulkDenemeList(file.uri, {
                      onProgress: (msg) => setResultBulkStatus(msg),
                    });
                    const matched = matchStudentsToRows(parsed.rows, students);
                    setResultBulkParsed(parsed);
                    setResultBulkMatches(matched);
                    const ok = matched.filter((m) => m.status === 'matched').length;
                    const bad = matched.filter((m) => m.status === 'unmatched').length;
                    const amb = matched.filter((m) => m.status === 'ambiguous').length;
                    setResultBulkStatus(
                      `${parsed.meta.examTitle}: ${matched.length} satır · ${ok} eşleşti · ${bad} eşleşmedi · ${amb} belirsiz`
                    );
                  } catch (e) {
                    setResultBulkError(e instanceof Error ? e.message : 'Liste okunamadı.');
                    setResultBulkStatus(null);
                  } finally {
                    setResultBulkBusy(false);
                  }
                }}
              />
              {resultBulkStatus ? <Text style={styles.info}>{resultBulkStatus}</Text> : null}
              {resultBulkError ? <Text style={styles.error}>{resultBulkError}</Text> : null}
              {resultBulkParsed && resultBulkMatches.length ? (
                <>
                  <Field
                    label="Deneme adı (tüm öğrencilere aynı yazılır)"
                    value={resultBulkParsed.meta.examTitle}
                    onChangeText={(t) =>
                      setResultBulkParsed({
                        ...resultBulkParsed,
                        meta: { ...resultBulkParsed.meta, examTitle: t },
                      })
                    }
                  />
                  <SectionLabel>Eşleşme önizlemesi</SectionLabel>
                  {resultBulkMatches.map((m, idx) => {
                    const classBits = [
                      m.row.classLabel || null,
                      !m.row.classLabel && m.row.classGrade != null
                        ? listGradeTabLabel(m.row.classGrade)
                        : null,
                      !m.row.classLabel && m.row.classSection
                        ? `Şube ${m.row.classSection}`
                        : null,
                      !m.row.classLabel &&
                      m.row.classTrack &&
                      m.row.classTrack !== 'ortaokul'
                        ? trackLabel(m.row.classTrack)
                        : null,
                    ].filter(Boolean);
                    return (
                      <View key={`${m.row.studentName}-${idx}`} style={styles.bulkRow}>
                        <View style={styles.row}>
                          <Text style={styles.name}>{m.row.studentName}</Text>
                          <Chip
                            text={
                              m.status === 'matched'
                                ? 'Eşleşti'
                                : m.status === 'ambiguous'
                                  ? 'Belirsiz'
                                  : 'Bulunamadı'
                            }
                            tone={
                              m.status === 'matched'
                                ? 'ok'
                                : m.status === 'ambiguous'
                                  ? 'gold'
                                  : 'bad'
                            }
                          />
                        </View>
                        <Text style={styles.meta}>
                          Net {m.row.net} · Puan {m.row.score}
                          {classBits.length ? ` · ${classBits.join(' · ')}` : ''}
                          {m.studentFullName ? ` → ${m.studentFullName}` : ''}
                        </Text>
                        {m.status === 'ambiguous' && m.candidates?.length ? (
                          <View style={styles.wrapChips}>
                            {m.candidates.map((c) => (
                              <Button
                                key={c.id}
                                title={
                                  c.className ? `${c.fullName} (${c.className})` : c.fullName
                                }
                                variant="ghost"
                                onPress={() => {
                                  setResultBulkMatches((prev) =>
                                    prev.map((row, i) =>
                                      i === idx
                                        ? {
                                            ...row,
                                            status: 'matched',
                                            studentId: c.id,
                                            studentFullName: c.fullName,
                                            candidates: undefined,
                                          }
                                        : row
                                    )
                                  );
                                }}
                              />
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                  <Button
                    title={
                      resultBulkBusy
                        ? 'Kaydediliyor...'
                        : `Eşleşenleri kaydet (${
                            resultBulkMatches.filter((m) => m.status === 'matched').length
                          })`
                    }
                    disabled={
                      resultBulkBusy ||
                      !resultBulkMatches.some((m) => m.status === 'matched' && m.studentId)
                    }
                    onPress={async () => {
                      if (!resultBulkParsed) return;
                      const items = resultBulkMatches
                        .filter((m) => m.status === 'matched' && m.studentId)
                        .map((m) => ({
                          studentId: m.studentId!,
                          title: resultBulkParsed.meta.examTitle || 'Kurum Denemesi',
                          date: resultBulkParsed.meta.date,
                          net: m.row.net,
                          score: m.row.score,
                          note: 'Toplu listeden aktarıldı',
                          documentUri: resultBulkDoc?.uri,
                          documentName: resultBulkDoc?.name,
                          subjects: m.row.subjects,
                          studentName: m.studentFullName || m.row.studentName,
                          examType: resultBulkParsed.meta.examType,
                          ranks: ranksFromBulkRow(m.row, resultBulkParsed.meta),
                          classGrade: m.row.classGrade,
                          classSection: m.row.classSection,
                          classTrack: m.row.classTrack,
                        }));
                      setResultBulkBusy(true);
                      const result = await addDenemesBulk(items);
                      setResultBulkBusy(false);
                      if (result.error) {
                        setResultBulkError(result.error);
                        return;
                      }
                      setResultBulkStatus(`${result.ok} öğrencinin deneme sonucu kaydedildi.`);
                      setResultBulkError(null);
                      setResultBulkParsed(null);
                      setResultBulkMatches([]);
                      setShowBulk(false);
                    }}
                  />
                </>
              ) : null}
            </Card>
          ) : null}

          {showUpload ? (
            <Card>
              <Text style={styles.hint}>
                Yapay zeka API anahtarı (ücretsiz): aistudio.google.com/apikey — bir kez kaydedin.
              </Text>
              <Field
                label="Yapay zeka API anahtarı (Gemini)"
                value={apiKeyInput}
                onChangeText={setApiKeyInput}
                placeholder="AIza... ile başlayan anahtar"
              />
              <Button
                title={apiKeySaved ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
                variant="ghost"
                disabled={ocrBusy}
                onPress={async () => {
                  await setGeminiApiKey(apiKeyInput);
                  const ok = await hasGeminiApiKey();
                  setApiKeySaved(ok);
                  setOcrStatus(ok ? 'API anahtarı kaydedildi.' : 'Anahtar silindi.');
                  setError(ok ? null : 'Anahtar yoksa belge seçince manuel form açılır.');
                }}
              />
              <Button
                title={ocrBusy ? 'Belge okunuyor...' : 'Sonuç belgesi seçin (PNG / JPG)'}
                disabled={ocrBusy}
                onPress={async () => {
                  setError(null);
                  setOcrStatus(null);
                  const file = await pickAnyFile();
                  if (!file) return;

                  const openManual = (msg: string) => {
                    setError(`${msg} Manuel giriş formu açıldı.`);
                    setDraft({
                      title: 'Kurum Denemesi',
                      date: new Date().toISOString().slice(0, 10),
                      net: '',
                      score: '',
                      note: 'Manuel girildi',
                      documentUri: file.uri,
                      documentName: file.name,
                      subjects: [],
                      ranks: [],
                    });
                    setOcrStatus('Formu manuel doldurun');
                  };

                  if (!(isImageFile(file.name, file.mimeType) || isImageFile(file.uri))) {
                    openManual('Yalnızca PNG/JPG görseller otomatik okunur.');
                    return;
                  }

                  const hasKey = await hasGeminiApiKey();
                  if (!hasKey) {
                    openManual('Yapay zeka API anahtarı yok. Yukarıya anahtarı kaydedin.');
                    return;
                  }

                  setOcrBusy(true);
                  setOcrStatus('Belge yükleniyor...');
                  setDraft(null);
                  try {
                    const parsed = await parseDenemeWithAi(file.uri, {
                      fileName: file.name,
                      onProgress: (msg) => setOcrStatus(msg),
                    });

                    const netStr =
                      Number.isFinite(parsed.net) &&
                      (parsed.net !== 0 || parsed.confidence !== 'none')
                        ? String(parsed.net)
                        : '';
                    const scoreStr =
                      Number.isFinite(parsed.score) &&
                      (parsed.score !== 0 || parsed.confidence !== 'none')
                        ? String(parsed.score)
                        : '';

                    setDraft({
                      title: parsed.title?.trim() || 'Kurum Denemesi',
                      date: parsed.date,
                      net: netStr,
                      score: scoreStr,
                      note: parsed.note,
                      documentUri: file.uri,
                      documentName: file.name,
                      subjects: parsed.subjects,
                      studentName: parsed.studentName,
                      examType: parsed.examType,
                      averageScore: parsed.averageScore,
                      ranks: parsed.ranks,
                      classGrade: parsed.classGrade,
                      classSection: parsed.classSection,
                      classTrack: parsed.classTrack,
                    });

                    if (parsed.confidence === 'none' || !netStr || !scoreStr) {
                      setError(
                        'Otomatik okuma tamamlanamadı. Net ve puanı kontrol edip kaydedin.'
                      );
                      setOcrStatus('Kısmi sonuç — net ve puanı kontrol edin');
                    } else {
                      setError(null);
                      setOcrStatus(
                        `Okundu: net ${parsed.net}, puan ${parsed.score}, ${parsed.subjects.length} ders, ${parsed.ranks.length} derece`
                      );
                    }
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Belge okunamadı.';
                    openManual(msg);
                  } finally {
                    setOcrBusy(false);
                  }
                }}
              />
              {ocrStatus ? <Text style={styles.info}>{ocrStatus}</Text> : null}
              {draft ? (
                <>
                  <Text style={styles.hint}>
                    Net ve puanı kontrol edin veya doldurun, sonra kaydedin.
                  </Text>
                  <Field
                    label="Deneme adı"
                    value={draft.title}
                    onChangeText={(t) => setDraft({ ...draft, title: t })}
                  />
                  <Field
                    label="Toplam Net"
                    value={draft.net}
                    onChangeText={(t) => {
                      setError(null);
                      setDraft({ ...draft, net: t });
                    }}
                    keyboardType="numeric"
                    placeholder="örn: 92,50"
                  />
                  <Field
                    label="Puan"
                    value={draft.score}
                    onChangeText={(t) => {
                      setError(null);
                      setDraft({ ...draft, score: t });
                    }}
                    keyboardType="numeric"
                    placeholder="örn: 418,914"
                  />
                  {draft.ranks.map((r) => (
                    <Text key={r.scope} style={styles.meta}>
                      {r.label}: {r.rank} / {r.total}
                    </Text>
                  ))}
                  {draft.subjects.map((s) => (
                    <Text key={s.subject} style={styles.meta}>
                      {s.subject}: D{s.correct} Y{s.wrong} · Net {s.net}
                    </Text>
                  ))}
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Button
                    title="Sonucu kaydet"
                    disabled={ocrBusy}
                    onPress={async () => {
                      if (!studentId) {
                        setError('Önce yukarıdan bir öğrenci seçin.');
                        return;
                      }
                      if (!draft.title.trim()) {
                        setError('Deneme adı gerekli.');
                        return;
                      }
                      const net = Number(String(draft.net).trim().replace(',', '.'));
                      const score = Number(String(draft.score).trim().replace(',', '.'));
                      if (!Number.isFinite(net) || !Number.isFinite(score)) {
                        setError('Net ve puanı sayı olarak girin (örn: 92.5 ve 418.914).');
                        return;
                      }
                      const err = await addDeneme({
                        studentId,
                        title: draft.title.trim() || 'Kurum Denemesi',
                        date: draft.date || new Date().toISOString().slice(0, 10),
                        net,
                        score,
                        note: draft.note,
                        source: 'institution',
                        documentUri: draft.documentUri,
                        documentName: draft.documentName,
                        subjects: draft.subjects,
                        studentName: draft.studentName,
                        examType: draft.examType,
                        averageScore: draft.averageScore,
                        ranks: draft.ranks,
                        classGrade: draft.classGrade,
                        classSection: draft.classSection,
                        classTrack: draft.classTrack,
                      });
                      if (err) {
                        setError(err);
                        return;
                      }
                      setDraft(null);
                      setShowUpload(false);
                      setError(null);
                      setOcrStatus('Kayıt tamamlandı.');
                    }}
                  />
                </>
              ) : null}
            </Card>
          ) : null}
        </Screen>
      );
    }

    if (teacherView === 'placement') {
      return (
        <Screen scroll>
          <PageHeader
            title="Sınıf belirleme / deneme listesi"
            subtitle="Listeden 12/mezun vb. okunur; sıralamaya göre N’er kişilik dilimler A, B, C… şubelerine aktarılır. Öğrenci eski sınıftan çıkarılır; yalnızca sınıf değişir, diğer bilgiler aynı kalır."
          />

          <Card>
            <Field
              label="Şube kotası (kaç kişilik)"
              value={placementSize}
              onChangeText={setPlacementSize}
              keyboardType="numeric"
              placeholder="örn: 10 veya 15"
            />
            <View style={styles.wrapChips}>
              <Button
                title="10"
                variant={Number(placementSize) === 10 ? 'primary' : 'ghost'}
                onPress={() => setPlacementSize('10')}
              />
              <Button
                title="15"
                variant={Number(placementSize) === 15 ? 'primary' : 'ghost'}
                onPress={() => setPlacementSize('15')}
              />
            </View>

            <Text style={styles.hint}>
              Ücretsiz yapay zeka anahtarı almak için: aistudio.google.com/apikey
            </Text>
            <Field
              label="Yapay zeka API anahtarı (Gemini)"
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="AIza... ile başlayan anahtar"
            />
            <Button
              title={apiKeySaved ? 'Anahtarı güncelle' : 'Anahtarı kaydet'}
              variant="ghost"
              disabled={bulkBusy}
              onPress={async () => {
                await setGeminiApiKey(apiKeyInput);
                const ok = await hasGeminiApiKey();
                setApiKeySaved(ok);
                setBulkStatus(ok ? 'API anahtarı kaydedildi.' : 'Anahtar silindi.');
              }}
            />
            <Button
              title={bulkBusy ? 'Liste okunuyor...' : 'Net listesi seçin (PNG / JPG)'}
              disabled={bulkBusy}
              onPress={async () => {
                setBulkError(null);
                setBulkStatus(null);
                const file = await pickAnyFile();
                if (!file) return;
                if (!(isImageFile(file.name, file.mimeType) || isImageFile(file.uri))) {
                  setBulkError('Yalnızca PNG veya JPG liste görselleri desteklenir.');
                  return;
                }
                if (!(await hasGeminiApiKey())) {
                  setBulkError('Önce yapay zeka API anahtarını kaydedin.');
                  return;
                }
                setBulkBusy(true);
                setBulkParsed(null);
                setBulkMatches([]);
                setBulkDoc({ uri: file.uri, name: file.name });
                try {
                  const parsed = await parseBulkDenemeList(file.uri, {
                    onProgress: (msg) => setBulkStatus(msg),
                  });
                  const matched = matchStudentsToRows(parsed.rows, students);
                  setBulkParsed(parsed);
                  setBulkMatches(matched);
                  const ok = matched.filter((m) => m.status === 'matched').length;
                  const bad = matched.filter((m) => m.status === 'unmatched').length;
                  const amb = matched.filter((m) => m.status === 'ambiguous').length;
                  setBulkStatus(
                    `${parsed.meta.examTitle}: ${matched.length} satır · ${ok} eşleşti · ${bad} eşleşmedi · ${amb} belirsiz`
                  );
                } catch (e) {
                  setBulkError(e instanceof Error ? e.message : 'Liste okunamadı.');
                  setBulkStatus(null);
                } finally {
                  setBulkBusy(false);
                }
              }}
            />
            {bulkStatus ? <Text style={styles.info}>{bulkStatus}</Text> : null}
            {bulkError ? <Text style={styles.error}>{bulkError}</Text> : null}

            {bulkParsed && bulkMatches.length ? (
              <>
                <Field
                  label="Deneme adı (tüm öğrencilere aynı yazılır)"
                  value={bulkParsed.meta.examTitle}
                  onChangeText={(t) =>
                    setBulkParsed({ ...bulkParsed, meta: { ...bulkParsed.meta, examTitle: t } })
                  }
                />
                <SectionLabel>Eşleşme önizlemesi</SectionLabel>
                {bulkMatches.map((m, idx) => {
                  const classBits = [
                    m.row.classLabel || null,
                    !m.row.classLabel && m.row.classGrade != null
                      ? listGradeTabLabel(m.row.classGrade)
                      : null,
                    !m.row.classLabel && m.row.classSection
                      ? `Şube ${m.row.classSection}`
                      : null,
                    !m.row.classLabel &&
                    m.row.classTrack &&
                    m.row.classTrack !== 'ortaokul'
                      ? trackLabel(m.row.classTrack)
                      : null,
                  ].filter(Boolean);
                  return (
                    <View key={`${m.row.studentName}-${idx}`} style={styles.bulkRow}>
                      <View style={styles.row}>
                        <Text style={styles.name}>{m.row.studentName}</Text>
                        <Chip
                          text={
                            m.status === 'matched'
                              ? 'Eşleşti'
                              : m.status === 'ambiguous'
                                ? 'Belirsiz'
                                : 'Bulunamadı'
                          }
                          tone={
                            m.status === 'matched'
                              ? 'ok'
                              : m.status === 'ambiguous'
                                ? 'gold'
                                : 'bad'
                          }
                        />
                      </View>
                      <Text style={styles.meta}>
                        Net {m.row.net} · Puan {m.row.score}
                        {classBits.length ? ` · ${classBits.join(' · ')}` : ''}
                        {m.studentFullName ? ` → ${m.studentFullName}` : ''}
                      </Text>
                      {m.status === 'ambiguous' && m.candidates?.length ? (
                        <View style={styles.wrapChips}>
                          {m.candidates.map((c) => (
                            <Button
                              key={c.id}
                              title={c.className ? `${c.fullName} (${c.className})` : c.fullName}
                              variant="ghost"
                              onPress={() => {
                                setBulkMatches((prev) =>
                                  prev.map((row, i) =>
                                    i === idx
                                      ? {
                                          ...row,
                                          status: 'matched',
                                          studentId: c.id,
                                          studentFullName: c.fullName,
                                          candidates: undefined,
                                        }
                                      : row
                                  )
                                );
                              }}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}

                <SectionLabel>Otomatik sınıf ataması</SectionLabel>
                {placementPlan.summaries.length === 0 ? (
                  <Empty text="Henüz yerleşecek eşleşmiş öğrenci yok." />
                ) : (
                  placementPlan.summaries.map((s) => (
                    <Text key={s} style={styles.meta}>
                      {s}
                    </Text>
                  ))
                )}

                {changedMoves.length ? (
                  <>
                    <Text style={styles.hint}>
                      Sınıfı değişecekler ({changedMoves.length})
                    </Text>
                    {changedMoves.map((m) => (
                      <View key={m.studentId} style={styles.bulkRow}>
                        <Text style={styles.name}>{m.studentName}</Text>
                        <Text style={styles.meta}>
                          {m.fromClassName || 'Sınıfsız'} → {m.toClassName}
                          {' · '}sıra {m.rankInGroup}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : bulkMatches.some((m) => m.status === 'matched') ? (
                  <Text style={styles.meta}>Sınıf değişikliği yok (zaten doğru şubede).</Text>
                ) : null}

                {placementPlan.skipped.length ? (
                  <>
                    <Text style={styles.hint}>Atlananlar ({placementPlan.skipped.length})</Text>
                    {placementPlan.skipped.map((s, i) => (
                      <Text key={`${s.studentName}-${i}`} style={styles.meta}>
                        {s.studentName}: {s.reason}
                      </Text>
                    ))}
                  </>
                ) : null}

                <Button
                  title={
                    bulkBusy
                      ? 'Kaydediliyor...'
                      : `Denemeleri kaydet ve sınıfları güncelle (${
                          bulkMatches.filter((m) => m.status === 'matched').length
                        } deneme · ${changedMoves.length} sınıf)`
                  }
                  disabled={
                    bulkBusy || !bulkMatches.some((m) => m.status === 'matched' && m.studentId)
                  }
                  onPress={async () => {
                    if (!bulkParsed) return;
                    const items = bulkMatches
                      .filter((m) => m.status === 'matched' && m.studentId)
                      .map((m) => ({
                        studentId: m.studentId!,
                        title: bulkParsed.meta.examTitle || 'Kurum Denemesi',
                        date: bulkParsed.meta.date,
                        net: m.row.net,
                        score: m.row.score,
                        note: 'Toplu listeden aktarıldı',
                        documentUri: bulkDoc?.uri,
                        documentName: bulkDoc?.name,
                        subjects: m.row.subjects,
                        studentName: m.studentFullName || m.row.studentName,
                        examType: bulkParsed.meta.examType,
                        ranks: ranksFromBulkRow(m.row, bulkParsed.meta),
                        classGrade: m.row.classGrade,
                        classSection: m.row.classSection,
                        classTrack: m.row.classTrack,
                      }));
                    setBulkBusy(true);
                    setBulkError(null);
                    try {
                      const denemeResult = await addDenemesBulk(items);
                      if (denemeResult.error) {
                        setBulkError(denemeResult.error);
                        return;
                      }
                      const reassignPayload = changedMoves.map((m) => ({
                        studentId: m.studentId,
                        classId: m.toClassId,
                      }));
                      const classResult = await reassignStudentClasses(reassignPayload);
                      if (classResult.error) {
                        setBulkError(
                          `Denemeler kaydedildi (${denemeResult.ok}), sınıf güncellemesi kısmen: ${classResult.error}`
                        );
                        setBulkStatus(
                          `${denemeResult.ok} deneme kaydı · ${classResult.ok} sınıf güncellendi.`
                        );
                        return;
                      }
                      setBulkStatus(
                        `${denemeResult.ok} deneme sonucu kaydedildi · ${classResult.ok} öğrencinin sınıfı güncellendi.`
                      );
                      setBulkParsed(null);
                      setBulkMatches([]);
                      setBulkDoc(null);
                    } finally {
                      setBulkBusy(false);
                    }
                  }}
                />
              </>
            ) : null}
          </Card>
        </Screen>
      );
    }

    return (
      <Screen>
        <Title>Denemeler</Title>
        <Subtitle>
          Sol menüde Denemeler’e tıklayın; kayıtlı denemeler, deneme sonucu ekle veya sınıf
          belirleme alt başlığını seçin.
        </Subtitle>
      </Screen>
    );
  }

  // Student role
  return (
    <Screen scroll>
      <PageHeader
        title="Denemelerim"
        subtitle="Okulun kaydettiği denemeler ve sizin ekledikleriniz burada. Detay için bir denemeye dokunun."
      />

      <Segmented
        value={filter}
        onChange={(k) => setFilter(k as FilterKey)}
        options={[
          { key: 'all', label: 'Tümü' },
          { key: 'institution', label: 'Kurum denemesi' },
          { key: 'student', label: 'Kendi denemem' },
        ]}
      />

      <Card>
        <Text style={styles.block}>Kendi denememi ekle</Text>
        <Field label="Deneme adı" value={ownTitle} onChangeText={setOwnTitle} />
        <Field label="Tarih" value={ownDate} onChangeText={setOwnDate} />
        <Field label="Net" value={ownNet} onChangeText={setOwnNet} keyboardType="numeric" />
        <Field label="Puan" value={ownScore} onChangeText={setOwnScore} keyboardType="numeric" />
        <Button
          title="Kaydet"
          onPress={async () => {
            if (!user) return;
            await addDeneme({
              studentId: user.id,
              title: ownTitle,
              date: ownDate,
              net: Number(ownNet) || 0,
              score: Number(ownScore) || 0,
              source: 'student',
            });
            setOwnTitle('');
            setOwnNet('');
            setOwnScore('');
          }}
        />
      </Card>

      <SectionLabel>Denemeler ({studentList.length})</SectionLabel>
      {studentList.length === 0 ? <Empty text="Bu filtrede deneme yok." /> : null}
      {studentList.map((item) => (
        <Card key={item.id} onPress={() => setSelected(item)}>
          <View style={styles.row}>
            <Text style={styles.name}>{item.title}</Text>
            <Chip
              text={
                (item.source || 'institution') === 'institution'
                  ? 'Kurum denemesi'
                  : 'Kendi denemem'
              }
              tone={(item.source || 'institution') === 'institution' ? 'gold' : 'blue'}
            />
          </View>
          <Text style={styles.meta}>
            {item.date} · Net {item.net} · Puan {item.score}
            {item.ranks?.[0]
              ? ` · ${item.ranks[0].label} ${item.ranks[0].rank}/${item.ranks[0].total}`
              : ''}
          </Text>
          <Text style={styles.tap}>Detayı aç →</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { fontFamily: fonts.displaySemi, color: colors.ink, marginBottom: 6, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, flex: 1 },
  meta: { marginTop: 4, color: colors.muted, lineHeight: 18, fontFamily: fonts.body },
  tap: { marginTop: 8, color: colors.brandSoft, fontFamily: fonts.bodyBold, fontSize: 12 },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, marginTop: 4 },
  info: { color: colors.success, fontFamily: fonts.bodyBold, marginTop: 4, marginBottom: 6 },
  hint: { color: colors.muted, marginBottom: 8, fontFamily: fonts.bodyMed },
  wrapChips: { gap: 4, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap' },
  bulkRow: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.sm },
  scoreBox: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.ink,
    padding: space.md,
    alignItems: 'center',
  },
  scoreValue: { fontSize: 26, fontFamily: fonts.display, color: colors.ink },
  scoreLabel: {
    fontFamily: fonts.bodyBold,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 4,
  },
});
