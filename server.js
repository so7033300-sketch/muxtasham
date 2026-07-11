const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DB_FILE = path.join(__dirname, 'database.json');
const BOT_TOKEN = 'Sizning_Telegram_Bot_Tokeningiz'; // Shu yerga Telegram Bot token qo'yiladi
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Ma'lumotlarni o'qish va yozish funksiyalari
function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { students: [], teachers: [], attendance: [], history: { center_profit: [], teacher_salary: [] } };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ---------------- ALGORITMLAR VA API ----------------

// 1. Tizimga kirish (Login)
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

// 2. Yangi o'quvchi qo'shish
app.post('/api/students', (req, res) => {
    const { name, phone, birthYear, fee, parentChatId } = req.body;
    const db = readDB();
    
    const newStudent = {
        id: Date.now().toString(),
        name,
        phone,
        birthYear,
        fee: parseInt(fee),
        balance: 0,
        parentChatId: parentChatId || null // Telegram xabarnoma uchun
    };
    
    db.students.push(newStudent);
    writeDB(db);
    res.json({ success: true, student: newStudent });
});

// 3. O'quvchi to'lov qilganda
app.post('/api/students/pay', (req, res) => {
    const { studentId, amount } = req.body;
    const db = readDB();
    const student = db.students.find(s => s.id === studentId);
    
    if (!student) return res.status(404).json({ success: false, message: "O'quvchi topilmadi" });
    
    student.balance += parseInt(amount);
    writeDB(db);
    res.json({ success: true, balance: student.balance });
});

// 4. Yangi o'qituvchi qo'shish
app.post('/api/teachers', (req, res) => {
    const { name, subject, timeStart, timeEnd, days, login, password } = req.body;
    const db = readDB();
    
    const newTeacher = {
        id: Date.now().toString(),
        name,
        subject,
        timeStart, // Masalan: "14:00"
        timeEnd,   // Masalan: "16:00"
        days,      // Masalan: ["Dushanba", "Chorshanba", "Juma"]
        login,
        password,
        salary: 0
    };
    
    db.teachers.push(newTeacher);
    writeDB(db);
    res.json({ success: true, teacher: newTeacher });
});

// 5. Davomat qilish va Balansni 50/50 bo'lish algoritmi
app.post('/api/attendance', (req, res) => {
    const { teacherId, studentId, status } = req.body; // status: 'keldi' yoki 'kelmadi'
    const db = readDB();
    
    const student = db.students.find(s => s.id === studentId);
    const teacher = db.teachers.find(t => t.id === teacherId);
    
    if (!student || !teacher) return res.status(404).json({ success: false, message: "Ma'lumot xato" });
    
    // Bir darslik narxni hisoblash (1 oyda 12 ta dars deb hisoblaymiz: haftasiga 3 kun)
    const perLessonFee = Math.round(student.fee / 12);
    
    // O'quvchidan pul yechish (Keldi yoki Kelmadi deyilsa ham baribir dars uchun yechiladi)
    student.balance -= perLessonFee;
    
    // 50/50 bo'lish
    const halfFee = Math.round(perLessonFee / 2);
    teacher.salary += halfFee;
    
    // Markaz foydasini saqlash uchun bazada center_profit'ni oshiramiz
    if(!db.center_profit) db.center_profit = 0;
    db.center_profit += halfFee;
    
    // Davomat tarixini yozish
    db.attendance.push({
        date: new Date().toISOString().split('T')[0],
        studentName: student.name,
        teacherName: teacher.name,
        status: status
    });
    
    writeDB(db);
    
    // --- TELEGRAM BOT ORQALI HABAR YUBORISH ---
    if (student.parentChatId) {
        // Davomat xabari
        const statusText = status === 'keldi' ? "✅ darsga keldi." : "❌ darsga kelmadi.";
        bot.sendMessage(student.parentChatId, `Hurmatli ota-ona, farzandingiz ${student.name} bugun ${teacher.subject} darsiga ${statusText}`);
        
        // Qarzdorlik xabari (-150 000 so'mdan oshsa)
        if (student.balance <= -150000) {
            bot.sendMessage(student.parentChatId, `⚠️ DIQQAT! Farzandingiz ${student.name}ning qarzi ${Math.abs(student.balance)} so'mga yyetdi. Iltimos, tez orada to'lovni amalga oshiring!`);
        }
    }
    
    res.json({ success: true, studentBalance: student.balance, teacherSalary: teacher.salary });
});

// 6. Ma'lumotlarni o'chirish va tozalash
app.delete('/api/clear/:type', (req, res) => {
    const type = req.params.type;
    const db = readDB();
    
    if (type === 'all') {
        db.students = [];
        db.teachers = [];
        db.attendance = [];
    } else if (type === 'attendance') {
        db.attendance = [];
    }
    
    writeDB(db);
    res.json({ success: true, message: "Tozalash bajarildi" });
});

// Ma'lumotlarni olish (Get) API'lari
app.get('/api/data', (req, res) => res.json(readDB()));

// 7. HAR OYNING 1-KUNIDA TOZALASH VA 3 OYLIK TARIXNI SAQLASH (CRON JOB)
schedule.scheduleJob('0 0 1 * *', function(){
    const db = readDB();
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Arxivga oylik foyda va oyliklarni olish
    db.history.center_profit.push({ date: currentDate, amount: db.center_profit || 0 });
    
    db.teachers.forEach(t => {
        db.history.teacher_salary.push({
            date: currentDate,
            teacherId: t.id,
            teacherName: t.name,
            salary: t.salary
        });
        t.salary = 0; // Oylikni yangi oy uchun nolga tushirish
    });
    
    db.center_profit = 0; // Markaz foydasini nolga tushirish
    
    // Tarixni faqat oxirgi 3 oylik qilib saqlash (Eng oxirgi 3 ta yozuv)
    if (db.history.center_profit.length > 3) db.history.center_profit.shift();
    if (db.history.teacher_salary.length > 45) db.history.teacher_salary.shift(); // 15 ta ustoz * 3 oy = 45
    
    writeDB(db);
    console.log("Aylik arxivlash muvaffaqiyatli bajarildi!");
});

// Serverni ishga tushirish
const PORT = 3000;
app.listen(PORT, () => console.log(`Server http://localhost:${PORT} portida muvaffaqiyatli ishlamoqda!`));
