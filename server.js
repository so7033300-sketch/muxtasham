const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const app = express();

// INTERNET BLOKLARINI VA CORS TAQIQLARINI BUTUNLAY YECHISH
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

// PULLIK POSTGRESQL BAZASIGA MAHKAM ZANJIRLASH
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// SAYT OCHILGANDA JONLI REJIMDA PUBLIC PAPKASINI ISHGA TUSHIRISH
app.use(express.static(path.join(__dirname, 'public')));

// BAZADA JADVALLAR BO'LMASA, AVTOMATIK PRO-REJIMDA YARATIB OLISH (ALLOWED_DAYS TEXT FORMATGA SOZLANDI)
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
                allowed_days TEXT, 
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
        console.log("🟢 PostgreSQL jadvallari Render serverida tayyor!");
    } finally { client.release(); }
}
initDatabaseTables();

// BARCHA MA'LUMOTLARNY SAQLASH (SAVE API) - FRONTEND VA BASE ULANISHI ZANJIRLANDI
app.post('/api/save-all', async (req, res) => {
    const { teachers, students, excelLog } = req.body; 
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); 
        await client.query('DELETE FROM students'); 
        await client.query('DELETE FROM teachers'); 
        await client.query('DELETE FROM excel_log');
        
        if (teachers && Array.isArray(teachers)) {
            for (let t of teachers) { 
                let daysText = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
                await client.query(`INSERT INTO teachers (id, name, subject, group_name, start_time, end_time, allowed_days, login, pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, 
                [t.id, t.name, t.subject, t.group_name, t.start_time, t.end_time, daysText, t.login, t.pass]); 
            }
        }
        
        if (students && Array.isArray(students)) {
            for (let s of students) { 
                await client.query(`INSERT INTO students (id, name, phone, balance, teacher_id, group_name, monthly_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                [s.id, s.name, s.phone || "", s.balance || 0, s.teacherId || null, s.groupName || s.group_name, s.monthlyPrice || 200000]); 
            }
        }
        
        if (excelLog && Array.isArray(excelLog)) {
            for (let l of excelLog) { 
                await client.query(`INSERT INTO excel_log (student_id, dars_time, name, date, status, sum, phone) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                [l.studentId || null, l.dars_time || l.darsTime || "00:00", l.name, l.date, l.status, l.sum || 0, l.phone || ""]); 
            }
        }
        
        await client.query('COMMIT'); 
        res.json({ success: true });
    } catch (err) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ success: false, error: err.message }); 
    } finally { client.release(); }
});

// BARCHA MA'LUMOTLARNI YUKLASH (LOAD API) - JONLI REJIM FORMATLARI MUKAMMAL QILINDI
app.get('/api/load-all', async (req, res) => {
    try {
        const teachersRes = await pool.query('SELECT * FROM teachers'); 
        const studentsRes = await pool.query('SELECT * FROM students'); 
        const logsRes = await pool.query('SELECT * FROM excel_log ORDER BY id DESC');
        res.json({
            success: true,
            teachers: teachersRes.rows.map(t => ({ 
                id: Number(t.id), 
                name: t.name, 
                subject: t.subject, 
                group_name: t.group_name, 
                start_time: t.start_time, 
                end_time: t.end_time, 
                allowed_days: t.allowed_days ? t.allowed_days.split(', ') : [], 
                login: t.login, 
                pass: t.pass 
            })),
            students: studentsRes.rows.map(s => ({ 
                id: Number(s.id), 
                name: s.name, 
                phone: s.phone, 
                balance: Number(s.balance), 
                teacherId: s.teacher_id ? Number(s.teacher_id) : null, 
                groupName: s.group_name, 
                monthlyPrice: Number(s.monthly_price) 
            })),
            excelLog: logsRes.rows.map(l => ({ 
                id: Number(l.id),
                studentId: l.student_id ? Number(l.student_id) : null, 
                dars_time: l.dars_time, 
                name: l.name, 
                date: l.date, 
                status: l.status, 
                sum: Number(l.sum), 
                phone: l.phone 
            }))
        });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// SAYT INTERNETDA 0 DAN OCHILGANDA TO'G'RIDAN-TO'G'RI KIRISH OYNASINI PORTLATIB OCHISH TIZIMI
app.get('*', (req, res) => { 
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

const PORT = process.env.PORT || 10000; 
app.listen(PORT, () => console.log(`🚀 Pullik Render serveri ${PORT}-portda daxshatli tezlikda ishga tushdi!`));
