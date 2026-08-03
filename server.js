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
    students: [],   // {id, name, group, teacherId, fee, studQrCode, lessonStart, lessonEnd, parentChatId, balance}
    teachers: [],   // {id, name, salary}
    attendance: [], // {id, studentId, studentName, date, status, time, teacherId}
    center_profit: 0,
    history: []     // {month, center_profit, teacher_salary: {teacherId: amount, ...}}
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
    db.teachers = db.teachers || [];
    db.attendance = db.attendance || [];
    db.center_profit = db.center_profit || 0;
    db.history = db.history || [];
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

// Yangi o'quvchi qo'shish
app.post('/api/students', (req, res) => {
  const db = readDB();
  const {
    name, group, teacherId, fee,
    studQrCode, lessonStart, lessonEnd,
    parentChatId
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
    parentChatId, balance
  } = req.body;

  if (studQrCode && db.students.some(s => s.studQrCode === studQrCode && s.id !== student.id)) {
    return res.status(400).json({ success: false, message: 'Bu QR/Shtrix kod boshqa o\'quvchiga band.' });
  }

  if (name !== undefined) student.name = name;
  if (group !== undefined) student.group = group;
  if (teacherId !== undefined) student.teacherId = teacherId;
  if (fee !== undefined) student.fee = Number(fee);
  if (studQrCode !== undefined) student.studQrCode = studQrCode;
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
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'O\'qituvchi ismi majburiy.' });
  }
  const newTeacher = { id: genId('tch'), name, salary: 0 };
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
  const { name, salary } = req.body;
  if (name !== undefined) teacher.name = name;
  if (salary !== undefined) teacher.salary = Number(salary);
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

  const time = currentTimeStr();
  const record = {
    id: genId('att'),
    studentId: student.id,
    studentName: student.name,
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
    const endMin = timeStrToMinutes(student.lessonEnd);
    if (endMin === null) continue; // dars vaqti kiritilmagan o'quvchini o'tkazib yuboramiz

    if (nowMin >= endMin && !hasAttendanceToday(db, student.id)) {
      const record = {
        id: genId('att'),
        studentId: student.id,
        studentName: student.name,
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

app.listen(PORT, () => {
  console.log(`Smart QR-Attendance CRM server ${PORT}-portda ishga tushdi.`);
});
