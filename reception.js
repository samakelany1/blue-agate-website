/* Blue Agate reception QR check-in. Only users listed in admins/{uid} with role=admin may scan. */
let scanner = null;
let busy = false;
const $ = id => document.getElementById(id);
function showMessage(id, text, type='info') { const el=$(id); if(!el)return; el.textContent=text; el.className='message '+type; el.hidden=false; }
function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fromKey(k){ return new Date(`${k}T00:00:00`); }
function nextDay(d){ const n=new Date(d); n.setDate(n.getDate()+1); return n; }
function isFriday(d){ return d.getDay()===5; }
function isClosedDate(key, member){ return Array.isArray(member.excludedAbsenceDates) && member.excludedAbsenceDates.includes(key); }
async function isAdmin(user){ if(!user)return false; const snap=await firebase.firestore().collection('admins').doc(user.uid).get(); return snap.exists && snap.data().role==='admin'; }
function setPanel(isIn){ $('login-card').hidden=isIn; $('scanner-card').hidden=!isIn; $('logout').hidden=!isIn; if(isIn) startScanner(); else stopScanner(); }
async function startScanner(){ if(scanner || typeof Html5Qrcode==='undefined') return; scanner=new Html5Qrcode('reader'); try { await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240}}, async text=>{ if(busy)return; await handleScan(text); }, ()=>{}); } catch(e){ showMessage('scan-message','تعذر تشغيل الكاميرا. تأكدي من السماح باستخدام الكاميرا أو أدخلي الرمز يدويًا.','error'); } }
async function stopScanner(){ if(!scanner)return; try{ if(scanner.isScanning) await scanner.stop(); await scanner.clear(); }catch(e){} scanner=null; }
async function handleScan(raw){ const uid=String(raw||'').trim(); if(!uid || uid.length>150){ showMessage('scan-message','الرمز غير صالح.','error'); return; } busy=true; try { const result=await registerCheckin(uid); const box=$('last-result'); box.hidden=false; box.className='result'+(result.ok?'':' bad'); box.innerHTML=''; const title=document.createElement('strong'); title.textContent=result.title; const detail=document.createElement('div'); detail.textContent=result.detail; box.append(title,detail); $('manual-uid').value=''; if(result.ok) showMessage('scan-message','تم تسجيل الحضور بنجاح.','success'); else showMessage('scan-message',result.title,'error'); } catch(e){ console.error(e); showMessage('scan-message','تعذر تسجيل الحضور. تحققي من الاتصال وصلاحيات Firebase.','error'); } finally { setTimeout(()=>{busy=false;},1600); } }
async function registerCheckin(uid){
 const db=firebase.firestore(), today=new Date(), todayKey=dateKey(today), memberRef=db.collection('members').doc(uid), todayRef=memberRef.collection('attendance').doc(todayKey);
 return db.runTransaction(async tx=>{
   const mSnap=await tx.get(memberRef); if(!mSnap.exists)return {ok:false,title:'العضوية غير موجودة',detail:'لم يتم العثور على حساب بهذه البطاقة.'};
   const m=mSnap.data();
   const adminUser=firebase.auth().currentUser; if(!adminUser) throw new Error('Not signed in');
   const attToday=await tx.get(todayRef); if(attToday.exists)return {ok:false,title:'تم تسجيل الحضور اليوم',detail:`${m.name||'المشتركة'} لديها حضور مسجل لهذا اليوم.`};
   if(m.active===false || m.membershipActive===false)return {ok:false,title:'العضوية موقوفة',detail:'راجعي الإدارة قبل السماح بالدخول.'};
   let started=m.attendancePlanStartedAt ? (m.attendancePlanStartedAt.toDate ? m.attendancePlanStartedAt.toDate() : new Date(m.attendancePlanStartedAt)) : null;
   let remaining=Number.isFinite(m.attendanceDaysRemaining)?m.attendanceDaysRemaining:30;
   let grace=Number.isFinite(m.graceAbsenceDaysRemaining)?m.graceAbsenceDaysRemaining:7;
   let last=m.attendanceLastProcessedDate || null;
   if(!started){
     started=new Date(today); started.setHours(0,0,0,0);
     remaining=30; grace=7; last=todayKey;
   } else {
     // Reconcile all unprocessed dates up to yesterday. Friday and approved closure dates are excluded.
     let cursor=last ? nextDay(fromKey(last)) : nextDay(started);
     let iterations=0;
     while(dateKey(cursor)<todayKey && iterations<370){
       const key=dateKey(cursor);
       if(!isFriday(cursor) && !isClosedDate(key,m)){
         const oldRef=memberRef.collection('attendance').doc(key);
         const oldSnap=await tx.get(oldRef);
         // A date with attendance already consumed one basic day at check-in.
         // Never deduct that same attended day again during reconciliation.
         if(!oldSnap.exists){
           if(grace>0) grace-=1;
           else remaining=Math.max(0,remaining-1);
         }
       }
       last=key; cursor=nextDay(cursor); iterations++;
     }
     if(iterations>=370) throw new Error('Attendance reconciliation exceeded safe range; admin review required.');
   }
   if(remaining<=0)return {ok:false,title:'انتهى رصيد أيام الحضور',detail:'لا يمكن تسجيل حضور جديد قبل تجديد الاشتراك من الإدارة.'};
   // Today's attendance consumes one actual attendance day, never twice due to the date-key document ID.
   remaining=Math.max(0,remaining-1);
   tx.set(todayRef,{uid,dateKey:todayKey,timestamp:firebase.firestore.FieldValue.serverTimestamp(),source:'reception-qr'});
   tx.set(memberRef,{attendancePlanStartedAt:firebase.firestore.Timestamp.fromDate(started),attendanceDaysRemaining:remaining,graceAbsenceDaysRemaining:grace,attendanceLastProcessedDate:todayKey,attendancePlanVersion:1},{merge:true});
   return {ok:true,title:`تم تسجيل حضور ${m.name||'المشتركة'} ✓`,detail:`الرصيد الأساسي المتبقي: ${remaining} يومًا. أيام السماح المتبقية: ${grace}.`};
 });
}
$('login-form').addEventListener('submit',async e=>{e.preventDefault();try{await firebase.auth().signInWithEmailAndPassword($('email').value.trim(),$('password').value); }catch(err){showMessage('login-message','تعذر تسجيل الدخول. تحققي من البريد وكلمة المرور.','error');}});
$('logout').addEventListener('click',async()=>{await stopScanner();await firebase.auth().signOut();setPanel(false);});
$('manual-submit').addEventListener('click',()=>handleScan($('manual-uid').value));
$('manual-uid').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleScan($('manual-uid').value);}});
firebase.initializeApp(firebaseConfig);
firebase.auth().onAuthStateChanged(async user=>{ if(!user){setPanel(false);return;} try{ if(await isAdmin(user)){setPanel(true);} else {await firebase.auth().signOut();setPanel(false);showMessage('login-message','هذا الحساب ليس لديه صلاحية الاستقبال.','error');} }catch(e){console.error(e);setPanel(false);showMessage('login-message','تعذر التحقق من الصلاحيات.','error');} });
