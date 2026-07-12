const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
const DB_FILE = path.join(__dirname, 'database.json');

// --- TELEGRAM BOT SOZLAMASI (YANGILANGAN QISQA VA LONDA MATN BILAN) ---
const BOT_TOKEN = '8812254760:AAHwgpOASA8J66YaPIeMCs5E_k9uH_pFs58'; 
let bot = null;

if (BOT_TOKEN && BOT_TOKEN.includes(':')) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: { autoStart: true, params: { timeout: 10 } } });
        bot.deleteWebHook().then(() => console.log("✅ Bot faol!"));

        bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const firstName = msg.from.first_name || "Foydalanuvchi";
            
            // Qisqa, londa va tushunarli yangi matn (Ustoz ismini ham so'raydi)
            const welcomeMessage = `👋 Assalomu alaykum, ${firstName}!\n\n` +
                                   `<b>"Muxtasham L/C"</b> bildirishnoma tizimiga xush kelibsiz.\n\n` +
                                   `📌 Sizning shaxsiy Chat ID raqamingiz:\n<code>${chatId}</code>\n\n` +
                                   `👉 Raqam ustiga bosib nusxalang va pastdagi tugma orqali farzandingizning <b>Ism-Familiyasi</b> hamda <b>Qaysi ustozda</b> o'qishini qo'shib adminga jo'nating. Admin @sobirov_cybersecurity`;
            
            const inlineKeyboard = {
                reply_markup: {
                    inline_keyboard: [[{ text: "💬 ID va Ma'lumotlarni adminga jo'natish", url: "https://t.me" }]]
                }
            };
            
            bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML', ...inlineKeyboard });
        });
    } catch (e) { console.log(e.message); }
}

function getTashkentDate() {
    const options = { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(new Date());
    return `${year}-${month}-${day}`;
}

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { students: [], teachers: [], attendance: [], center_profit: 0, history: { center_profit: [], teacher_salary: [] } };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.history) db.history = { center_profit: [], teacher_salary: [] };
        if (typeof db.center_profit !== 'number') db.center_profit = 0;
        return db;
    } catch (e) { return { students: [], teachers: [], attendance: [], center_profit: 0, history: { center_profit: [], teacher_salary: [] } }; }
}

function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8'); }
// --- HAR MINUTDA DARS TUGASHINI POYLASH TAYMERI ---
schedule.scheduleJob('* * * * *', function() {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tashkent"}));
    const currentTimeStr = now.toTimeString().substring(0, 5);
    const currentDayIndex = now.getDay();
    const daysUz = { 0: "yakshanba", 1: "dushanba", 2: "seshanba", 3: "chorshanba", 4: "payshanba", 5: "juma", 6: "shanba" };
    const todayName = daysUz[currentDayIndex];
    const db = readDB();
    
    db.teachers.forEach(teacher => {
        const teacherDaysString = teacher.days.join(' ').toLowerCase();
        if (teacherDaysString.includes(todayName) && teacher.timeEnd === currentTimeStr) {
            const groupStudents = db.students.filter(s => s.teacherId === teacher.id);
            groupStudents.forEach(student => {
                if (bot && student.parentChatId) {
                    try {
                        const finishMessage = `🔔 <b>Dars yakunlandi!</b>\n\nHurmatli ota-ona, farzandingiz <b>${student.name}</b>ning bugungi <b>${teacher.subject}</b> darsi tugadi va barcha o'quvchilar uyiga ketdi. 🚀\n\n✍️ Savollar bo'lsa: @sobirov_cybersecurity`;
                        bot.sendMessage(student.parentChatId, finishMessage, { parse_mode: 'HTML' });
                    } catch (err) { console.log(err.message); }
                }
            });
        }
    });
});

// --- HAR OYNING 1-SANASIDA ARXIVLASH TAYMERI ---
schedule.scheduleJob('0 0 1 * *', function() {
    const db = readDB();
    const currentTashkentDate = getTashkentDate();
    const currentMonthStr = currentTashkentDate.substring(0, 7);

    db.history.center_profit.push({ date: currentMonthStr, amount: db.center_profit || 0 });

    db.teachers.forEach(t => {
        db.history.teacher_salary.push({ date: currentMonthStr, teacherName: t.name, subject: t.subject, salary: t.salary || 0 });
        t.salary = 0;
    });

    db.center_profit = 0;

    if (db.history.center_profit.length > 3) db.history.center_profit.shift();
    
    const maxTeacherRecords = db.teachers.length * 3;
    while (db.history.teacher_salary.length > maxTeacherRecords && maxTeacherRecords > 0) {
        db.history.teacher_salary.shift();
    }

    writeDB(db);
    console.log("📊 Arxiv saqlandi!");
});
// --- CRM API ENDPOINTS ---
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const db = readDB();
    if (login === 'admin' && password === 'admin123') return res.json({ success: true, role: 'admin' });
    const teacher = db.teachers.find(t => t.login === login && t.password === password);
    if (teacher) return res.json({ success: true, role: 'teacher', teacherId: teacher.id });
    res.status(401).json({ success: false, message: "Login yoki parol xato!" });
});

app.post('/api/students', (req, res) => {
    const { name, phone, birthYear, fee, parentChatId, teacherId, groupName } = req.body;
    const db = readDB();
    const newStudent = { id: Date.now().toString(), name, phone, birthYear, fee: parseInt(fee), balance: 0, parentChatId: parentChatId || null, teacherId, groupName: groupName || "Asosiy" };
    db.students.push(newStudent);
    writeDB(db);
    res.json({ success: true, student: newStudent });
});

app.post('/api/students/pay', (req, res) => {
    const { studentId, amount } = req.body;
    const db = readDB();
    const student = db.students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ success: false });
    student.balance += parseInt(amount);
    writeDB(db);
    res.json({ success: true });
});

app.delete('/api/students/:id', (req, res) => {
    const db = readDB();
    db.students = db.students.filter(s => s.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

app.post('/api/teachers', (req, res) => {
    const { name, subject, timeStart, timeEnd, days, login, password } = req.body;
    const db = readDB();
    const newTeacher = { id: Date.now().toString(), name, subject, timeStart, timeEnd, days, login, password, salary: 0 };
    db.teachers.push(newTeacher);
    writeDB(db);
    res.json({ success: true });
});

app.delete('/api/teachers/:id', (req, res) => {
    const db = readDB();
    db.teachers = db.teachers.filter(t => t.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
});

// OXIRI TO'G'RILANGAN, ARALASHIB KETMAYDIGAN TOZA DAVOMAT BILDIRISHNOMASI
app.post('/api/attendance', (req, res) => {
    const { teacherId, studentId, status } = req.body;
    const db = readDB();
    const student = db.students.find(s => s.id === studentId);
    const teacher = db.teachers.find(t => t.id === teacherId);
    if (!student || !teacher) return res.status(404).json({ success: false });

    const perLessonFee = Math.round(student.fee / 12);
    student.balance -= perLessonFee;
    const halfFee = Math.round(perLessonFee / 2);
    teacher.salary += halfFee;
    db.center_profit += halfFee;
    
    db.attendance.push({ 
        date: getTashkentDate(), 
        studentId: student.id, 
        studentName: student.name,
        teacherId: teacherId,
        teacherName: teacher.name,
        groupName: student.groupName,
        status: status 
    });
    writeDB(db);

    if (bot && student.parentChatId) {
        try {
            // Tushunarsiz takrorlanishlar olib tashlandi: faqat "✅ darsga keldi" yoki "❌ darsga kelmadi" boradi!
            const statusText = status === 'keldi' ? "✅ darsga keldi." : "❌ darsga kelmadi.";
            bot.sendMessage(student.parentChatId, `Hurmatli ota-ona, farzandingiz ${student.name} bugun ${teacher.subject} darsiga ${statusText}`);
        } catch (e) {}
    }
    res.json({ success: true });
});

app.delete('/api/clear/:type', (req, res) => {
    const db = readDB();
    if (req.params.type === 'all') { db.students = []; db.teachers = []; db.attendance = []; db.center_profit = 0; db.history = { center_profit: [], teacher_salary: [] }; }
    else if (req.params.type === 'attendance') db.attendance = [];
    writeDB(db);
    res.json({ success: true });
});

app.get('/api/data', (req, res) => {
    const db = readDB();
    const todayStr = getTashkentDate();
    const updatedStudents = db.students.map(student => {
        const hasAttendedToday = db.attendance.some(att => att.date === todayStr && att.studentId === student.id && att.groupName === student.groupName);
        return { ...student, attendedToday: hasAttendedToday };
    });
    res.json({ students: updatedStudents, teachers: db.teachers, attendance: db.attendance, center_profit: db.center_profit, history: db.history });
});

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(publicPath, 'admin.html')));
app.get('/ustoz.html', (req, res) => res.sendFile(path.join(publicPath, 'ustoz.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server faol`));
