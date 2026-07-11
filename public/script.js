// 1. BACKEND SERVER HAVOLASI
const RENDER_BACKEND_URL = "https://onrender.com";

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

// BAZADAN TOZA NUSXANI ORQA FONDA YUKLAB OLISH
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
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    let dataToSend = { teachers, students, excelLog };
    
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend)
        });
        return await response.json();
    } catch (error) { 
        console.error("Serverga avto-yuklashda xato:", error.message); 
        return { success: false };
    }
}
// 📱 TELEFON RAQAMINI AVTOMATIK +998 90 123 45 67 FORMATIGA SOLISH
function initPhoneFormatters() {
    const phoneInputs = document.querySelectorAll('#s-phone, #ts-phone, [id*="phone"]');
    phoneInputs.forEach(input => {
        if (!input) return;
        if (input.value === "" || input.value === "+998") {
            input.value = "+998 ";
        }

        input.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith("+998")) {
                e.target.value = "+998 ";
                return;
            }

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
            if (e.key === 'Backspace' && e.target.value.length <= 5) {
                e.preventDefault();
            }
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
        
        const foundTeacher = teachers.find(t => String(t.id) === String(selectedTeacherId));
        if (!foundTeacher) return;

        let teacherGroups = new Set();
        let gName = foundTeacher.group_name || foundTeacher.groupName;
        if (gName) teacherGroups.add(gName);
        
        students.forEach(s => {
            let sGName = s.groupName || s.group_name;
            if (String(s.teacherId) === String(selectedTeacherId) && sGName) teacherGroups.add(sGName);
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
// 4. O'QITUVCHINI QO'SHISH (ZANJIR MUTLOQ TO'G'RILANDI)
async function addTeacher(event) {
    event.preventDefault();
    
    // Serverdan eng oxirgi bazani yuklab, xotirani yangilaymiz
    await syncDataFromDatabaseSilently(); 

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
    const newTeacher = { 
        id: Date.now(), 
        name, 
        subject, 
        group_name, 
        groupName: group_name, 
        start_time, 
        startTime: start_time, 
        end_time, 
        endTime: end_time, 
        allowed_days, 
        allowedDays: allowed_days, 
        login, 
        pass 
    };
    
    teachers.push(newTeacher);
    localStorage.setItem('teachers', JSON.stringify(teachers));

    // ⚡ BAZAGA YUKLASH TUGAGUNCHA KUTAMIZ (O'CHIB KETMASLIGI UCHUN)
    const serverResult = await uploadLocalDataToBackend(); 

    if(serverResult && serverResult.success) {
        alert("✅ O'qituvchi muvaffaqiyatli qo'shildi va serverga saqlandi!");
        event.target.reset();
        renderTeachers();
        updateMoliyaGrid();
    } else {
        alert("❌ Serverga saqlashda internet xatolik berdi, qayta urinib ko'ring.");
    }
}

// 5. O'QITUVCHILAR JADVALINI CHIZISH (PUL JAMLAGICHI QAT'IY STRING/NUMBER FORMATDAN QUTQARILDI)
function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return; rows.innerHTML = "";
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];

    teachers.forEach((t, i) => {
        let currentAllowedDays = t.allowed_days || t.allowedDays || [];
        let daysDisplay = Array.isArray(currentAllowedDays) ? currentAllowedDays.join(', ') : String(currentAllowedDays || '');
        
        // String va Number tiplari mos kelmay qolmasligi uchun ikkala tomonni ham String qilamiz
        let teacherTotalEarned = excelLog
            .filter(l => (l.status === 'Keldi' || l.status === 'Kelmadi') && (String(l.teacherId) === String(t.id) || String(l.teacher_id) === String(t.id)))
            .reduce((sum, current) => sum + (Number(current.sum) || 0), 0);
            
        let teacherSalary = teacherTotalEarned * 0.5;

        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${t.name}</b><br><span style="color:#fbbf24">${t.subject}</span><br><small>${t.start_time || t.startTime || '14:00'}-${t.end_time || t.endTime || '16:00'} (${daysDisplay})</small></td>
                <td>Login: ${t.login}<br>Parol: ${t.pass}</td>
                <td style="text-align: right; color:#28a745; font-weight:bold; font-size:15px;">${teacherSalary.toLocaleString()} UZS</td>
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
    teachers = teachers.filter(t => String(t.id) !== String(id));
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
async function addStudentBalance(studentId) {
    let amount = prompt("To'lov summasini kiriting (UZS):", "200000");
    if (amount === null || amount.trim() === "") return;
    let parsedAmount = Math.abs(Number(amount)); if (isNaN(parsedAmount) || parsedAmount === 0) return;

    await syncDataFromDatabaseSilently(); 

    let students = JSON.parse(localStorage.getItem('students')) || [];
    let student = students.find(s => String(s.id) === String(studentId));
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

        await uploadLocalDataToBackend();
        renderStudents(); renderExcelLog(); updateMoliyaGrid();
        alert(`✅ To'lov muvaffaqiyatli saqlandi!`);
    }
}

async function deleteStudent(id) {
    if (!confirm("O'quvchini tizimdan butunlay o'chirishni tasdiqlaysizmi?")) return;
    await syncDataFromDatabaseSilently();
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => String(s.id) !== String(id));
    localStorage.setItem('students', JSON.stringify(students));
    await uploadLocalDataToBackend();
    renderStudents(); updateMoliyaGrid();
}

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
            sumDisplay = `- ${l.sum.toLocaleString()} UZS`; sumColor = "#ff4747"; 
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
    let totalCollected = excelLog.filter(l => l.status === 'Keldi' || l.status === 'Kelmadi').reduce((acc, curr) => acc + (Number(curr.sum) || 0), 0);
    if (document.getElementById('center-profit')) document.getElementById('center-profit').innerText = (totalCollected * 0.5).toLocaleString() + " UZS";
    if (document.getElementById('admin-teacher-salary')) document.getElementById('admin-teacher-salary').innerText = (totalCollected * 0.5).toLocaleString() + " UZS";
}

let currentTeacher = null;
async function initTeacherCabinet() {
    const loggedInUser = JSON.parse(localStorage.getItem('loggedInTeacher'));
    if (!loggedInUser) return;
    currentTeacher = loggedInUser;

    await syncDataFromDatabaseSilently();

    const teacherTitle = document.getElementById('teacher-title-name');
    let excelLog = JSON.parse(localStorage.getItem('excelLog')) || [];
    
    let myEarned = excelLog
        .filter(l => (l.status === 'Keldi' || l.status === 'Kelmadi') && (String(l.teacherId) === String(currentTeacher.id) || String(l.teacher_id) === String(currentTeacher.id)))
        .reduce((sum, current) => sum + (Number(current.sum) || 0), 0);
    
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

    let sTime = currentTeacher.start_time || currentTeacher.startTime || "14:00";
    let eTime = currentTeacher.end_time || currentTeacher.endTime || "16:00";

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = sTime.split(':').map(Number);
    const [endH, endM] = eTime.split(':').map(Number);
    
    let currentAllowedDays = currentTeacher.allowed_days || currentTeacher.allowedDays || [];
    let isRightDay = false;
    if (Array.isArray(currentAllowedDays)) {
        isRightDay = currentAllowedDays.includes(currentDayUz) || currentAllowedDays.includes(currentDayNum) || currentAllowedDays.includes(String(currentDayNum));
    } else {
        isRightDay = String(currentAllowedDays).includes(currentDayUz) || String(currentAllowedDays).includes(String(currentDayNum));
    }

    const isRightTime = currentMinutes >= (startH * 60 + startM) && currentMinutes <= (endH * 60 + endM);
    const lockMessage = document.getElementById('lock-message');

    if (lockMessage) {
        lockMessage.style.display = "block"; lockMessage.style.color = "#fbbf24"; lockMessage.style.fontWeight = "bold";
        let kunlarMatni = Array.isArray(currentAllowedDays) ? currentAllowedDays.join(', ') : currentAllowedDays;
        if (String(kunlarMatni).includes('1') || String(kunlarMatni).includes('3') || String(kunlarMatni).includes('5')) kunlarMatni = "Dushanba, Chorshanba, Juma";
        
        if (isRightDay && isRightTime) lockMessage.innerHTML = `🟢 <b>Dars vaqti faol!</b> Davomat oynalari ochiq. Guruh dars tugashi bilan soat <b>${eTime}</b> da avtomatik yopiladi.`;
        else lockMessage.innerHTML = `🔒 <b>Tizim qulflangan!</b> Guruh dars kunlari: ${kunlarMatni} | Soat: <b>${sTime}-${eTime}</b> da ochiladi.`;
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
    let myStudents = students.filter(s => String(s.teacherId) === String(currentTeacher.id));
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
            const isStudentDoneToday = excelLog.some(l => String(l.studentId) === String(s.id) && l.date.startsWith(todayDateStr) && (l.status === 'Keldi' || l.status === 'Kelmadi'));

            let actionCellHtml = isStudentDoneToday 
                ? `<span style="color:#fbbf24; font-weight:bold; font-size:13px; background:#1c150a; padding:6px 12px; border-radius:8px; border:1px solid rgba(245,158,11,0.2); display:inline-block;">🔒 Yakunlandi</span>`
: <div class="individual-btn-box-${s.id}" style="display:flex; gap:10px; align-items:center; width:100%;"><button onclick="doAttendance(${s.id}, 'Keldi')" style="background:#28a745; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELDI</button><button onclick="doAttendance(${s.id}, 'Kelmadi')" style="background:#ff4747; color:white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer; font-weight:bold; width:90px;">KELMADI</button>
                </div>;let rowStyle = ""; let textStyle = "";if (s.balance < -150000) rowStyle = style="background-color: rgba(255, 71, 71, 0.25) !important;";else if (s.balance < -100000) textStyle = style="color: #ff4747 !important;";studentRowsHtml += `<tr ${rowStyle}><td ${textStyle}>${idx + 1}<td ${textStyle}>${s.name}${s.phone}<td style="font-weight:bold; ${s.balance < 0 ? 'color:#ff4747;' : 'color:#fb
