# Dershane — Merkezi SQL + API (+ ileride mobil)

**Birincil kullanım: web tarayıcı** (`npm run web` → http://localhost:8081).

Masaüstü Electron kurulumu şimdilik **ertelendi**. Telefon, bilgisayar (web) ve ileride mobil aynı SQL’e API üzerinden bağlanabilir.

```
[Expo Web]  ─┐
[Expo Mobil]─┼─► Node API (:3001) ─► SQL Server (DershaneDb)
(ileride)   ─┘
```

## 1) SQL Server

### Docker (önerilen yerel geliştirme)

```bash
cd database
docker compose up -d
```

Şifre: `Dershane_Sql_2026!` (SA)

### Şema kurulum

```bash
cd server
copy .env.example .env
npm install
npm run migrate
npm run seed
```

Script sırası: `database/01_*.sql` … `07_*.sql`  
Seed admin: **admin / admin123**

Azure SQL kullanıyorsanız `.env` içinde `SQL_SERVER`, `SQL_USER`, `SQL_PASSWORD`, `SQL_ENCRYPT=true` ayarlayın.

## 2) API sunucusu

```bash
cd server
npm install
npm start
```

- Health: http://localhost:3001/api/health  
- LAN’dan telefon için bilgisayarın IP’sini kullanın (firewall’da 3001 açık olmalı).

## 3) Web istemci (asıl kanal)

Kök `.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:3001/api
```

```bash
npm install
npm run web
```

→ http://localhost:8081

API ayaktaysa uygulama SQL üzerinden çalışır; API yoksa yerel AsyncStorage moduna düşer.

## 4) Masaüstü (Electron) — ertelendi

Kurulum / dağıtım ağır olduğu için şimdilik kullanılmıyor. Kod `desktop/` klasöründe duruyor; ileride gerekirse tekrar açılır. Şimdilik siteyi kullanın.

## 5) Mobil — sonra

Aynı Expo projesi; web oturunca `expo start` / EAS ile paketlenecek.

Kurulum paketi:

```bash
cd desktop
npm run dist
```

Çıktı: `desktop/dist/`

## Klasörler

| Yol | İçerik |
|-----|--------|
| `database/` | SQL şema, indeksler, seed, view/proc, docker-compose |
| `server/` | Express + mssql + JWT API |
| `apiClient.ts` | İstemci API katmanı |
| `AuthContext.tsx` | API öncelikli veri katmanı |
| `desktop/` | Electron masaüstü kabuğu |
| `assets/brand/` | Logo |

## Güvenlik notları

- Üretimde `JWT_SECRET` ve SQL SA şifresini değiştirin.
- Telefondan internet üzerinden erişim için API’yi public host’a (Azure App Service / VPS) koyun; sadece ev PC’si NAT arkasında dışarıdan zor erişilir.
- Şifreler bcrypt ile saklanır.

## Hızlı kontrol listesi

1. `docker compose up -d` (SQL)  
2. `server`: `npm run migrate` → `npm start`  
3. Kök: `npm run web`  
4. `desktop`: `npm start`  
5. Yönetici: **admin / admin123** → kurum oluştur → öğretmen/öğrenci hesapları ile farklı cihazlardan giriş
