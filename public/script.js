// 1. BACKEND SERVER HAVOLASI
const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com";


// Tizim yuklanganda barcha sahifalar uchun dinamik funksiyalarni ishga tushirish
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('teachers-rows')) renderTeachers();
    if (document.getElementById('students-rows')) renderStudents();
    if (document.getElementById('excel-rows')) renderExcelLog();
    if (document.getElementById('center-profit')) updateMoliyaGrid();

    if (window.location.pathname.includes('ustoz.html') || document.getElementById('excel-rows') === null) {
        initTeacherCabinet();
    }
});

// 2. MA'LUMOTLARNI BACKEND-GA SAQLASH
async function uploadLocalDataToBackend() {
    let dataToSend = {
        teachers: JSON.parse(localStorage.getItem('teachers')) || [],
        students: JSON.parse(localStorage.getItem('students')) || [],
        excelLog: JSON.parse(localStorage.getItem('excelLog')) || []
    };
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });
        const result = await response.json();
        if (result.success) {
            alert("🔥 Dahshat! Hamma ma'lumotlar pullik Render serveriga 100% xavfsiz yuklandi! 🎉");
        } else { throw new Error(result.error); }
    } catch (error) { alert("❌ Serverga yuklashda xatolik bo'ldi: " + error.message); }
}

// 3. MA'LUMOTLARNI SERVERDAN TIKLASH
async function downloadDataFromBackend() {
    if (!confirm("Diqqat! Serverdan yuklasangiz, hozirgi brauzeringizdagi ma'lumotlar o'chib ketadi. Rozimisiz?")) return;
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`);
        const result = await response.json();
        if (result.success) {
            localStorage.setItem('teachers', JSON.stringify(result.teachers || []));
            localStorage.setItem('students', JSON.stringify(result.students || []));
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || []));
            alert("🟢 Ma'lumotlar serverdan muvaffaqiyatli tiklandi!");
            window.location.reload();
        } else { throw new Error(result.error); }
    } catch (error) { alert("❌ Serverdan yuklashda xatolik yuz berdi: " + error.message); }
}

// 4. O'QITUVCHINI QO'SHISH (ADMIN PANEL)
function addTeacher(event) {
    event.preventDefault();
    const name = document.getElementById('teacherName')?.value.trim() || document.getElementById('t-name')?.value.trim();
    const subject = document.getElementById('teacherSubject')?.value.trim() || document.getElementById('t-subject')?.value.trim();
    const group_name = document.getElementById('teacherGroup')?.value.trim() || document.getElementById('t-group')?.value.trim();
    const start_time = document.getElementById('startTime')?.value || "14:00";
    const end_time = document.getElementById('endTime')?.value || "16:00";
    const login = document.getElementById('teacherLogin')?.value.trim() || document.getElementById('t-login')?.value.trim();
    const pass = document.getElementById('teacherPass')?.value.trim() || document.getElementById('t-pass')?.value.trim();

    const allowed_days = [];
    const checkboxes = document.querySelectorAll('input[name="t-days"]:checked, input[name="days"]:checked');
    checkboxes.forEach(cb => allowed_days.push(cb.value));

    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    const newTeacher = { id: Date.now(), name, subject, group_name, start_time, end_time, allowed_days, login, pass };
    teachers.push(newTeacher);
    localStorage.setItem('teachers', JSON.stringify(teachers));

    alert("✅ O'qituvchi muvaffaqiyatli qo'shildi!");
    event.target.reset();
    renderTeachers();
    updateMoliyaGrid();
}
// 5. O'QITUVCHILAR JADVALINI CHIZISH VA USTORDNING O'ZIGA TEGISHLI OYLIGINI CHIQARISH
function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return; rows.innerHTML = "";
    
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    teachers.forEach((t, i) => {
        let daysDisplay = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
        
        // Shu ustozning guruhidagi darslardan yechilgan jami pulni hisoblash (Keldi holati uchun)
        let teacherTotalEarned = excelLog
            .filter(l => l.status === 'Keldi' && l.dars_time === t.start_time)
            .reduce((sum, current) => sum + (current.sum || 0), 0);
            
        // Ustozning ulushi 50%
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

function deleteTeacher(id) {
    if(!confirm("O'qituvchini o'chirishni xohlaysizmi?")) return;
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers = teachers.filter(t => t.id !== id);
    localStorage.setItem('teachers', JSON.stringify(teachers));
    renderTeachers();
    updateMoliyaGrid();
}

function updateTeacherSelect() {
    const select = document.getElementById('s-teacher');
    if (!select) return; select.innerHTML = '<option value="" disabled selected>Ustozni tanlang</option>';
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers.forEach(t => { select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`; });
}

// 6. O'QUVCHINI QO'SHISH (ADMIN PANEL)
function addStudent(event) {
    event.preventDefault();
    const name = document.getElementById('s-name')?.value.trim();
    const phone = document.getElementById('s-phone')?.value.trim();
    const balance = Math.abs(Number(document.getElementById('s-balance')?.value)) || 0; // Minuslik kiritishni oldini olish
    const teacherId = document.getElementById('s-teacher')?.value;
    const groupName = document.getElementById('s-group')?.value.trim();
    const monthlyPrice = Number(document.getElementById('s-price')?.value) || 200000;

    let students = JSON.parse(localStorage.getItem('students')) || [];
    const newStudent = { id: Date.now(), name, phone, balance, teacherId, groupName, monthlyPrice };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    
    alert("✅ O'quvchi muvaffaqiyatli qo'shildi!");
    event.target.reset();
    renderStudents();
    updateMoliyaGrid();
}

// 7. O'QUVCHILAR JADVALINI CHIZISH (O'CHIRISH TUGMASI BILAN)
function renderStudents() {
    const rows = document.getElementById('students-rows');
    if (!rows) return; rows.innerHTML = "";
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    
    students.forEach((s, i) => {
        const teacher = teachers.find(t => t.id == s.teacherId);
        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${s.name}</b><br><small>${s.phone}</small></td>
                <td>${teacher ? teacher.name : "Yo'q"}</td>
                <td>${s.groupName}<br><b style="color:#fbbf24">${s.balance.toLocaleString()} UZS</b></td>
                <td><button onclick="deleteStudent(${s.id})" style="color:#ff4747; background:none; border:none; cursor:pointer; font-weight:bold;">❌ O'chirish</button></td>
            </tr>
        `;
    });
}

function deleteStudent(id) {
    if (!confirm("O'quvchini tizimdan butunlay o'chirishni tasdiqlaysizmi?")) return;
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => s.id !== id);
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
    updateMoliyaGrid();
}
// 8. EXCEL DAVOMAT LOG TARIXINI CHIZISH
function renderExcelLog() {
    const rows = document.getElementById('excel-rows');
    if (!rows) return; rows.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    logs.forEach((l, i) => {
        rows.innerHTML += `<tr><td>${i+1}</td><td><b>${l.name}</b></td><td>Davomat</td><td>${l.date || '-'}</td><td><span style="color:${l.status === 'Keldi' ? '#28a745' : '#ff4747'}; font-weight:bold;">${l.status || 'Keldi'}</span></td><td><b>${l.sum ? l.sum.toLocaleString() : 0} UZS</b></td><td>-</td></tr>`;
    });
}

// 9. REYTING GRIDLARINI 50% / 50% ULUSH BO'YICHA YANGILASH
function updateMoliyaGrid() {
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    // Davomatda "Keldi" deb bosilib, guruhlardan yechilgan jami umumiy tushum
    let totalCollected = excelLog
        .filter(l => l.status === 'Keldi')
        .reduce((acc, curr) => acc + (curr.sum || 0), 0);
    
    // Markaz ulushi 50% va Ustozlar ulushi 50%
    let centerProfit = totalCollected * 0.5;
    let teachersSalaryPool = totalCollected * 0.5;

    const profitEl = document.getElementById('center-profit');
    const salaryEl = document.getElementById('admin-teacher-salary');
    
    if (profitEl) profitEl.innerText = centerProfit.toLocaleString() + " UZS";
    if (salaryEl) salaryEl.innerText = teachersSalaryPool.toLocaleString() + " UZS";
}

// =========================================================================
// 👨‍🏫 O'QITUVCHI KABINETI FUNKSIYALARI (TAYMER VA MATNLI DAVOMAT)
// =========================================================================
let currentTeacher = null;

function initTeacherCabinet() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInTeacher'));
    if (!loggedInUser) return;
    currentTeacher = loggedInUser;

    const teacherTitle = document.getElementById('teacher-title-name');
    if (teacherTitle) teacherTitle.innerText = currentTeacher.name;

    renderTeacherStudents();
    checkTimeAndLockSystem();
    setInterval(checkTimeAndLockSystem, 15000); // Har 15 soniyada taymerni tekshirish
}

function checkTimeAndLockSystem() {
    if (!currentTeacher) return;
    const now = new Date();
    const daysUz = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    const currentDayUz = daysUz[now.getDay()];

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = currentTeacher.start_time.split(':').map(Number);
    const [endH, endM] = currentTeacher.end_time.split(':').map(Number);
    
    const isRightDay = currentTeacher.allowed_days.includes(currentDayUz);
    const isRightTime = currentMinutes >= (startH * 60 + startM) && currentMinutes <= (endH * 60 + endM);

    const todayDateStr = now.toLocaleDateString();
    const isAlreadyDoneToday = localStorage.getItem(`davomat_done_${currentTeacher.id}_${todayDateStr}`) === "true";

    const davomatContainer = document.getElementById('davomat-table-container') || document.querySelector('.excel-wrapper');
    const lockMessage = document.getElementById('lock-message');

    if (isRightDay && isRightTime && !isAlreadyDoneToday) {
        if (davomatContainer) davomatContainer.style.display = "block";
        if (lockMessage) lockMessage.style.display = "none";
    } else {
        if (davomatContainer) davomatContainer.style.display = "none";
        if (lockMessage) {
            lockMessage.style.display = "block";
            lockMessage.innerHTML = isAlreadyDoneToday 
                ? "🔒 <b>Bugungi dars davomati yakunlandi va tizim yopildi!</b>" 
                : `🔒 <b>Tizim qulflangan!</b> Dars soati kelganda ochiladi.`;
        }
    }
}

function renderTeacherStudents() {
    const rows = document.getElementById('teacher-students-rows') || document.getElementById('students-rows');
    if (!rows || !currentTeacher) return; rows.innerHTML = "";

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let myStudents = students.filter(s => s.teacherId == currentTeacher.id);

    myStudents.forEach((s, i) => {
        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${s.name}</b><br><small>${s.phone}</small></td>
                <td><span style="color:#fbbf24; font-weight:bold;">${s.balance.toLocaleString()} UZS</span></td>
                <td>
                    <div style="display:flex; gap:10px;">
                        <button onclick="doAttendance(${s.id}, 'Keldi')" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold;">KELDI</button>
                        <button onclick="doAttendance(${s.id}, 'Kelmadi')" style="background:#ff4747; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold;">KELMADI</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

// DAVOMAT BOSILGANDA KURS NARXINI 12 GACHA BO'LIB BALANSDAN YECHISH VA AVTO-QULFLASH
function doAttendance(studentId, status) {
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => s.id == studentId);
    if (!student || !currentTeacher) return;

    const now = new Date();
    // Kurs oylik summasini (200.000, 250.000, 400.000) haftasiga 3 kundan (1 oyda 12 darsga) bo'lib darslik summasini chiqarish
    let pricePerLesson = Math.round(student.monthlyPrice / 12);

    if (status === 'Keldi') {
        student.balance = Math.max(0, student.balance - pricePerLesson); // Balansni minusga kiritmaslik
    }

    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    excelLog.push({
        id: Date.now(),
        studentId: student.id,
        name: student.name,
        dars_time: currentTeacher.start_time,
        date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5),
        status: status,
        sum: status === 'Keldi' ? pricePerLesson : 0,
        phone: student.phone
    });

    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('excelLog', JSON.stringify(excelLog));

    // Bir marta bosilganda tizim avtomatik yopilishi uchun flag qo'yish
    localStorage.setItem(`davomat_done_${currentTeacher.id}_${now.toLocaleDateString()}`, "true");

    alert(`Davomat bajarildi: ${student.name} -> ${status}. Tizim vaqtinchalik yopiladi.`);
    
    renderTeacherStudents();
    checkTimeAndLockSystem();
    uploadLocalDataToBackend(); // Avtomatik tarzda pullik PostgreSQL serveriga sinxronizatsiya qilish
}

function filterTeachers() {}
function filterStudents() {}
function formatPhoneInput(el) {}
function scrolltoExcelLog() { document.getElementById('excel-rows')?.scrollIntoView({ behavior: 'smooth' }); }
function resetCurrentMonthMoliya() { if(confirm("Tozalash?")) { localStorage.setItem('students', '[]'); window.location.reload(); } }
function clearAllLogs() { if(confirm("O'chirish?")) { localStorage.setItem('excelLog', '[]'); window.location.reload(); } }
