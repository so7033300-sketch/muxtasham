// JONLI INTERNET BAZASI BILAN SINXRONLASHTIRILGAN MATRITSA
const firebaseConfig = {
    apiKey: "AIzaSyDwsRvElnUzo-QXb6CBCz9YVBc44upvS7U",
    authDomain: "://firebaseapp.com",
    databaseURL: "https://firebaseio.com",
    projectId: "muxtasham-crm",
    storageBucket: "muxtasham-crm.firebasestorage.app",
    messagingSenderId: "266948031437",
    appId: "1:266948031437:web:e0f79bfeae7f8e693fa25a",
    measurementId: "G-TRNC75JE31"
};

let teachers = [];
let students = [];
let isSearching = false;

// BAZADAN MA'LUMOTLARNI REALTIME TORTIB OLISH ALGORITMI
async function initAdminPanel() {
    if (isSearching) return;

    checkMonthlyReset();

    try {
        // 1. Ustozlarni yuklash
        let tRes = await fetch(`${firebaseConfig.databaseURL}/teachers.json`);
        let tData = await tRes.json();
        teachers = tData ? Object.keys(tData).map(k => ({...tData[k], firebaseKey: k})) : [];

        // 2. O'quvchilarni yuklash
        let sRes = await fetch(`${firebaseConfig.databaseURL}/students.json`);
        let sData = await sRes.json();
        students = sData ? Object.keys(sData).map(k => ({...sData[k], firebaseKey: k})) : [];

        // 3. Markaz foydasi va oyliklarni yuklash
        let mRes = await fetch(`${firebaseConfig.databaseURL}/moliya.json`);
        let mData = await mRes.json() || { centerProfit: 0, teacherSalary: 0 };

        // 4. Tarix loglarini yuklash
        let lRes = await fetch(`${firebaseConfig.databaseURL}/excelLog.json`);
        let lData = await lRes.json();
        let log = lData ? Object.values(lData) : [];

        const cpEl = document.getElementById('center-profit');
        const tsEl = document.getElementById('admin-teacher-salary');
        
        if (cpEl) cpEl.innerText = Math.round(mData.centerProfit || 0).toLocaleString() + " UZS";
        if (tsEl) tsEl.innerText = Math.round(mData.teacherSalary || 0).toLocaleString() + " UZS";

        renderTeachersTable(teachers);
        renderStudentsTable(students);
        renderMonthlyArchive();

        const tbodyLog = document.getElementById('excel-rows');
        if (tbodyLog) {
            tbodyLog.innerHTML = '';
            if(log.length === 0) {
                tbodyLog.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a1a1aa; padding: 30px;">Hozircha tizimda tarix ma'lumotlari mavjud emas.</td></tr>`;
            } else {
                let logIndex = 1;
                let reversedLog = log.map((item, index) => ({...item, originalIndex: index})).reverse();
                
                reversedLog.forEach(item => {
                    let isPlus = item.status.includes('✅') || item.status.includes('💰') || item.status.includes('to\'ldirildi');
                    let sPhoneDisplay = item.phone ? `<br><span style="font-size:13px; color:#fbbf24; font-weight:500;">📞 Tel: ${item.phone}</span>` : "";
                    
                    tbodyLog.innerHTML += `<tr>
                        <td>${logIndex++}</td>
                        <td style="font-weight: 700; color: #ffffff;">${item.name} ${sPhoneDisplay}</td>
                        <td style="color: #a1a1aa;">${item.date}</td>
                        <td style="font-weight: 800; color: ${isPlus ? '#fbbf24' : '#f87171'}">${item.status}</td>
                        <td style="font-weight: 800; color: #fbbf24;">${item.sum > 0 ? '-' + Math.round(item.sum).toLocaleString() + ' UZS' : '0'}</td>
                        <td style="text-align: right;">
                            <button onclick="deleteSingleLog('${item.id || logIndex}')" class="btn-premium-dark" style="width: auto; padding: 8px 14px; border-color: #f87171; color: #f87171; font-weight:700; border-radius:10px; font-size:13px;">🗑️ O'chirish</button>
                        </td>
                    </tr>`;
                });
            }
        }
    } catch(e) { console.log("Yuklashda xato:", e); }
}
// AVTOMAT JORIY OY RESET TIZIMI
async function checkMonthlyReset() {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonthLabel = now.getFullYear() + "-" + now.toLocaleString('uz-UZ', { month: 'long' });
    
    try {
        let rRes = await fetch(`${firebaseConfig.databaseURL}/lastResetMonth.json`);
        let lastResetMonth = await rRes.json() || "";

        if (currentDay === 1 && lastResetMonth !== currentMonthLabel) {
            let mRes = await fetch(`${firebaseConfig.databaseURL}/moliya.json`);
            let mData = await mRes.json() || { centerProfit: 0, teacherSalary: 0 };

            if (mData.centerProfit > 0 || mData.teacherSalary > 0) {
                let aRes = await fetch(`${firebaseConfig.databaseURL}/moliyaArchive.json`);
                let archiveData = await aRes.json();
                let archive = archiveData ? Object.values(archiveData) : [];
                
                let newArchiveItem = { id: Date.now(), month: lastResetMonth || "O'tgan oy", profit: mData.centerProfit, salary: mData.teacherSalary };
                archive.push(newArchiveItem);
                if (archive.length > 3) archive.shift();

                await fetch(`${firebaseConfig.databaseURL}/moliyaArchive.json`, { method: 'PUT', body: JSON.stringify(archive) });
            }

            await fetch(`${firebaseConfig.databaseURL}/moliya.json`, { method: 'PUT', body: JSON.stringify({ centerProfit: 0, teacherSalary: 0 }) });
            await fetch(`${firebaseConfig.databaseURL}/lastResetMonth.json`, { method: 'PUT', body: JSON.stringify(currentMonthLabel) });
        }
        if (!lastResetMonth) {
            await fetch(`${firebaseConfig.databaseURL}/lastResetMonth.json`, { method: 'PUT', body: JSON.stringify(currentMonthLabel) });
        }
    } catch(e) { console.log(e); }
}

// 3 OYLIK MOLIYA ARXIVINI CHIZISH
async function renderMonthlyArchive() {
    const archiveBox = document.getElementById('moliya-archive-box');
    if (!archiveBox) return;

    let aRes = await fetch(`${firebaseConfig.databaseURL}/moliyaArchive.json`);
    let archiveData = await aRes.json();
    let archive = archiveData ? Object.keys(archiveData).map(k => ({...archiveData[k], firebaseKey: k})) : [];
    
    if (archive.length === 0) {
        archiveBox.innerHTML = `<p style="color: #a1a1aa; font-size: 15px; font-weight:600; text-align:center;">O'tgan oylardan yopilgan moliya arxivi hozircha bo'sh.</p>`;
        return;
    }

    let archiveHtml = `<div style="display: flex; flex-direction: column; gap: 15px; width: 100%;">`;
    [...archive].reverse().forEach(item => {
        archiveHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 18px 25px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <h4 style="font-size: 18px; font-weight: 800; color: #fbbf24; text-transform: uppercase;">📅 OY: ${item.month}</h4>
                    <p style="font-size: 15px; color: #cbd5e1; margin-top: 5px;">
                        Markaz sof foydasi: <span style="color:#ffffff; font-weight:700;">${Math.round(item.profit).toLocaleString()} UZS</span> | 
                        Ustozlar haqining jami: <span style="color:#ffffff; font-weight:700;">${Math.round(item.salary).toLocaleString()} UZS</span>
                    </p>
                </div>
                <button onclick="deleteArchiveItem('${item.firebaseKey}')" class="btn-premium-dark" style="width: auto; padding: 10px 18px; border-color: #f87171; color: #f87171; font-weight:700; border-radius:12px; font-size:14px;">🗑️</button>
            </div>`;
    });
    archiveHtml += `</div>`;
    archiveBox.innerHTML = archiveHtml;
}
async function deleteArchiveItem(firebaseKey) {
    if (confirm("Ushbu arxiv hisobotini bazadan butunlay o'chirib tashlaysizmi?")) {
        await fetch(`${firebaseConfig.databaseURL}/moliyaArchive/${firebaseKey}.json`, { method: 'DELETE' });
        initAdminPanel();
    }
}

function renderTeachersTable(data) {
    const tBody = document.getElementById('teachers-rows');
    if (!tBody) return;
    tBody.innerHTML = '';
    
    const selectTeacher = document.getElementById('s-teacher');
    let lastSelected = selectTeacher ? selectTeacher.value : "";
    
    if (selectTeacher) {
        selectTeacher.innerHTML = '<option value="" disabled selected>Ustozni tanlang</option>';
        teachers.forEach(t => {
            selectTeacher.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`;
        });
        if(lastSelected) selectTeacher.value = lastSelected;
    }

    if(data.length === 0) {
        tBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #a1a1aa; padding: 20px;">Ustoz kiritilmagan.</td></tr>`;
        return;
    }

    let tIndex = 1;
    const uzDays = ["Yaksh", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    data.forEach(t => {
        let currentSalary = t.salaryBalance || 0;
        let dayNames = t.allowedDays ? t.allowedDays.map(d => uzDays[d]).join(', ') : "Belgilanmagan";

        tBody.innerHTML += `<tr>
            <td>${tIndex++}</td>
            <td style="font-weight: 800; color: #ffffff; font-size: 19px;">
                ${t.name} <br>
                <span style="font-size:14px; color:#fbbf24; font-weight:600;">Fan: ${t.subject} | Guruh: ${t.groupName}</span><br>
                <span style="font-size:13px; color:#a1a1aa;">🕒 Vaqt: ${dayNames} (${t.startTime}-${t.endTime})</span>
            </td>
            <td style="color: #cbd5e1; font-weight: 600;">Log: ${t.login}<br>Parol: ${t.pass}</td>
            <td style="font-weight: 900; color: #fbbf24; font-size:20px;">${Math.round(currentSalary).toLocaleString()} UZS</td>
            <td style="text-align: right;">
                <button onclick="editTeacher('${t.firebaseKey}', '${t.name}')" class="btn-premium-dark" style="width: auto; padding: 12px 18px; border-color: #fbbf24; color: #fbbf24; font-weight:700; border-radius:14px;">✏️</button>
                <button onclick="deleteTeacher('${t.firebaseKey}')" class="btn-premium-dark" style="width: auto; padding: 12px 18px; border-color: #f87171; color: #f87171; font-weight:700; border-radius:14px;">🗑️</button>
            </td>
        </tr>`;
    });
}
function renderStudentsTable(data) {
    const sBody = document.getElementById('students-rows');
    if (!sBody) return;
    sBody.innerHTML = '';
    
    if(data.length === 0) {
        sBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #a1a1aa; padding: 20px;">Ro'yxat bo'sh.</td></tr>`;
        return;
    }
    let sIndex = 1;
    data.forEach(s => {
        let teacher = teachers.find(t => t.id == s.teacherId) || { name: "Noma'lum Ustoz" };
        let mPrice = s.monthlyPrice || 200000;
        let singlePrice = Math.round(mPrice / 12);
        let phoneDisplay = s.phone ? s.phone : "Kiritilmagan";

        sBody.innerHTML += `<tr>
            <td>${sIndex++}</td>
            <td style="font-weight: 800; color: #ffffff; font-size: 19px;">
                ${s.name} <br>
                <span style="font-size:14px; color:#fbbf24; font-weight:500;">📞 Tel: ${phoneDisplay}</span>
            </td>
            <td style="color: #cbd5e1; font-weight: 600;">${teacher.name}</td>
            <td style="color: #a1a1aa; font-weight: 700;">${s.groupName}<br><span style="font-size:14px; color:#fbbf24;">(${mPrice.toLocaleString()} / ${singlePrice.toLocaleString()} UZS)</span></td>
            <td><span style="font-weight: 900; color: #fbbf24; font-size: 19px;">${Number(s.balance).toLocaleString()} so'm</span></td>
            <td style="text-align: right;">
                <button onclick="topUpBalance('${s.firebaseKey}')" class="btn-premium-dark" style="width: auto; padding: 12px 15px; border-color: #fbbf24; color: #fbbf24; font-weight:700; border-radius:12px;">➕</button>
                <button onclick="deleteStudent('${s.firebaseKey}')" class="btn-premium-dark" style="width: auto; padding: 12px 15px; border-color: #f87171; color: #f87171; font-weight:700; border-radius:12px;">🗑️</button>
            </td>
        </tr>`;
    });
}

function formatPhoneInput(input) {
    let val = input.value.replace(/\D/g, "");
    if (!val.startsWith("998")) { val = "998" + val; }
    let formatted = "+998 ";
    if (val.length > 3) formatted += val.substring(3, 5);
    if (val.length > 5) formatted += " " + val.substring(5, 8);
    if (val.length > 8) formatted += " " + val.substring(8, 10);
    if (val.length > 10) formatted += " " + val.substring(10, 12);
    input.value = formatted.substring(0, 17);
}

function filterTeachers() {
    let val = document.getElementById('search-teacher-input').value.toLowerCase().trim();
    isSearching = val !== "";
    let filtered = teachers.filter(t => t.name.toLowerCase().includes(val) || t.subject.toLowerCase().includes(val) || t.groupName.toLowerCase().includes(val));
    renderTeachersTable(filtered);
}

function filterStudents() {
    let val = document.getElementById('search-student-input').value.toLowerCase().trim();
    isSearching = val !== "";
    let filtered = students.filter(s => s.name.toLowerCase().includes(val) || s.groupName.toLowerCase().includes(val) || (s.phone && s.phone.includes(val)));
    renderStudentsTable(filtered);
}
async function addTeacher(e) {
    e.preventDefault();
    try {
        if (teachers.length >= 50) { alert("Maksimal 50 ta ustoz mumkin!"); return; }
        const selectedDays = [];
        const checkBoxes = document.getElementsByName('t-days');
        checkBoxes.forEach(cb => { if (cb.checked) { selectedDays.push(Number(cb.value)); } });
        if (selectedDays.length === 0) { alert("Iltimos, dars kunini tanlang!"); return; }

        const name = document.getElementById('t-name').value.trim();
        const subject = document.getElementById('t-subject').value.trim();
        const groupName = document.getElementById('t-group').value.trim();
        const startTime = document.getElementById('t-start').value;
        const endTime = document.getElementById('t-end').value;
        const login = document.getElementById('t-login').value.trim();
        const pass = document.getElementById('t-pass').value.trim();

        let newTeacher = { id: Date.now(), name, subject, groupName, startTime, endTime, allowedDays: selectedDays, login, pass, salaryBalance: 0 };
        
        await fetch(`${firebaseConfig.databaseURL}/teachers.json`, { method: 'POST', body: JSON.stringify(newTeacher) });
        await saveLog(name, `👨‍🏫 Ustoz internet bazasiga qo'shildi`, 0, "");
        document.getElementById('teacherForm').reset();
        isSearching = false; initAdminPanel();
        alert("Ustoz internet bazasiga saqlandi! 👍");
    } catch (err) { alert("Xato: " + err.message); }
}

async function editTeacher(firebaseKey, oldName) {
    let newName = prompt("Yangi Ism Familiya:", oldName);
    if (newName && newName.trim() !== '') {
        await fetch(`${firebaseConfig.databaseURL}/teachers/${firebaseKey}.json`, { method: 'PATCH', body: JSON.stringify({ name: newName.trim() }) });
        initAdminPanel();
    }
}

async function deleteTeacher(firebaseKey) {
    if (confirm("Ustozni bazadan butunlay o'chirasizmi?")) {
        await fetch(`${firebaseConfig.databaseURL}/teachers/${firebaseKey}.json`, { method: 'DELETE' });
        initAdminPanel();
    }
}
async function addStudent(e) {
    e.preventDefault();
    const name = document.getElementById('s-name').value.trim();
    const phone = document.getElementById('s-phone').value.trim();
    const balance = Number(document.getElementById('s-balance').value);
    const teacherId = Number(document.getElementById('s-teacher').value);
    const groupName = document.getElementById('s-group').value.trim();
    const monthlyPrice = Number(document.getElementById('s-group-price').value);

    let newStudent = { id: Date.now(), name, phone, balance, teacherId, groupName, monthlyPrice };
    await fetch(`${firebaseConfig.databaseURL}/students.json`, { method: 'POST', body: JSON.stringify(newStudent) });
    await saveLog(name, `💰 Guruhga ro'yxatga olindi`, 0, phone);
    e.target.reset();
    document.getElementById('s-phone').value = "+998 "; initAdminPanel();
}

async function topUpBalance(firebaseKey) {
    let amount = prompt("Qancha pul solmoqchisiz (so'mda):");
    if (amount && !isNaN(amount) && Number(amount) > 0) {
        let s = students.find(x => x.firebaseKey === firebaseKey);
        let newBal = Number(s.balance) + Number(amount);
        await fetch(`${firebaseConfig.databaseURL}/students/${firebaseKey}.json`, { method: 'PATCH', body: JSON.stringify({ balance: newBal }) });
        await saveLog(s.name, `💵 Balans to'ldirildi (+${Number(amount).toLocaleString()} so'm)`, 0, s.phone || "");
        initAdminPanel();
    }
}

async function deleteStudent(firebaseKey) {
    if (confirm("O'quvchini o'chirasizmi?")) {
        let s = students.find(x => x.firebaseKey === firebaseKey);
        await saveLog(s.name, "❌ Ro'yxatdan o'chirildi", 0, s.phone || "");
        await fetch(`${firebaseConfig.databaseURL}/students/${firebaseKey}.json`, { method: 'DELETE' });
        initAdminPanel();
    }
}

async function deleteSingleLog(logFirebaseKey) {
    if (confirm("Ushbu tarix qatorini o'chirib tashlaysizmi?")) {
        await fetch(`${firebaseConfig.databaseURL}/excelLog/${logFirebaseKey}.json`, { method: 'DELETE' });
        initAdminPanel();
    }
}

async function clearAllLogs() {
    if (confirm("Butun markaz tarixini tozalaysizmi?")) {
        await fetch(`${firebaseConfig.databaseURL}/excelLog.json`, { method: 'DELETE' });
        initAdminPanel();
    }
}

async function saveLog(name, status, sum, phone) {
    let logRes = await fetch(`${firebaseConfig.databaseURL}/excelLog.json`, { method: 'POST', body: JSON.stringify({ id: Date.now(), name, date: new Date().toLocaleDateString('uz-UZ'), status, sum, phone: phone || "" }) });
    let logData = await logRes.json();
    if(logData && logData.name) {
        await fetch(`${firebaseConfig.databaseURL}/excelLog/${logData.name}.json`, { method: 'PATCH', body: JSON.stringify({ id: logData.name }) });
    }
}

function scrollToExcelLog() {
    const targetTable = document.getElementById('excel-rows');
    if (targetTable) targetTable.closest('.moliya-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function resetCurrentMonthMoliya() {
    if (confirm("Joriy oy balansini tozalaysizmi?")) {
        await fetch(`${firebaseConfig.databaseURL}/moliya.json`, { method: 'PUT', body: JSON.stringify({ centerProfit: 0, teacherSalary: 0 }) });
        initAdminPanel();
    }
}

if (window.location.href.includes('admin.html')) {
    window.onload = function() { initAdminPanel(); setInterval(initAdminPanel, 3000); };
}
