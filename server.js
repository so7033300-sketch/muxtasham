/* =========================================================================
   SMART QR-ATTENDANCE CRM — server.js
   Express backend + node-schedule taymerlari + Telegram bildirishnomalari
   ========================================================================= */

const express = require('express');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const TIMEZONE = 'Asia/Tashkent';

// Telegram bot tokeni environment orqali beriladi (Render -> Environment Variables)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* =========================================================================
   1. DATABASE YORDAMCHI FUNKSIYALARI (database.json)
   ========================================================================= */

function defaultDB() {
  return {
    students: [],   // {id, name, group, teacherId, fee, studQrCode, phone, days:[], lessonStart, lessonEnd, parentChatId, balance}
    teachers: [],   // {id, name, salary, groups: [name, ...]}
    attendance: [], // {id, studentId, studentName, phone, date, status, time, teacherId}
    center_profit: 0,
    history: [],    // {month, center_profit, teacher_salary: {teacherId: amount, ...}}
    adminChatId: null // Telegram bot orqali /start bosgan administratorning chat ID si
  };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    writeDB(defaultDB());
  }
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    const db = JSON.parse(raw);
    // Eski fayllarda maydon yo'q bo'lsa, xavfsiz default qiymatlar bilan to'ldiramiz
    db.students = db.students || [];
    db.students.forEach(s => {
      if (typeof s.phone !== 'string') s.phone = '';
      // Eski o'quvchilarda "days" bo'lmasa — eski xatti-harakatni buzmaslik uchun
      // har kuni faol deb hisoblaymiz. Yangilarida forma orqali aniq tanlanadi.
      if (!Array.isArray(s.days)) s.days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    });
    db.teachers = db.teachers || [];
    db.teachers.forEach(t => { if (!Array.isArray(t.groups)) t.groups = []; });
    db.attendance = db.attendance || [];
    db.center_profit = db.center_profit || 0;
    db.history = db.history || [];
    db.adminChatId = db.adminChatId || null;
    return db;
  } catch (e) {
    console.error('database.json o\'qishda xatolik, yangi baza yaratilmoqda:', e.message);
    const fresh = defaultDB();
    writeDB(fresh);
    return fresh;
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/* =========================================================================
   2. VAQT YORDAMCHI FUNKSIYALARI (Toshkent vaqti bo'yicha)
   ========================================================================= */

// Hozirgi vaqtni Toshkent zonasida Date obyekti sifatida qaytaradi
function nowInTashkent() {
  const s = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
  return new Date(s);
}

// "YYYY-MM-DD" formatidagi bugungi sana (Toshkent bo'yicha)
function todayDateStr() {
  const d = nowInTashkent();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// "HH:MM" formatidagi hozirgi vaqt (Toshkent bo'yicha)
function currentTimeStr() {
  const d = nowInTashkent();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

// "HH:MM" ni bugungi sanadagi daqiqalar soniga aylantiradi (taqqoslash uchun)
function timeStrToMinutes(t) {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function currentMinutes() {
  const d = nowInTashkent();
  return d.getHours() * 60 + d.getMinutes();
}

// Bugungi hafta kunini qisqa kalit sifatida qaytaradi: mon, tue, wed, thu, fri, sat, sun
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function todayWeekdayKey() {
  const d = nowInTashkent();
  return WEEKDAY_KEYS[d.getDay()];
}

// O'quvchi uchun bugun faol dars kuni ekanligini tekshiradi.
// "days" ro'yxati bo'sh yoki bugungi kun belgilanmagan bo'lsa — hech narsa qilinmaydi
// (xabar yuborilmaydi, pul yechilmaydi) — foydalanuvchi talabiga ko'ra.
function isScheduledToday(student) {
  const days = Array.isArray(student.days) ? student.days : [];
  if (days.length === 0) return false;
  return days.includes(todayWeekdayKey());
}

/* =========================================================================
   3. TELEGRAM BILDIRISHNOMA FUNKSIYASI
   ========================================================================= */

async function sendTelegramMessage(chatId, text) {
  if (!chatId) return; // parentChatId kiritilmagan bo'lsa, jim o'tkazib yuboramiz
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN sozlanmagan — xabar yuborilmadi:', text);
    return;
  }
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram xabar yuborishda xatolik:', data.description);
    }
  } catch (err) {
    console.error('Telegram fetch xatoligi:', err.message);
  }
}

/* =========================================================================
   3.1 TELEGRAM BOT — /start, ID raqamni ko'rsatish, "Adminga yuborish" tugmasi
   Bot faqat funksional xabarlar yuboradi, hech qanday reklama/marketing matni yo'q.
   ========================================================================= */

// Administrator Telegram username'i (@ belgisisiz). Render Environment orqali
// TELEGRAM_ADMIN_USERNAME bilan almashtirish mumkin.
const ADMIN_USERNAME = (process.env.TELEGRAM_ADMIN_USERNAME || 'sobirov_cybersecurity').replace(/^@/, '').toLowerCase();

let telegramBot = null;

function initTelegramBot() {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN sozlanmagan — Telegram bot ishga tushmadi.');
    return;
  }

  const { TelegramBot } = require('node-telegram-bot-api');
  telegramBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  telegramBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = (msg.from.username || '').toLowerCase();
    const fullName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ');

    // Agar shu odam administrator (@sobirov_cybersecurity) bo'lsa — uning chat ID
    // sini bazaga saqlaymiz, shundan keyin "Adminga yuborish" xabarlari shu yerga keladi.
    if (username && username === ADMIN_USERNAME) {
      const db = readDB();
      db.adminChatId = chatId;
      writeDB(db);
      telegramBot.sendMessage(
        chatId,
        `✅ Siz administrator sifatida ro'yxatdan o'tdingiz.\nEndi ota-onalarning "Adminga yuborish" xabarlari shu yerga keladi.\n\nSizning Telegram ID: <code>${chatId}</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    telegramBot.sendMessage(
      chatId,
      `Assalomu alaykum${fullName ? ', ' + fullName : ''}! 👋\n\n` +
      `Sizning Telegram ID raqamingiz:\n<code>${chatId}</code>\n\n` +
      `Farzandingiz davomati haqida xabarlarni olish uchun ushbu ID pastdagi tugma orqali administratorga yuboriladi, u sizni tizimga qo'shib qo'yadi.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '📨 Administratorga yuborish', callback_data: 'send_to_admin' }]]
        }
      }
    );
  });

  telegramBot.on('callback_query', (query) => {
    if (query.data !== 'send_to_admin') return;

    const chatId = query.message.chat.id;
    const username = query.from.username ? '@' + query.from.username : '(username yo\'q)';
    const fullName = [query.from.first_name, query.from.last_name].filter(Boolean).join(' ');

    const db = readDB();
    const adminChatId = db.adminChatId;

    if (!adminChatId) {
      telegramBot.answerCallbackQuery(query.id, {
        text: 'Administrator hali botni ishga tushirmagan. Birozdan keyin urinib ko\'ring.',
        show_alert: true
      });
      return;
    }

    telegramBot.sendMessage(
      adminChatId,
      `📨 Yangi ota-ona ID raqamini yubordi:\n\n` +
      `Ism: ${fullName || '—'}\nUsername: ${username}\nTelegram ID: <code>${chatId}</code>\n\n` +
      `Ushbu ID raqamni admin panelda tegishli o'quvchining "Ota-ona Telegram ID" maydoniga kiriting.`,
      { parse_mode: 'HTML' }
    );

    telegramBot.answerCallbackQuery(query.id, { text: '✅ Yuborildi! Administrator siz bilan bog\'lanadi.' });
    telegramBot.sendMessage(chatId, '✅ ID raqamingiz administratorga muvaffaqiyatli yuborildi.');
  });

  telegramBot.on('polling_error', (err) => {
    console.error('Telegram polling xatoligi:', err.message);
  });

  console.log(`Telegram bot ishga tushdi (admin: @${ADMIN_USERNAME}).`);
}

/* =========================================================================
   4. MOLIYAVIY HISOB-KITOB MANTIQI (o'zgarmas eski mantiq)
   Dars holati tasdiqlanganda (keldi/kelmadi — farqi yo'q):
     - o'quvchi balansidan (fee / 12) miqdorda pul yechiladi
     - shu summaning 50% qismi tegishli o'qituvchining joriy oyligiga qo'shiladi
     - qolgan 50% qismi markaz foydasiga (center_profit) qo'shiladi
   ========================================================================= */

function chargeForLesson(db, student) {
  const lessonPrice = (Number(student.fee) || 0) / 12;
  const teacherShare = lessonPrice * 0.5;
  const centerShare = lessonPrice * 0.5;

  student.balance = Number((Number(student.balance) || 0) - lessonPrice).toFixed(2) * 1;

  const teacher = db.teachers.find(t => t.id === student.teacherId);
  if (teacher) {
    teacher.salary = Number((Number(teacher.salary) || 0) + teacherShare).toFixed(2) * 1;
  }

  db.center_profit = Number((Number(db.center_profit) || 0) + centerShare).toFixed(2) * 1;

  return { lessonPrice, teacherShare, centerShare };
}

// Bugun shu o'quvchi uchun davomat yozuvi mavjudligini tekshiradi
function hasAttendanceToday(db, studentId) {
  const today = todayDateStr();
  return db.attendance.some(a => a.studentId === studentId && a.date === today);
}

/* =========================================================================
   5. STUDENTS API — O'QUVCHILAR (CRUD + Tahrirlash)
   ========================================================================= */

// Barcha o'quvchilar
app.get('/api/students', (req, res) => {
  const db = readDB();
  res.json({ success: true, students: db.students });
});

const ALLOWED_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
function sanitizeDays(days) {
  if (!Array.isArray(days)) return [];
  return days.filter(d => ALLOWED_DAYS.includes(d));
}

// Yangi o'quvchi qo'shish
app.post('/api/students', (req, res) => {
  const db = readDB();
  const {
    name, group, teacherId, fee,
    studQrCode, lessonStart, lessonEnd,
    parentChatId, phone, days
  } = req.body;

  if (!name || !fee) {
    return res.status(400).json({ success: false, message: 'Ism va oylik to\'lov (fee) majburiy.' });
  }

  if (studQrCode && db.students.some(s => s.studQrCode === studQrCode)) {
    return res.status(400).json({ success: false, message: 'Bu QR/Shtrix kod allaqachon boshqa o\'quvchiga biriktirilgan.' });
  }

  const newStudent = {
    id: genId('stu'),
    name,
    group: group || '',
    teacherId: teacherId || null,
    fee: Number(fee),
    balance: 0,
    studQrCode: studQrCode || '',
    phone: phone || '',
    days: sanitizeDays(days),
    lessonStart: lessonStart || '',
    lessonEnd: lessonEnd || '',
    parentChatId: parentChatId || ''
  };

  db.students.push(newStudent);
  writeDB(db);
  res.json({ success: true, student: newStudent });
});

// O'quvchini tahrirlash (Edit tizimi — Telegram ID, QR-kod, guruh, dars vaqtlari va h.k.)
app.put('/api/students/:id', (req, res) => {
  const db = readDB();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) {
    return res.status(404).json({ success: false, message: 'O\'quvchi topilmadi.' });
  }

  const {
    name, group, teacherId, fee,
    studQrCode, lessonStart, lessonEnd,
    parentChatId, balance, phone, days
  } = req.body;

  if (studQrCode && db.students.some(s => s.studQrCode === studQrCode && s.id !== student.id)) {
    return res.status(400).json({ success: false, message: 'Bu QR/Shtrix kod boshqa o\'quvchiga band.' });
  }

  if (name !== undefined) student.name = name;
  if (group !== undefined) student.group = group;
  if (teacherId !== undefined) student.teacherId = teacherId;
  if (fee !== undefined) student.fee = Number(fee);
  if (studQrCode !== undefined) student.studQrCode = studQrCode;
  if (phone !== undefined) student.phone = phone;
  if (days !== undefined) student.days = sanitizeDays(days);
  if (lessonStart !== undefined) student.lessonStart = lessonStart;
  if (lessonEnd !== undefined) student.lessonEnd = lessonEnd;
  if (parentChatId !== undefined) student.parentChatId = parentChatId;
  if (balance !== undefined) student.balance = Number(balance);

  writeDB(db);
  res.json({ success: true, student });
});

// O'quvchini o'chirish
app.delete('/api/students/:id', (req, res) => {
  const db = readDB();
  const idx = db.students.findIndex(s => s.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'O\'quvchi topilmadi.' });
  }
  db.students.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

/* =========================================================================
   6. TEACHERS API — O'QITUVCHILAR
   ========================================================================= */

app.get('/api/teachers', (req, res) => {
  const db = readDB();
  res.json({ success: true, teachers: db.teachers });
});

app.post('/api/teachers', (req, res) => {
  const db = readDB();
  const { name, groups } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'O\'qituvchi ismi majburiy.' });
  }
  const newTeacher = {
    id: genId('tch'),
    name,
    salary: 0,
    groups: Array.isArray(groups) ? groups.filter(g => g && g.trim()) : []
  };
  db.teachers.push(newTeacher);
  writeDB(db);
  res.json({ success: true, teacher: newTeacher });
});

app.put('/api/teachers/:id', (req, res) => {
  const db = readDB();
  const teacher = db.teachers.find(t => t.id === req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi.' });
  }
  const { name, salary, groups } = req.body;
  if (name !== undefined) teacher.name = name;
  if (salary !== undefined) teacher.salary = Number(salary);
  if (Array.isArray(groups)) teacher.groups = groups.filter(g => g && g.trim());
  writeDB(db);
  res.json({ success: true, teacher });
});

// Bitta o'qituvchiga yangi guruh qo'shish (har o'qituvchi o'z guruhlariga ega)
app.post('/api/teachers/:id/groups', (req, res) => {
  const db = readDB();
  const teacher = db.teachers.find(t => t.id === req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi.' });
  }
  const group = (req.body.group || '').trim();
  if (!group) {
    return res.status(400).json({ success: false, message: 'Guruh nomi kiritilmadi.' });
  }
  teacher.groups = teacher.groups || [];
  if (teacher.groups.includes(group)) {
    return res.status(400).json({ success: false, message: 'Bu guruh allaqachon mavjud.' });
  }
  teacher.groups.push(group);
  writeDB(db);
  res.json({ success: true, teacher });
});

// O'qituvchidan bitta guruhni o'chirish
app.delete('/api/teachers/:id/groups/:group', (req, res) => {
  const db = readDB();
  const teacher = db.teachers.find(t => t.id === req.params.id);
  if (!teacher) {
    return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi.' });
  }
  const groupName = decodeURIComponent(req.params.group);
  teacher.groups = (teacher.groups || []).filter(g => g !== groupName);
  writeDB(db);
  res.json({ success: true, teacher });
});

app.delete('/api/teachers/:id', (req, res) => {
  const db = readDB();
  const idx = db.teachers.findIndex(t => t.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'O\'qituvchi topilmadi.' });
  }
  db.teachers.splice(idx, 1);
  writeDB(db);
  res.json({ success: true });
});

/* =========================================================================
   7. 🔴 JONLI QR-DAVOMAT API — POST /api/attendance/qr
   Skaner (kamera yoki apparat) shtrix/QR kodni yuboradi, sahifa yangilanmaydi
   ========================================================================= */

app.post('/api/attendance/qr', async (req, res) => {
  const db = readDB();
  const { code } = req.body;

  if (!code || !String(code).trim()) {
    return res.status(400).json({ success: false, message: 'QR/Shtrix kod yuborilmadi.' });
  }

  const student = db.students.find(s => s.studQrCode === String(code).trim());
  if (!student) {
    return res.status(404).json({ success: false, message: `"${code}" kodi bo'yicha o'quvchi topilmadi.` });
  }

  if (hasAttendanceToday(db, student.id)) {
    return res.status(409).json({
      success: false,
      message: `${student.name} bugun allaqachon davomatga olingan.`
    });
  }

  if (!isScheduledToday(student)) {
    return res.status(409).json({
      success: false,
      message: `Bugun ${student.name} uchun dars kuni sifatida belgilanmagan.`
    });
  }

  const time = currentTimeStr();
  const record = {
    id: genId('att'),
    studentId: student.id,
    studentName: student.name,
    phone: student.phone || '',
    date: todayDateStr(),
    status: 'keldi',
    time,
    teacherId: student.teacherId
  };
  db.attendance.unshift(record); // eng tepaga — jonli jadval uchun

  chargeForLesson(db, student);
  writeDB(db);

  // Ota-onaga zumda Telegram xabar (asinxron, javobni kutmasdan yuboramiz)
  sendTelegramMessage(
    student.parentChatId,
    `Hurmatli ota-ona, farzandingiz ${student.name} bugun soat ${time} da darsga yetib keldi. ✅`
  );

  const stats = computeTodayStats(db);
  res.json({ success: true, record, student, stats });
});

/* =========================================================================
   8. STATISTIKA API
   ========================================================================= */

function computeTodayStats(db) {
  const today = todayDateStr();
  const todays = db.attendance.filter(a => a.date === today);
  const kelgan = todays.filter(a => a.status === 'keldi').length;
  const kelmagan = todays.filter(a => a.status === 'kelmadi').length;
  return { kelgan, kelmagan, jami: kelgan + kelmagan, totalStudents: db.students.length };
}

app.get('/api/stats/today', (req, res) => {
  const db = readDB();
  res.json({ success: true, stats: computeTodayStats(db) });
});

// Umumiy holat: bosh sahifa/admin panel bir so'rovda barcha kerakli ma'lumotni olishi uchun
app.get('/api/overview', (req, res) => {
  const db = readDB();
  const today = todayDateStr();
  res.json({
    success: true,
    students: db.students,
    teachers: db.teachers,
    attendanceToday: db.attendance.filter(a => a.date === today),
    center_profit: db.center_profit,
    history: db.history,
    stats: computeTodayStats(db)
  });
});

/* =========================================================================
   9. AVTOMATIK POYLOQCHI TAYMER — har minutda ishlaydi
   Dars tugash vaqti (lessonEnd) o'tgan, lekin bugun "keldi" deb belgilanmagan
   o'quvchini avtomatik "kelmadi" deb belgilaydi va pul amallarini bajaradi.
   ========================================================================= */

schedule.scheduleJob('* * * * *', async () => {
  const db = readDB();
  const nowMin = currentMinutes();
  const today = todayDateStr();
  let changed = false;

  for (const student of db.students) {
    if (!isScheduledToday(student)) continue; // bugun bu o'quvchi uchun dars kuni emas — hech narsa qilinmaydi

    const endMin = timeStrToMinutes(student.lessonEnd);
    if (endMin === null) continue; // dars vaqti kiritilmagan o'quvchini o'tkazib yuboramiz

    if (nowMin >= endMin && !hasAttendanceToday(db, student.id)) {
      const record = {
        id: genId('att'),
        studentId: student.id,
        studentName: student.name,
        phone: student.phone || '',
        date: today,
        status: 'kelmadi',
        time: currentTimeStr(),
        teacherId: student.teacherId
      };
      db.attendance.unshift(record);
      chargeForLesson(db, student);
      changed = true;

      sendTelegramMessage(
        student.parentChatId,
        `Hurmatli ota-ona, bugungi dars yakunlandi. Farzandingiz ${student.name} darsga KELMADI. ❌`
      );
    }
  }

  if (changed) {
    writeDB(db);
    console.log(`[${new Date().toISOString()}] Avtomatik "kelmadi" belgilash bajarildi.`);
  }
});

/* =========================================================================
   10. OYLIK ARXIVLASH TAYMERI — har oyning 1-sanasi, 00:00 da ishlaydi
   center_profit va o'qituvchilar oyligi arxivga tushadi, joriy balanslar
   nollanadi. Arxivda faqat oxirgi 3 oy saqlanadi.
   ========================================================================= */

schedule.scheduleJob('0 0 1 * *', () => {
  const db = readDB();

  const now = nowInTashkent();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthLabel = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const teacherSalarySnapshot = {};
  db.teachers.forEach(t => {
    teacherSalarySnapshot[t.id] = { name: t.name, salary: t.salary || 0 };
  });

  db.history.push({
    month: monthLabel,
    center_profit: db.center_profit || 0,
    teacher_salary: teacherSalarySnapshot
  });

  // Faqat oxirgi 3 oy saqlanadi
  db.history = db.history.slice(-3);

  // Joriy balanslarni nollash
  db.center_profit = 0;
  db.teachers.forEach(t => { t.salary = 0; });

  writeDB(db);
  console.log(`[${new Date().toISOString()}] ${monthLabel} oyi arxivga tushdi, joriy balanslar nollandi.`);
});

/* =========================================================================
   11. SERVERNI ISHGA TUSHIRISH
   ========================================================================= */

// database.json mavjud bo'lmasa, boshlang'ich fayl yaratamiz
if (!fs.existsSync(DB_FILE)) {
  writeDB(defaultDB());
}

initTelegramBot();

app.listen(PORT, () => {
  console.log(`Smart QR-Attendance CRM server ${PORT}-portda ishga tushdi.`);
});
