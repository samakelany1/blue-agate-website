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
  let availableDays=days;
  try{const snap=await firebase.firestore().collection('clubClasses').get();const rows=snap.docs.map(d=>d.data()).filter(x=>x.active!==false);if(rows.length){const found=new Set(rows.map(x=>x.day).filter(Boolean));const order=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];availableDays=order.filter(day=>found.has(day));availableDays.push(...[...found].filter(day=>!order.includes(day)));}}catch(e){console.warn('Using default weekly schedule',e);}
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
      const cards = items.map(x => {
        const name = x.name || 'كلاس';
        const click = `classPage(${JSON.stringify(name)},${JSON.stringify(day)})`;
        return `<button type="button" class="class-row class-clickable" onclick='${click}'><div class="class-period">🕒 <span>${escapeContent(x.time||'')}</span></div><div class="class-name"><span>${escapeContent(name)}</span><span class="class-arrow">←</span></div>${x.description?`<p>${escapeContent(x.description)}</p>`:''}${day==='الخميس'?'<div class="class-extra-note">🧘‍♀️ يتضمن الكلاس فقرة يوجا في نهايته</div>':''}</button>`;
      }).join('');
      show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${escapeContent(day)}</h2><p class="hero-text">اضغطي على أي كلاس لمعرفة تفاصيله والأجزاء المستهدفة.</p><div class="day-detail">${cards}</div>`);
      return;
    }
  }catch(e){console.warn('Using built-in class schedule',e);}
  const data=schedule[day];
  if(!data){show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${escapeContent(day)}</h2><p class="placeholder">لا توجد كلاسات مضافة لهذا اليوم.</p>`);return;}
  show(`<button class="back-btn" onclick="schedulePage()">← العودة للأيام</button><h2>جدول يوم ${day}</h2><p class="hero-text">اضغطي على أي كلاس لمعرفة نبذة عنه.</p><div class="day-detail">${classCard('☀️','كلاس الصباح • 8:15 ص',data.morning,day)}${classCard('🕐','الكلاس الأول • 3:30 م',data.first,day)}${classCard('🕐','الكلاس الثاني • 6:30 م',data.second,day)}</div><div class="schedule-note"><strong>ملاحظة</strong><p>مواعيد الكلاسات متغيرة حسب الجدول الأسبوعي. يرجى الالتزام بالجدول لتحقيق أفضل النتائج.</p></div>`);
}

function classCard(icon, period, className, day = '') {
  if (className === "لا يوجد كلاس صباحي") {
    return `<div class="class-row no-class"><div class="class-period">${icon}<span>${period}</span></div><div class="class-name">${className}</div></div>`;
  }
  const click = `classPage(${JSON.stringify(className)},${JSON.stringify(day)})`;
  return `<button class="class-row class-clickable" onclick='${click}'><div class="class-period">${icon}<span>${period}</span></div><div class="class-name"><span>${escapeContent(className)}</span><span class="class-arrow">←</span></div>${day === 'الخميس' ? '<div class="class-extra-note">🧘‍♀️ يتضمن الكلاس فقرة يوجا في نهايته</div>' : ''}</button>`;
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
    focus: "حصة تعتمد على أداء حركات متحكم بها وبإيقاع هادئ، مع التركيز على التنفس والمحاذاة الصحيحة للجسم وتقوية العضلات العميقة.",
    targets: [
      ["عضلات الكور والبطن", "تنشيط العضلات العميقة المسؤولة عن ثبات الجذع ودعم العمود الفقري."],
      ["عضلات الظهر", "تقوية العضلات الداعمة للظهر وتحسين التحكم بوضعية الجسم."],
      ["الحوض والمؤخرة", "تحسين ثبات الحوض وتنشيط عضلات الأرداف."],
      ["الفخذان والساقان", "تقوية عضلات الجزء السفلي وتحسين التحكم بالحركة."],
      ["الكتفان والذراعان", "إشراك الجزء العلوي في حركات الثبات والتحكم."]
    ],
    benefits: [
      "تحسين التوازن والثبات والتحكم بالجسم",
      "زيادة المرونة ومدى الحركة تدريجيًا",
      "تقوية العضلات العميقة وعضلات الكور",
      "تحسين الوعي بالتنفس ووضعية الجسم",
      "دعم تناسق الحركة وتقليل التوتر العضلي"
    ],
    tip: "في البيلاتس، جودة الحركة والتحكم فيها أهم من سرعتها؛ احرصي على التنفس المنتظم وأداء الحركة بالشكل الصحيح."
  },

  "فل بودي": {
    icon: "✨",
    title: "كلاس فل بودي",
    focus: "حصة تدريبية متكاملة تجمع تمارين القوة والتحمل والحركة لتشغيل مجموعات عضلية متعددة في الجسم خلال حصة واحدة.",
    targets: [
      ["الجزء العلوي", "تمارين للصدر والظهر والأكتاف والذراعين لتحسين القوة والتناسق."],
      ["عضلات الكور والبطن", "تمارين لتقوية منتصف الجسم ودعم التوازن والثبات."],
      ["المؤخرة والفخذان", "تمارين تستهدف عضلات الأرداف والفخذ الأمامي والخلفي."],
      ["الساقان", "تنشيط عضلات السمانة وتحسين قوة وثبات الساقين."],
      ["القلب والتنفس", "قد تتضمن الحصة فترات حركة ترفع معدل النبض وتحسن التحمل حسب مستوى التمرين."]
    ],
    benefits: [
      "تقوية عضلات الجسم بصورة متوازنة",
      "تحسين اللياقة والتحمل البدني",
      "دعم التوازن والتناسق الحركي",
      "تنويع التمارين وتنشيط الجسم بالكامل",
      "المساعدة على تطوير القوة والأداء اليومي"
    ],
    tip: "تُعدّل شدة التمارين والأوزان حسب مستوى كل مشتركة؛ اختاري الحمل المناسب واهتمي بالتكنيك الصحيح طوال الحصة."
  }
};

function classPage(className, day = '') {
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
    ${day === 'الخميس' ? '<div class="schedule-note"><strong>فقرة ختامية يوم الخميس</strong><p>تُختتم الحصة بفقرة يوجا تساعد على التهدئة وتمارين التنفس والتمدد بعد التمرين.</p></div>' : ''}

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
function escapeContent(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function clubRulesPage(){
  show(`<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>نظام النادي</h2><p class="hero-text">التعليمات والتنظيمات الخاصة بنادي العقيق الأزرق.</p><div id="club-rules-list"><div class="empty-state">جاري تحميل التعليمات...</div></div>`);
  const box=document.getElementById('club-rules-list');
  try{const snap=await firebase.firestore().collection('clubRules').get();const items=snap.docs.map(d=>d.data()).filter(x=>x.active!==false);box.innerHTML=items.length?items.map(x=>`<article class="announcement-card"><h3>${escapeContent(x.title||'')}</h3><p>${escapeContent(x.body||'').replace(/\n/g,'<br>')}</p></article>`).join(''):'<div class="placeholder">سيتم نشر تعليمات النادي هنا قريبًا.</div>';}catch(e){console.error(e);box.innerHTML='<div class="placeholder">تعذر تحميل التعليمات.</div>';}
}


async function contactPage() {
  show(`
    <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
    <h2>تواصل معنا</h2>
    <div class="placeholder">جارٍ تحميل بيانات التواصل...</div>
  `);

  const link = (label, value, href, icon) => {
    if (!value) return "";
    const safeLabel = escapeContent(label);
    const safeValue = escapeContent(value);
    const safeHref = escapeContent(href);
    return `<a class="contact-detail-link" href="${safeHref}" target="_blank" rel="noopener noreferrer">
      <span class="contact-detail-icon">${icon}</span>
      <span class="contact-detail-copy"><strong>${safeLabel}</strong><span>${safeValue}</span></span>
      <span class="contact-detail-arrow">←</span>
    </a>`;
  };

  try {
    const snap = await firebase.firestore().collection("clubSettings").doc("contact").get();
    const data = snap.exists ? snap.data() : {};
    const items = [
      link("رقم الجوال", data.phone, `tel:${String(data.phone || "").replace(/[^+\d]/g, "")}`, "📱"),
      link("واتساب", data.whatsapp, data.whatsapp, "💬"),
      link("البريد الإلكتروني", data.email, `mailto:${data.email || ""}`, "✉️"),
      link("إنستغرام", data.instagram, data.instagram, "📷"),
      link("سناب شات", data.snapchat, data.snapchat, "👻"),
      link("الموقع / العنوان", data.location,
        /^https?:\/\//i.test(data.location || "") ? data.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.location || "")}`,
        "📍")
    ].filter(Boolean);

    show(`
      <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
      <h2>تواصل معنا</h2>
      <p class="hero-text">يسعدنا تواصلكِ معنا. اختاري وسيلة التواصل المناسبة.</p>
      ${items.length
        ? `<div class="contact-details-grid">${items.join("")}</div>`
        : `<div class="placeholder">لم تُضف بيانات التواصل بعد. يرجى المحاولة لاحقًا.</div>`}
    `);
  } catch (error) {
    console.error("Could not load club contact information:", error);
    show(`
      <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
      <h2>تواصل معنا</h2>
      <div class="placeholder">تعذر تحميل بيانات التواصل حاليًا. يرجى المحاولة مرة أخرى.</div>
    `);
  }
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
