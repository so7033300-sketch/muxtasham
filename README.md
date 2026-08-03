# Smart QR-Attendance CRM

Jonli QR-kod orqali davomat, avtomatik moliyaviy hisob-kitob va Telegram
bildirishnomalariga ega o'quv markazi CRM tizimi.

## O'rnatish (lokal)

```bash
npm install
node server.js
```

Server `http://localhost:3000` da ishga tushadi.
- `public/index.html` — bosh sahifa (umumiy statistika)
- `public/admin.html` — admin panel (QR-skaner, o'quvchilar/o'qituvchilar boshqaruvi)

## Telegram bot

Ota-onalarga xabar yuborish uchun `TELEGRAM_BOT_TOKEN` environment
o'zgaruvchisini o'rnating (BotFather orqali olingan token):

```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
node server.js
```

Bot ikki vazifani bajaradi:
1. **Avtomatik xabarlar** — davomat "keldi"/"kelmadi" bo'lganda ota-onaga darhol yuboriladi (`parentChatId` maydoni orqali).
2. **`/start` va ID olish** — har qanday foydalanuvchi botga `/start` yozganda, o'zining Telegram ID raqamini va "📨 Administratorga yuborish" tugmasini oladi. Tugma bosilganda ID administratorga (quyida) avtomatik yuboriladi.

**Administrator sozlash:** botning administratori environment orqali beriladi:
```bash
export TELEGRAM_ADMIN_USERNAME="sobirov_cybersecurity"   # standart qiymat shu
```
Administrator birinchi marta botga shaxsan `/start` bosishi kerak — shundagina
uning chat ID'si saqlanadi va ota-onalarning "Adminga yuborish" xabarlari shu
odamga kela boshlaydi.

⚠️ **Xavfsizlik:** bot tokenini hech qachon kodga yozmang yoki ochiq joyda
ulashmang — faqat Render'ning Environment Variables bo'limiga kiriting. Agar
token allaqachon kimgadir ko'rsatilgan/oshkor bo'lgan bo'lsa, BotFaher'da
`/revoke` orqali eskisini bekor qilib, yangisini oling.

## Dars kunlari (hafta jadvali)

Har bir o'quvchi uchun qaysi hafta kunlari faol ekanligini belgilash mumkin
(admin panel — qo'shish/tahrirlash formasida checkbox'lar). Faqat belgilangan
kunlarda: QR-skaner qabul qilinadi, taymer "kelmadi" belgilaydi, pul yechiladi
va Telegram xabari yuboriladi. Belgilanmagan kunlari tizim hech narsa qilmaydi.

## Qidiruv

Admin paneldagi "O'quvchilar ro'yxati" bo'limida ism, guruh, telefon yoki
QR-kod bo'yicha tezkor qidiruv mavjud.

## Kamera skaneri

QR-kod skaner qutisi kamera ko'rish maydonining katta qismini egallaydi va
tezkor aniqlash uchun sozlangan — shuning uchun kodni biroz uzoqroqdan
ko'rsatsa ham tez tanib oladi. Agar kamera ishlamasa, "Kamerani ishga
tushirish" tugmasi ostida aniq xatolik xabari chiqadi (ruxsat berilmagan,
kamera topilmadi va h.k.) — shu xabarga qarab muammoni aniqlash mumkin.

## Render'ga joylashtirish

1. Repositoryni GitHub'ga yuklang (`database.json` faylini repoda saqlab
   qoldiring — u boshlang'ich holat sifatida ishlatiladi).
2. Render'da **Web Service** yarating:
   - Build command: `npm install`
   - Start command: `node server.js`
3. Environment bo'limida `TELEGRAM_BOT_TOKEN` ni qo'shing.
4. **Muhim:** Render'ning bepul tarifida disk vaqtinchalik bo'ladi — har
   deploy'da `database.json` qayta tiklanadi. Doimiy saqlash uchun Render
   **Persistent Disk** qo'shing yoki keyinchalik haqiqiy bazaga
   (PostgreSQL/MongoDB) o'tkazing.

## Arxitektura

- `server.js` — Express backend: barcha API'lar, node-schedule taymerlari
  (har minutlik "kelmadi" tekshiruvi va oylik arxivlash), Telegram
  integratsiyasi.
- `public/admin.html` + `public/script.js` + `public/style.css` — jonli
  QR-skaner (kamera + apparat/qo'lda kiritish), sahifa yangilanmasdan
  ishlaydigan real-vaqt jadvali, o'quvchi/o'qituvchi CRUD va tahrirlash.
- `public/index.html` — bosh sahifa, umumiy statistika va oxirgi 3 oy
  arxivi.
- `database.json` — barcha ma'lumotlar shu yerda saqlanadi (students,
  teachers, attendance, center_profit, history).

## Moliyaviy mantiq

Har bir dars holati tasdiqlanganda (QR orqali "keldi" yoki taymer orqali
avtomatik "kelmadi" — farqi yo'q):

```
dars_narxi = fee / 12
o'qituvchi_ulushi = dars_narxi * 50%
markaz_ulushi     = dars_narxi * 50%
```

O'quvchi darsga kelmasa ham, pul baribir yechiladi va o'qituvchiga
yoziladi — bu eski tizimning o'zgarmagan mantig'i.
