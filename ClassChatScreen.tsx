import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Card, Chip, Empty, Field, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, space } from './theme';
import { pickAnyFile, toChatAttachment } from './filePick';
import { ChatAttachment } from './types';
import {
  ClassListFilter,
  classMatchesDims,
  emptyClassDims,
  type ClassDims,
} from './design/ClassPicker';
import {
  ChatCategory,
  ChatSubParams,
  classInChatCategory,
} from './design/ChatNavItem';

type ViewMode = 'hub' | 'list' | 'room';

function categoryTitle(cat: ChatCategory) {
  if (cat === 'mezun') return 'Mezun Sohbet';
  if (cat === 'lise') return 'Lise Sohbet';
  return 'Ortaokul Sohbet';
}

export default function ClassChatScreen() {
  const route = useRoute();
  const { user, myClasses, classes, messages, sendClassMessage, users, isManager } = useAuth();

  const available = useMemo(() => {
    if (user?.role === 'teacher') return isManager ? classes : myClasses;
    return classes.filter((c) => c.id === user?.classId);
  }, [user, isManager, classes, myClasses]);

  const [view, setView] = useState<ViewMode>('hub');
  const [category, setCategory] = useState<ChatCategory>('mezun');
  const [listDims, setListDims] = useState<ClassDims>(emptyClassDims());
  const [classId, setClassId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Öğrenci: doğrudan kendi sınıf sohbeti
  useEffect(() => {
    if (user?.role === 'student' && user.classId) {
      setClassId(user.classId);
      setView('room');
    }
  }, [user?.role, user?.classId]);

  useEffect(() => {
    if (user?.role === 'student') return;
    const p = (route.params || {}) as Partial<ChatSubParams>;
    if (p.section === 'list' && p.category) {
      setCategory(p.category);
      setView('list');
      setClassId(null);
      setListDims(emptyClassDims());
      setError(null);
      return;
    }
    if (p.section === 'hub') {
      setView('hub');
      setClassId(null);
    }
  }, [route.params, user?.role]);

  const categoryClasses = useMemo(
    () => available.filter((c) => classInChatCategory(c.grade, category)),
    [available, category]
  );

  const filteredClasses = useMemo(() => {
    return categoryClasses
      .filter((c) => classMatchesDims(c, listDims))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [categoryClasses, listDims]);

  const activeClass = available.find((c) => c.id === classId) || classes.find((c) => c.id === classId);

  const roomMessages = useMemo(
    () =>
      messages
        .filter((m) => m.classId === classId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages, classId]
  );

  const openRoom = (id: string) => {
    setClassId(id);
    setView('room');
    setText('');
    setPendingFiles([]);
    setError(null);
  };

  const backToList = () => {
    setClassId(null);
    setView(user?.role === 'student' ? 'hub' : 'list');
  };

  if (view === 'room' && classId) {
    return (
      <Screen>
        {user?.role === 'teacher' ? (
          <Button title="← Sınıf listesi" variant="ghost" onPress={backToList} />
        ) : null}
        <Title>{activeClass?.name || 'Sohbet'}</Title>
        <Subtitle>Bu sınıftaki duyurular ve paylaşılan dosyalar</Subtitle>

        <FlatList
          style={{ flex: 1, marginTop: space.sm }}
          data={roomMessages}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="Henüz mesaj yok." />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <Text style={styles.sender}>{item.senderName}</Text>
                {item.isHomeworkNotice ? <Chip text="Ödev" tone="gold" /> : null}
              </View>
              <Text style={styles.body}>{item.text}</Text>
              {(item.attachments || []).map((a, idx) => (
                <Button
                  key={`${item.id}_${idx}`}
                  title={`📎 ${a.label}`}
                  variant="secondary"
                  onPress={() => Linking.openURL(a.uri).catch(() => undefined)}
                />
              ))}
              <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text>
            </Card>
          )}
        />

        {user?.role === 'teacher' ? (
          <View>
            {pendingFiles.map((f, i) => (
              <Chip key={`${f.uri}_${i}`} text={f.label} tone="blue" />
            ))}
            <Field
              label="Mesaj"
              value={text}
              onChangeText={setText}
              placeholder="Duyuru yazın..."
              multiline
            />
            <Button
              title="Belge / dosya ekle"
              variant="ghost"
              onPress={async () => {
                const file = await pickAnyFile();
                if (!file) return;
                setPendingFiles((prev) => [...prev, toChatAttachment(file)]);
              }}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title="Gönder"
              onPress={async () => {
                const err = await sendClassMessage(classId, text, pendingFiles);
                if (err) setError(err);
                else {
                  setText('');
                  setPendingFiles([]);
                  setError(null);
                }
              }}
            />
          </View>
        ) : (
          <Card>
            <Text style={styles.meta}>
              Bu odada yalnızca öğretmen yazar. Belgeleri buradan açabilirsiniz.
            </Text>
          </Card>
        )}
      </Screen>
    );
  }

  if (view === 'hub' || user?.role === 'student') {
    return (
      <Screen>
        <Title>Sınıf Sohbeti</Title>
        <Subtitle>
          {user?.role === 'student'
            ? 'Sınıfınızın sohbet odası yükleniyor…'
            : 'Sol menüden Mezun, Lise veya Ortaokul sohbetini seçin.'}
        </Subtitle>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{categoryTitle(category)}</Title>
      <Subtitle>
        {isManager
          ? 'Sınıf adıyla arayıp sohbet odasını seçin.'
          : 'Yalnızca sorumlu olduğunuz sınıflar listelenir.'}
      </Subtitle>

      <ClassListFilter
        classes={categoryClasses}
        value={listDims}
        onChange={setListDims}
        label="Sohbet sınıfı"
      />

      <SectionLabel>Sohbet odaları ({filteredClasses.length})</SectionLabel>
      <FlatList
        data={filteredClasses}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Empty text="Bu filtrede görüntülenecek sınıf yok." />}
        renderItem={({ item }) => {
          const count = messages.filter((m) => m.classId === item.id).length;
          const studentCount = users.filter(
            (u) => u.classId === item.id && u.role === 'student'
          ).length;
          return (
            <Card onPress={() => openRoom(item.id)}>
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Chip text={`${count} mesaj`} />
              </View>
              <Text style={styles.meta}>{studentCount} öğrenci</Text>
              <Text style={styles.tapHint}>Sohbete gir →</Text>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontWeight: '800', fontSize: 16, color: colors.ink, flex: 1 },
  sender: { fontFamily: fonts.bodyBold, fontWeight: '800', color: colors.ink },
  body: { fontFamily: fonts.body, marginTop: 6, color: colors.ink, lineHeight: 20 },
  time: { fontFamily: fonts.body, marginTop: 8, color: colors.muted, fontSize: 12 },
  meta: { fontFamily: fonts.bodySemi, fontWeight: '600', color: colors.muted, marginTop: 4, lineHeight: 20 },
  tapHint: {
    marginTop: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.brand,
  },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, fontWeight: '800' },
});
