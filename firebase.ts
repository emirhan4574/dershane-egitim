/**
 * Firebase bağlantı iskeleti.
 * Şimdilik uygulama yerel AsyncStorage (db.ts) ile çalışır.
 * Canlıya alırken buraya Firebase config eklenip AuthContext Firebase'e taşınacak.
 *
 * 1) Firebase Console'da proje aç
 * 2) Authentication + Firestore + Storage etkinleştir
 * 3) Aşağıdaki alanları doldur
 * 4) firestore.rules dosyasını deploy et
 */

export const firebaseConfig = {
  apiKey: 'BURAYA_API_KEY',
  authDomain: 'BURAYA_AUTH_DOMAIN',
  projectId: 'BURAYA_PROJECT_ID',
  storageBucket: 'BURAYA_STORAGE_BUCKET',
  messagingSenderId: 'BURAYA_SENDER_ID',
  appId: 'BURAYA_APP_ID',
};

export const firebaseEnabled =
  firebaseConfig.apiKey !== 'BURAYA_API_KEY';
