const offersButton = document.querySelector('.offers-highlight-btn');
const offerEsc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if (offersButton) {
  offersButton.addEventListener('click', async () => {
    const content=document.getElementById('content');
    content.hidden=false;
    content.innerHTML='<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>الأسعار والعروض</h2><p class="hero-text">اختاري الباقة المناسبة لكِ من عروض Blue Agate.</p><div id="dynamic-offers"><div class="empty-state">جاري تحميل الأسعار والعروض...</div></div>';
    content.scrollIntoView({behavior:'smooth',block:'start'});
    const target=document.getElementById('dynamic-offers');
    try {
      const db=firebase.firestore();
      const [offersSnap,plansSnap]=await Promise.all([db.collection('clubOffers').get(),db.collection('clubPlans').get()]);
      const offers=offersSnap.docs.map(d=>d.data()).filter(x=>x.active!==false);
      const plans=plansSnap.docs.map(d=>d.data()).filter(x=>x.active!==false);
      const render=(items,title,icon)=>items.length?`<section class="price-section"><div class="price-section-head"><span class="price-section-icon">${icon}</span><div><span class="price-section-label">BLUE AGATE FITNESS</span><h3>${title}</h3></div></div><div class="price-grid">${items.map(x=>`<article class="price-card"><h4>${offerEsc(x.title||'')}</h4>${x.price!==undefined&&x.price!==''?`<div class="price">${offerEsc(x.price)} <small>ريال</small></div>`:''}${x.duration?`<p>${offerEsc(x.duration)}</p>`:''}<p>${offerEsc(x.description||x.details||'')}</p>${x.category?`<span class="mini-tag">${offerEsc(x.category)}</span>`:''}${x.imageUrl?`<img src="${offerEsc(x.imageUrl)}" alt="${offerEsc(x.title||'العرض')}" style="width:100%;border-radius:12px;margin-top:10px">`:''}</article>`).join('')}</div></section>`:'';
      if(offers.length||plans.length) target.innerHTML=render(offers,'العروض والخدمات','✨')+render(plans,'باقات ونظام النادي','🏋🏻‍♀️')+'<p class="price-note">الأسعار والتفاصيل حسب آخر تحديث من إدارة النادي.</p>';
      else target.innerHTML='<div class="placeholder">لا توجد عروض أو باقات منشورة حاليًا. سيتم عرضها هنا عند إضافتها من لوحة التحكم.</div>';
    } catch(e){console.error(e);target.innerHTML='<div class="placeholder">تعذر تحميل الأسعار والعروض. حاولي مرة أخرى لاحقًا.</div>';}
  });
}
