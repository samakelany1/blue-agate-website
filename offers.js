const offersButton = document.querySelector(".offers-highlight-btn");

if (offersButton) {
  offersButton.addEventListener("click", () => {
    const content = document.getElementById("content");

    content.hidden = false;
    content.innerHTML = `
      <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
      <h2>الأسعار والعروض</h2>
      <p class="hero-text">اختاري الباقة المناسبة لكِ من عروض Blue Agate.</p>

      <div class="price-section">
        <div class="price-section-head">
          <span class="price-section-icon">💙</span>
          <div>
            <span class="price-section-label">BLUE AGATE MEMBERSHIPS</span>
            <h3>الاشتراكات الشهرية</h3>
          </div>
        </div>
        <div class="price-grid">
          <div class="price-card"><h4>اشتراك شهري فردي</h4><div class="price">399 <small>ريال</small></div><p>اشتراك لمدة شهر لشخص واحد.</p></div>
          <div class="price-card"><h4>اشتراك شهري لشخصين</h4><div class="price">699 <small>ريال</small></div><p>الإجمالي لشخصين — 349.5 ريال لكل مشتركة.</p></div>
          <div class="price-card"><h4>اشتراك شهري لثلاثة أشخاص</h4><div class="price">999 <small>ريال</small></div><p>الإجمالي لثلاث مشتركات — 333 ريال لكل مشتركة.</p></div>
        </div>
      </div>

      <div class="price-section">
        <div class="price-section-head">
          <span class="price-section-icon">🏋🏻‍♀️</span>
          <div>
            <span class="price-section-label">BLUE AGATE FITNESS</span>
            <h3>باقات النادي</h3>
          </div>
        </div>

        <div class="price-grid">
          <div class="price-card">
            <h4>3 شهور + شهر مجاني</h4>
            <div class="price">996 <small>ريال</small></div>
            <p>باقة ممتدة مع شهر إضافي مجانًا.</p>
          </div>
        </div>

        <div class="price-grid single-row">
          <div class="price-card compact">
            <span class="mini-tag">دخول يومي</span>
            <h4>تجربة يوم</h4>
            <div class="price">35 <small>ريال</small></div>
          </div>

          <div class="price-card compact">
            <span class="mini-tag">كلاس</span>
            <h4>دخول بيلاتس — الأربعاء</h4>
            <div class="price">30 <small>ريال</small></div>
          </div>

          <div class="price-card compact">
            <span class="mini-tag">كلاس</span>
            <h4>دخول يوجا — الخميس</h4>
            <div class="price">25 <small>ريال</small></div>
          </div>
        </div>
      </div>

      <div class="price-section swimming-section">
        <div class="price-section-head">
          <span class="price-section-icon">🏊🏻‍♀️</span>
          <div>
            <span class="price-section-label">BLUE AGATE SWIMMING</span>
            <h3>باقات السباحة</h3>
          </div>
        </div>

        <div class="price-grid">
          <div class="price-card">
            <h4>تعليم السباحة</h4>
            <div class="price">299 <small>ريال</small></div>
            <p>6 كلاسات تعليم سباحة.</p>
          </div>

          <div class="price-card">
            <h4>السباحة الحرة</h4>
            <div class="price">35 <small>ريال</small></div>
            <p>الكلاس الواحد.</p>
          </div>

          <div class="price-card">
            <h4>السباحة الحرة</h4>
            <div class="price">299 <small>ريال</small></div>
            <p>باقة 15 كلاس.</p>
          </div>
        </div>
      </div>

      <div class="price-note">
        <strong>ملاحظة</strong>
        <p>العروض والأسعار قابلة للتحديث حسب عروض النادي الحالية.</p>
      </div>
    `;

    content.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
