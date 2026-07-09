// 1. BACKEND SERVER HAVOLASI (X HARFI BILAN MUTLOQ TO'G'RI VARIANT)
const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com";

// Tizim yuklanganda barcha sahifalar uchun dinamik funksiyalarni ishga tushirish
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('teachers-rows')) renderTeachers();
    if (document.getElementById('students-rows')) renderStudents();
    if (document.getElementById('excel-rows')) renderExcelLog();
    if (document.getElementById('center-profit')) updateMoliyaGrid();

    // Ustoz sahifasi yuklanganda ishga tushadi
    if (window.location.pathname.includes('ustoz.html') || document.getElementById('excel-rows') === null) {
        initTeacherCabinet();
    }
});

// 1.1 TIZIMGA KIRISH LOGIKASI (ADMIN VA USTOZ)
let selectedRole = 'teacher';

function selectRole(role) {
    selectedRole = role;
    const btnTeacher = document.getElementById('btn-role-teacher');
    const btnAdmin = document.getElementById('btn-role-admin');
    if (!btnTeacher || !btnAdmin) return;
    
    if (role === 'admin') {
        btnAdmin.classList.add('active');
        btnTeacher.classList.remove('active');
    } else {
        btnTeacher.classList.add('active');
        btnAdmin.classList.remove('active');
    }
}

function handleLoginSystem(event) {
    event.preventDefault();
    const inputLogin = document.getElementById('loginUser')?.value.trim();
    const inputPass = document.getElementById('passUser')?.value.trim();

    if (selectedRole === 'admin') {
        // MAJBURIY KIRISH: Kesh xalaqit bermasligi uchun har qanday holatda admin.html ga o'tkazish
        if (inputLogin === 'admin' && inputPass === 'admin123') {
            localStorage.setItem('adminIsactive', 'true');
            alert("Welcome! Administrator tizimga kirdi. 🎉");
            window.location.href = 'admin.html';
        } else {
            alert("❌ Admin login yoki paroli noto'g'ri!");
        }
        return;
    }

    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    const foundTeacher = teachers.find(t => t.login === inputLogin && t.pass === inputPass);

    if (foundTeacher) {
        localStorage.setItem('loggedInTeacher', JSON.stringify(foundTeacher));
        alert(`✅ Xush kelibsiz, ${foundTeacher.name}! Tizim muvaffaqiyatli ochildi.`);
        window.location.href = 'ustoz.html';
    } else {
        alert("❌ Ustoz login yoki paroli noto'g'ri!");
    }
}

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
        if (result.success) { console.log("Serverga sinxronlandi."); }
    } catch (error) { console.error("Xatolik:", error.message); }
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
        }
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
    uploadLocalDataToBackend();
}

// 5. O'QITUVCHILAR JADVALINI CHIZISH (HAR BIR USTOZNING SHAXSIY TO'PLAGAN PULINI ANIQ CHIQARISH)
function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return; rows.innerHTML = "";
    
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    teachers.forEach((t, i) => {
        let daysDisplay = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
        
        // Shu ustoz darsidan tushgan jami tushumni loglardan qidirish
        let teacherTotalEarned = excelLog
            .filter(l => l.status === 'Keldi' && l.dars_time === t.start_time)
            .reduce((sum, current) => sum + (current.sum || 0), 0);
            
        // Ustoz ulushi 50%
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
    uploadLocalDataToBackend();
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
    const balance = Math.abs(Number(document.getElementById('s-balance')?.value)) || 0;
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
    uploadLocalDataToBackend();
}

// 7. O'QUVCHILAR JADVALINI CHIZISH (BALANS VA ➕ TO'LOV TUGMASI)
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
                <td>${s.groupName}</td>
                <td style="color:#fbbf24; font-weight:bold;">${s.balance.toLocaleString()} UZS</td>
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

function addStudentBalance(studentId) {
    let amount = prompt("To'lov summasini kiriting (UZS):", "200000");
    if (amount === null || amount.trim() === "") return;
    
    let parsedAmount = Math.abs(Number(amount));
    if (isNaN(parsedAmount) || parsedAmount === 0) {
        alert("Iltimos, to'g'ri summa kiriting!");
        return;
    }

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => s.id == studentId);
    
    if (student) {
        student.balance += parsedAmount;
        localStorage.setItem('students', JSON.stringify(students));
        
        alert(`✅ To'lov qabul qilindi! +${parsedAmount.toLocaleString()} UZS qo'shildi.`);
        renderStudents();
        updateMoliyaGrid();
        uploadLocalDataToBackend();
    }
}

function deleteStudent(id) {
    if (!confirm("O'quvchini tizimdan butunlay o'chirishni tasdiqlaysizmi?")) return;
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => s.id !== id);
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
    updateMoliyaGrid();
    uploadLocalDataToBackend();
}

// 8. EXCEL DAVOMAT LOG JURNALINI CHIZISH
function renderExcelLog() {
    const rows = document.getElementById('excel-rows');
    if (!rows) return; rows.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    logs.forEach((l, i) => {
        let isKeldi = l.status === 'Keldi';
        let statusBadge = isKeldi 
            ? `<span style="background:#28a745; color:white; padding:4px 10px; border-radius:6px; font-weight:bold;">✔ Keldi</span>`
            : `<span style="background:#ff4747; color:white; padding:4px 10px; border-radius:6px; font-weight:bold;">✖ Kelmadi</span>`;
            
        let sumDisplay = isKeldi ? `- ${l.sum.toLocaleString()} UZS` : "0 UZS";
        let sumColor = isKeldi ? "#ff4747" : "#cbd5e1";

        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${l.name}</b></td>
                <td>Davomat</td>
                <td>${l.date || '-'}</td>
                <td>${statusBadge}</td>
                <td style="color:${sumColor}; font-weight:bold;">${sumDisplay}</td>
                <td>-</td>
            </tr>
        `;
    });
}
// 9. MOLIYA PANELINI 50% / 50% TAQSIMOT BO'YICHA YANGILASH
function updateMoliyaGrid() {
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    let totalCollected = excelLog
        .filter(l => l.status === 'Keldi')
        .reduce((acc, curr) => acc + (curr.sum || 0), 0);
    
    let centerProfit = totalCollected * 0.5;
    let teachersSalaryPool = totalCollected * 0.5;

    const profitEl = document.getElementById('center-profit');
    const salaryEl = document.getElementById('admin-teacher-salary');
    
    if (profitEl) profitEl.innerText = centerProfit.toLocaleString() + " UZS";
    if (salaryEl) salaryEl.innerText = teachersSalaryPool.toLocaleString() + " UZS";
}

// =========================================================================
// 👨‍🏫 O'QITUVCHI KABINETI FUNKSIYALARI (TAYMER VA AVTO-QULFLASH)
// =========================================================================
let currentTeacher = null;

function initTeacherCabinet() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInTeacher'));
    if (!loggedInUser) return;
    currentTeacher = loggedInUser;

    const teacherTitle = document.getElementById('teacher-title-name');
    if (teacherTitle) teacherTitle.innerText = currentTeacher.name;

    // SHAXSIY KABINETDA USTOZNING QANCHA PUL TO'PLAGANINI HAM REALTAYMDA KO'RSATIB QO'YISH
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    let myEarned = excelLog
        .filter(l => l.status === 'Keldi' && l.dars_time === currentTeacher.start_time)
        .reduce((sum, current) => sum + (current.sum || 0), 0);
    let mySalary = myEarned * 0.5;

    if (teacherTitle) {
        teacherTitle.innerHTML = `${currentTeacher.name} <span style="font-size:14px; background:#28a745; color:white; padding:4px 12px; border-radius:10px; margin-left:15px; font-weight:bold;">Sizning ulushingiz: ${mySalary.toLocaleString()} UZS</span>`;
    }

    renderTeacherStudents();
    checkTimeAndLockSystem();
    setInterval(checkTimeAndLockSystem, 3000);
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

    const allButtons = document.querySelectorAll('button');
    
    if (!isRightDay || !isRightTime || isAlreadyDoneToday) {
        allButtons.forEach(btn => {
            if (btn.innerText.includes('KELDI') || btn.innerText.includes('KELMADI')) {
                const parentDiv = btn.parentElement;
                if (parentDiv) {
                    parentDiv.innerHTML = `<span style="color:#fbbf24; font-weight:bold; font-size:14px; background:#1c150a; padding:8px 16px; border-radius:10px; border:1px solid rgba(245,158,11,0.3); display:inline-block; width:100%; text-align:center;">🔒 Davomat Yakunlandi</span>`;
                }
            }
        });
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
                    <div class="attendance-actions-box" style="display:flex; gap:10px; align-items:center; width:100%;">
                        <button onclick="doAttendance(${s.id}, 'Keldi')" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELDI</button>
                        <button onclick="doAttendance(${s.id}, 'Kelmadi')" style="background:#ff4747; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELMADI</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function doAttendance(studentId, status) {
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => s.id == studentId);
    if (!student || !currentTeacher) return;

    const now = new Date();
    let pricePerLesson = Math.round(student.monthlyPrice / 12);

    if (status === 'Keldi') {
        student.balance = Math.max(0, student.balance - pricePerLesson);
    }

    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    excelLog.push({
        id: Date.now(), studentId: student.id, name: student.name, dars_time: currentTeacher.start_time,
        date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5), status: status, sum: pricePerLesson, phone: student.phone
    });

    localStorage.setItem('students', JSON.stringify(students));
    localStorage.setItem('excelLog', JSON.stringify(excelLog));

    localStorage.setItem(`davomat_done_${currentTeacher.id}_${now.toLocaleDateString()}`, "true");

    const allBoxes = document.querySelectorAll('.attendance-actions-box');
    allBoxes.forEach(box => {
        box.innerHTML = `<span style="color:#fbbf24; font-weight:bold; font-size:14px; background:#1c150a; padding:8px 16px; border-radius:10px; border:1px solid rgba(245,158,11,0.3); display:inline-block; width:100%; text-align:center;">🔒 Davomat Yakunlandi</span>`;
    });

    alert(`Davomat bajarildi!`);
    initTeacherCabinet(); // Pulni srazu qayta hisoblab ustoz panelida ham ko'rsatish
    uploadLocalDataToBackend();
}

function filterTeachers() {}
function filterStudents() {}
// Keraksiz qoldiqlarni tozalash funksiyalari
function formatPhoneInput(el) {}
function scrolltoExcelLog() { document.getElementById('excel-rows')?.scrollIntoView({ behavior: 'smooth' }); }
function resetCurrentMonthMoliya() { if(confirm("Tozalash?")) { localStorage.setItem('students', '[]'); window.location.reload(); } }
function clearAllLogs() { if(confirm("O'chirish?")) { localStorage.setItem('excelLog', '[]'); window.location.reload(); } }
