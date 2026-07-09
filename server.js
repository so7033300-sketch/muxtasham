const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();

// RENDER SERVERI XAVFSIZLIK SOZLAMALARI (CORS BLOKLARINI TECH REJIMDA YECHISh)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// RENDER PULLIK POSTGRESQL BAZASI BILAN ULANISH TARMOG'I
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render pullik bazasi uchun majburiy xavfsizlik sertifikati
});

// Front-end fayllarni internet foydalanuvchilariga to'g'ridan-to'g'ri ko'rsatish
app.use(express.static(path.join(__dirname, 'public')));

// 1. BAZADA JADVALLAR BULMASA, AVTOMATIK PRO-REJIMDA YARATIB OLISH (0 TA XATO KAFOLATI)
async function initDatabaseTables() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS teachers (
                id BIGINT PRIMARY KEY,
                name TEXT,
                subject TEXT,
                group_name TEXT,
                start_time TEXT,
                end_time TEXT,
                allowed_days INTEGER[],
                login TEXT,
                pass TEXT
            );
            CREATE TABLE IF NOT EXISTS students (
                id BIGINT PRIMARY KEY,
                name TEXT,
                phone TEXT,
                balance NUMERIC DEFAULT 0,
                teacher_id BIGINT,
                group_name TEXT,
                monthly_price NUMERIC DEFAULT 200000
            );
            CREATE TABLE IF NOT EXISTS excel_log (
                id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                student_id BIGINT,
                dars_time TEXT,
                name TEXT,
                date TEXT,
                status TEXT,
                sum NUMERIC DEFAULT 0,
                phone TEXT
            );
        `);
        console.log("🟢 PostgreSQL jadvallari Render serverida muvaffaqiyatli tekshirildi/yaratildi!");
    } catch (err) {
        console.error("❌ Jadvallarni yaratishda xato:", err.message);
    } finally {
        client.release();
    }
}
initDatabaseTables();
// 2. HAMMA MA'LUMOTLARNI RENDER BULUTLI BAZASIGA SAQLASH (SAVE API)
app.post('/api/save-all', async (req, res) => {
    const { teachers, students, excelLog } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Render bazasini sinxronlashdan oldin tozalash
        await client.query('DELETE FROM students');
        await client.query('DELETE FROM teachers');
        await client.query('DELETE FROM excel_log');

        for (let t of teachers) {
            await client.query(
                `INSERT INTO teachers (id, name, subject, group_name, start_time, end_time, allowed_days, login, pass) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [t.id, t.name, t.subject, t.groupName, t.startTime, t.endTime, t.allowedDays || [], t.login, t.pass]
            );
        }

        for (let s of students) {
            await client.query(
                `INSERT INTO students (id, name, phone, balance, teacher_id, group_name, monthly_price) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [s.id, s.name, s.phone || "", s.balance || 0, s.teacherId, s.groupName, s.monthlyPrice || 200000]
            );
        }

        for (let l of excelLog) {
            await client.query(
                `INSERT INTO excel_log (student_id, dars_time, name, date, status, sum, phone) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [l.studentId || null, l.darsTime || "00:00", l.name, l.date, l.status, l.sum || 0, l.phone || ""]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Hamma ma'lumotlar Render pullik bazasiga muhrlandi! 👍" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// 3. JONLI INTERNET REJIMIDA BARCHA MA'LUMOTLARNI YUKLAB OLISH (LOAD API)
app.get('/api/load-all', async (req, res) => {
    try {
        const teachersRes = await pool.query('SELECT * FROM teachers');
        const studentsRes = await pool.query('SELECT * FROM students');
        const logsRes = await pool.query('SELECT * FROM excel_log ORDER BY id DESC');

        const teachers = teachersRes.rows.map(t => ({
            id: Number(t.id), name: t.name, subject: t.subject, groupName: t.group_name,
            startTime: t.start_time, endTime: t.end_time, allowedDays: t.allowed_days, login: t.login, pass: t.pass
        }));

        const students = studentsRes.rows.map(s => ({
            id: Number(s.id), name: s.name, phone: s.phone, balance: Number(s.balance),
            teacherId: Number(s.teacher_id), groupName: s.group_name, monthlyPrice: Number(s.monthly_price)
        }));

        const excelLog = logsRes.rows.map(l => ({
            studentId: l.student_id ? Number(l.student_id) : null,
            darsTime: l.dars_time, name: l.name, date: l.date, status: l.status, sum: Number(l.sum), phone: l.phone
        }));

        res.json({ success: true, teachers, students, excelLog });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Sayt har qanday sahifadan noldan ochilganda index.html ni birinchi yuklash
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000; // Render port sozlamasi
app.listen(PORT, () => console.log(`🚀 Pullik Render xizmati ${PORT}-portda lahzada ishga tushdi!`));
