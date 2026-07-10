const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com"; // Render pullik serverining URL manzili

let teachers = [];
let students = [];
let isSearching = false;

// ADMIN PANELNI BOSHLANG'ICH YUKLASH FUNKSIYASI
function initAdminPanel() {
    if (isSearching) return;
    checkMonthlyReset();

    teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    students = JSON.parse(localStorage.getItem('students')) || [];

    let centerProfit = Number(localStorage.getItem('centerProfit')) || 0;
    let globalTeacherSalary = Number(localStorage.getItem('teacherSalary')) || 0;
    let log = JSON.parse(localStorage.getItem('excelLog')) || [];

    if (document.getElementById('center-profit')) {
        document.getElementById('center-profit').innerText = Math.round(centerProfit).toLocaleString() + " UZS";
    }
    if (document.getElementById('admin-teacher-salary')) {
        document.getElementById('admin-teacher-salary').innerText = Math.round(globalTeacherSalary).toLocaleString() + " UZS";
    }

    renderTeachersTable(teachers);
    renderStudentsTable(students);
    renderMonthlyArchive();

    const tbodyLog = document.getElementById('excel-rows');
    if (tbodyLog) {
        tbodyLog.innerHTML = '';
        if (log.length === 0) {
            tbodyLog.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a1a1aa; padding: 20px;">Tarix bo'sh.</td></tr>`;
        } else {
            let logIndex = 1;
            let reversedLog = log.map((item, index) => ({...item, originalIndex: index})).reverse();
            reversedLog.forEach(item => {
                let isPlus = item.status.includes('✅') || item.status.includes('💰') || item.status.includes('to\'ldirildi');
                tbodyLog.innerHTML += `<tr>
                    <td>${logIndex++}</td>
                    <td style="font-weight: 700; color: #ffffff;">${item.name}</td>
                    <td>${item.date}</td>
                    <td style="font-weight: 800; color: ${isPlus ? '#fbbf24' : '#f87171'}">${item.status}</td>
                    <td style="font-weight: 800; color: #fbbf24;">${item.sum > 0 ? '-' + Math.round(item.sum).toLocaleString() + ' UZS' : '0'}</td>
                    <td style="text-align: right;"><button onclick="deleteSingleLog(${item.originalIndex})" class="btn-premium-dark" style="padding: 6px 12px; color: #f87171;">🗑️</button></td>
                </tr>`;
            });
        }
    }
}
function checkMonthlyReset() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthLabel = now.getFullYear() + "-" + now.toLocaleString('uz-UZ', { month: 'long' });
    let lastResetMonth = localStorage.getItem('lastResetMonth') || "";

    if (currentDay === 1 && lastResetMonth !== currentMonthLabel) {
        let centerProfit = Number(localStorage.getItem('centerProfit')) || 0;
        let globalTeacherSalary = Number(localStorage.getItem('teacherSalary')) || 0;
        if (centerProfit > 0 || globalTeacherSalary > 0) {
            let archive = JSON.parse(localStorage.getItem('moliyaArchive')) || [];
            archive.push({ id: Date.now(), month: lastResetMonth || "O'tgan oy", profit: centerProfit, salary: globalTeacherSalary });
            if (archive.length > 3) archive.shift();
            localStorage.setItem('moliyaArchive', JSON.stringify(archive));
        }
        localStorage.setItem('centerProfit', 0);
        localStorage.setItem('teacherSalary', 0);
        localStorage.setItem('lastResetMonth', currentMonthLabel);
    }
    if (!lastResetMonth) localStorage.setItem('lastResetMonth', currentMonthLabel);
}

function renderMonthlyArchive() {
    const archiveBox = document.getElementById('moliya-archive-box');
    if (!archiveBox) return;
    let archive = JSON.parse(localStorage.getItem('moliyaArchive')) || [];
    if (archive.length === 0) {
        archiveBox.innerHTML = `<p style="color: #a1a1aa; text-align:center;">Moliya arxivi hozircha bo'sh.</p>`;
        return;
    }
    let archiveHtml = `<div style="display: flex; flex-direction: column; gap: 15px; width: 100%;">`;
    archive.reverse().forEach(item => {
        archiveHtml += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 15px 20px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);">
            <div><h4 style="color: #fbbf24;">📅 OY: ${item.month}</h4><p style="color: #cbd5e1; margin-top:4px;">Foyda: ${Math.round(item.profit).toLocaleString()} UZS | Oylik: ${Math.round(item.salary).toLocaleString()} UZS</p></div>
            <button onclick="deleteArchiveItem(${item.id})" class="btn-premium-dark" style="color: #f87171;">🗑️</button>
        </div>`;
    });
    archiveHtml += `</div>`; archiveBox.innerHTML = archiveHtml;
}

function deleteArchiveItem(id) {
    if (confirm("Arxivni o'chirasizmi?")) {
        let archive = JSON.parse(localStorage.getItem('moliyaArchive')) || [];
        archive = archive.filter(x => x.id !== id);
        localStorage.setItem('moliyaArchive', JSON.stringify(archive));
        initAdminPanel();
    }
}

function renderTeachersTable(data) {
    const tBody = document.getElementById('teachers-rows'); if (!tBody) return; tBody.innerHTML = '';
    const selectTeacher = document.getElementById('s-teacher'); let lastSelected = selectTeacher ? selectTeacher.value : "";
    if (selectTeacher) {
        selectTeacher.innerHTML = '<option value="" disabled selected>Ustozni tanlang</option>';
        teachers.forEach(t => { selectTeacher.innerHTML += `<option value="${t.id}">${t.name}</option>`; });
        if(lastSelected) selectTeacher.value = lastSelected;
    }
    if(data.length === 0) { tBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #a1a1aa; padding: 20px;">Ustoz kiritilmagan.</td></tr>`; return; }
    let tIndex = 1; const uzDays = ["Yaksh", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    data.forEach(t => {
        let dayNames = t.allowedDays ? t.allowedDays.map(d => uzDays[d]).join(', ') : "Belgilanmagan";
        let salaryKey = 'teacherSalary_' + t.id;
        let tSalary = Number(localStorage.getItem(salaryKey)) || 0;
        tBody.innerHTML += `<tr>
            <td>${tIndex++}</td>
            <td style="font-weight: 800; color: #ffffff; font-size: 18px;">${t.name}<br><span style="font-size:13px; color:#fbbf24;">Fan: ${t.subject}</span><br><span style="font-size:12px; color:#a1a1aa;">🕒 ${dayNames} (${t.startTime}-${t.endTime})</span></td>
            <td>Log: ${t.login}<br>Parol: ${t.pass}</td><td>${Math.round(tSalary).toLocaleString()} UZS</td>
            <td style="text-align: right;"><button onclick="deleteTeacher(${t.id})" class="btn-premium-dark" style="color: #f87171;">🗑️</button></td>
        </tr>`;
    });
}
function renderStudentsTable(data) {
    const sBody = document.getElementById('students-rows'); if (!sBody) return; sBody.innerHTML = '';
    if(data.length === 0) { sBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a1a1aa; padding: 20px;">Ro'yxat bo'sh.</td></tr>`; return; }
    let sIndex = 1;
    data.forEach(s => {
        let teacher = teachers.find(t => t.id == s.teacherId) || { name: "Noma'lum" };
        let textStyle = s.balance <= -100000 ? 'color: #f87171 !important; font-weight: 800;' : 'color: #ffffff;';
        sBody.innerHTML += `<tr>
            <td>${sIndex++}</td>
            <td style="${textStyle}">${s.name}<br><span style="font-size:13px; color:#fbbf24;">📞 Tel: ${s.phone || ''}</span></td>
            <td>${teacher.name}</td><td>${s.groupName}</td>
            <td style="font-weight:900; color:#fbbf24;">${Number(s.balance).toLocaleString()} so'm</td>
            <td style="text-align: right;"><button onclick="topUpBalance(${s.id})" class="btn-premium-dark" style="color: #fbbf24;">➕</button> <button onclick="deleteStudent(${s.id})" class="btn-premium-dark" style="color: #f87171;">🗑️</button></td>
        </tr>`;
    });
}

function formatPhoneInput(input) {
    let val = input.value.replace(/\D/g, ""); if (!val.startsWith("998")) val = "998" + val;
    let formatted = "+998 ";
    if (val.length > 3) formatted += val.substring(3, 5); if (val.length > 5) formatted += " " + val.substring(5, 8);
    if (val.length > 8) formatted += " " + val.substring(8, 10); if (val.length > 10) formatted += " " + val.substring(10, 12);
    input.value = formatted.substring(0, 17);
}

function filterTeachers() { let val = document.getElementById('search-teacher-input').value.toLowerCase().trim(); isSearching = val !== ""; if(!isSearching) { initAdminPanel(); return; } let filtered = teachers.filter(t => t.name.toLowerCase().includes(val) || t.subject.toLowerCase().includes(val)); renderTeachersTable(filtered); }
function filterStudents() { let val = document.getElementById('search-student-input').value.toLowerCase().trim(); isSearching = val !== ""; if(!isSearching) { initAdminPanel(); return; } let filtered = students.filter(s => s.name.toLowerCase().includes(val) || s.phone.includes(val)); renderStudentsTable(filtered); }

function addTeacher(e) {
    e.preventDefault(); if (teachers.length >= 50) return; 
    const selectedDays = []; document.querySelectorAll('input[name="t-days"]:checked').forEach(cb => { selectedDays.push(Number(cb.value)); });
    if (selectedDays.length === 0) return;
    let t = { id: Date.now(), name: document.getElementById('t-name').value.trim(), subject: document.getElementById('t-subject').value.trim(), groupName: document.getElementById('t-group').value.trim(), startTime: document.getElementById('t-start').value, endTime: document.getElementById('t-end').value, allowedDays: selectedDays, login: document.getElementById('t-login').value.trim(), pass: document.getElementById('t-pass').value.trim() };
    teachers.push(t); localStorage.setItem('teachers', JSON.stringify(teachers)); saveLog(t.name, `👨‍🏫 Ustoz qo'shildi`, 0, ""); document.getElementById('teacherForm').reset(); initAdminPanel();
}

function addStudent(e) {
    e.preventDefault();
    let s = { id: Date.now(), name: document.getElementById('s-name').value.trim(), phone: document.getElementById('s-phone').value.trim(), balance: Number(document.getElementById('s-balance').value), teacherId: Number(document.getElementById('s-teacher').value), groupName: document.getElementById('s-group').value.trim(), monthlyPrice: Number(document.getElementById('s-group-price').value) };
    students.push(s); localStorage.setItem('students', JSON.stringify(students)); saveLog(s.name, `💰 Guruhga qo'shildi`, 0, s.phone); document.getElementById('studentForm').reset(); document.getElementById('s-phone').value = "+998 "; initAdminPanel();
}

function topUpBalance(id) { let amount = prompt("Qancha pul solasiz:"); if (amount && !isNaN(amount) && Number(amount) > 0) { let s = students.find(x => x.id === id); s.balance += Number(amount); localStorage.setItem('students', JSON.stringify(students)); saveLog(s.name, `💵 Balans to'ldirildi (+${Number(amount).toLocaleString()})`, 0, s.phone); initAdminPanel(); } }
function deleteStudent(id) { if (confirm("O'chirasizmi?")) { let s = students.find(x => x.id === id); saveLog(s.name, "❌ O'chirildi", 0, s.phone); students = students.filter(x => x.id !== id); localStorage.setItem('students', JSON.stringify(students)); initAdminPanel(); } }
function deleteTeacher(id) { if (confirm("O'chirasizmi?")) { teachers = teachers.filter(x => x.id !== id); localStorage.setItem('teachers', JSON.stringify(teachers)); initAdminPanel(); } }
function deleteSingleLog(idx) { if (confirm("O'chirasizmi?")) { let log = JSON.parse(localStorage.getItem('excelLog')) || []; log.splice(idx, 1); localStorage.setItem('excelLog', JSON.stringify(log)); initAdminPanel(); } }
function clearAllLogs() { if (confirm("Tozalaysizmi?")) { localStorage.setItem('excelLog', JSON.stringify([])); initAdminPanel(); } }
function resetCurrentMonthMoliya() { if (confirm("Tozalaysizmi?")) { localStorage.setItem('centerProfit', 0); localStorage.setItem('teacherSalary', 0); let savedTeachers = JSON.parse(localStorage.getItem('teachers')) || []; savedTeachers.forEach(t => { localStorage.setItem('teacherSalary_' + t.id, 0); }); initAdminPanel(); } }
function saveLog(n, st, s, p) { let log = JSON.parse(localStorage.getItem('excelLog')) || []; log.push({ name: n, date: new Date().toLocaleDateString('uz-UZ'), status: st, sum: s, phone: p || "" }); localStorage.setItem('excelLog', JSON.stringify(log)); }
// OFLAYN FUNKSIYALAR BILAN BACKENDNING PROFESSIONAL BIRLASHUV TARMOG'I
const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com";
async function uploadLocalDataToBackend() {
    console.log("⏳ Render pullik serveriga zaxira nusxa yuklanmoqda...");
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
            alert("🟢 Hamma ma'lumotlar pullik Render serveriga muvaffaqiyatli yuklandi! 👍");
        }
    } catch (error) { 
        alert("❌ Serverga yuklashda xatolik: " + error.message); 
    }
}

async function downloadDataFromBackend() {
    if (!confirm("Serverdan yuklasangiz, hozirgi brauzeringizdagi ma'lumotlar o'chadi. Rozimisiz?")) return;
    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`); 
        const result = await response.json();
        if (result.success) { 
            localStorage.setItem('teachers', JSON.stringify(result.teachers || [])); 
            localStorage.setItem('students', JSON.stringify(result.students || [])); 
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || [])); 
            alert("📥 Serverdagi hamma ma'lumotlar muvaffaqiyatli qayta tiklandi! 🎉"); 
            window.location.reload(); 
        }
    } catch (error) { 
        alert("❌ Serverdan yuklab olishda xatolik: " + error.message); 
    }
}

if (window.location.href.includes('admin.html')) {
    window.onload = function() { initAdminPanel(); };
}
