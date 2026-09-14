const content = document.getElementById("content");

const schedule = {
  "السبت": { morning: "لا يوجد كلاس صباحي", first: "علوي", second: "علوي" },
  "الأحد": { morning: "علوي", first: "بطن وكور", second: "بطن وكور" },
  "الاثنين": { morning: "بطن وكور", first: "سفلي", second: "سفلي" },
  "الثلاثاء": { morning: "سفلي", first: "HIIT", second: "HIIT" },
  "الأربعاء": { morning: "HIIT", first: "ظهر وأكتاف جانبية", second: "بيلاتس" },
  "الخميس": { morning: "فل بودي", first: "فل بودي", second: "فل بودي" }
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
          <span style="display:block;font-size:11px;color:#22b9c2;margin-bottom:3px">0${i + 1}</span>
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

  const safeName = className.replace(/'/g, "\\'");

  return `
    <button class="class-row class-clickable" onclick="classPage('${safeName}')">
      <div class="class-period">${icon}<span>${period}</span></div>
      <div class="class-name">
        <span>${className}</span>
        <span class="class-arrow">←</span>
      </div>
    </button>
  `;
}

/* معلومات الكلاسات مأخوذة من الإنفوجرافيك الذي أرسلتيه */
const classInfo = {
  "علوي": {
    icon: "🏋🏻‍♀️",
    title: "كلاس علوي",
    focus: "نركز اليوم على الجزء العلوي من الجسم لتقويته وبناء عضلاته.",
    targets: [
      ["الأكتاف", "تساعد على رفع الذراعين وتحسين الثبات والقوة."],
      ["الذراعين", "تقوية البايسبس والترايسبس لذراعين مشدودة وقوية."],
      ["الصدر", "يعزز من قوة الجزء العلوي ويدعم الثبات أثناء التمارين."],
      ["الظهر", "يحسن من وضعية الجسم ويقوي العضلات الداعمة للظهر."]
    ],
    benefits: [
      "تحسين الشكل العام للجسم",
      "زيادة القوة والقدرة البدنية",
      "تحسين وضعية الجسم والثبات",
      "رفع معدل الحرق وبناء العضلات"
    ],
    tip: "تقوية الجزء العلوي من الجسم تساعد على أداء التمارين الأخرى بشكل أفضل وتقلل من خطر الإصابات."
  },

  "بطن وكور": {
    icon: "🔥",
    title: "كلاس بطن وكور",
    focus: "نركز اليوم على عضلات البطن والكور وأسفل الظهر لبناء جسم قوي ومتوازن.",
    targets: [
      ["البطن العلوية", "لتقوية وشد الجزء العلوي من البطن."],
      ["العضلات الجانبية (الأوبليكس)", "لتحسين التوازن وتحديد الخصر."],
      ["أسفل الظهر", "لدعم العمود الفقري وتقليل الآلام."]
    ],
    benefits: [
      "تقليل خطر الإصابات في الظهر والبطن",
      "تحسين الثبات والتوازن في جميع التمارين",
      "دعم العمود الفقري والجلوس بوضعية صحية",
      "حرق سعرات أكثر وزيادة معدل التمثيل الغذائي"
    ],
    tip: "عضلات الكور القوية ليست فقط لبطن مسطح، بل هي أساس القوة والتوازن في كل حركة تقومين بها."
  },

  "سفلي": {
    icon: "🦵🏻",
    title: "كلاس سفلي",
    focus: "نركز اليوم على الجزء السفلي من الجسم لتقوية العضلات وتحسين القوة والثبات والأداء اليومي.",
    targets: [
      ["المؤخرة", "تقوية عضلات الأرداف ودعم قوة الجزء السفلي."],
      ["الفخذ الأمامي", "تقوية عضلات الفخذ الأمامية وتحسين أداء الساقين."],
      ["الفخذ الخلفي", "تقوية عضلات الهامسترنج ودعم حركة الساق."],
      ["الساق", "تقوية عضلات السمانة ودعم الحركة والثبات."]
    ],
    benefits: [
      "زيادة الكتلة العضلية وقوة الجسم",
      "تحسين التوازن والثبات",
      "دعم المفاصل والركب وحمايتها",
      "تقوية الساقين وتحسين الأداء الرياضي",
      "حرق سعرات أكثر وزيادة معدل الحرق"
    ],
    tip: "عضلات الساق والمؤخرة من أكبر مجموعات العضلات في الجسم، وتدريبها بانتظام يساعد على تحسين التمثيل الغذائي والصحة العامة."
  },

  "HIIT": {
    icon: "🏃🏻‍♀️",
    title: "كلاس HIIT",
    focus: "نركز اليوم على تمارين الكارديو عالية الشدة لرفع اللياقة والقدرة على التحمل.",
    targets: [
      ["الذراعين", "رفع شدة التمرين وتحريك الجزء العلوي من الجسم."],
      ["المؤخرة", "تنشيط عضلات الأرداف ضمن التمارين عالية الشدة."],
      ["الساقين", "رفع نبض القلب وزيادة الجهد العضلي."],
      ["البطن", "إشراك عضلات البطن والكور أثناء الحركة."],
      ["القلب والرئتين", "تحسين كفاءة الجهاز القلبي التنفسي."]
    ],
    benefits: [
      "تحسين المزاج وخفض مستوى التوتر",
      "المساعدة على حرق الدهون وتنحيف الجسم",
      "زيادة اللياقة والقدرة على التحمل",
      "تحسين صحة القلب والأوعية الدموية",
      "حرق سعرات أكثر في وقت أقل"
    ],
    tip: "تمارين HIIT تجمع بين فترات عالية الشدة وفترات استشفاء قصيرة، مما يجعل التمرين فعالًا في وقت أقصر."
  },

  "ظهر وأكتاف جانبية": {
    icon: "💪🏻",
    title: "ظهر وأكتاف جانبية",
    focus: "كلاس يركز على عضلات الظهر والأكتاف الجانبية ضمن تمارين متنوعة.",
    targets: [],
    benefits: [],
    tip: "تفاصيل هذا الكلاس ستُضاف عند توفر بطاقة المعلومات الخاصة به."
  },

  "بيلاتس": {
    icon: "🧘🏻‍♀️",
    title: "كلاس بيلاتس",
    focus: "تمارين تعتمد على التحكم بالحركة والتركيز على الثبات والمرونة وقوة الكور.",
    targets: [],
    benefits: [],
    tip: "تفاصيل هذا الكلاس ستُضاف عند توفر بطاقة المعلومات الخاصة به."
  },

  "فل بودي": {
    icon: "✨",
    title: "كلاس فل بودي",
    focus: "تمارين متنوعة تستهدف مجموعات عضلية متعددة في حصة واحدة.",
    targets: [],
    benefits: [],
    tip: "تفاصيل هذا الكلاس ستُضاف عند توفر بطاقة المعلومات الخاصة به."
  }
};

function classPage(className) {
  const info = classInfo[className] || {
    icon: "🏋🏻‍♀️",
    title: className,
    focus: "معلومات هذا الكلاس ستُضاف هنا.",
    targets: [],
    benefits: [],
    tip: ""
  };

  const targetBoxes = info.targets.length
    ? `
      <h3 class="section-title">الأجزاء المستهدفة</h3>
      <div class="class-info-grid">
        ${info.targets.map(([name, text]) => `
          <div class="info-box">
            <span>🎯</span>
            <strong>${name}</strong>
            <small>${text}</small>
          </div>
        `).join("")}
      </div>
    `
    : "";

  const benefitBoxes = info.benefits.length
    ? `
      <h3 class="section-title">فوائد التمرين</h3>
      <div class="class-info-grid">
        ${info.benefits.map(benefit => `
          <div class="info-box benefit-box">
            <span>✓</span>
            <small>${benefit}</small>
          </div>
        `).join("")}
      </div>
    `
    : "";

  show(`
    <button class="back-btn" onclick="schedulePage()">← العودة لجدول الكلاسات</button>

    <div class="class-hero">
      <div class="class-icon">${info.icon}</div>
      <p class="small-label">BLUE AGATE • CLASS</p>
      <h2>${info.title}</h2>
      <p>${info.focus}</p>
    </div>

    ${targetBoxes}
    ${benefitBoxes}

    <div class="schedule-note">
      <strong>معلومة اليوم</strong>
      <p>${info.tip}</p>
    </div>
  `);
}

function equipmentPage() {
  window.open(
    "https://drive.google.com/drive/folders/1GiLuoqMbwMzTpTzXIEKHrovmtEzrxzFh?usp=sharing",
    "_blank",
    "noopener,noreferrer"
  );
}

function hoursPage() {
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>مواعيد النادي</h2>
    <p class="hero-text">أوقات العمل والكلاسات الأسبوعية.</p>

    <div class="club-hours-grid">
      <div class="hours-card">
        <div class="hours-day">السبت</div>
        <div class="hours-row"><span>🕓 وقت النادي</span><strong>4:00 م</strong></div>
        <div class="hours-row"><span>🏋🏻‍♀️ الكلاس الأول</span><strong>4:30 م</strong></div>
        <div class="hours-row"><span>🏋🏻‍♀️ الكلاس الثاني</span><strong>6:30 م</strong></div>
      </div>

      <div class="hours-card">
        <div class="hours-day">الأحد – الخميس</div>
        <div class="period-title">☀️ الفترة الصباحية</div>
        <div class="hours-row"><span>وقت النادي</span><strong>7:00 ص – 9:00 ص</strong></div>
        <div class="hours-row"><span>🏋🏻‍♀️ الكلاس</span><strong>7:30 ص</strong></div>

        <div class="period-divider"></div>

        <div class="period-title">🌙 الفترة المسائية</div>
        <div class="hours-row"><span>وقت النادي</span><strong>4:00 م</strong></div>
        <div class="hours-row"><span>🏋🏻‍♀️ الكلاس الأول</span><strong>4:30 م</strong></div>
        <div class="hours-row"><span>🏋🏻‍♀️ الكلاس الثاني</span><strong>6:30 م</strong></div>
      </div>

      <div class="hours-card closed">
        <div class="hours-day">الجمعة</div>
        <div class="closed-text">إجازة النادي</div>
        <p>نتمنى لكِ يومًا سعيدًا 🤍</p>
      </div>
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
    if (page === "equipment") equipmentPage();

    if (page === "rules") {
      placeholderPage("نظام النادي", "هنا سنضيف قوانين وتعليمات النادي بشكل مرتب وسهل القراءة.");
    }

    if (page === "hours") hoursPage();

    if (page === "news") {
      placeholderPage("الإعلانات", "هنا ستظهر إعلانات وتحديثات النادي.");
    }

    if (page === "contact") {
      placeholderPage("تواصل معنا", "هنا سنضيف رقم التواصل، الموقع، وحسابات النادي.");
    }
  });
});
