const hoursCard = document.querySelector('.menu-card[data-page="hours"]');
const hoursEsc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(hoursCard){hoursCard.addEventListener('click',async()=>{
  const content=document.getElementById('content');content.hidden=false;
  content.innerHTML='<button class="back-btn" onclick="backHome()">← العودة للرئيسية</button><h2>مواعيد النادي</h2><p class="hero-text">أوقات العمل والفترات المعتمدة في النادي.</p><div id="dynamic-hours"><div class="empty-state">جاري تحميل المواعيد...</div></div>';
  content.scrollIntoView({behavior:'smooth',block:'start'});
  const target=document.getElementById('dynamic-hours');
  try{const snap=await firebase.firestore().collection('clubHours').get();const items=snap.docs.map(d=>d.data()).filter(x=>x.active!==false);
    if(!items.length){target.innerHTML='<div class="placeholder">لم تُضف مواعيد منشورة بعد. يمكنكِ إضافتها من لوحة التحكم.</div>';return;}
    target.innerHTML=`<div class="club-hours-grid">${items.map(x=>`<div class="hours-card"><div class="hours-day">${hoursEsc(x.day||'')}</div>${x.period?`<div class="period-title">${hoursEsc(x.period)}</div>`:''}<div class="hours-row"><span>وقت البداية</span><strong>${hoursEsc(x.open||'—')}</strong></div><div class="hours-row"><span>وقت النهاية</span><strong>${hoursEsc(x.close||'—')}</strong></div>${x.notes?`<p>${hoursEsc(x.notes)}</p>`:''}</div>`).join('')}</div>`;
  }catch(e){console.error(e);target.innerHTML='<div class="placeholder">تعذر تحميل المواعيد حاليًا.</div>';}
});}
