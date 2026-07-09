// 2. MA'LUMOTLARNI RENDER SERVERIGA VA POSTGRESQL BAZASIGA SAQLASH
async function uploadLocalDataToBackend() {
    console.log("Render pullik serveriga zaxira nusxa yuklanmoqda...");
    const RENDER_BACKEND_URL = "https://muxtasham-jgqv.onrender.com";
    let dataToSend = {
        teachers: JSON.parse(localStorage.getItem('teachers')) || [],
        students: JSON.parse(localStorage.getItem('students')) || [],
        excelLog: JSON.parse(localStorage.getItem('excelLog')) || []
    };

    try {
        // To'g'rilangan havola va POST so'rovi
        const response = await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'  
            },
            body: JSON.stringify(dataToSend), // JSON.stringity xatosi JSON.stringify ga tuzatildi
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

// 3. MA'LUMOTLARNI RENDER SERVERIDAN (POSTGRESQL BAZADAN) BRAUZERGA TIKLASH
async function downloadDataFromBackend() {
    if (!confirm("Diqqat! Serverdan yuklasangiz, hozirgi brauzeringizdagi ma'lumotlar o'chib ketadi. Rozimisiz?")) return;

    try {
        // To'g'rilangan GET so'rovi
        const response = await fetch(`${RENDER_BACKEND_URL}/api/load-all`);
        const result = await response.json();

        if (result.success) {
            // Serverdan kelgan ma'lumotlarni brauzer xotirasiga (LocalStorage) yozish
            localStorage.setItem('teachers', JSON.stringify(result.teachers || []));
            localStorage.setItem('students', JSON.stringify(result.students || []));
            localStorage.setItem('excelLog', JSON.stringify(result.excelLog || []));

            alert("🟢 Ma'lumotlar serverdan muvaffaqiyatli tiklandi! Sahifa qayta yangilanadi.");
            window.location.reload(); // Sahifani yangilab ma'lumotlarni ko'rsatish
        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        alert("❌ Serverdan yuklashda xatolik yuz berdi: " + error.message);
    }
}

// 4. O'QITUVCHINI RO'YXATGA QO'SHISH FUNKSIYASI (ADMIN.HTML UCHUN)
// 1. RENDER PLATFORMASIDAGI BACKEND SERVINGIZNING INTERNETDAGI HAVOLASI
const RENDER_BACKEND_URL = "https://onrender.com";

// 2. MA'LUMOTLARNI RENDER SERVERIGA VA POSTGRESQL BAZASIGA SAQLASH
async function uploadLocalDataToBackend() {
    console.log("Render pullik serveriga zaxira nusxa yuklanmoqda...");

    let dataToSend = {
        teachers: JSON.parse(localStorage.getItem('teachers')) || [],
        students: JSON.parse(localStorage.getItem('students')) || [],
        excelLog: JSON.parse(localStorage.getItem('excelLog')) || []
    };

    try {
        const response = await fetch(`${RENDER_BACKEND_URL}/api/save-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSend),
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

// 3. MA'LUMOTLARNI RENDER SERVERIDAN (POSTGRESQL BAZADAN) BRAUZERGA TIKLASH
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

// 4. O'QITUVCHINI RO'YXATGA QO'SHISH FUNKSIYASI
function addTeacher(event) {
    event.preventDefault();

    // Elementlarni ID yoki Placeholder orqali xavfsiz o'qish
    const name = (document.getElementById('teacherName') || document.querySelector('[placeholder*="Ism"]'))?.value.trim();
    const subject = (document.getElementById('teacherSubject') || document.querySelector('[placeholder*="Fan"]'))?.value.trim();
    const group_name = (document.getElementById('teacherGroup') || document.querySelector('[placeholder*="Guruh"]'))?.value.trim();
    const start_time = document.getElementById('startTime')?.value || "14:00";
    const end_time = document.getElementById('endTime')?.value || "16:00";
    const login = (document.getElementById('teacherLogin') || document.querySelector('[placeholder*="Login"]'))?.value.trim();
    const pass = (document.getElementById('teacherPass') || document.querySelector('[placeholder*="Parol"]'))?.value.trim();

    // Haftalik kunlarni t-days yoki days orqali yig'ish
    const allowed_days = [];
    const checkboxes = document.querySelectorAll('input[name="t-days"]:checked, input[name="days"]:checked');
    checkboxes.forEach(cb => allowed_days.push(cb.value));

    let teachers = [];
    try {
        teachers = JSON.parse(localStorage.getItem('teachers')) || [];
    } catch(e) {
        teachers = [];
    }
    
    const newTeacher = {
        id: Date.now(),
        name: name || "Nomalum Ustoz",
        subject: subject || "Fan kiritilmagan",
        group_name: group_name || "Guruhsiz",
        start_time,
        end_time,
        allowed_days,
        login: login || "user_" + Date.now(),
        pass: pass || "12345"
    };

    teachers.push(newTeacher);
    localStorage.setItem('teachers', JSON.stringify(teachers));

    alert("✅ O'qituvchi muvaffaqiyatli qo'shildi! Endi 'SERVERGA SAQLASH' tugmasini bosib bazaga yuklashingiz mumkin.");
    
    event.target.reset();
    if (typeof renderTeachers === 'function') renderTeachers();
}
