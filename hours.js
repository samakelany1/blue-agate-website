const hoursCard = document.querySelector('.menu-card[data-page="hours"]');

if (hoursCard) {
  hoursCard.addEventListener("click", () => {
    const content = document.getElementById("content");

    content.hidden = false;
    content.innerHTML = `
      <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
      <h2>مواعيد النادي</h2>
      <p class="hero-text">نستقبلكِ خلال الفترات التالية من السبت إلى الخميس.</p>

      <div class="club-hours-grid">
        <div class="hours-card">
          <div class="hours-day">السبت</div>
          <div class="hours-row">
            <span>🕓 وقت النادي</span>
            <strong>4:00 م</strong>
          </div>
          <div class="hours-row">
            <span>🏋🏻‍♀️ الكلاس الأول</span>
            <strong>4:30 م</strong>
          </div>
          <div class="hours-row">
            <span>🏋🏻‍♀️ الكلاس الثاني</span>
            <strong>6:30 م</strong>
          </div>
        </div>

        <div class="hours-card">
          <div class="hours-day">الأحد – الخميس</div>

          <div class="period-title">☀️ الفترة الصباحية</div>
          <div class="hours-row">
            <span>وقت النادي</span>
            <strong>7:00 ص – 9:00 ص</strong>
          </div>
          <div class="hours-row">
            <span>🏋🏻‍♀️ الكلاس</span>
            <strong>7:30 ص</strong>
          </div>

          <div class="period-divider"></div>

          <div class="period-title">🌙 الفترة المسائية</div>
          <div class="hours-row">
            <span>وقت النادي</span>
            <strong>4:00 م</strong>
          </div>
          <div class="hours-row">
            <span>🏋🏻‍♀️ الكلاس الأول</span>
            <strong>4:30 م</strong>
          </div>
          <div class="hours-row">
            <span>🏋🏻‍♀️ الكلاس الثاني</span>
            <strong>6:30 م</strong>
          </div>
        </div>

        <div class="hours-card closed">
          <div class="hours-day">الجمعة</div>
          <div class="closed-text">إجازة النادي</div>
          <p>نتمنى لكِ يومًا سعيدًا 🤍</p>
        </div>
      </div>
    `;

    content.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
