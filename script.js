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

async function schedulePage() {
  const orderedDays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  let availableDays = [...days];
  try {
    const snap = await firebase.firestore().collection("clubClasses").get();
    const rows = snap.docs.map(d => d.data()).filter(x => x.active !== false);
    if (rows.length) {
      const savedDays = new Set(rows.map(x => x.day).filter(Boolean));
      availableDays = orderedDays.filter(day => savedDays.has(day));
      // Keep any custom day names after the standard week, without losing them.
      rows.map(x => x.day).filter(Boolean).forEach(day => {
        if (!orderedDays.includes(day) && !availableDays.includes(day)) availableDays.push(day);
      });
    } else {
      availableDays = orderedDays.filter(day => schedule[day]);
    }
  } catch (e) {
    console.warn("Using default weekly schedule", e);
    availableDays = orderedDays.filter(day => schedule[day]);
  }
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>جدول الكلاسات</h2>
    <p class="hero-text">اختاري اليوم لمشاهدة جدول الكلاسات بالتفصيل.</p>
    <div class="day-grid">${availableDays.map((day,i)=>`<button class="day-btn" onclick="dayPage('${String(day).replace(/'/g,"\\'")}')"><span style="display:block;font-size:11px;color:#22b9c2;margin-bottom:3px">${String(i+1).padStart(2,'0')}</span>${escapeContent(day)}</button>`).join('')}</div>
  `);
}

async function dayPage(day) {
  try{
    const snap=await firebase.firestore().collection('clubClasses').where('day','==',day).get();
    const items=snap.docs.map(d=>d.data()).filter(x=>x.active!==false).sort((a,b)=>String(a.time||'').localeCompare(String(b.time||''),'ar'));
    if(items.length){
      show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${escapeContent(day)}</h2><p class="hero-text">اضغطي على أي كلاس لمعرفة الأجزاء المستهدفة ومعلومات الحصة.</p><div class="day-detail">${items.map(x=>{
        const className = x.name || x.className || "";
        const safeName = String(className).replace(/\\/g,"\\\\").replace(/'/g,"\\'");
        return `<button class="class-row class-clickable" type="button" onclick="classPage('${safeName}')"><div class="class-period">🕒 <span>${escapeContent(x.time||'موعد الكلاس')}</span></div><div class="class-name"><span>${escapeContent(className)}</span><span class="class-arrow">←</span></div>${x.description?`<p>${escapeContent(x.description)}</p>`:''}</button>`;
      }).join('')}</div>`);return;
    }
  }catch(e){console.warn('Using built-in class schedule',e);}
  const data=schedule[day];
  if(!data){show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${escapeContent(day)}</h2><p class="placeholder">لا توجد كلاسات مضافة لهذا اليوم.</p>`);return;}
  show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${day}</h2><p class="hero-text">اضغطي على أي كلاس لمعرفة نبذة عنه.</p><div class="day-detail">${classCard('☀️','كلاس الصباح • 8:15 ص',data.morning)}${classCard('🕐','الكلاس الأول • 3:30 م',data.first)}${classCard('🕐','الكلاس الثاني • 6:30 م',data.second)}</div><div class="schedule-note"><strong>ملاحظة</strong><p>مواعيد الكلاسات متغيرة حسب الجدول الأسبوعي. يرجى الالتزام بالجدول لتحقيق أفضل النتائج.</p></div>`);
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
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>دليل الأجهزة الرياضية</h2>
    <p class="hero-text">تصفحي دليل الأجهزة وطريقة الاستخدام من داخل موقع Blue Agate.</p>
    <div class="equipment-pdf-wrap"><iframe src="assets/device-guide.pdf#toolbar=1&navpanes=0" title="دليل أجهزة نادي العقيق الأزرق" loading="lazy"></iframe></div>
    <p class="hero-text"><a href="assets/device-guide.pdf" target="_blank" rel="noopener">فتح الدليل في نافذة مستقلة</a></p>
  `);
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

async function newsPage() {
  show(`<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>الإعلانات</h2><p class="hero-text">آخر التنبيهات والتحديثات من Blue Agate.</p><div id="public-announcements" class="announcement-list"><div class="empty-state">جاري تحميل الإعلانات...</div></div>`);
  const target=document.getElementById('public-announcements');
  try {
    const snap=await firebase.firestore().collection('clubAnnouncements').get();
    const items=snap.docs.map(d=>d.data()).filter(x=>x.active!==false);
    if(items.length){target.innerHTML=items.map(x=>`<article class="announcement-card"><div class="announcement-badge">📢 إعلان</div>${x.date?`<p class="announcement-date">${escapeContent(x.date)}</p>`:''}<h3>${escapeContent(x.title||'')}</h3><p class="announcement-text">${escapeContent(x.body||'').replace(/\n/g,'<br>')}</p>${x.imageUrl?`<img src="${escapeContent(x.imageUrl)}" alt="${escapeContent(x.title||'إعلان النادي')}" style="max-width:100%;border-radius:14px">`:''}</article>`).join('');}
    else target.innerHTML='<div class="placeholder">لا توجد إعلانات منشورة حاليًا.</div>';
  } catch(e){console.error(e);target.innerHTML='<div class="placeholder">تعذر تحميل الإعلانات حاليًا.</div>';}
}

async function contactPage() {
  show(`<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>تواصل معنا</h2><p class="hero-text">يسعدنا تواصلكِ معنا، اختاري وسيلة التواصل المناسبة.</p><div id="club-contact-details" class="contact-details"><div class="empty-state">جاري تحميل بيانات التواصل...</div></div>`);
  const target = document.getElementById("club-contact-details");
  try {
    const snap = await firebase.firestore().collection("clubSettings").doc("contact").get();
    const c = snap.exists ? snap.data() : {};
    const links = [];
    if (c.phone) links.push(`<a class="contact-link" href="tel:${escapeContent(c.phone)}">📞 الاتصال: ${escapeContent(c.phone)}</a>`);
    if (c.whatsapp) links.push(`<a class="contact-link" href="${escapeContent(c.whatsapp)}" target="_blank" rel="noopener">💬 التواصل عبر واتساب</a>`);
    if (c.email) links.push(`<a class="contact-link" href="mailto:${escapeContent(c.email)}">✉️ ${escapeContent(c.email)}</a>`);
    if (c.instagram) links.push(`<a class="contact-link" href="${escapeContent(c.instagram)}" target="_blank" rel="noopener">📷 إنستغرام</a>`);
    if (c.snapchat) links.push(`<a class="contact-link" href="${escapeContent(c.snapchat)}" target="_blank" rel="noopener">👻 سناب شات</a>`);
    if (c.location) links.push(`<div class="contact-link">📍 ${escapeContent(c.location)}</div>`);
    target.innerHTML = links.length ? `<div class="contact-links-grid">${links.join("")}</div>` : '<div class="placeholder">سيتم تحديث بيانات التواصل قريبًا.</div>';
  } catch (e) {
    console.error(e);
    target.innerHTML = '<div class="placeholder">تعذر تحميل بيانات التواصل حاليًا.</div>';
  }
}

function escapeContent(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function clubRulesPage(){
  show(`<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>نظام النادي</h2><p class="hero-text">التعليمات والتنظيمات الخاصة بنادي العقيق الأزرق.</p><div id="club-rules-list"><div class="empty-state">جاري تحميل التعليمات...</div></div>`);
  const box=document.getElementById('club-rules-list');
  try{const snap=await firebase.firestore().collection('clubRules').get();const items=snap.docs.map(d=>d.data()).filter(x=>x.active!==false);box.innerHTML=items.length?items.map(x=>`<article class="announcement-card"><h3>${escapeContent(x.title||'')}</h3><p>${escapeContent(x.body||'').replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="placeholder">سيتم نشر تعليمات النادي هنا قريبًا.</div>';}catch(e){console.error(e);box.innerHTML='<div class="placeholder">تعذر تحميل التعليمات.</div>';}
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
      clubRulesPage();
    }

    if (page === "hours") hoursPage();

    if (page === "news") {
      newsPage();
    }

    if (page === "contact") {
      contactPage();
    }
  });
});
