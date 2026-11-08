// Blue Agate content manager: announcements, offers, membership plans, hours, classes and club rules.
(() => {
  const modules = {
    announcements: { title: 'الإعلانات', collection: 'clubAnnouncements', fields: [ ['title','عنوان الإعلان','text'], ['body','نص الإعلان','textarea'], ['date','التاريخ أو المدة','text'], ['imageUrl','رابط الصورة (اختياري)','url'] ] },
    offers: { title: 'العروض والأسعار', collection: 'clubOffers', fields: [ ['title','اسم العرض أو الخدمة','text'], ['price','السعر بالريال','number'], ['description','وصف العرض','textarea'], ['category','التصنيف','text'], ['imageUrl','رابط الصورة (اختياري)','url'] ] },
    plans: { title: 'نظام النادي والباقات', collection: 'clubPlans', fields: [ ['title','اسم الباقة / النظام','text'], ['duration','المدة','text'], ['price','السعر بالريال','number'], ['details','التفاصيل والمزايا','textarea'] ] },
    hours: { title: 'مواعيد النادي', collection: 'clubHours', fields: [ ['day','اليوم أو مجموعة الأيام','text'], ['period','الفترة','text'], ['open','وقت البداية','text'], ['close','وقت النهاية','text'], ['notes','ملاحظات','textarea'] ] },
    classes: { title: 'جدول الكلاسات', collection: 'clubClasses', fields: [ ['day','اليوم','text'], ['time','وقت الكلاس','text'], ['name','اسم الكلاس','text'], ['description','وصف مختصر (اختياري)','textarea'] ] },
    rules: { title: 'تعليمات ونظام النادي', collection: 'clubRules', fields: [ ['title','عنوان التعليمات','text'], ['body','نص التعليمات','textarea'] ] }
  };
  let activeKey = 'announcements';
  let editingId = null;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function message(text, type='info') { const el=$('content-admin-message'); el.textContent=text; el.className=`admin-message ${type}`; el.hidden=false; }
  function currentModule(){ return modules[activeKey]; }
  function renderForm(data={}) {
    const m=currentModule(); editingId=data.id || null;
    $('content-admin-form-title').textContent = editingId ? `تعديل: ${m.title}` : `إضافة إلى ${m.title}`;
    $('content-admin-fields').innerHTML=m.fields.map(([key,label,type])=>`<div class="field-group ${type==='textarea'?'full-width':''}"><label for="content-field-${key}">${label}</label>${type==='textarea'?`<textarea id="content-field-${key}" rows="3">${esc(data[key]||'')}</textarea>`:`<input id="content-field-${key}" type="${type}" ${type==='number'?'min="0" step="0.01"':''} value="${esc(data[key]??'')}">`}</div>`).join('')+`<label class="content-active-toggle"><input id="content-field-active" type="checkbox" ${data.active===false?'':'checked'}> منشور / ظاهر للمشتركات</label>`;
    $('content-admin-editor').hidden=false; $('content-admin-editor').scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function loadItems(){
    const m=currentModule(), list=$('content-admin-list'); list.innerHTML='<div class="empty-state">جاري التحميل...</div>';
    try {
      const snap=await firebase.firestore().collection(m.collection).get();
      const items=snap.docs.map(d=>({id:d.id,...d.data()}));
      items.sort((a,b)=>(a.order??999)-(b.order??999) || String(a.title||a.day||a.name||'').localeCompare(String(b.title||b.day||b.name||''),'ar'));
      if(!items.length){list.innerHTML='<div class="empty-state">لا توجد عناصر بعد. استخدمي زر الإضافة لإنشاء أول عنصر.</div>';return;}
      list.innerHTML=items.map(item=>`<article class="content-admin-item"><div><strong>${esc(item.title||item.name||item.day||'عنصر بدون عنوان')}</strong><p>${esc(item.description||item.body||item.details||[item.period,item.open,item.close,item.time].filter(Boolean).join(' • ')||'')}</p><small>${item.active===false?'مخفي عن المشتركات':'ظاهر للمشتركات'}</small></div><div class="content-item-actions"><button type="button" data-edit="${esc(item.id)}">تعديل</button><button type="button" data-toggle="${esc(item.id)}" data-active="${item.active===false?'false':'true'}">${item.active===false?'نشر':'إخفاء'}</button><button type="button" class="danger" data-delete="${esc(item.id)}">حذف</button></div></article>`).join('');
      list.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>renderForm(items.find(x=>x.id===btn.dataset.edit))));
      list.querySelectorAll('[data-toggle]').forEach(btn=>btn.addEventListener('click',async()=>{try{await firebase.firestore().collection(m.collection).doc(btn.dataset.toggle).update({active:btn.dataset.active==='false'});await loadItems();}catch(e){console.error(e);message('تعذر تحديث حالة النشر. تحققي من صلاحيات Firestore.','error');}}));
      list.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('هل أنتِ متأكدة من حذف هذا العنصر؟'))return;try{await firebase.firestore().collection(m.collection).doc(btn.dataset.delete).delete();await loadItems();message('تم الحذف.','success');}catch(e){console.error(e);message('تعذر الحذف. تحققي من صلاحيات Firestore.','error');}}));
    } catch(e){console.error(e);list.innerHTML='<div class="empty-state error-state">تعذر تحميل المحتوى. تأكدي من نشر قواعد Firestore الجديدة.</div>';}
  }
  async function save(event){event.preventDefault();const m=currentModule(), data={active:$('content-field-active').checked,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:firebase.auth().currentUser.uid};m.fields.forEach(([key])=>{const el=$(`content-field-${key}`);data[key]=el.value.trim();});
    if(m.fields.some(([key,,type])=>type!=='textarea' && !data[key])){message('أكملي الحقول المطلوبة قبل الحفظ.','error');return;}
    try{const ref=firebase.firestore().collection(m.collection);if(editingId)await ref.doc(editingId).update(data);else await ref.add({...data,createdAt:firebase.firestore.FieldValue.serverTimestamp()});$('content-admin-editor').hidden=true;$('content-admin-form').reset();message('تم حفظ التعديلات بنجاح.','success');await loadItems();}catch(e){console.error(e);message('تعذر الحفظ. تحققي من قواعد Firestore.','error');}
  }
  async function seedInitialContent(){
    const db=firebase.firestore(), meta=db.collection('clubContentMeta').doc('initialSeed');
    const state=await meta.get(); if(state.exists && state.data().done===true)return;
    const packages=[
      ['اشتراك شهري فردي','شهر',399,'اشتراك لمدة شهر لشخص واحد.'],
      ['اشتراك شهري لشخصين','شهر',699,'الإجمالي لشخصين — 349.5 ريال لكل مشتركة.'],
      ['اشتراك شهري لثلاثة أشخاص','شهر',999,'الإجمالي لثلاث مشتركات — 333 ريال لكل مشتركة.'],
      ['3 شهور + شهر مجاني','4 شهور',996,'باقة ممتدة مع شهر إضافي مجانًا.'],
      ['تجربة يوم','دخول يومي',35,'دخول يومي للنادي.'],
      ['دخول بيلاتس — الأربعاء','كلاس',30,'دخول كلاس بيلاتس يوم الأربعاء.'],
      ['دخول يوجا — الخميس','كلاس',25,'دخول كلاس يوجا يوم الخميس.'],
      ['تعليم السباحة','6 كلاسات',299,'6 كلاسات تعليم سباحة.'],
      ['السباحة الحرة','الكلاس الواحد',35,'دخول السباحة الحرة للكلاس الواحد.'],
      ['السباحة الحرة','15 كلاس',299,'باقة 15 كلاس سباحة حرة.']
    ];
    const batch=db.batch();
    packages.forEach(([title,duration,price,details],i)=>batch.set(db.collection('clubPlans').doc(`initial-${i+1}`),{title,duration,price,details,active:true,order:i,createdAt:firebase.firestore.FieldValue.serverTimestamp()}));
    const hours=[
      {day:'السبت',period:'الفترة المسائية',open:'3:00 م',close:'9:00 م',notes:'الكلاس الأول 3:30 م • الكلاس الثاني 6:30 م'},
      {day:'الأحد – الخميس',period:'الفترة الصباحية',open:'7:45 ص',close:'10:30 ص',notes:'الكلاس الصباحي 8:15 ص'},
      {day:'الأحد – الخميس',period:'الفترة المسائية',open:'3:00 م',close:'9:00 م',notes:'الكلاس الأول 3:30 م • الكلاس الثاني 6:30 م'},
      {day:'الجمعة',period:'إجازة النادي',open:'مغلق',close:'مغلق',notes:'نتمنى لكِ يومًا سعيدًا 🤍'}
    ];
    hours.forEach((x,i)=>batch.set(db.collection('clubHours').doc(`initial-${i+1}`),{...x,active:true,order:i,createdAt:firebase.firestore.FieldValue.serverTimestamp()}));
    const classRows=[
      ['الأحد','8:15 ص','علوي'],['الأحد','3:30 م','بطن وكور'],['الأحد','6:30 م','بطن وكور'],
      ['الاثنين','8:15 ص','بطن وكور'],['الاثنين','3:30 م','سفلي'],['الاثنين','6:30 م','سفلي'],
      ['الثلاثاء','8:15 ص','سفلي'],['الثلاثاء','3:30 م','HIIT'],['الثلاثاء','6:30 م','HIIT'],
      ['الأربعاء','8:15 ص','HIIT'],['الأربعاء','3:30 م','ظهر وأكتاف جانبية'],['الأربعاء','6:30 م','بيلاتس'],
      ['الخميس','8:15 ص','فل بودي'],['الخميس','3:30 م','فل بودي'],['الخميس','6:30 م','فل بودي'],
      ['السبت','3:30 م','علوي'],['السبت','6:30 م','علوي']
    ];
    classRows.forEach(([day,time,name],i)=>batch.set(db.collection('clubClasses').doc(`initial-${i+1}`),{day,time,name,active:true,order:i,createdAt:firebase.firestore.FieldValue.serverTimestamp()}));
    batch.set(meta,{done:true,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
  }
  function init(){
    const panel=$('content-management-panel'); if(!panel)return;
    panel.querySelectorAll('[data-content-tab]').forEach(btn=>btn.addEventListener('click',()=>{activeKey=btn.dataset.contentTab;panel.querySelectorAll('[data-content-tab]').forEach(b=>b.classList.toggle('active',b===btn));$('content-admin-section-title').textContent=currentModule().title; $('content-admin-editor').hidden=true;loadItems();}));
    $('add-content-item').addEventListener('click',()=>renderForm()); $('cancel-content-edit').addEventListener('click',()=>$('content-admin-editor').hidden=true); $('content-admin-form').addEventListener('submit',save);
    firebase.auth().onAuthStateChanged(async user=>{if(user){try{if(await isCurrentUserAdmin(user)){panel.hidden=false;try{await seedInitialContent();}catch(seedError){console.error('Initial content seed failed',seedError);}loadItems();}}catch(e){console.error(e);}}else panel.hidden=true;});
  }
  document.addEventListener('DOMContentLoaded',init);
})();
