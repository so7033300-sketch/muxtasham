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

// Telegram Bot Token
const BOT_TOKEN = '8955968685:AAEv-KraJbKvgWkpiHAREjecGI3F038N0io'; 
let bot = null;

if (BOT_TOKEN) {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        bot.on('polling_error', (error) => console.log("Bot bildirishnomasi:", error.message));
        console.log("✅ Telegram Bot faol!");
    } catch (e) {
        console.log("Telegram bot xatosi:", e.message);
    }
}

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            const initialData = { students: [], teachers: [], attendance: [], center_profit: 0, history: { center_profit: [], teacher_salary: [] } };
            fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
            return initialData;
        }
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (typeof db.center_profit !== 'number') db.center_profit = 0;
        return db;
    } catch (e) {
        return { students: [], teachers: [], attendance: [], center_profit: 0, history: { center_profit: [], teacher_salary: [] } };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
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
    const { name, phone, birthYear, fee, parentChatId, teacherId, groupName } = req.body;
    const db = readDB();
    
    const newStudent = { 
        id: Date.now().toString(), 
        name, 
        phone, 
        birthYear, 
        fee: parseInt(fee), 
        balance: 0, 
        parentChatId: parentChatId || null,
        teacherId: teacherId,
        groupName: groupName || "Asosiy"
    };
    
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

app.delete('/api/teachers/:id', (req, res) => {
    const teacherId = req.params.id;
    const db = readDB();
    db.teachers = db.teachers.filter(t => t.id !== teacherId);
    writeDB(db);
    res.json({ success: true });
});

// QULFLANISHNI ID BO'YICHA 100% TA'MINLAYDIGAN MUZLATISH BACKENDI
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
    db.center_profit += halfFee; // 50% Markaz sof foydasiga o'tdi
    
    // Davomat ro'yxatiga o'quvchining ID raqamini qat'iy ulab saqlaymiz
    db.attendance.push({ 
        date: new Date().toISOString().split('T'), 
        studentId: student.id, 
        studentName: student.name, 
        teacherName: teacher.name, 
        status: status 
    });
    writeDB(db);

    if (bot && student.parentChatId) {
        try {
            const statusText = status === 'keldi' ? "✅ darsga keldi." : "❌ darsga kelmadi.";
            bot.sendMessage(student.parentChatId, `Hurmatli ota-ona, farzandingiz ${student.name} bugun ${teacher.subject} darsiga ${statusText}`);
            if (student.balance <= -150000) {
                bot.sendMessage(student.parentChatId, `⚠️ DIQQAT! Farzandingiz ${student.name}ning qarzi ${Math.abs(student.balance).toLocaleString()} so'mga yetdi. Iltimos, to'lov qiling!`);
            }
        } catch (botErr) {
            console.log("Bot xatosi:", botErr.message);
        }
    }
    res.json({ success: true });
});
app.delete('/api/clear/:type', (req, res) => {
    const type = req.params.type;
    const db = readDB();
    if (type === 'all') { db.students = []; db.teachers = []; db.attendance = []; db.center_profit = 0; }
    else if (type === 'attendance') { db.attendance = []; }
    writeDB(db);
    res.json({ success: true });
});

// HARF XATOLARIDAN QAT'IY NAZAR ID BO'YICHA QUFLAYDIGAN DATA API
app.get('/api/data', (req, res) => {
    const db = readDB();
    const todayStr = new Date().toISOString().split('T');

    const updatedStudents = db.students.map(student => {
        const hasAttendedToday = db.attendance.some(att => 
            att.date === todayStr && 
            (att.studentId === student.id || att.studentName.toLowerCase().trim() === student.name.toLowerCase().trim())
        );
        return { ...student, attendedToday: hasAttendedToday };
    });

    res.json({
        students: updatedStudents,
        teachers: db.teachers,
        attendance: db.attendance,
        center_profit: db.center_profit
    });
});

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(publicPath, 'admin.html')));
app.get('/ustoz.html', (req, res) => res.sendFile(path.join(publicPath, 'ustoz.html')));

schedule.scheduleJob('0 0 1 * *', function(){
    const db = readDB();
    const currentDate = new Date().toISOString().split('T');
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
app.listen(PORT, '0.0.0.0', () => console.log(`Server Renderda ${PORT}-portda barqaror yondi!`));
