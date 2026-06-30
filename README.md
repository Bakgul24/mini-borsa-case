# Mini Borsa — Alım-Satım API (Case Study)

Bir borsa uygulamasının çekirdeğinde yer alan alım-satım servisinin mini bir
versiyonu. Kullanıcı sabit fiyatlı hisseleri alıp satabiliyor, portföyünü ve
işlem geçmişini görüntüleyebiliyor.

## Kurulum ve Çalıştırma

### Gereksinimler
- Node.js v18+
- Docker Desktop (PostgreSQL için)

### Adımlar

```bash
# 1. Bağımlılıkları kur
npm install

# 2. PostgreSQL'i başlat
docker compose up -d

# 3. .env dosyasını oluştur
cp .env.example .env

# 4. Veritabanı şemasını kur (development DB)
npm run db:setup

# 5. Başlangıç verisini yükle (3 hisse + 100.000 TL'lik hesap)
npm run db:seed

# 6. Sunucuyu başlat
npm start
```

Sunucu `http://localhost:3000` adresinde ayağa kalkar.

### Test ortamı için

```bash
docker exec -it mini-borsa-postgres createdb -U borsa borsa_test
NODE_ENV=test npm run db:setup
npm test
```

(Windows PowerShell'de `NODE_ENV=test` yerine `$env:NODE_ENV="test"` kullanın.)

## API Uçları

| Method | Endpoint | Açıklama |
|---|---|---|
| GET | `/stocks` | Hisse listesi ve fiyatları |
| GET | `/accounts/:id` | Hesap/bakiye sorgulama |
| GET | `/accounts/:id/portfolio` | Portföy görüntüleme |
| GET | `/accounts/:id/transactions` | İşlem geçmişi |
| POST | `/orders/buy` | Hisse alım işlemi |
| POST | `/orders/sell` | Hisse satım işlemi |

**Örnek istek (alım):**
```json
POST /orders/buy
{ "accountId": 1, "symbol": "THYAO", "quantity": 10 }
```

## Tasarım Notları

Bu bölüm, projede alınan teknik kararları ve gerekçelerini açıklıyor.

### 1. Neden float kullanılmadı, kuruş bazlı integer tercih edildi?

Para hesaplamalarında `float`/`double` kullanmak, ikili (binary) kayan nokta
sayılarının ondalık kesirleri **tam olarak temsil edememesinden** kaynaklanan
yuvarlama hatalarına yol açar. Klasik örnek:

```js
0.1 + 0.2 === 0.30000000000000004 // true, 0.3 değil
```

Bir borsa/finans uygulamasında bu tarz bir hata, küçük gibi görünse de
binlerce işlem üzerinden **birikerek** bakiye tutarsızlıklarına dönüşebilir —
kabul edilemez bir risk.

**Çözüm olarak iki yaygın yaklaşım var:** `decimal` tipi (ör. PostgreSQL'in
`NUMERIC` tipi, ya da JS tarafında `decimal.js` gibi bir kütüphane) veya
**en küçük birim cinsinden tam sayı** (kuruş bazlı integer). Bu projede
**kuruş bazlı integer** tercih edildi:

- Tüm parasal değerler (`price_kurus`, `cash_balance_kurus`, `total_kurus`)
  veritabanında `BIGINT` olarak, en küçük para birimi olan **kuruş** cinsinden
  tutuluyor (300.00 TL → `30000`).
- Tüm aritmetik işlemler (toplama, çıkarma, çarpma) bu tam sayılar üzerinden
  yapılıyor — JavaScript'in `Number` tipi, `Number.MAX_SAFE_INTEGER`
  (`2^53 - 1`) sınırına kadar tam sayı aritmetiğinde **kesinlik** garantiliyor,
  bizim değer aralığımız bu sınırın çok altında.
- API response'larında, **sadece görüntüleme amacıyla**, kuruş değeri 100'e
  bölünerek TL'ye çevriliyor (`price_kurus / 100`). Bu bölme işlemi
  hesaplamaları etkilemiyor, sadece son kullanıcıya sunulan temsili
  değiştiriyor.

Bu yaklaşımın `NUMERIC`/`decimal` tipine göre artısı: ek bir kütüphaneye
ihtiyaç duymadan, native `BIGINT` ve native JS `Number` ile (sınırlar dahilinde)
tam kesinlik elde ediliyor, kod daha basit kalıyor. Eksisi: çok büyük tutarlı
veya çok fazla ondalık basamak gerektiren senaryolarda (ör. kripto paralarda
8 ondalık basamak) bu yaklaşım yetersiz kalabilir; böyle bir ihtiyaç olsaydı
`NUMERIC` tipi veya `decimal.js` tercih edilirdi.

**Dikkat edilen bir teknik detay:** `pg` (node-postgres) kütüphanesi,
PostgreSQL'in `BIGINT` tipini varsayılan olarak **string** olarak döndürür
(çünkü `BIGINT`, JS'in güvenli tam sayı sınırını teorik olarak aşabilir).
Bizim değerlerimiz bu sınırın çok altında kaldığı için, `pg.types.setTypeParser`
ile `BIGINT`'i `number`'a çevirdik (`src/db/pool.js`) — aksi halde
`cash_balance_kurus - amount` gibi bir işlem, sayısal çıkarma değil
**string birleştirme** gibi davranabilirdi.

### 2. Neden PostgreSQL?

README'de in-memory çözüm de kabul edilebilir deniyordu, ama PostgreSQL
tercih edildi çünkü:

- **Gerçek transaction (ACID) garantisi** — `BEGIN`/`COMMIT`/`ROLLBACK` ile
  atomiklik gerçek anlamda test edilebiliyor, in-memory bir çözümde bunu
  taklit etmek (ve bunu eşzamanlılık testleriyle kanıtlamak) ekstra,
  gereksiz bir karmaşıklık olurdu.
- **`SELECT ... FOR UPDATE` (satır seviyesinde kilit)** — eşzamanlı isteklerde
  race condition'ı önlemek için kritik bir özellik, in-memory bir çözümde
  bunu doğru şekilde simüle etmek (mutex/lock yazmak) PostgreSQL'in
  sunduğundan daha hataya açık olurdu.
- **`CHECK` kısıtları ve foreign key'ler** — veritabanı seviyesinde
  "defense in depth" sağlıyor (ör. `cash_balance_kurus >= 0`,
  `total_kurus = quantity * price_kurus`), kod tarafında bir hata olsa
  bile veritabanı tutarsız veri yazılmasını engelliyor.
- Bu, gerçek bir borsa/fintech sisteminde de tercih edilecek, **production'a
  en yakın** yaklaşım olduğu için seçildi.

### 3. Atomiklik nasıl sağlandı?

`src/db/withTransaction.js`, verilen bir fonksiyonu `BEGIN`/`COMMIT`/`ROLLBACK`
ile sarmalıyor. `src/services/orderService.js` içindeki `buyStock` ve
`sellStock` fonksiyonları, tüm adımları (hisse fiyatını okuma, hesabı
kilitleme, bakiye güncelleme, portföy güncelleme, işlem kaydı oluşturma) **tek
bir transaction içinde** yapıyor. Herhangi bir adımda hata oluşursa (ör.
yetersiz bakiye), `ROLLBACK` tetikleniyor ve **hiçbir değişiklik kalıcı
olmuyor** — bu, testlerde de doğrulanıyor (`orderService.test.js`'te
"hiçbir şeyi değiştirmez" testleri).

**Eşzamanlılık (race condition) koruması:** Aynı hesaba aynı anda gelen iki
istek (ör. iki paralel alım isteği), ikisi de "yeterli bakiye var" diye
düşünüp aynı parayı "iki kere harcayabilir" (double-spend riski). Bunu
önlemek için, hesap satırı okunurken `FOR UPDATE` kullanılıyor:

```sql
SELECT id, cash_balance_kurus FROM accounts WHERE id = $1 FOR UPDATE
```

Bu, ilgili satırı **kilitler** — aynı satırı okumaya çalışan başka bir
transaction, bu transaction `COMMIT`/`ROLLBACK` olana kadar **bekler**. Bu
sayede iki eşzamanlı istek sırayla işlenir, biri diğerinin üzerine yazamaz.
Bu davranış, `orderService.test.js` içindeki eşzamanlılık testinde
`Promise.allSettled` ile iki paralel istek gönderilerek doğrulanıyor: sadece
biri başarılı oluyor, bakiye asla negatife düşmüyor.

### 4. Hata yönetimi mimarisi

Servis katmanı (`orderService.js`), HTTP'den habersiz şekilde **anlamlı
hatalar** fırlatıyor (`NotFoundError`, `BusinessRuleError`,
`ValidationError` — `src/errors.js`). Bu hataların HTTP koduna çevrilmesi,
merkezi bir middleware'de (`src/middleware/errorHandler.js`) yapılıyor. Bu
ayrım sayesinde:

- Servis katmanı test edilirken HTTP'yi hiç bilmesine gerek kalmıyor
  (`orderService.test.js`, doğrudan fonksiyonları çağırıp `rejects.toThrow`
  ile hata tipini kontrol ediyor).
- HTTP durum kodu eşlemesi tek bir yerde toplanıyor: `NotFoundError` → 404,
  `ValidationError` → 400, `BusinessRuleError` → 422.

Giriş doğrulama (request body validasyonu) için `zod` kullanılıyor
(`src/validation/orderSchemas.js`) — hisse adedinin pozitif tam sayı olması
kuralı burada uygulanıyor (`z.number().int().positive()`), ondalıklı,
sıfır veya negatif değerler doğrudan `400 Bad Request` ile reddediliyor.

### 5. Neden repository/DAO katmanı yok?

Bu boyuttaki bir projede (4 tablo, 2 ana iş kuralı), her tablo için ayrı bir
repository soyutlaması eklemek gereksiz bir katman karmaşıklığı yaratacaktı.
Bunun yerine SQL sorguları doğrudan servis ve route katmanlarında yazıldı.
Daha büyük bir projede (çok sayıda tablo, tekrar eden sorgu mantığı, birden
fazla servis aynı veriye farklı şekillerde erişiyorsa) repository katmanı
eklemek mantıklı olurdu.

### 6. Test stratejisi

İki seviyede test yazıldı:

- **Servis seviyesi** (`orderService.test.js`) — iş mantığını doğrudan test
  ediyor: bakiye/portföy güncellemeleri, yetersiz bakiye/hisse reddi,
  olmayan hesap/sembol hataları, ve **eşzamanlılık** (`FOR UPDATE` kilidinin
  gerçekten çalıştığının kanıtı).
- **HTTP seviyesi** (`routes.test.js`, `supertest` ile) — gerçek HTTP
  isteklerinin doğru status code (`200`, `201`, `400`, `404`, `422`)
  döndürdüğünü doğruluyor.

Her testten önce veritabanı sıfırlanıp yeniden tohumlanıyor
(`src/tests/setup.js`) — testler birbirinden bağımsız, hangi sırayla
çalıştırılırsa çalıştırılsın aynı sonucu veriyor.

Test edilebilirlik için `app.js` (Express kurulumu) ile `server.js`
(`listen()` çağrısı) ayrıldı — testler gerçek bir port açmadan, doğrudan
`app` nesnesi üzerinden çalışıyor.

## Kapsam Dışı Bırakılanlar

README'de de belirtildiği gibi, gerçek bir borsadaki emir defteri/emir
eşleştirme mekanizmaları kasıtlı olarak kapsam dışı bırakıldı. Ayrıca:

- Kimlik doğrulama/yetkilendirme (JWT vb.) eklenmedi — case study'nin
  odağı alım-satım iş mantığı olduğu için kapsam dışı tutuldu.
- Fiyatlar sabit, gerçek zamanlı fiyat güncellemesi yok.
- Komisyon/işlem ücreti hesaplaması yok.

## Kullanılan Teknolojiler

Node.js, Express, PostgreSQL (`pg`), `zod` (validasyon), Jest + Supertest
(test), Docker Compose (PostgreSQL için).
