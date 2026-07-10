// 1. BACKEND SERVER HAVOLASI (MUTLOQ TO'G'RI VARIANT)
const RENDER_BACKEND_URL = "https://onrender.com";

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
    
    // Telefon raqami formatlagichni ishga tushirish
    initPhoneFormatters();
    // Ustoz tanlanganda guruhni avto-to'ldirishni ulash
    initTeacherGroupAutoFiller();
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
            console.log("Ma'lumotlar serverga muvaffaqiyatli sinxronizatsiya qilindi.");
        }
    } catch (error) { console.error("Serverga yuklashda xatolik:", error.message); }
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
// 📱 TELEFON RAQAMINI +998 90 123 45 67 FORMATIGA AVTOMATIK SOLISH TIZIMI
function initPhoneFormatters() {
    const phoneInputs = document.querySelectorAll('#s-phone, #ts-phone, [id*="phone"]');
    
    phoneInputs.forEach(input => {
        if (!input) return;
        
        // Boshlang'ich qiymat doim +998 bo'lib tursin
        if (input.value === "" || input.value === "+998 ") {
            input.value = "+998 ";
        }

        input.addEventListener('input', (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,2})(\d{0,3})(\d{0,2})(\d{0,2})/);
            
            // Agar foydalanuvchi +998 ni o'chirib tashlamoqchi bo'lsa, qaytarib qo'yamiz
            if (!x || x[1] !== "998" && e.target.value.length < 5) {
                e.target.value = "+998 ";
                return;
            }

            // Avtomatik probellar bilan chiroyli formatlash
            let formatted = "+998";
            if (x[2]) formatted += " " + x[2];
            if (x[3]) formatted += " " + x[3];
            if (x[4]) formatted += " " + x[4];
            if (x[5]) formatted += " " + x[5];
            
            e.target.value = formatted;
        });

        // O'chirayotganda majburiy qotirish
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && e.target.value.length <= 5) {
                e.preventDefault();
            }
        });
    });
}

// ✍️ ADMIN PANELDA USTOZ TANLANGANDA UNING GURUH NOMINI AVTOMATIK INPUTGA YOZISH TIZIMI
function initTeacherGroupAutoFiller() {
    const teacherSelect = document.getElementById('s-teacher');
    const groupInput = document.getElementById('s-group');

    if (teacherSelect && groupInput) {
        teacherSelect.addEventListener('change', () => {
            const selectedTeacherId = teacherSelect.value;
            let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
            const foundTeacher = teachers.find(t => Number(t.id) === Number(selectedTeacherId));
            
            if (foundTeacher && foundTeacher.group_name) {
                groupInput.value = foundTeacher.group_name; // Guruh nomini avto-to'ldirish
            }
        });
    }
}
// 4. O'QITUVCHINI QO'SHISH (ADMIN PANEL)
function addTeacher(event) {
    event.preventDefault();
    const name = document.getElementById('teacherName')?.value.trim() || document.getElementById('t-name')?.value.trim();
    const subject = document.getElementById('teacherSubject')?.value.trim() || document.getElementById('t-subject')?.value.trim();
    const group_name = document.getElementById('teacherGroup')?.value.trim() || document.getElementById('t-group')?.value.trim();
    
    let start_time = document.getElementById('startTime')?.value || document.getElementById('t-start')?.value || "14:00";
    let end_time = document.getElementById('endTime')?.value || document.getElementById('t-end')?.value || "16:00";
    
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

// 5. O'QITUVCHILAR JADVALINI CHIZISH
function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return; rows.innerHTML = "";
    
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    teachers.forEach((t, i) => {
        let daysDisplay = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
        
        let teacherTotalEarned = excelLog
            .filter(l => l.status === 'Keldi' && (l.dars_time === t.start_time || l.darsTime === t.start_time))
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
    const newStudent = { id: Date.now(), name, phone, balance, teacherId: teacherId ? Number(teacherId) : null, groupName, monthlyPrice };
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    
    const now = new Date();
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    excelLog.push({
        id: Date.now(), studentId: newStudent.id, name: name, dars_time: "00:00",
        date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5),
        status: "Yangi talaba", sum: 0, phone: phone
    });
    localStorage.setItem('excelLog', JSON.stringify(excelLog));

    alert("✅ Yangi o'quvchi muvaffaqiyatli ro'yxatga olindi!");
    event.target.reset();
    renderStudents();
    renderExcelLog();
    updateMoliyaGrid();
    uploadLocalDataToBackend();
    initPhoneFormatters(); // Formatlagichni qayta yangilash
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

        rows.innerHTML += `
            <tr class="student-search-row" data-name="${s.name.toLowerCase()}" data-phone="${s.phone}">
                <td>${i+1}</td>
                <td><b>${s.name}</b><br><small>${s.phone}</small></td>
                <td>${teacherNameDisplay}</td>
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

function filterStudents() {
    const searchInput = (document.getElementById('search-student-input') || document.querySelector('[placeholder*="qidirish"]'))?.value.toLowerCase().trim();
    const rows = document.querySelectorAll('.student-search-row');
    
    rows.forEach(row => {
        const name = row.getAttribute('data-name') || '';
        const phone = row.getAttribute('data-phone') || '';
        if (name.includes(searchInput) || phone.includes(searchInput)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

setTimeout(() => {
    const inp = document.getElementById('search-student-input') || document.querySelector('[placeholder*="qidirish"]');
    if (inp) inp.oninput = filterStudents;
}, 1000);
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
        
        const now = new Date();
        let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
        excelLog.push({
            id: Date.now(), studentId: student.id, name: student.name, dars_time: "00:00",
            date: now.toLocaleDateString() + " " + now.toLocaleTimeString().substring(0,5),
            status: "To'lov qilindi", sum: parsedAmount, phone: student.phone
        });
        localStorage.setItem('excelLog', JSON.stringify(excelLog));

        alert(`✅ To'lov qabul qilindi!`);
        renderStudents();
        renderExcelLog();
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

// 8. EXCEL DAVOMAT LOG JURNALINI CHIZISH (YUZ FOIZ MINUS BILAN TELEFON CHIQADI)
function renderExcelLog() {
    const rows = document.getElementById('excel-rows');
    if (!rows) return; rows.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    logs.forEach((l, i) => {
        let statusBadge = "";
        let sumDisplay = "0 UZS";
        let sumColor = "#cbd5e1";

        if (l.status === 'Keldi') {
            statusBadge = `<span style="background:#28a745; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">✔ Keldi</span>`;
            sumDisplay = `- ${l.sum.toLocaleString()} UZS`; // MINUS BELGISI QAT'IY TURIBDI
            sumColor = "#ff4747";
        } else if (l.status === 'Kelmadi') {
            statusBadge = `<span style="background:#ff4747; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">✖ Kelmadi</span>`;
            sumDisplay = "0 UZS";
        } else if (l.status === "To'lov qilindi") {
            statusBadge = `<span style="background:#ffc107; color:black; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">💵 To'lov</span>`;
            sumDisplay = `+ ${l.sum.toLocaleString()} UZS`;
            sumColor = "#28a745";
        } else if (l.status === "Yangi talaba") {
            statusBadge = `<span style="background:#007bff; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:12px;">👤 Yangi</span>`;
            sumDisplay = "Ro'yxatga olindi";
            sumColor = "#007bff";
        }

        let displayName = l.status === "To'lov qilindi" ? `${l.name} / + To'lov qilindi` : (l.status === "Yangi talaba" ? `${l.name} / Yangi o'quvchi ro'yxatga olindi` : l.name);
        let phoneDisplay = l.phone ? `<br><small style="color:#8a8a8a;">Tel: ${l.phone}</small>` : "";

        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${displayName}</b>${phoneDisplay}</td>
                <td>${l.date || '-'}</td>
                <td>${statusBadge}</td>
                <td style="color:${sumColor}; font-weight:bold;">${sumDisplay}</td>
                <td><button onclick="deleteLogItem(${i})" style="color:#ff4747; background:none; border:none; cursor:pointer;">❌</button></td>
            </tr>
        `;
    });
}

function deleteLogItem(index) {
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    logs.splice(index, 1);
    localStorage.setItem('excelLog', JSON.stringify(logs));
    renderExcelLog();
    updateMoliyaGrid();
    uploadLocalDataToBackend();
}

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
// 👨‍🏫 O'QITUVCHI KABINETI FUNKSIYALARI (GURUHLAR ALOHIDA BLOK BO'LADI)
// =========================================================================
let currentTeacher = null;

function initTeacherCabinet() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInTeacher'));
    if (!loggedInUser) return;
    currentTeacher = loggedInUser;

    const teacherTitle = document.getElementById('teacher-title-name');
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    let myEarned = excelLog
        .filter(l => l.status === 'Keldi' && (l.dars_time === currentTeacher.start_time || l.darsTime === currentTeacher.start_time))
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
    const currentDayNum = now.getDay() === 0 ? 7 : now.getDay(); 

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = currentTeacher.start_time.split(':').map(Number);
    const [endH, endM] = currentTeacher.end_time.split(':').map(Number);
    
    let isRightDay = false;
    if (Array.isArray(currentTeacher.allowed_days)) {
        isRightDay = currentTeacher.allowed_days.includes(currentDayUz) || currentTeacher.allowed_days.includes(currentDayNum) || currentTeacher.allowed_days.includes(String(currentDayNum));
    } else {
        let daysStr = String(currentTeacher.allowed_days || '');
        isRightDay = daysStr.includes(currentDayUz) || daysStr.includes(String(currentDayNum));
    }

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
            lockMessage.style.color = "#fbbf24";
            lockMessage.style.fontWeight = "bold";
            
            if (isAlreadyDoneToday) {
                lockMessage.innerHTML = `🔒 <b>Bugungi dars davomati muvaffaqiyatli yakunlandi va guruh qulflandi!</b>`;
            } else {
                let kunlarMatni = Array.isArray(currentTeacher.allowed_days) ? currentTeacher.allowed_days.join(', ') : currentTeacher.allowed_days;
                if (kunlarMatni.includes('1') || kunlarMatni.includes('3') || kunlarMatni.includes('5')) {
                    kunlarMatni = "Dushanba, Chorshanba, Juma";
                }
                lockMessage.innerHTML = `🔒 <b>Tizim qulflangan!</b> Guruh dars kunlari soat <b>${currentTeacher.start_time}-${currentTeacher.end_time}</b> da ochiladi.`;
            }
        }
    }
}

// 👨‍🏫 GURUHLARNI ALOHIDA BLOKLARGA BO'LIB PREMIUM CHIZISH
function renderTeacherStudents() {
    const mainBox = document.getElementById('teacher-students-rows') || document.getElementById('students-rows') || document.getElementById('davomat-table-container');
    if (!mainBox || !currentTeacher) return;

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let myStudents = students.filter(s => s.teacherId == currentTeacher.id);

    // O'quvchilarni guruh nomlari bo'yicha guruhlash (Grouping)
    let groups = {};
    myStudents.forEach(s => {
        let gName = s.groupName || "Asosiy Guruh";
        if (!groups[gName]) groups[gName] = [];
        groups[gName].push(s);
    });

    // Agar ustoz sahifasida jadval konteyneri topilsa ichini butunlay yangilaymiz
    mainBox.innerHTML = "";

    // Har bir guruh uchun alohida jadval bloki chiziladi
    Object.keys(groups).forEach(gName => {
        let studentRowsHtml = "";
        groups[gName].forEach((s, idx) => {
            studentRowsHtml += `
                <tr>
                    <td>${idx + 1}</td>
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

        mainBox.innerHTML += `
            <div class="moliya-card" style="margin-bottom:30px; border-color:rgba(245,158,11,0.2); padding:20px; background:rgba(20,16,10,0.4);">
                <h4 style="color:#fbbf24; font-size:16px; font-weight:800; text-transform:uppercase; margin-bottom:15px; letter-spacing:0.5px;">📦 Guruh Nomi: ${gName}</h4>
                <div class="excel-wrapper">
                    <table class="excel-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>O'quvchi Ismi / Telefoni</th>
                                <th>Mavjud Balansi</th>
                                <th style="text-align:center;">Kunlik Davomat Amali</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studentRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
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
        id: Date.now(), studentId: student.id, name: student.name, dars_time: currentTeacher.start_time, darsTime: currentTeacher.start_time,
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
    initTeacherCabinet();
    uploadLocalDataToBackend();
}

function formatPhoneInput(el) {}
function scrolltoExcelLog() { document.getElementById('excel-rows')?.scrollIntoView({ behavior: 'smooth' }); }
function resetCurrentMonthMoliya() { if(confirm("Tozalash?")) { localStorage.setItem('students', '[]'); window.location.reload(); } }
function clearAllLogs() { if(confirm("O'chirish?")) { localStorage.setItem('excelLog', '[]'); window.location.reload(); } }
