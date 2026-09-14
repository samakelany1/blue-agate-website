const content = document.getElementById("content");

const schedule = {
  "السبت": {
    morning: "لا يوجد كلاس صباحي",
    first: "علوي",
    second: "علوي"
  },
  "الأحد": {
    morning: "علوي",
    first: "بطن وكور",
    second: "بطن وكور"
  },
  "الاثنين": {
    morning: "بطن وكور",
    first: "سفلي",
    second: "سفلي"
  },
  "الثلاثاء": {
    morning: "سفلي",
    first: "HIIT",
    second: "HIIT"
  },
  "الأربعاء": {
    morning: "HIIT",
    first: "ظهر وأفخاذ جانبية",
    second: "بيلاتس"
  },
  "الخميس": {
    morning: "فل بودي",
    first: "فل بودي",
    second: "فل بودي"
  }
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
    <p class="hero-text">اختاري اليوم لمشاهدة جدول الكلاسات بالتفصيل.</p>

    <div class="day-grid">
      ${days.map((day, i) => `
        <button class="day-btn" onclick="dayPage('${day}')">
          <span style="display:block;font-size:11px;color:#22b9c2;margin-bottom:3px">0${i+1}</span>
          ${day}
        </button>
      `).join("")}
    </div>
  `);
}

function dayPage(day) {
  const data = schedule[day];

  show(`
    <button class="back-btn" onclick="schedulePage()">← العودة للأيام</button>
    <h2>جدول يوم ${day}</h2>
    <p class="hero-text">اضغطي على أي كلاس لمعرفة نبذة عنه.</p>

    <div class="day-detail">
      ${classCard("☀️", "كلاس الصباح", data.morning)}
      ${classCard("🕐", "الكلاس الأول", data.first)}
      ${classCard("🕐", "الكلاس الثاني", data.second)}
    </div>

    <div class="schedule-note">
      <strong>ملاحظة</strong>
      <p>مواعيد الكلاسات متغيرة حسب الجدول الأسبوعي. يرجى الالتزام بالجدول لتحقيق أفضل النتائج.</p>
    </div>
  `);
}

function classCard(icon, period, className) {
  if (className === "لا يوجد كلاس صباحي") {
    return `
      <div class="class-row no-class">
        <div class="class-period">${icon}<span>${period}</span></div>
        <div class="class-name">${className}</div>
      </div>
    `;
  }

  return `
    <button class="class-row class-clickable" onclick="classPage('${className.replace(/'/g, "\\'")}')">
      <div class="class-period">${icon}<span>${period}</span></div>
      <div class="class-name">
        <span>${className}</span>
        <span class="class-arrow">←</span>
      </div>
    </button>
  `;
}

const classInfo = {
  "علوي": {
    icon: "🏋🏻‍♀️",
    title: "كلاس علوي",
    text: "كلاس يركز على عضلات الجزء العلوي من الجسم ضمن تمارين النادي الجماعية."
  },
  "بطن وكور": {
    icon: "🔥",
    title: "كلاس بطن وكور",
    text: "كلاس يركز على عضلات البطن والكور من خلال مجموعة من تمارين الثبات والتحكم."
  },
  "سفلي": {
    icon: "🦵🏻",
    title: "كلاس سفلي",
    text: "كلاس يركز على عضلات الجزء السفلي من الجسم من خلال تمارين مخصصة للرجلين."
  },
  "HIIT": {
    icon: "🏃🏻‍♀️",
    title: "كلاس HIIT",
    text: "تمارين متقطعة تجمع بين فترات من الجهد العالي وفترات استعادة قصيرة."
  },
  "ظهر وأفخاذ جانبية": {
    icon: "💪🏻",
    title: "ظهر وأفخاذ جانبية",
    text: "كلاس يركز على عضلات الظهر والأفخاذ الجانبية ضمن تمارين متنوعة."
  },
  "بيلاتس": {
    icon: "🧘🏻‍♀️",
    title: "كلاس بيلاتس",
    text: "تمارين تعتمد على التحكم بالحركة والتركيز على الثبات والمرونة وقوة الكور."
  },
  "فل بودي": {
    icon: "✨",
    title: "كلاس فل بودي",
    text: "تمارين متنوعة تستهدف مجموعات عضلية متعددة في حصة واحدة."
  }
};

function classPage(className) {
  const info = classInfo[className] || {
    icon: "🏋🏻‍♀️",
    title: className,
    text: "معلومات هذا الكلاس ستُضاف هنا."
  };

  show(`
    <button class="back-btn" onclick="schedulePage()">← العودة لجدول الكلاسات</button>

    <div class="class-hero">
      <div class="class-icon">${info.icon}</div>
      <p class="small-label">BLUE AGATE • CLASS</p>
      <h2>${info.title}</h2>
      <p>${info.text}</p>
    </div>

    <div class="class-info-grid">
      <div class="info-box">
        <span>🎯</span>
        <strong>التركيز</strong>
        <small>${className}</small>
      </div>
      <div class="info-box">
        <span>💧</span>
        <strong>قبل الكلاس</strong>
        <small>احرصي على شرب الماء والحضور في الوقت المحدد.</small>
      </div>
      <div class="info-box">
        <span>👟</span>
        <strong>الاستعداد</strong>
        <small>ملابس رياضية وحذاء مناسب للتمرين.</small>
      </div>
    </div>

    <div class="schedule-note">
      <strong>معلومة مهمة</strong>
      <p>تفاصيل التمارين والأجهزة المستخدمة في كل كلاس يمكن إضافتها لاحقًا حسب برنامج النادي.</p>
    </div>
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
