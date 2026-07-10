// 1. BACKEND SERVER HAVOLASI
const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com";

// Tizim yuklanganda JONLI SERVERDAN ma'lumotlarni majburiy tortib olish
document.addEventListener("DOMContentLoaded", async () => {
    // Har qanday qurilmadan kirganda birinchi bo'lib bazani jonli yangilaymiz
    await syncDataFromDatabaseSilently();

    if (document.getElementById('teachers-rows')) renderTeachers();
    if (document.getElementById('students-rows')) renderStudents();
    if (document.getElementById('excel-rows')) renderExcelLog();
    if (document.getElementById('center-profit')) updateMoliyaGrid();

    if (window.location.pathname.includes('ustoz.html') || document.getElementById('excel-rows') === null) {
        initTeacherCabinet();
    }
    
    initPhoneFormatters();
    initTeacherGroupDropdownSystem();
});

// BAZADAN TOZA NUQLANI ORQA FONDA SEZDIRMASDAN YUKLAB OLISH FUNKSIYASI
async function syncDataFromDatabaseSilently() {
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`);
        const result = await response.json();
        if (result.success) {
            localStorage.setItem('teachers', JSON.stringify(result.teachers || []));
            localStorage.setItem('students', JSON.stringify(result.students || []));
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || []));
        }
    } catch (e) { console.error("Jonli sinxronizatsiyada xato:", e.message); }
}

// MA'LUMOTLARNI BACKEND-GA AUTOMAT SAQLASH
async function uploadLocalDataToBackend() {
    let dataToSend = {
        teachers: JSON.parse(localStorage.getItem('teachers')) || [],
        students: JSON.parse(localStorage.getItem('students')) || [],
        excelLog: JSON.parse(localStorage.getItem('excelLog')) || []
    };
    try {
        await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });
    } catch (error) { console.error("Serverga avto-yuklashda xato:", error.message); }
}
// 📱 TELEFON RAQAMINI AVTOMATIK +998 90 123 45 67 FORMATIGA SOLISH TIZIMI
function initPhoneFormatters() {
    const phoneInputs = document.querySelectorAll('#s-phone, #ts-phone, [id*="phone"]');
    phoneInputs.forEach(input => {
        if (!input) return;
        if (input.value === "" || input.value === "+998 ") input.value = "+998 ";

        input.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith("+998")) { e.target.value = "+998 "; return; }
            let digits = val.substring(4).replace(/\D/g, '');
            if (digits.length > 9) digits = digits.substring(0, 9);

            let formatted = "+998 ";
            if (digits.length > 0) formatted += digits.substring(0, 2);
            if (digits.length > 2) formatted += " " + digits.substring(2, 5);
            if (digits.length > 5) formatted += " " + digits.substring(5, 7);
            if (digits.length > 7) formatted += " " + digits.substring(7, 9);
            
            e.target.value = formatted;
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value.length <= 5) e.preventDefault();
        });
    });
}

// 📦 USTOZ TANLANGANDA UNING MAVJUD GURUHLARINI RO'YXAT QILISH TIZIMI
function initTeacherGroupDropdownSystem() {
    const teacherSelect = document.getElementById('s-teacher');
    const groupInput = document.getElementById('s-group');
    if (!teacherSelect || !groupInput) return;

    let groupSelect = document.getElementById('s-group-select');
    if (!groupSelect) {
        groupSelect = document.createElement('select');
        groupSelect.id = 's-group-select';
        groupSelect.className = 'premium-input';
        groupSelect.style.background = '#120e07'; groupSelect.style.color = 'white';
        groupSelect.style.padding = '15px'; groupSelect.style.borderRadius = '12px';
        groupSelect.style.border = '2px solid rgba(255,255,255,0.08)'; groupSelect.style.width = '100%';
        groupSelect.style.marginTop = '8px'; groupSelect.style.display = 'none';
        groupInput.parentElement.appendChild(groupSelect);
    }

    teacherSelect.addEventListener('change', () => {
        const selectedTeacherId = teacherSelect.value;
        let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
        let students = JSON.parse(localStorage.getItem('students')) || [];
        
        const foundTeacher = teachers.find(t => Number(t.id) === Number(selectedTeacherId));
        if (!foundTeacher) return;

        let teacherGroups = new Set();
        if (foundTeacher.group_name) teacherGroups.add(foundTeacher.group_name);
        students.forEach(s => {
            if (Number(s.teacherId) === Number(selectedTeacherId) && s.groupName) teacherGroups.add(s.groupName);
        });

        groupSelect.innerHTML = '<option value="new_group" selected>➕ Yangi guruh yozish...</option>';
        teacherGroups.forEach(g => { groupSelect.innerHTML += `<option value="${g}">📦 Mavjud guruh: ${g}</option>`; });

        groupSelect.style.display = 'block';
        groupInput.placeholder = "Yangi guruh nomini yozing"; groupInput.value = "";

        groupSelect.onchange = () => {
            if (groupSelect.value === 'new_group') {
                groupInput.style.display = 'block'; groupInput.value = ""; groupInput.focus();
            } else { groupInput.value = groupSelect.value; }
        };
    });
}
// 4. O'QITUVCHINI QO'SHISH (ADMIN PANEL)
async function addTeacher(event) {
    event.preventDefault();
    await syncDataFromDatabaseSilently(); // Eski qurilma ma'lumotlarini tozalab yuborishni oldini olish

    const name = document.getElementById('teacherName')?.value.trim() || document.getElementById('t-name')?.value.trim();
    const subject = document.getElementById('teacherSubject')?.value.trim() || document.getElementById('t-subject')?.value.trim();
    const group_name = document.getElementById('teacherGroup')?.value.trim() || document.getElementById('t-group')?.value.trim();
    let start_time = document.getElementById('startTime')?.value || document.getElementById('t-start')?.value || "14:00";
    let end_time = document.getElementById('endTime')?.value || document.getElementById('t-end')?.value || "16:00";
    const login = document.getElementById('teacherLogin')?.value.trim() || document.getElementById('t-login')?.value.trim();
    const pass = document.getElementById('teacherPass')?.value.trim() || document.getElementById('t-pass')?.value.trim();

    const allowed_days = [];
    document.querySelectorAll('input[name="t-days"]:checked, input[name="days"]:checked').forEach(cb => allowed_days.push(cb.value));

    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    const newTeacher = { id: Date.now(), name, subject, group_name, start_time, end_time, allowed_days, login, pass };
    teachers.push(newTeacher);
    localStorage.setItem('teachers', JSON.stringify(teachers));

    alert("✅ O'qituvchi muvaffaqiyatli qo'shildi!");
    event.target.reset();
    await uploadLocalDataToBackend(); // Srazu bazaga qulflash
    renderTeachers();
    updateMoliyaGrid();
}

// 5. O'QITUVCHILAR JADVALINI CHIZISH
function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return; rows.innerHTML = "";
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    teachers.forEach((t, i) => {
        let daysDisplay = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
        let teacherTotalEarned = excelLog
            .filter(l => l.status === 'Keldi' && Number(l.teacherId || l.teacher_id) === Number(t.id))
            .reduce((sum, current) => sum + (current.sum || 0), 0);
        let teacherSalary = teacherTotalEarned * 0.5;

        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${t.name}</b><br><span style="color:#fbbf24">${t.subject}</span><br><small>${t.start_time}-${t.end_time} (${daysDisplay})</small></td>
                <td>Login: ${t.login}<br>Parol: ${t.pass}</td>
                <td style="text-align: right; color:#28a745; font-weight:bold;">${teacherSalary.toLocaleString()} UZS</td>
                <td><button onclick="deleteTeacher(${t.id})" style="color:#ff4747; background:none; border:none; cursor:pointer; font-weight:bold;">❌ O'chirish</button></td>
            </tr>
        `;
    });
    updateTeacherSelect();
}

async function deleteTeacher(id) {
    if(!confirm("O'qituvchini o'chirishni xohlaysizmi?")) return;
    await syncDataFromDatabaseSilently();
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers = teachers.filter(t => t.id !== id);
    localStorage.setItem('teachers', JSON.stringify(teachers));
    await uploadLocalDataToBackend();
    renderTeachers(); updateMoliyaGrid();
}

function updateTeacherSelect() {
    const select = document.getElementById('s-teacher');
    if (!select) return; select.innerHTML = '<option value="" disabled selected>Ustozni tanlang</option>';
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers.forEach(t => { select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`; });
}

// 6. O'QUVCHINI QO'SHISH (ADMIN PANEL)
async function addStudent(event) {
    event.preventDefault();
    await syncDataFromDatabaseSilently();

    const name = document.getElementById('s-name')?.value.trim();
    const phone = document.getElementById('s-phone')?.value.trim();
    const balance = Number(document.getElementById('s-balance')?.value) || 0;
    const teacherId = document.getElementById('s-teacher')?.value;
    const groupName = document.getElementById('s-group')?.value.trim();
    const monthlyPrice = Number(document.getElementById('s-price')?.value) || 200000;

    let students = JSON.parse(localStorage.getItem('students')) || [];
    const newStudent = { id: Date.now(), name, phone, balance, teacherId: teacherId ? Number(teacherId) : null, groupName, monthlyPrice };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    
    const now = new Date();
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    excelLog.push({
        id: Date.now(), studentId: newStudent.id, teacherId: newStudent.teacherId, teacher_id: newStudent.teacherId, name: name, dars_time: "00:00",
        date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5), status: "Yangi talaba", sum: 0, phone: phone
    });
    localStorage.setItem('excelLog', JSON.stringify(excelLog));

    alert("✅ Yangi o'quvchi ro'yxatga olindi!");
    event.target.reset();
    if (document.getElementById('s-group-select')) document.getElementById('s-group-select').style.display = 'none';

    await uploadLocalDataToBackend();
    renderStudents(); renderExcelLog(); updateMoliyaGrid(); initPhoneFormatters();
}
// 7. O'QUVCHILAR JADVALINI CHIZISH
function renderStudents() {
    const rows = document.getElementById('students-rows');
    if (!rows) return; rows.innerHTML = "";
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    
    students.forEach((s, i) => {
        const teacher = teachers.find(t => Number(t.id) === Number(s.teacherId));
        const teacherNameDisplay = teacher ? teacher.name : "Yo'q";

        let rowStyle = ""; let textStyle = "";
        if (s.balance < -150000) rowStyle = `style="background-color: rgba(255, 71, 71, 0.25) !important;"`;
        else if (s.balance < -100000) textStyle = `style="color: #ff4747 !important;"`;

        rows.innerHTML += `
            <tr class="student-search-row" ${rowStyle} data-name="${s.name.toLowerCase()}" data-phone="${s.phone}">
                <td ${textStyle}>${i+1}</td>
                <td ${textStyle}><b>${s.name}</b><br><small>${s.phone}</small></td>
                <td ${textStyle}>${teacherNameDisplay}</td>
                <td ${textStyle}>${s.groupName}</td>
                <td style="font-weight:bold; ${s.balance < 0 ? 'color:#ff4747;' : 'color:#fbbf24;'}">${s.balance.toLocaleString()} UZS</td>
                <td>
                    <div style="display:flex; gap:10px;">
                        <button onclick="addStudentBalance(${s.id})" style="background:#28a745; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">➕ To'lov</button>
                        <button onclick="deleteStudent(${s.id})" style="color:#ff4747; background:none; border:none; cursor:pointer; font-weight:bold;">❌ O'chirish</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function filterStudents() {
    const searchInput = (document.getElementById('search-student-input') || document.querySelector('[placeholder*="qidirish"]'))?.value.toLowerCase().trim();
    document.querySelectorAll('.student-search-row').forEach(row => {
        const name = row.getAttribute('data-name') || ''; const phone = row.getAttribute('data-phone') || '';
        row.style.display = (name.includes(searchInput) || phone.includes(searchInput)) ? "" : "none";
    });
}

async function addStudentBalance(studentId) {
    let amount = prompt("To'lov summasini kiriting (UZS):", "200000");
    if (amount === null || amount.trim() === "") return;
    let parsedAmount = Math.abs(Number(amount)); if (isNaN(parsedAmount) || parsedAmount === 0) return;

    await syncDataFromDatabaseSilently(); // Boshqa telefondagi oxirgi holatni olish

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => s.id == studentId);
    if (student) {
        student.balance += parsedAmount;
        localStorage.setItem('students', JSON.stringify(students));
        
        const now = new Date();
        let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
        excelLog.push({
            id: Date.now(), studentId: student.id, teacherId: student.teacherId, teacher_id: student.teacherId, name: student.name, dars_time: "00:00",
            date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5), status: "To'lov qilindi", sum: parsedAmount, phone: student.phone
        });
        localStorage.setItem('excelLog', JSON.stringify(excelLog));

        alert(`✅ To'lov muvaffaqiyatli saqlandi!`);
        await uploadLocalDataToBackend();
        renderStudents(); renderExcelLog(); updateMoliyaGrid();
    }
}

async function deleteStudent(id) {
    if (!confirm("O'quvchini tizimdan butunlay o'chirishni tasdiqlaysizmi?")) return;
    await syncDataFromDatabaseSilently();
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => s.id !== id);
    localStorage.setItem('students', JSON.stringify(students));
    await uploadLocalDataToBackend();
    renderStudents(); updateMoliyaGrid();
}

// 8. EXCEL DAVOMAT LOG JURNALINI CHIZISH
function renderExcelLog() {
    const rows = document.getElementById('excel-rows');
    if (!rows) return; rows.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    logs.forEach((l, i) => {
        let statusBadge = ""; let sumDisplay = "0 UZS"; let sumColor = "#cbd5e1";
        if (l.status === 'Keldi') {
            statusBadge = `<span style="background:#28a745; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">✔ Keldi</span>`;
            sumDisplay = `- ${l.sum.toLocaleString()} UZS`; sumColor = "#ff4747";
        } else if (l.status === 'Kelmadi') {
            statusBadge = `<span style="background:#ff4747; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">✖ Kelmadi</span>`;
        } else if (l.status === "To'lov qilindi") {
            statusBadge = `<span style="background:#ffc107; color:black; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">💵 To'lov</span>`;
            sumDisplay = `+ ${l.sum.toLocaleString()} UZS`; sumColor = "#28a745";
        } else if (l.status === "Yangi talaba") {
            statusBadge = `<span style="background:#007bff; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">👤 Yangi</span>`;
            sumDisplay = "Ro'yxatga olindi"; sumColor = "#007bff";
        }

        let displayName = l.status === "To'lov qilindi" ? `${l.name} / + To'lov qilindi` : (l.status === "Yangi talaba" ? `${l.name} / Yangi o'quvchi ro'yxatga olindi` : l.name);
        rows.innerHTML += `<tr><td>${i+1}</td><td><b>${displayName}</b><br><small style="color:#8a8a8a;">Tel: ${l.phone || ''}</small></td><td>${l.date || '-'}</td><td>${statusBadge}</td><td style="color:${sumColor}; font-weight:bold;">${sumDisplay}</td><td><button onclick="deleteLogItem(${i})" style="color:#ff4747; background:none; border:none; cursor:pointer;">❌</button></td></tr>`;
    });
}

async function deleteLogItem(index) {
    await syncDataFromDatabaseSilently();
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    logs.splice(index, 1);
    localStorage.setItem('excelLog', JSON.stringify(logs));
    await uploadLocalDataToBackend();
    renderExcelLog(); updateMoliyaGrid();
}
function updateMoliyaGrid() {
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    let totalCollected = excelLog.filter(l => l.status === 'Keldi').reduce((acc, curr) => acc + (curr.sum || 0), 0);
    if (document.getElementById('center-profit')) document.getElementById('center-profit').innerText = (totalCollected * 0.5).toLocaleString() + " UZS";
    if (document.getElementById('admin-teacher-salary')) document.getElementById('admin-teacher-salary').innerText = (totalCollected * 0.5).toLocaleString() + " UZS";
}

// =========================================================================
// 👨‍🏫 O'QITUVCHI KABINETI FUNKSIYALARI (MULTIPLE DEVICE LIVE REJIM)
// =========================================================================
async function initTeacherCabinet() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInTeacher'));
    if (!loggedInUser) return;
    currentTeacher = loggedInUser;

    // Har kirganda boshqa telefonlardan tushgan davomatlarni srazu yuklash
    await syncDataFromDatabaseSilently();

    const teacherTitle = document.getElementById('teacher-title-name');
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    let myEarned = excelLog.filter(l => l.status === 'Keldi' && Number(l.teacherId || l.teacher_id) === Number(currentTeacher.id)).reduce((sum, current) => sum + (current.sum || 0), 0);
    
    if (teacherTitle) {
        teacherTitle.innerHTML = `${currentTeacher.name} <span style="font-size:14px; background:#28a745; color:white; padding:4px 12px; border-radius:10px; margin-left:15px; font-weight:bold;">Sizning ulushingiz: ${(myEarned * 0.5).toLocaleString()} UZS</span>`;
    }

    renderTeacherStudents();
    checkTimeAndLockSystem();
}

function checkTimeAndLockSystem() {
    if (!currentTeacher) return;
    const now = new Date();
    const daysUz = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    const currentDayUz = daysUz[now.getDay()]; const currentDayNum = now.getDay() === 0 ? 7 : now.getDay(); 

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = currentTeacher.start_time.split(':').map(Number);
    const [endH, endM] = currentTeacher.end_time.split(':').map(Number);
    
    let isRightDay = false;
    if (Array.isArray(currentTeacher.allowed_days)) {
        isRightDay = currentTeacher.allowed_days.includes(currentDayUz) || currentTeacher.allowed_days.includes(currentDayNum) || currentTeacher.allowed_days.includes(String(currentDayNum));
    } else {
        isRightDay = String(currentTeacher.allowed_days || '').includes(currentDayUz) || String(currentTeacher.allowed_days || '').includes(String(currentDayNum));
    }

    const isRightTime = currentMinutes >= (startH * 60 + startM) && currentMinutes <= (endH * 60 + endM);
    const lockMessage = document.getElementById('lock-message');

    if (lockMessage) {
        lockMessage.style.display = "block"; lockMessage.style.color = "#fbbf24"; lockMessage.style.fontWeight = "bold";
        let kunlarMatni = Array.isArray(currentTeacher.allowed_days) ? currentTeacher.allowed_days.join(', ') : currentTeacher.allowed_days;
        if (String(kunlarMatni).includes('1') || String(kunlarMatni).includes('3') || String(kunlarMatni).includes('5')) kunlarMatni = "Dushanba, Chorshanba, Juma";
        
        if (isRightDay && isRightTime) lockMessage.innerHTML = `🟢 <b>Dars vaqti faol!</b> Davomat dars tugashi bilan soat <b>${currentTeacher.end_time}</b> da avtomatik yopiladi.`;
        else lockMessage.innerHTML = `🔒 <b>Tizim qulflangan!</b> Guruh dars kunlari: ${kunlarMatni} | Soat: <b>${currentTeacher.start_time}-${currentTeacher.end_time}</b> da ochiladi.`;
    }

    if (!isRightDay || !isRightTime) {
        document.querySelectorAll('[class^="individual-btn-box-"]').forEach(box => {
            box.innerHTML = `<span style="color:#fbbf24; font-weight:bold; font-size:13px; background:#1c150a; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,158,11,0.2); display:inline-block; width:100%; text-align:center;">🔒 Vaqti Emas</span>`;
        });
    }
}

function renderTeacherStudents() {
    const mainBox = document.getElementById('teacher-students-rows') || document.getElementById('students-rows') || document.getElementById('davomat-table-container');
    if (!mainBox || !currentTeacher) return;

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let myStudents = students.filter(s => Number(s.teacherId) === Number(currentTeacher.id));
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    const todayDateStr = new Date().toLocaleDateString();

    let groups = {};
    myStudents.forEach(s => {
        let gName = s.groupName || s.group_name || "Asosiy Guruh";
        if (!groups[gName]) groups[gName] = [];
        groups[gName].push(s);
    });

    mainBox.innerHTML = "";

    Object.keys(groups).forEach(gName => {
        let studentRowsHtml = "";
        groups[gName].forEach((s, idx) => {
            const isStudentDoneToday = excelLog.some(l => Number(l.studentId) === Number(s.id) && l.date.startsWith(todayDateStr) && (l.status === 'Keldi' || l.status === 'Kelmadi'));

            let actionCellHtml = isStudentDoneToday 
                ? `<span style="color:#fbbf24; font-weight:bold; font-size:13px; background:#1c150a; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,158,11,0.2); display:inline-block;">🔒 Yakunlandi</span>`
                : `<div class="individual-btn-box-${s.id}" style="display:flex; gap:10px; align-items:center; width:100%;"><button onclick="doAttendance(${s.id}, 'Keldi')" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELDI</button><button onclick="doAttendance(${s.id}, 'Kelmadi')" style="background:#ff4747; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELMADI</button></div>`;

            let rowStyle = ""; let textStyle = "";
            if (s.balance < -150000) rowStyle = `style="background-color: rgba(255, 71, 71, 0.25) !important;"`;
            else if (s.balance < -100000) textStyle = `style="color: #ff4747 !important;"`;

            studentRowsHtml += `<tr ${rowStyle}><td ${textStyle}>${idx + 1}</td><td ${textStyle}><b>${s.name}</b><br><small>${s.phone}</small></td><td style="font-weight:bold; ${s.balance < 0 ? 'color:#ff4747;' : 'color:#fbbf24;'}">${s.balance.toLocaleString()} UZS</td><td>${actionCellHtml}</td></tr>`;
        });

        mainBox.innerHTML += `<div class="guruh-premium-card-box moliya-card" style="margin-bottom:30px; border-color:rgba(245,158,11,0.2); padding:20px; background:rgba(20,16,10,0.4); display:block !important;"><h4 style="color:#fbbf24; font-size:16px; font-weight:800; text-transform:uppercase; margin-bottom:15px; letter-spacing:0.5px;">📦 Guruh Nomi: ${gName}</h4><div class="excel-wrapper" style="display:block !important;"><table class="excel-table" style="display:table !important;"><thead><tr><th>#</th><th>O'quvchi Ismi / Telefoni</th><th>Mavjud Balansi</th><th style="text-align:center;">Kunlik Davomat Amali</th></tr></thead><tbody>${studentRowsHtml}</tbody></table></div></div>`;
    });
}

async function doAttendance(studentId, status) {
    await syncDataFromDatabaseSilently(); // Boshqa telefondan tushgan oxirgi holatni majburiy olish

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => s.id == studentId);
    if (!student || !currentTeacher) return;

    const now = new Date();
    let pricePerLesson = Math.round(student.monthlyPrice / 12);
    if (status === 'Keldi') student.balance = student.balance - pricePerLesson;

    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    excelLog.push({
        id: Date.now(), studentId: student.id, teacherId: currentTeacher.id, teacher_id: currentTeacher.id, name: student.name, dars_time: currentTeacher.start_time, darsTime: currentTeacher.start_time,
        date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5), status: status, sum: pricePerLesson, phone: student.phone
    });

    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('excelLog', JSON.stringify(excelLog));

    const specificBox = document.querySelector(`.individual-btn-box-${studentId}`);
    if (specificBox) specificBox.parentElement.innerHTML = `<span style="color:#fbbf24; font-weight:bold; font-size:13px; background:#1c150a; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,158,11,0.2); display:inline-block;">🔒 Yakunlandi</span>`;

    alert(`Davomat muvaffaqiyatli saqlandi!`);
    await uploadLocalDataToBackend(); // Jonli serverga saqlash
    initTeacherCabinet();
}

setTimeout(() => { if(typeof initPhoneFormatters === 'function') initPhoneFormatters(); }, 1000);
function formatPhoneInput(el) {}
function scrolltoExcelLog() { document.getElementById('excel-rows')?.scrollIntoView({ behavior: 'smooth' }); }
function resetCurrentMonthMoliya() { if(confirm("Tozalash?")) { localStorage.setItem('students', '[]'); window.location.reload(); } }
function clearAllLogs() { if(confirm("O'chirish?")) { localStorage.setItem('excelLog', '[]'); window.location.reload(); } }
