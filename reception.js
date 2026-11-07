/* Blue Agate reception QR check-in. Reception access is restricted to admins/{uid} role=admin. */
let scanner = null;
let busy = false;
let cameraRunning = false;
const $ = id => document.getElementById(id);

function showMessage(id, text, type='info') {
  const el=$(id); if(!el)return;
  el.textContent=text; el.className='message '+type; el.hidden=false;
}
function dateKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fromKey(k){ return new Date(`${k}T00:00:00`); }
function nextDay(d){ const n=new Date(d); n.setDate(n.getDate()+1); return n; }
function isFriday(d){ return d.getDay()===5; }
function toDate(value){
  if(!value)return null;
  const d=typeof value.toDate==='function'?value.toDate():new Date(value);
  return Number.isNaN(d.getTime())?null:d;
}
function startOfDay(value){ const d=toDate(value); if(!d)return null; d.setHours(0,0,0,0); return d; }
function formatDate(value){
  const d=toDate(value); if(!d)return 'غير مسجل';
  return d.toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'});
}
function isClosedDate(key, member){ return Array.isArray(member.excludedAbsenceDates) && member.excludedAbsenceDates.includes(key); }
async function isAdmin(user){
  if(!user)return false;
  const snap=await firebase.firestore().collection('admins').doc(user.uid).get();
  return snap.exists && snap.data().role==='admin';
}
function setCameraUi(running){
  cameraRunning=running;
  $('camera-toggle').textContent=running?'إيقاف الكاميرا':'تشغيل الكاميرا';
  $('camera-status').textContent=running?'الكاميرا تعمل — وجّهيها نحو الرمز':'الكاميرا متوقفة';
}
function setPanel(isIn){
  $('login-card').hidden=isIn; $('scanner-card').hidden=!isIn; $('logout').hidden=!isIn;
  if(isIn) startScanner(); else stopScanner();
}
async function startScanner(){
  if(cameraRunning)return;
  if(typeof Html5Qrcode==='undefined'){
    showMessage('scan-message','تعذر تحميل ماسح QR. استخدمي الإدخال اليدوي أو أعيدي تحميل الصفحة.','error');
    $('camera-status').textContent='الماسح غير متاح'; return;
  }
  try{
    if(!scanner)scanner=new Html5Qrcode('reader');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:240,height:240},aspectRatio:1.0},async text=>{
      if(busy)return;
      await handleScan(text);
    },()=>{});
    setCameraUi(true);
  }catch(e){
    console.error('Camera start failed:',e);
    setCameraUi(false);
    showMessage('scan-message','تعذر تشغيل الكاميرا. اسمحي للمتصفح باستخدام الكاميرا، أو أدخلي رمز العضوية يدويًا.','error');
  }
}
async function stopScanner(){
  if(!scanner){setCameraUi(false);return;}
  try{ if(scanner.isScanning)await scanner.stop(); await scanner.clear(); }catch(e){console.warn('Scanner stop:',e);}
  scanner=null; setCameraUi(false);
}
async function toggleCamera(){
  if(cameraRunning)await stopScanner();
  else await startScanner();
}
function renderResult(result){
  const box=$('last-result'); box.hidden=false; box.className='result-card'+(result.ok?'':' bad'); box.replaceChildren();
  const head=document.createElement('div'); head.className='result-head';
  const symbol=document.createElement('div'); symbol.className='result-symbol'; symbol.textContent=result.ok?'✓':'!';
  const heading=document.createElement('div');
  const title=document.createElement('div'); title.className='result-title'; title.textContent=result.title;
  const subtitle=document.createElement('div'); subtitle.className='result-subtitle'; subtitle.textContent=result.detail||'';
  heading.append(title,subtitle); head.append(symbol,heading); box.append(head);
  if(result.member){
    const grid=document.createElement('div'); grid.className='member-grid';
    const fields=[
      ['اسم العضوة',result.member.name||'غير مسجل'],
      ['نوع الاشتراك',result.member.membershipType||'غير محدد'],
      ['بداية الاشتراك',formatDate(result.member.startDate)],
      ['نهاية الاشتراك',formatDate(result.member.endDate)],
      ['أيام الحضور المتبقية',`${result.member.remaining} يوم`],
      ['أيام السماح المتبقية',`${result.member.grace} يوم`]
    ];
    fields.forEach(([label,value])=>{
      const item=document.createElement('div'); item.className='member-field';
      const l=document.createElement('span'); l.textContent=label;
      const v=document.createElement('strong'); v.textContent=value;
      item.append(l,v); grid.append(item);
    });
    box.append(grid);
  }
}
async function handleScan(raw){
  const uid=String(raw||'').trim();
  if(!uid || uid.length>150){showMessage('scan-message','الرمز غير صالح.','error');return;}
  busy=true;
  try{
    const result=await registerCheckin(uid);
    renderResult(result);
    $('manual-uid').value='';
    showMessage('scan-message',result.ok?'تم تسجيل الحضور بنجاح.':result.title,result.ok?'success':'error');
  }catch(e){
    console.error('Reception check-in failed:',e);
    const code=e && e.code ? ` (${e.code})` : '';
    showMessage('scan-message',`تعذر تسجيل الحضور${code}. راجعي اتصال الإنترنت وصلاحيات Firestore.`, 'error');
  }finally{setTimeout(()=>{busy=false;},1800);}
}
async function registerCheckin(uid){
  const db=firebase.firestore();
  const today=new Date();
  const todayKey=dateKey(today);
  const memberRef=db.collection('members').doc(uid);
  const attendanceCollection=memberRef.collection('attendance');
  const todayRef=attendanceCollection.doc(todayKey);
  const calendarCollection=db.collection('clubCalendar');
  const leaveCollection=memberRef.collection('absenceRequests');

  // Firestore Web transactions accept document references, not Query objects.
  // Read the history collections before starting the transaction, then use
  // the transaction only for the member and today's critical documents.
  const [attendanceHistory,leaveHistory,calendarHistory]=await Promise.all([
    attendanceCollection.get(),
    leaveCollection.get(),
    calendarCollection.get()
  ]);

  const attendedDates=new Set();
  attendanceHistory.forEach(doc=>{
    const data=doc.data();
    attendedDates.add(data.dateKey||doc.id);
  });

  const leavesByDate=new Map();
  leaveHistory.forEach(doc=>{
    const data=doc.data();
    if(!data.dateKey)return;
    if(!leavesByDate.has(data.dateKey))leavesByDate.set(data.dateKey,[]);
    leavesByDate.get(data.dateKey).push(data);
  });

  const calendarByDate=new Map();
  calendarHistory.forEach(doc=>calendarByDate.set(doc.id,doc.data()));

  return db.runTransaction(async tx=>{
    const [mSnap,attToday,todayCalendar]=await Promise.all([
      tx.get(memberRef),
      tx.get(todayRef),
      tx.get(calendarCollection.doc(todayKey))
    ]);

    if(!mSnap.exists)return {ok:false,title:'العضوية غير موجودة',detail:'لم يتم العثور على حساب بهذه البطاقة.'};
    const m=mSnap.data();
    if(!firebase.auth().currentUser)throw new Error('Not signed in');

    const memberInfo={
      name:m.name,
      membershipType:m.membershipType,
      startDate:m.startDate,
      endDate:m.endDate,
      remaining:Number.isFinite(m.attendanceDaysRemaining)?m.attendanceDaysRemaining:30,
      grace:Number.isFinite(m.graceAbsenceDaysRemaining)?m.graceAbsenceDaysRemaining:7
    };

    if(attToday.exists)return {ok:false,title:'تم تسجيل الحضور اليوم',detail:`${m.name||'العضوة'} لديها حضور مسجل لهذا اليوم.`,member:memberInfo};
    if(m.active===false || m.membershipActive===false)return {ok:false,title:'العضوية موقوفة',detail:'راجعي الإدارة قبل السماح بالدخول.',member:memberInfo};

    const start=startOfDay(m.startDate);
    let end=startOfDay(m.endDate);
    const todayStart=startOfDay(today);
    if(!start || !end)return {ok:false,title:'بيانات الاشتراك غير مكتملة',detail:'لا يوجد تاريخ بداية أو نهاية صالح للاشتراك. راجعي الإدارة.',member:memberInfo};
    if(todayStart<start)return {ok:false,title:'لم يبدأ الاشتراك بعد',detail:`يبدأ الاشتراك بتاريخ ${formatDate(m.startDate)}.`,member:memberInfo};
    if(todayStart>end)return {ok:false,title:'الاشتراك منتهٍ',detail:`انتهى الاشتراك بتاريخ ${formatDate(m.endDate)}. يلزم التجديد قبل الدخول.`,member:memberInfo};
    if(isFriday(today))return {ok:false,title:'النادي مغلق يوم الجمعة',detail:'لا يمكن تسجيل حضور في يوم إغلاق النادي.',member:memberInfo};

    const todayCalendarData=todayCalendar.exists?todayCalendar.data():{};
    if(todayCalendarData.closed===true || todayCalendarData.type==='closed'){
      return {ok:false,title:'النادي مغلق اليوم',detail:todayCalendarData.reason||'تم تسجيل إغلاق النادي لهذا اليوم.',member:memberInfo};
    }

    const todayLeaves=leavesByDate.get(todayKey)||[];
    if(todayLeaves.some(leave=>leave.status==='approved')){
      return {ok:false,title:'لديها إجازة معتمدة اليوم',detail:'تم اعتماد غياب هذه العضوة لهذا اليوم، ولا يمكن تسجيل حضور متزامن.',member:memberInfo};
    }

    let started=m.attendancePlanStartedAt?toDate(m.attendancePlanStartedAt):null;
    let remaining=Number.isFinite(m.attendanceDaysRemaining)?m.attendanceDaysRemaining:30;
    let grace=Number.isFinite(m.graceAbsenceDaysRemaining)?m.graceAbsenceDaysRemaining:7;
    let last=m.attendanceLastProcessedDate||null;

    if(!started){
      started=new Date(today);
      started.setHours(0,0,0,0);
      remaining=30;
      grace=7;
      last=todayKey;
    }else{
      let cursor=last?nextDay(fromKey(last)):nextDay(started);
      let iterations=0;
      while(dateKey(cursor)<todayKey && iterations<370){
        const key=dateKey(cursor);
        const calendar=calendarByDate.get(key)||{};
        const globalClosed=calendar.closed===true||calendar.type==='closed';

        if(globalClosed){
          end=nextDay(end);
        }else if(!isFriday(cursor)&&!isClosedDate(key,m)&&!attendedDates.has(key)){
          const approvedLeave=(leavesByDate.get(key)||[]).find(leave=>leave.status==='approved');
          if(approvedLeave){
            if(approvedLeave.balanceApplied!==true&&grace>0)grace-=1;
          }else if(grace>0){
            grace-=1;
          }else{
            remaining=Math.max(0,remaining-1);
          }
        }

        last=key;
        cursor=nextDay(cursor);
        iterations++;
      }
      if(iterations>=370)throw new Error('Attendance reconciliation exceeded safe range; admin review required.');
    }

    if(remaining<=0){
      return {ok:false,title:'انتهى رصيد أيام الحضور',detail:'لا يمكن تسجيل حضور جديد قبل تجديد الرصيد من الإدارة.',member:{...memberInfo,remaining,grace}};
    }

    remaining=Math.max(0,remaining-1);
    tx.set(todayRef,{
      uid,
      dateKey:todayKey,
      timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      source:'reception-qr'
    });

    const memberUpdates={
      attendancePlanStartedAt:firebase.firestore.Timestamp.fromDate(started),
      attendanceDaysRemaining:remaining,
      graceAbsenceDaysRemaining:grace,
      attendanceLastProcessedDate:todayKey,
      attendancePlanVersion:2
    };
    if(end.getTime()!==startOfDay(m.endDate).getTime()){
      const extendedEnd=new Date(end);
      extendedEnd.setHours(23,59,59,999);
      memberUpdates.endDate=firebase.firestore.Timestamp.fromDate(extendedEnd);
    }

    tx.set(memberRef,memberUpdates,{merge:true});
    return {
      ok:true,
      title:`تم تسجيل حضور ${m.name||'العضوة'} ✓`,
      detail:'تم اعتماد حضور اليوم وتحديث الرصيد.',
      member:{...memberInfo,remaining,grace,endDate:memberUpdates.endDate||m.endDate}
    };
  });
}

$('login-form').addEventListener('submit',async e=>{
  e.preventDefault();
  try{await firebase.auth().signInWithEmailAndPassword($('email').value.trim(),$('password').value);}
  catch(err){showMessage('login-message','تعذر تسجيل الدخول. تحققي من البريد وكلمة المرور.','error');}
});
$('logout').addEventListener('click',async()=>{await stopScanner();await firebase.auth().signOut();setPanel(false);});
$('camera-toggle').addEventListener('click',toggleCamera);
$('manual-submit').addEventListener('click',()=>handleScan($('manual-uid').value));
$('manual-uid').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleScan($('manual-uid').value);}});
firebase.initializeApp(firebaseConfig);
firebase.auth().onAuthStateChanged(async user=>{
  if(!user){setPanel(false);return;}
  try{
    if(await isAdmin(user))setPanel(true);
    else{await firebase.auth().signOut();setPanel(false);showMessage('login-message','هذا الحساب ليس لديه صلاحية الاستقبال.','error');}
  }catch(e){console.error(e);setPanel(false);showMessage('login-message','تعذر التحقق من الصلاحيات.','error');}
});