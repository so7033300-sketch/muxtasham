const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

const app = express();

// CORS xavfsizlik sozlamalarini kengaytiramiz (Brauzer bloklamasligi uchun)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Static fayllar 'public' papkasida ekanligini ko'rsatamiz
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

const DB_FILE = path.join(__dirname, 'database.json');

// Telegram Bot Sozlamasi
const BOT_TOKEN = '8955968685:AAEv-KraJbKvgWkpiHAREjecGI3F038N0io'; 
let bot = null;

if (BOT_TOKEN) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        bot.on('polling_error', (error) => {
            console.log("Telegram Bot bildirishnomasi:", error.message);
        });
        console.log("✅ Telegram Bot faol!");
    } catch (e) {
        console.log("Telegram bot xatosi:", e.message);
    }
}

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { students: [], teachers: [], attendance: [], history: { center_profit: [], teacher_salary: [] } };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { students: [], teachers: [], attendance: [], history: { center_profit: [], teacher_salary: [] } };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// --- API ENDPOINTS ---

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    const db = readDB();
    if (login === 'admin' && password === 'admin123') {
        return res.json({ success: true, role: 'admin' });
    }
    const teacher = db.teachers.find(t => t.login === login && t.password === password);
    if (teacher) {
        return res.json({ success: true, role: 'teacher', teacherId: teacher.id });
    }
    res.status(401).json({ success: false, message: "Login yoki parol xato!" });
});

app.post('/api/students', (req, res) => {
    const { name, phone, birthYear, fee, parentChatId } = req.body;
    const db = readDB();
    const newStudent = { id: Date.now().toString(), name, phone, birthYear, fee: parseInt(fee), balance: 0, parentChatId: parentChatId || null };
    db.students.push(newStudent);
    writeDB(db);
    res.json({ success: true, student: newStudent });
});

app.post('/api/students/pay', (req, res) => {
    const { studentId, amount } = req.body;
    const db = readDB();
    const student = db.students.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ success: false, message: "O'quvchi topilmadi" });
    student.balance += parseInt(amount);
    writeDB(db);
    res.json({ success: true, balance: student.balance });
});

app.post('/api/teachers', (req, res) => {
    const { name, subject, timeStart, timeEnd, days, login, password } = req.body;
    const db = readDB();
    const newTeacher = { id: Date.now().toString(), name, subject, timeStart, timeEnd, days, login, password, salary: 0 };
    db.teachers.push(newTeacher);
    writeDB(db);
    res.json({ success: true, teacher: newTeacher });
});

app.post('/api/attendance', (req, res) => {
    const { teacherId, studentId, status } = req.body;
    const db = readDB();
    const student = db.students.find(s => s.id === studentId);
    const teacher = db.teachers.find(t => t.id === teacherId);
    if (!student || !teacher) return res.status(404).json({ success: false, message: "Ma'lumot topilmadi" });

    // 1 darslik oylik to'lovni hisoblash (12 ta darsga bo'lamiz)
    const perLessonFee = Math.round(student.fee / 12);
    student.balance -= perLessonFee; // O'quvchidan dars pulini to'liq yechish
    
    // 50/50 bo'lish algoritmi
    const halfFee = Math.round(perLessonFee / 2);
    teacher.salary += halfFee; // 50% ustozning shaxsiy balansiga (oyligiga)
    
    // 50% Markaz sof foydasiga tushishi (NaN bo'lib qolmasligi uchun himoya bilan)
    if (typeof db.center_profit !== 'number') {
        db.center_profit = 0;
    }
    db.center_profit += halfFee; // 50% markaz hisobiga tushdi!
    
    // Davomat tarixini yozish
    db.attendance.push({ 
        date: new Date().toISOString().split('T')[0], 
        studentName: student.name, 
        teacherName: teacher.name, 
        status: status 
    });
    
    writeDB(db);

    // Telegram Bot orqali xabar yuborish qismi
    if (bot && student.parentChatId) {
        try {
            const statusText = status === 'keldi' ? "✅ darsga keldi." : "❌ darsga kelmadi.";
            bot.sendMessage(student.parentChatId, `Hurmatli ota-ona, farzandingiz ${student.name} bugun ${teacher.subject} darsiga ${statusText}`);
            if (student.balance <= -150000) {
                bot.sendMessage(student.parentChatId, `⚠️ DIQQAT! Farzandingiz ${student.name}ning qarzi ${Math.abs(student.balance).toLocaleString()} so'mga yetdi. Iltimos, to'lov qiling!`);
            }
        } catch (botErr) {
            console.log("Bot yuborish xatosi:", botErr.message);
        }
    }
    res.json({ success: true, studentBalance: student.balance, teacherSalary: teacher.salary, centerProfit: db.center_profit });
});

// Barcha ma'lumotlarni frontendga uzatish API havolasi
app.get('/api/data', (req, res) => {
    const db = readDB();
    const todayStr = new Date().toISOString().split('T')[0];

    // Har bir o'quvchi bugun darsda belgilanganmi yoki yo'qligini aniqlash
    const updatedStudents = (db.students || []).map(student => {
        const hasAttendedToday = (db.attendance || []).some(att => 
            att.date === todayStr && 
            att.studentName === student.name
        );
        return { ...student, attendedToday: hasAttendedToday };
    });

    res.json({
        students: updatedStudents,
        teachers: db.teachers || [],
        attendance: db.attendance || [],
        center_profit: db.center_profit || 0 // Frontend aniq o'qib olishi uchun markaz foydasini ham qo'shdik!
    });
});

// --- HTML SAHIFALARNI TO'G'RI YONALISHI (ROUTING) ---
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});
app.get('/ustoz.html', (req, res) => {
    res.sendFile(path.join(publicPath, 'ustoz.html'));
});

// Oy boshida arxivlash
schedule.scheduleJob('0 0 1 * *', function(){
    const db = readDB();
    const currentDate = new Date().toISOString().split('T')[0];
    db.history.center_profit.push({ date: currentDate, amount: db.center_profit || 0 });
    db.teachers.forEach(t => {
        db.history.teacher_salary.push({ date: currentDate, teacherId: t.id, teacherName: t.name, salary: t.salary });
        t.salary = 0;
    });
    db.center_profit = 0;
    if (db.history.center_profit.length > 3) db.history.center_profit.shift();
    writeDB(db);
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server ${PORT}-portda yonib turibdi!`));
