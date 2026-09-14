const content = document.getElementById("content");

const schedule = {
  "السبت": ["لا يوجد كلاس صباحي", "علوي", "علوي"],
  "الأحد": ["علوي", "بطن وكور", "بطن وكور"],
  "الاثنين": ["بطن وكور", "سفلي", "سفلي"],
  "الثلاثاء": ["سفلي", "HIIT", "HIIT"],
  "الأربعاء": ["سفلي", "ظهر وأفخاذ جانبية", "بيلاتس"],
  "الخميس": ["فل بودي", "فل بودي", "فل بودي"]
};

const days = Object.keys(schedule);

function show(html) {
  content.hidden = false;
  content.innerHTML = html;
  content.scrollIntoView({ behavior: "smooth", block: "start" });
}

function backHome() {
  content.hidden = true;
  content.innerHTML = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function schedulePage() {
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>جدول الكلاسات</h2>
    <p class="hero-text">اختاري اليوم لمشاهدة جدول الكلاسات.</p>
    <div class="day-grid">
      ${days.map(day => `<button class="day-btn" onclick="dayPage('${day}')">${day}</button>`).join("")}
    </div>
  `);
}

function dayPage(day) {
  const [morning, first, second] = schedule[day];
  show(`
    <button class="back-btn" onclick="schedulePage()">← العودة للأيام</button>
    <h2>جدول يوم ${day}</h2>
    <table class="schedule-table">
      <thead><tr><th>الفترة</th><th>الكلاس</th></tr></thead>
      <tbody>
        <tr><td>كلاس الصباح</td><td>${morning}</td></tr>
        <tr><td>الكلاس الأول</td><td>${first}</td></tr>
        <tr><td>الكلاس الثاني</td><td>${second}</td></tr>
      </tbody>
    </table>
  `);
}

function placeholderPage(title, text) {
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>${title}</h2>
    <div class="placeholder">${text}</div>
  `);
}

document.querySelectorAll(".menu-card").forEach(card => {
  card.addEventListener("click", () => {
    const page = card.dataset.page;
    if (page === "schedule") schedulePage();
    if (page === "equipment") placeholderPage("دليل الأجهزة", "هنا سنضيف الأجهزة مرتبة حسب أيام التمرين، مع صورة كل جهاز وطريقة الاستخدام والعضلات المستهدفة.");
    if (page === "rules") placeholderPage("نظام النادي", "هنا سنضيف قوانين وتعليمات النادي بشكل مرتب وسهل القراءة.");
    if (page === "hours") placeholderPage("مواعيد النادي", "هنا سنضيف أوقات عمل النادي ومواعيد الكلاسات.");
    if (page === "news") placeholderPage("الإعلانات", "هنا ستظهر إعلانات وتحديثات النادي.");
    if (page === "contact") placeholderPage("تواصل معنا", "هنا سنضيف رقم التواصل، الموقع، وحسابات النادي.");
  });
});
