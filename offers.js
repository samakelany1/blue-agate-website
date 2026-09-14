const offersButton = document.querySelector(".offers-highlight-btn");

if (offersButton) {
  offersButton.addEventListener("click", () => {
    const content = document.getElementById("content");

    content.hidden = false;
    content.innerHTML = `
      <button class="back-btn" onclick="backHome()">← العودة للرئيسية</button>
      <h2>الأسعار والعروض</h2>

      <div class="offers-page-card">
        <div class="offers-page-icon">✨</div>
        <h3>عروض Blue Agate</h3>
        <p>هنا نضع أحدث الأسعار والباقات والعروض الخاصة بالنادي.</p>
        <p class="offers-page-note">سيتم تحديث هذه الصفحة عند إضافة أي عرض جديد.</p>
      </div>
    `;

    content.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
