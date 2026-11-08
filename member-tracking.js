// Blue Agate - Member absence balance and body measurements (read-only for members)
(function () {
  "use strict";
  const TOTAL_GRACE_DAYS = 7;
  const safe = value => String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  window.renderAbsenceBalance = function (memberData) {
    const remainingValue = memberData && (memberData.graceAbsenceDaysRemaining ?? memberData.absenceAllowanceDaysRemaining);
    const remaining = Number.isFinite(Number(remainingValue)) ? Math.max(0, Math.min(TOTAL_GRACE_DAYS, Number(remainingValue))) : TOTAL_GRACE_DAYS;
    const used = TOTAL_GRACE_DAYS - remaining;
    const usedEl = document.getElementById("absence-days-used");
    const leftEl = document.getElementById("absence-days-left");
    const bar = document.getElementById("absence-progress-bar");
    const note = document.getElementById("absence-balance-note");
    if (usedEl) usedEl.textContent = `${used} / ${TOTAL_GRACE_DAYS}`;
    if (leftEl) leftEl.textContent = String(remaining);
    if (bar) bar.style.width = `${(used / TOTAL_GRACE_DAYS) * 100}%`;
    if (note) note.textContent = remaining > 0
      ? `استهلكتِ ${used} أيام من رصيد التعويض، ويتبقى لكِ ${remaining} ${remaining === 1 ? "يوم" : "أيام"}.`
      : "استهلكتِ كامل رصيد أيام التعويض السبعة. بعد ذلك تُحتسب أيام الغياب وفق نظام الاشتراك.";
  };

  window.loadMemberMeasurements = async function (uid) {
    const list = document.getElementById("member-measurements-list");
    if (!list || !uid) return;
    list.innerHTML = '<div class="tracking-empty">جاري تحميل القياسات...</div>';
    try {
      const snap = await firebase.firestore().collection("members").doc(uid).collection("measurements").get();
      const records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => String(b.dateKey || "").localeCompare(String(a.dateKey || "")));
      if (!records.length) {
        list.innerHTML = '<div class="tracking-empty">لم تُسجّل قياساتكِ بعد. ستظهر هنا بعد إضافتها من إدارة النادي.</div>';
        return;
      }
      list.innerHTML = records.map(record => {
        const rows = [
          ["الطول", record.height, "سم"], ["الوزن", record.weight, "كجم"],
          ["محيط الرقبة", record.neck, "سم"], ["محيط العضد", record.upperArm, "سم"],
          ["محيط الساعد", record.forearm, "سم"], ["محيط الصدر", record.chest, "سم"],
          ["محيط الوسط", record.waist, "سم"], ["محيط البطن", record.abdomen, "سم"],
          ["محيط الأرداف", record.hips, "سم"], ["محيط الفخذ", record.thigh, "سم"],
          ["محيط السمانة", record.calf, "سم"], ["محيط العرقوب", record.ankle, "سم"]
        ].filter(([, value]) => value !== null && value !== undefined && value !== "");
        const date = record.dateKey ? new Date(`${record.dateKey}T00:00:00`).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" }) : "تاريخ غير محدد";
        return `<article class="measurement-record"><div class="measurement-record-head"><h3>قياسات ${safe(date)}</h3><span>BLUE AGATE</span></div><div class="measurement-values">${rows.map(([label,value,unit]) => `<div class="measurement-value"><span>${label}</span><strong>${safe(value)} <small>${unit}</small></strong></div>`).join("")}</div>${record.notes ? `<p class="measurement-notes"><strong>ملاحظات المدربة:</strong> ${safe(record.notes)}</p>` : ""}</article>`;
      }).join("");
    } catch (error) {
      console.error("Member measurements load error:", error);
      list.innerHTML = '<div class="tracking-empty tracking-error">تعذر تحميل القياسات حاليًا. حاولي تحديث الصفحة.</div>';
    }
  };
})();
