# Dershane — Web (birincil)

Şu an ürün **tarayıcıdaki site** üzerinden kullanılır. Masaüstü (Electron) ve mobil paket kurulumu şimdilik kenarda; aynı kod tabanı ileride mobilde de çalışacak.

## Hızlı başlatma (yerel site)

Proje klasöründe:

```bash
npm install
npm run web
```

Tarayıcıda açın: **http://localhost:8081**

API / SQL kullanacaksanız ayrı terminalde:

```bash
npm run api
```

Kök `.env` örneği:

```
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

API yoksa uygulama yerel AsyncStorage ile de çalışır.

## Demo giriş

| Rol | Kurum kodu | Kullanıcı | Şifre |
|-----|------------|-----------|-------|
| Platform yöneticisi | — | `admin` | `admin123` |
| Deneme dershanesi yönetici | `deneme` | `yonetici` | `1234` |
| Öğretmen | `deneme` | `matematik1` | `1234` |
| Öğrenci | `deneme` | T.C. (listeden) | T.C. son 6 hane / `123456` |

## Ne kullanıyoruz şu an?

1. **Web site** (`npm run web`) — asıl kanal  
2. İsteğe bağlı **API + SQL** — merkezi veri (`README-SQL-DESKTOP.md`)  
3. ~~Masaüstü Electron~~ — ertelendi (kurulum ağır)  
4. **Mobil** — sonra (aynı Expo projesi)

## SQL / API detayı

→ [README-SQL-DESKTOP.md](./README-SQL-DESKTOP.md)

## Notlar

- Veriler API açıksa SQL’de; değilse tarayıcıda AsyncStorage’da.
- Deneme listesi / sınıf belirleme için Gemini API anahtarı Hesap veya ilgili ekrandan kaydedilir.
- İnternete herkese açık yayın (domain / hosting) ayrı adım; hazır olunca netleştirilir.
