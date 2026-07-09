const RENDER_BACKEND_URL = "https://onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    renderTeachers();
    renderStudents();
    renderExcelLog();
    updateMoliyaGrid();
});

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
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert("❌ Serverga yuklashda xatolik bo'ldi: " + error.message);
    }
}

async function downloadDataFromBackend() {
    if (!confirm("Diqqat! Serverdan yuklasangiz, hozirgi brauzeringizdagi ma'lumotlar o'chib ketadi. Rozimisiz?")) return;

    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`);
        const result = await response.json();

        if (result.success) {
            localStorage.setItem('teachers', JSON.stringify(result.teachers || []));
            localStorage.setItem('students', JSON.stringify(result.students || []));
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || []));

            alert("🟢 Ma'lumotlar serverdan muvaffaqiyatli tiklandi! Sahifa qayta yangilanadi.");
            window.location.reload();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert("❌ Serverdan yuklashda xatolik yuz berdi: " + error.message);
    }
}

function addTeacher(event) {
    event.preventDefault();

    const name = document.getElementById('teacherName')?.value.trim();
    const subject = document.getElementById('teacherSubject')?.value.trim();
    const group_name = document.getElementById('teacherGroup')?.value.trim();
    const start_time = document.getElementById('startTime')?.value || "14:00";
    const end_time = document.getElementById('endTime')?.value || "16:00";
    const login = document.getElementById('teacherLogin')?.value.trim();
    const pass = document.getElementById('teacherPass')?.value.trim();

    const allowed_days = [];
    const checkboxes = document.querySelectorAll('input[name="t-days"]:checked, input[name="days"]:checked');
    checkboxes.forEach(cb => allowed_days.push(cb.value));

    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    
    const newTeacher = {
        id: Date.now(),
        name: name || "Nomalum Ustoz",
        subject: subject || "Kiritilmagan",
        group_name: group_name || "Guruhsiz",
        start_time,
        end_time,
        allowed_days,
        login: login || "user",
        pass: pass || "123"
    };

    teachers.push(newTeacher);
    localStorage.setItem('teachers', JSON.stringify(teachers));

    alert("✅ O'qituvchi muvaffaqiyatli qo'shildi! Endi 'SERVERGA SAQLASH' tugmasini bosing.");
    event.target.reset();
    renderTeachers();
}

function renderTeachers() {
    const rows = document.getElementById('teachers-rows');
    if (!rows) return;
    rows.innerHTML = "";
    
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers.forEach((t, i) => {
        let daysDisplay = Array.isArray(t.allowed_days) ? t.allowed_days.join(', ') : String(t.allowed_days || '');
        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${t.name || 'Nomalum'}</b><br><span style="color:#fbbf24">${t.subject || 'Yoq'}</span><br><small>${t.start_time || ''}-${t.end_time || ''} (${daysDisplay})</small></td>
                <td>Login: ${t.login || ''}<br>Parol: ${t.pass || ''}</td>
                <td style="text-align: right; color:#28a745;">${t.group_name || 'Guruhsiz'}</td>
                <td><button onclick="deleteTeacher(${t.id})" style="color:#ff4747; background:none; border:none; cursor:pointer;">❌ O'chirish</button></td>
            </tr>
        `;
    });
    updateTeacherSelect();
}

function deleteTeacher(id) {
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers = teachers.filter(t => t.id !== id);
    localStorage.setItem('teachers', JSON.stringify(teachers));
    renderTeachers();
}

function updateTeacherSelect() {
    const select = document.getElementById('s-teacher');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Ustozni tanlang</option>';
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    teachers.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name} (${t.subject})</option>`;
    });
}

function addStudent(event) {
    event.preventDefault();
    const name = document.getElementById('s-name')?.value.trim();
    const phone = document.getElementById('s-phone')?.value.trim();
    const balance = Number(document.getElementById('s-balance')?.value) || 0;
    const teacherId = document.getElementById('s-teacher')?.value;
    const groupName = document.getElementById('s-group')?.value.trim();
    const monthlyPrice = Number(document.getElementById('s-price')?.value) || 200000;

    let students = JSON.parse(localStorage.getItem('students')) || [];
    const newStudent = { id: Date.now(), name, phone, balance, teacherId, groupName, monthlyPrice };
    
    students.push(newStudent);
    localStorage.setItem('students', JSON.stringify(students));
    
    alert("✅ O'quvchi qo'shildi!");
    event.target.reset();
    renderStudents();
    updateMoliyaGrid();
}

function renderStudents() {
    const rows = document.getElementById('students-rows');
    if (!rows) return;
    rows.innerHTML = "";
    
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let teachers = JSON.parse(localStorage.getItem('teachers')) || [];

    students.forEach((s, i) => {
        const teacher = teachers.find(t => t.id == s.teacherId);
        const tName = teacher ? teacher.name : "Biriktirilmagan";
        
        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${s.name}</b><br><small>${s.phone}</small></td>
                <td>${tName}</td>
                <td>${s.groupName}<br><b style="color:#fbbf24">${s.balance} UZS</b></td>
                <td><button onclick="deleteStudent(${s.id})" style="color:#ff4747; background:none; border:none; cursor:pointer;">❌</button></td>
            </tr>
        `;
    });
}

function deleteStudent(id) {
    let students = JSON.parse(localStorage.getItem('students')) || [];
    students = students.filter(s => s.id !== id);
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
    updateMoliyaGrid();
}

function renderExcelLog() {
    const rows = document.getElementById('excel-rows');
    if (!rows) return;
    rows.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('excelLog')) || [];
    logs.forEach((l, i) => {
        rows.innerHTML += `
            <tr>
                <td>${i+1}</td>
                <td><b>${l.name}</b></td>
                <td>Davomat</td>
                <td>${l.date || '-'}</td>
                <td>${l.status || 'Keldi'}</td>
                <td>${l.sum || 0} UZS</td>
                <td>-</td>
            </tr>
        `;
    });
}

function updateMoliyaGrid() {
    let students = JSON.parse(localStorage.getItem('students')) || [];
    let totalProfit = students.reduce((acc, curr) => acc + (curr.balance || 0), 0);
    
    const profitEl = document.getElementById('center-profit');
    const salaryEl = document.getElementById('admin-teacher-salary');
    
    if (profitEl) profitEl.innerText = totalProfit.toLocaleString() + " UZS";
    if (salaryEl) salaryEl.innerText = (totalProfit * 0.4).toLocaleString() + " UZS";
}

function filterTeachers() {}
function filterStudents() {}
function formatPhoneInput(el) {}
function scrolltoExcelLog() { document.getElementById('excel-rows')?.scrollIntoView({ behavior: 'smooth' }); }
function resetCurrentMonthMoliya() { if(confirm("Tozalashni xohlaysizmi?")) { localStorage.setItem('students', '[]'); renderStudents(); updateMoliyaGrid(); } }
function clearAllLogs() { if(confirm("Tarixni o'chirish?")) { localStorage.setItem('excelLog', '[]'); renderExcelLog(); } }
