const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
}));

app.options('*', cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// BAZADA JADVALLARNI TO'G'RI FORMATDA YARATISH (allowed_days ustuni TEXT qilinadi)
async function initDatabaseTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Agar eski jadval xalaqit berayotgan bo'lsa, uni to'g'ri ustunlar bilan qayta yaratish
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
        `);

        // Agar allowed_days turi eski massiv bo'lib qolgan bo'lsa, uni TEXT ga majburlash
        try {
            await client.query(`ALTER TABLE teachers ALTER COLUMN allowed_days TYPE TEXT;`);
        } catch(e) {
            // Agar allaqachon TEXT bo'lsa, xato bermaydi
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS students (
                id BIGINT PRIMARY KEY,
                name TEXT,
                phone TEXT,
                balance NUMERIC(15,2),
                teacher_id BIGINT,
                group_name TEXT,
                monthly_price NUMERIC(15,2) DEFAULT 200000
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS excel_log (
                id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                student_id BIGINT,
                dars_time TEXT,
                name TEXT,
                date TEXT,
                status TEXT,
                sum NUMERIC(15,2),
                phone TEXT
            );
        `);

        await client.query('COMMIT');
        console.log("🟢 PostgreSQL jadvallari to'g'ri tekst formatida tekshirildi!");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Jadvallarda xatolik:", err.message);
    } finally {
        client.release();
    }
}

initDatabaseTables();

app.post('/api/save-all', async (req, res) => {
    const { teachers, students, excelLog } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM students;');
        await client.query('DELETE FROM teachers;');
        await client.query('DELETE FROM excel_log;');

        if (teachers && Array.isArray(teachers)) {
            for (let t of teachers) {
                // allowed_days har qanday holatda matn ko'rinishida yoziladi
                let daysText = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
                await client.query(`
                    INSERT INTO teachers (id, name, subject, group_name, start_time, end_time, allowed_days, login, pass)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
                `, [t.id, t.name, t.subject, t.group_name, t.start_time, t.end_time, daysText, t.login, t.pass]);
            }
        }

        if (students && Array.isArray(students)) {
            for (let s of students) {
                await client.query(`
                    INSERT INTO students (id, name, phone, balance, teacher_id, group_name, monthly_price)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [s.id, s.name, s.phone, s.balance || 0, s.teacherId || null, s.groupName, s.monthlyPrice || 200000]);
            }
        }

        if (excelLog && Array.isArray(excelLog)) {
            for (let l of excelLog) {
                await client.query(`
                    INSERT INTO excel_log (student_id, dars_time, name, date, status, sum, phone)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `, [l.studentId || null, l.dars_time, l.name, l.date, l.status, l.sum || 0, l.phone || ""]);
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.get('/api/load-all', async (req, res) => {
    const client = await pool.connect();
    try {
        const teachersRes = await client.query('SELECT * FROM teachers;');
        const studentsRes = await client.query('SELECT * FROM students;');
        const logsRes = await client.query('SELECT * FROM excel_log ORDER BY id DESC;');

        const teachers = teachersRes.rows.map(t => ({
            id: Number(t.id), name: t.name, subject: t.subject, group_name: t.group_name,
            start_time: t.start_time, end_time: t.end_time, allowed_days: t.allowed_days ? t.allowed_days.split(', ') : [],
            login: t.login, pass: t.pass
        }));

        const students = studentsRes.rows.map(s => ({
            id: Number(s.id), name: s.name, phone: s.phone, balance: Number(s.balance),
            teacherId: s.teacher_id ? Number(s.teacher_id) : null, groupName: s.group_name, monthlyPrice: Number(s.monthly_price)
        }));

        const excelLog = logsRes.rows.map(l => ({
            id: Number(l.id), studentId: l.student_id ? Number(l.student_id) : null,
            dars_time: l.dars_time, name: l.name, date: l.date, status: l.status, sum: Number(l.sum), phone: l.phone
        }));

        res.json({ success: true, teachers, students, excelLog });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Server ochiq!`); });
