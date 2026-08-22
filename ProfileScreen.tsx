import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import { Button, Card, Chip, Field, PageHeader, Screen } from './ui';
import { colors, fonts } from './theme';

export default function ProfileScreen() {
  const {
    user,
    institution,
    logout,
    changePassword,
    isManager,
    isMuhasebe,
    updateInstitutionSettings,
  } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [overdueDays, setOverdueDays] = useState(
    String(institution?.paymentOverdueIntervalDays ?? 7)
  );
  const [placementSize, setPlacementSize] = useState(
    String(institution?.classPlacementSize ?? 10)
  );
  const [settingsInfo, setSettingsInfo] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  if (!user) return null;

  const canEditPaymentSettings =
    (user.role === 'teacher' && (isManager || isMuhasebe)) || user.role === 'muhasebe';

  const onChangePassword = async () => {
    setError(null);
    setOk(null);
    if (newPassword !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    const err = await changePassword(currentPassword, newPassword);
    if (err) {
      setError(err);
      return;
    }
    setOk('Şifre güncellendi.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
  };

  const onSavePaymentSettings = async () => {
    setSettingsError(null);
    setSettingsInfo(null);
    const err = await updateInstitutionSettings({
      paymentOverdueIntervalDays: Number(overdueDays),
      classPlacementSize: Number(placementSize),
    });
    if (err) {
      setSettingsError(err);
      return;
    }
    setSettingsInfo('Kurum ayarları kaydedildi.');
  };

  const roleLabel =
    user.role === 'superadmin'
      ? 'Platform yöneticisi'
      : user.role === 'muhasebe'
        ? 'Muhasebe'
        : user.role === 'teacher'
          ? isManager && isMuhasebe
            ? 'Yönetici · Muhasebe'
            : isMuhasebe
              ? 'Öğretmen · Muhasebe'
              : isManager
                ? 'Yönetici öğretmen'
                : 'Öğretmen'
          : 'Öğrenci';

  return (
    <Screen scroll>
      <PageHeader
        title="Hesabım"
        subtitle="Adınız, kurum bilginiz ve şifre değiştirme buradadır."
      />

      <Card>
        <View style={styles.row}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Chip text={roleLabel} tone="gold" />
        </View>
        <Text style={styles.meta}>Kullanıcı adı: {user.loginId}</Text>
        {institution ? (
          <Text style={styles.meta}>
            Kurum: {institution.name} ({institution.code})
          </Text>
        ) : null}
        {user.className ? <Text style={styles.meta}>Sınıf: {user.className}</Text> : null}
        {user.role === 'student' ? <Text style={styles.meta}>Puan: {user.points}</Text> : null}
      </Card>

      {canEditPaymentSettings ? (
        <Card>
          <Text style={styles.block}>Kurum ayarları</Text>
          <Text style={styles.meta}>
            Ödeme günü geçtikten sonra kaç günde bir “ödemeniz X gün gecikmiştir” mesajı
            gönderilsin?
          </Text>
          <Field
            label="Gecikme aralığı (gün)"
            value={overdueDays}
            onChangeText={setOverdueDays}
            keyboardType="numeric"
            placeholder="7"
          />
          <Text style={styles.meta}>
            Deneme listesine göre otomatik sınıf atamasında her şubeye kaç öğrenci düşsün?
            (Örn. 10 → sıralamada ilk 10 A, sonraki 10 B…)
          </Text>
          <Field
            label="Şube kotası (kişi)"
            value={placementSize}
            onChangeText={setPlacementSize}
            keyboardType="numeric"
            placeholder="10"
          />
          {settingsError ? <Text style={styles.error}>{settingsError}</Text> : null}
          {settingsInfo ? <Text style={styles.ok}>{settingsInfo}</Text> : null}
          <Button title="Ayarları kaydet" onPress={onSavePaymentSettings} />
        </Card>
      ) : null}

      <Card>
        <Text style={styles.block}>Şifre değiştir</Text>
        <Field
          label="Mevcut şifre"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Field
          label="Yeni şifre"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Field
          label="Yeni şifre (tekrar)"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {ok ? <Text style={styles.ok}>{ok}</Text> : null}
        <Button title="Şifreyi kaydet" onPress={onChangePassword} />
      </Card>

      <Button title="Çıkış yap" variant="danger" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fonts.displaySemi, fontSize: 18, color: colors.ink },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  block: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, marginBottom: 4 },
  error: { fontFamily: fonts.body, color: colors.danger, marginBottom: 8 },
  ok: { fontFamily: fonts.body, color: colors.brand, marginBottom: 8 },
});
