// Blue Agate admin-only balance controls and reversible member archive.
(function () {
  const $ = id => document.getElementById(id);
  let uid = null;
  const db = () => firebase.firestore();
  function msg(id, text, kind = 'info') { const node = $(id); if (!node) return; node.textContent = text; node.className = 'admin-message ' + kind; node.hidden = false; }
  function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  async function adminUser() {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('NOT_SIGNED_IN');
    const snap = await db().collection('admins').doc(user.uid).get();
    if (!snap.exists || snap.data().role !== 'admin') throw new Error('NOT_ADMIN');
    return { user, name: snap.data().name || user.displayName || user.email || 'الإدارة' };
  }
  function baseBalance(m) { return Math.max(0, Number(m.graceAbsenceDaysRemaining ?? m.absenceAllowanceDaysRemaining ?? 7) || 0); }
  function extraBalance(m) { return Math.max(0, Number(m.graceAbsenceExtraDaysRemaining || 0) || 0); }
  async function audit(memberRef, action, before, after, days, reason, actor) {
    await memberRef.collection('adminAuditLog').add({
      type: 'absence-balance', action, before, after, days, reason,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: actor.user.uid, createdByName: actor.name
    });
  }
  async function loadControls(memberUid) {
    uid = memberUid;
    if (!uid) return;
    const ref = db().collection('members').doc(uid);
    try {
      const [snap, logs] = await Promise.all([ref.get(), ref.collection('adminAuditLog').orderBy('createdAt','desc').limit(30).get()]);
      if (!snap.exists) throw new Error('MEMBER_NOT_FOUND');
      const m = snap.data(), base = baseBalance(m), extra = extraBalance(m);
      if ($('admin-balance-current')) $('admin-balance-current').textContent = `الرصيد الأساسي المتبقي: ${base} يوم • الرصيد الإضافي المتبقي: ${extra} يوم • الإجمالي: ${base + extra} يوم`;
      if ($('admin-balance-audit-list')) $('admin-balance-audit-list').innerHTML = logs.empty ? '<div class="mini-empty">لا توجد تعديلات مسجلة.</div>' : logs.docs.map(d => { const x=d.data(); const dt=x.createdAt?.toDate ? x.createdAt.toDate().toLocaleString('ar-SA') : '—'; return `<div class="manual-absence-row"><div><strong>${esc(x.action)} • ${esc(x.days)} يوم</strong><small>${esc(x.reason)} — ${esc(x.createdByName)} — ${esc(dt)}</small></div><span>${esc(x.before?.total ?? '—')} ← ${esc(x.after?.total ?? '—')}</span></div>`; }).join('');
      const archiveBtn = $('archive-member-btn'); if (archiveBtn) { archiveBtn.disabled = m.archived === true; archiveBtn.textContent = m.archived ? 'الحساب مؤرشف' : 'أرشفة الحساب الحالي'; }
    } catch (e) { msg('admin-balance-tools-message','تعذر تحميل بيانات الرصيد: '+e.message,'error'); }
  }
  async function mutateBalance(kind) {
    if (!uid) return;
    try {
      const actor = await adminUser(), ref = db().collection('members').doc(uid);
      const reasonId = kind === 'return' ? 'balance-return-reason' : kind === 'set' ? 'balance-set-reason' : 'balance-extra-reason';
      const inputId = kind === 'return' ? 'balance-return-days' : kind === 'set' ? 'balance-set-total' : 'balance-extra-days';
      const reason = $(reasonId).value.trim(), amount = Number($(inputId).value);
      if (!Number.isInteger(amount) || amount < (kind === 'set' ? 0 : 1) || amount > 365 || !reason) throw new Error('أدخلي عدد أيام صحيحًا وسببًا واضحًا.');
      let before, after;
      await db().runTransaction(async tx => {
        const snap = await tx.get(ref); if (!snap.exists) throw new Error('MEMBER_NOT_FOUND');
        const m=snap.data(); if (m.archived === true) throw new Error('الحساب مؤرشف؛ استعيديه أولًا.');
        const base=baseBalance(m), extra=extraBalance(m); before={base,extra,total:base+extra};
        let nextBase=base, nextExtra=extra;
        if (kind === 'return') { const sum=base+amount; nextBase=Math.min(7,sum); nextExtra=extra+Math.max(0,sum-7); }
        if (kind === 'set') { nextBase=Math.min(7,amount); nextExtra=Math.max(0,amount-7); }
        if (kind === 'extra') nextExtra=extra+amount;
        after={base:nextBase,extra:nextExtra,total:nextBase+nextExtra};
        tx.update(ref, { graceAbsenceDaysRemaining:nextBase, absenceAllowanceDaysRemaining:nextBase, graceAbsenceDaysConsumed:Math.max(0,7-nextBase), graceAbsenceExtraDaysRemaining:nextExtra, absenceBalanceUpdatedAt:firebase.firestore.FieldValue.serverTimestamp(), absenceBalanceUpdatedBy:actor.user.uid });
      });
      await audit(ref, ({return:'إرجاع أيام',set:'تحديد إجمالي الرصيد',extra:'منح رصيد إضافي'})[kind], before, after, amount, reason, actor);
      msg('admin-balance-tools-message',`تم الحفظ. الرصيد الآن ${after.total} يومًا (أساسي ${after.base} + إضافي ${after.extra}).`,'success');
      $(reasonId).value=''; await loadControls(uid);
    } catch(e) { msg('admin-balance-tools-message',e.message || 'تعذر تعديل الرصيد.','error'); }
  }
  async function archiveCurrent() {
    if (!uid) return;
    if (!confirm('تأكيد أرشفة هذا الحساب؟ ستختفي المشتركة من القائمة النشطة وستبقى بياناتها محفوظة.')) return;
    try {
      const actor=await adminUser(), ref=db().collection('members').doc(uid);
      await db().runTransaction(async tx => { const snap=await tx.get(ref); if(!snap.exists) throw new Error('MEMBER_NOT_FOUND'); if(snap.data().archived===true) throw new Error('الحساب مؤرشف مسبقًا.'); tx.update(ref,{archived:true,archivedAt:firebase.firestore.FieldValue.serverTimestamp(),archivedBy:actor.user.uid,archivedByName:actor.name}); });
      await ref.collection('adminAuditLog').add({type:'member-archive',action:'أرشفة الحساب',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:actor.user.uid,createdByName:actor.name});
      msg('admin-archive-message','تمت أرشفة الحساب مع الاحتفاظ بسجلاته.','success');
      if (typeof loadMembers === 'function') await loadMembers(); await loadArchived();
    } catch(e) { msg('admin-archive-message',e.message || 'تعذرت الأرشفة.','error'); }
  }
  async function loadArchived() {
    const list=$('archived-members-list'); if(!list) return;
    try {
      const actor=await adminUser(); void actor;
      const snap=await db().collection('members').where('archived','==',true).get();
      list.innerHTML=snap.empty?'<div class="empty-state">لا توجد حسابات مؤرشفة.</div>':snap.docs.map(d=>{const m=d.data();return `<div class="member-row archived-member-row"><div class="member-main"><strong>${esc(m.name||'بدون اسم')}</strong><span>${esc(m.email||m.phone||d.id)}</span></div><div class="member-meta"><span class="status-pill expired">مؤرشف</span><button class="secondary-btn dark-btn" type="button" data-restore-member="${esc(d.id)}">استعادة</button></div></div>`;}).join('');
      list.querySelectorAll('[data-restore-member]').forEach(b=>b.addEventListener('click',()=>restoreMember(b.dataset.restoreMember)));
    } catch(e) { list.innerHTML='<div class="empty-state error-state">تعذر تحميل الأرشيف. تحققي من صلاحيات Firestore.</div>'; }
  }
  async function restoreMember(memberUid) {
    if(!confirm('استعادة هذا الحساب إلى قائمة المشتركات النشطة؟')) return;
    try { const actor=await adminUser(), ref=db().collection('members').doc(memberUid); const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const vals=Object.fromEntries(parts.map(x=>[x.type,x.value])); const todayKey=`${vals.year}-${vals.month}-${vals.day}`; await db().runTransaction(async tx=>{const snap=await tx.get(ref);if(!snap.exists)throw new Error('MEMBER_NOT_FOUND');tx.update(ref,{archived:false,archivedRestoredAt:firebase.firestore.FieldValue.serverTimestamp(),archivedRestoredBy:actor.user.uid,attendanceLastProcessedDate:todayKey});}); await ref.collection('adminAuditLog').add({type:'member-archive',action:'استعادة الحساب',createdAt:firebase.firestore.FieldValue.serverTimestamp(),createdBy:actor.user.uid,createdByName:actor.name}); await loadArchived(); if(typeof loadMembers==='function') await loadMembers(); }
    catch(e){alert('تعذرت الاستعادة: '+e.message);}
  }
  document.addEventListener('blueagate:member-editor-opened',e=>loadControls(e.detail.uid));
  document.addEventListener('DOMContentLoaded',()=>{
    $('balance-return-btn')?.addEventListener('click',()=>mutateBalance('return'));
    $('balance-set-btn')?.addEventListener('click',()=>mutateBalance('set'));
    $('balance-extra-btn')?.addEventListener('click',()=>mutateBalance('extra'));
    $('archive-member-btn')?.addEventListener('click',archiveCurrent);
    $('refresh-archived-members')?.addEventListener('click',loadArchived);
    firebase.auth().onAuthStateChanged(user=>{if(user)loadArchived();});
  });
})();
