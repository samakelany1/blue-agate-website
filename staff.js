let auth, db, currentUser = null, staffData = null, attendanceDates = [], todayClasses = [];

function byId(id){return document.getElementById(id);}
function todayKey(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function keyToDate(key){const [y,m,d]=key.split("-").map(Number);return new Date(y,m-1,d);}
function isFriday(date){return date.getDay()===5;}
function formatArabicDate(date){
  return new Intl.DateTimeFormat("ar-SA",{weekday:"long",day:"numeric",month:"long"}).format(date);
}
function showMessage(text,error=false){
  byId("login-message").textContent="";
  byId("dashboard-message").textContent=text||"";
  byId("dashboard-message").style.color=error?"#c0392b":"#718096";
}
function calculateStreak(dates){
  const set=new Set(dates);
  let cursor=new Date(); cursor.setHours(0,0,0,0);
  let streak=0;
  // Friday is a non-working day and never breaks the streak.
  while(true){
    if(isFriday(cursor)){cursor.setDate(cursor.getDate()-1);continue;}
    const key=cursor.getFullYear()+"-"+String(cursor.getMonth()+1).padStart(2,"0")+"-"+String(cursor.getDate()).padStart(2,"0");
    if(set.has(key)){streak++;cursor.setDate(cursor.getDate()-1);}
    else break;
  }
  return streak;
}
function startOfWeek(d){
  const x=new Date(d); x.setHours(0,0,0,0);
  const day=x.getDay();
  const diff=day===0?-6:1-day; // Monday start
  x.setDate(x.getDate()+diff); return x;
}
function weekAttendanceCount(){
  const start=startOfWeek(new Date());
  return attendanceDates.filter(k=>keyToDate(k)>=start).length;
}
async function loadStaff(){
  const snap=await db.collection("staff").doc(currentUser.uid).get();
  if(!snap.exists || snap.data().active===false || snap.data().role!=="trainer"){
    throw new Error("هذا الحساب غير مفعّل كحساب مدربة.");
  }
  staffData=snap.data();
}
async function loadAttendance(){
  const snap=await db.collection("staff").doc(currentUser.uid).collection("attendance").get();
  attendanceDates=snap.docs.map(d=>d.id).filter(Boolean).sort();
  byId("streak-count").textContent=calculateStreak(attendanceDates);
  byId("total-attendance").textContent=attendanceDates.length;
  byId("week-attendance").textContent=weekAttendanceCount();
}
async function loadTodayClasses(){
  const snap=await db.collection("staff").doc(currentUser.uid).collection("classes")
    .where("dateKey","==",todayKey()).get();
  todayClasses=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.time||"").localeCompare(String(b.time||"")));
  byId("today-classes-count").textContent=todayClasses.length;
  byId("today-date").textContent=formatArabicDate(new Date());
  const list=byId("classes-list"), empty=byId("no-classes");
  list.innerHTML="";
  empty.classList.toggle("hidden",todayClasses.length>0);
  todayClasses.forEach(c=>{
    const row=document.createElement("div"); row.className="class-row";
    row.innerHTML=`<span class="class-time">${escapeHtml(c.time||"—")}</span>
      <span class="class-name">${escapeHtml(c.className||"كلاس")}</span>
      <span class="class-status">${escapeHtml(c.status||"مجدول")}</span>`;
    list.appendChild(row);
  });
  const checked=attendanceDates.includes(todayKey());
  const btn=byId("check-in-btn");
  btn.disabled=checked || todayClasses.length===0;
  btn.textContent=checked ? "✓ تم تسجيل حضور اليوم" : (todayClasses.length ? "سجّلي حضوري اليوم" : "لا يوجد كلاس اليوم");
  byId("streak-note").textContent=checked
    ? "تم تسجيل حضورك اليوم — استمري! 🔥"
    : (todayClasses.length ? "سجّلي حضورك للمحافظة على الستريك." : "يظهر زر الحضور عند وجود كلاس مجدول لك اليوم.");
}
async function checkIn(){
  const key=todayKey();
  if(!todayClasses.length){showMessage("لا يوجد لديك كلاس مجدول اليوم.",true);return;}
  if(attendanceDates.includes(key)){return;}
  const btn=byId("check-in-btn"); btn.disabled=true;
  try{
    await db.collection("staff").doc(currentUser.uid).collection("attendance").doc(key).set({
      uid:currentUser.uid,dateKey:key,timestamp:firebase.firestore.FieldValue.serverTimestamp()
    });
    await loadAttendance(); await loadTodayClasses();
    showMessage("تم تسجيل حضورك بنجاح 💙");
  }catch(e){btn.disabled=false;showMessage("تعذر تسجيل الحضور. تأكدي من اتصالك ثم حاولي مرة أخرى.",true);}
}
function escapeHtml(v){
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
}
function renderProfile(){
  const name=staffData.name||"المدربة";
  byId("trainer-name").textContent=name;
  byId("profile-name").textContent=name;
  byId("profile-email").textContent=staffData.email||currentUser.email||"—";
  byId("profile-status").textContent=staffData.active===false?"غير مفعلة":"مفعلة";
}
async function openDashboard(){
  byId("login-view").classList.add("hidden");
  byId("dashboard-view").classList.remove("hidden");
  try{
    await loadStaff(); renderProfile(); await loadAttendance(); await loadTodayClasses();
  }catch(e){
    byId("dashboard-view").classList.add("hidden");
    byId("login-view").classList.remove("hidden");
    byId("login-message").textContent=e.message||"لا يمكن الدخول بهذا الحساب.";
    await auth.signOut();
  }
}
function init(){
  const app=firebase.initializeApp(firebaseConfig);
  auth=firebase.auth(app); db=firebase.firestore(app);
  byId("staff-login-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const msg=byId("login-message"); msg.textContent="جارٍ تسجيل الدخول...";
    try{await auth.signInWithEmailAndPassword(byId("staff-email").value.trim(),byId("staff-password").value);}
    catch(err){msg.textContent="البريد الإلكتروني أو كلمة المرور غير صحيحة.";msg.style.color="#c0392b";}
  });
  byId("forgot-password").addEventListener("click",async()=>{
    const email=byId("staff-email").value.trim();
    const msg=byId("login-message");
    if(!email){msg.textContent="اكتبي بريدك الإلكتروني أولًا.";return;}
    try{await auth.sendPasswordResetEmail(email);msg.textContent="تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك.";}
    catch(e){msg.textContent="تعذر إرسال الرابط. تأكدي من البريد الإلكتروني.";msg.style.color="#c0392b";}
  });
  byId("check-in-btn").addEventListener("click",checkIn);
  byId("logout-btn").addEventListener("click",()=>auth.signOut());
  auth.onAuthStateChanged(user=>{currentUser=user;if(user)openDashboard();else{byId("dashboard-view").classList.add("hidden");byId("login-view").classList.remove("hidden");}});
}
document.addEventListener("DOMContentLoaded",init);
