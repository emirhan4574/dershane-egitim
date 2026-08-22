import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from './AuthContext';
import { Button, Field, Segmented } from './ui';
import { colors, fonts, radius, space } from './theme';
import { useLayout } from './design/LayoutContext';

type LoginMode = 'student' | 'teacher' | 'admin';

export default function LoginScreen() {
  const { login } = useAuth();
  const { isDesktop } = useLayout();
  const wide = isDesktop;

  const [mode, setMode] = useState<LoginMode>('student');
  const [institutionCode, setInstitutionCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const code = mode === 'admin' ? '' : institutionCode;
    const role =
      mode === 'admin' ? 'superadmin' : mode === 'teacher' ? 'teacher' : 'student';
    const err = await login(code, loginId, password, role, remember);
    if (err) setError(err);
    setBusy(false);
  };

  const form = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.formPad}
    >
      <Text style={styles.formTitle}>Giriş yapın</Text>
      <Text style={styles.formHint}>
        Öğrenci, öğretmen veya yönetici seçin. Öğrenci ve öğretmen için kurum kodu gerekir.
      </Text>

      <Segmented
        value={mode}
        onChange={(k) => setMode(k as LoginMode)}
        options={[
          { key: 'student', label: 'Öğrenci' },
          { key: 'teacher', label: 'Öğretmen' },
          { key: 'admin', label: 'Yönetici' },
        ]}
      />

      {mode !== 'admin' ? (
        <Field
          label="Kurum kodu"
          value={institutionCode}
          onChangeText={setInstitutionCode}
          placeholder="Örnek: dershane-a"
        />
      ) : null}

      <Field
        label={mode === 'student' ? 'T.C. kimlik numarası' : 'Kullanıcı adı'}
        value={loginId}
        onChangeText={setLoginId}
        placeholder={
          mode === 'admin' ? 'admin' : mode === 'student' ? '11 haneli numara' : 'ogretmen'
        }
        keyboardType={mode === 'student' ? 'numeric' : 'default'}
      />
      <Field
        label="Şifre"
        value={password}
        onChangeText={setPassword}
        placeholder="Şifrenizi yazın"
        secureTextEntry
      />

      <Pressable
        style={styles.rememberRow}
        onPress={() => setRemember((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: remember }}
      >
        <View style={[styles.check, remember && styles.checkOn]}>
          {remember ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rememberTitle}>Girişi kaydet</Text>
          <Text style={styles.rememberHint}>Sonraki açılışta şifre sormadan devam eder.</Text>
        </View>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={busy ? 'Giriş yapılıyor...' : 'Giriş yap'}
        onPress={onSubmit}
        disabled={busy}
      />

      <View style={styles.help}>
        <Text style={styles.helpTitle}>Nasıl giriş yapılır?</Text>
        {mode === 'admin' ? (
          <Text style={styles.helpText}>
            Platform yöneticisi tüm kurumları yönetir. Deneme girişi: kullanıcı adı admin, şifre
            admin123.
          </Text>
        ) : mode === 'teacher' ? (
          <Text style={styles.helpText}>
            Yönetici önce kurumu oluşturur. Size verilen kurum kodu + kullanıcı adı + şifre ile
            girersiniz.
          </Text>
        ) : (
          <Text style={styles.helpText}>
            Kurum kodu ve T.C. kimlik numaranız gerekir. İlk şifre genelde T.C. kimlik
            numaranızın son 6 hanesidir.
          </Text>
        )}
      </View>
    </ScrollView>
  );

  if (wide) {
    return (
      <View style={styles.split}>
        <View style={styles.left}>
          <View style={styles.blobA} />
          <View style={styles.blobB} />
          <Text style={styles.brand}>Dershane</Text>
          <Text style={styles.tag}>
            Dershane yönetimi: öğrenci, öğretmen ve kurum işlemleri tek yerde.
          </Text>
          <Text style={styles.leftNote}>
            Deneme sonuçları, ödevler, yoklama ve sınıf duyuruları aynı uygulamada.
          </Text>
        </View>
        <KeyboardAvoidingView
          style={styles.right}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {form}
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.mobile}>
      <View style={styles.mobileHero}>
        <Text style={styles.brand}>Dershane</Text>
        <Text style={styles.tagMobile}>Öğrenci, öğretmen ve kurum yönetimi</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {form}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  left: {
    flex: 1.05,
    backgroundColor: colors.loginDeep,
    padding: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blobA: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: colors.loginMid,
    opacity: 0.35,
    top: -60,
    right: -40,
  },
  blobB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.loginSoft,
    opacity: 0.25,
    bottom: 80,
    left: -50,
  },
  right: { flex: 1, backgroundColor: colors.loginSky },
  brand: {
    fontFamily: fonts.bodyBold,
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  tag: {
    marginTop: 18,
    fontFamily: fonts.bodySemi,
    fontSize: 22,
    fontWeight: '700',
    color: '#ECFEFF',
    lineHeight: 32,
    maxWidth: 380,
  },
  leftNote: {
    marginTop: 20,
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    fontWeight: '600',
    color: '#CCFBF1',
    lineHeight: 26,
    maxWidth: 360,
  },
  formPad: {
    padding: 36,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  formTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 34,
    fontWeight: '800',
    color: colors.ink,
  },
  formHint: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 16,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 18,
    lineHeight: 24,
  },
  error: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    fontWeight: '800',
    color: colors.danger,
    marginTop: 4,
    marginBottom: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 6,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.brand },
  checkMark: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },
  rememberTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  rememberHint: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  help: {
    marginTop: 22,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  helpTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  helpText: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 15,
    color: colors.muted,
    lineHeight: 24,
  },
  mobile: { flex: 1, backgroundColor: colors.loginSky },
  mobileHero: {
    backgroundColor: colors.loginDeep,
    paddingTop: 52,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
  tagMobile: {
    marginTop: 10,
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 16,
    color: '#CCFBF1',
    lineHeight: 24,
  },
});
