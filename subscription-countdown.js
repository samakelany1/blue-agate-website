// Blue Agate - circular subscription countdown.
(function(){
 const $=id=>document.getElementById(id), TZ='Asia/Riyadh';
 function key(d){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}`;}
 function num(k){const [y,m,d]=k.split('-').map(Number);return Math.floor(Date.UTC(y,m-1,d)/86400000);}
 function date(v){if(!v)return null;if(v.toDate)return v.toDate();const d=new Date(v);return isNaN(d)?null:d;}
 function state(box,s){box.classList.remove('countdown-green','countdown-yellow','countdown-orange','countdown-red');box.classList.add('countdown-'+s);}
 function copy(left,total){if(left<0)return ['انتهى اشتراككِ، ننتظركِ لتكملي رحلتكِ معنا 💙','راجعي إدارة النادي لتحديث بيانات اشتراككِ.'];if(left<=7)return ['باقي القليل على نهاية اشتراككِ!','راجعي إدارة النادي عند الرغبة في تمديد اشتراككِ.'];if(left<=Math.ceil(total/2))return ['وصلتِ إلى منتصف رحلتكِ! 🌟','استمري، كل حصة تقرّبكِ أكثر من هدفكِ.'];return ['بداية جميلة، وهذه فرصتكِ لصناعة فرق! 💚','حافظي على حماسكِ والتزامكِ، هدفكِ يستحق.'];}
 async function loadAdjustments(uid){
  const host=$('subscription-adjustment-notices'); if(!host)return;
  try{
    const snap=await firebase.firestore().collection('members').doc(uid).collection('subscriptionAdjustments').limit(20).get();
    const rows=snap.docs.map(d=>d.data()).filter(x=>x.visibleToMember!==false && x.type!=='manual-absence').sort((a,b)=>{
      const ad=date(a.createdAt),bd=date(b.createdAt);return (bd?bd.getTime():0)-(ad?ad.getTime():0);
    }).slice(0,5);
    if(!rows.length){host.hidden=true;host.innerHTML='';return;}
    host.hidden=false;
    host.innerHTML=`<div class="adjustment-notice-title">إضافات على اشتراككِ</div>${rows.map(x=>{
      const before=x.beforeEndDate||'',after=x.afterEndDate||'';
      const fmt=k=>{if(!k)return '—';const [y,m,d]=k.split('-').map(Number);return new Intl.DateTimeFormat('ar-SA',{day:'numeric',month:'long',year:'numeric'}).format(new Date(Date.UTC(y,m-1,d,12)));};
      return `<article class="adjustment-notice"><strong>${Number(x.days)||0} يوم مضاف</strong><span>${String(x.reason||'تمديد اشتراك').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}${x.givenBy?' • من '+String(x.givenBy).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])):''}</span><small>انتهاء الاشتراك قبل الإضافة: ${fmt(before)}<br>انتهاء الاشتراك بعد الإضافة: ${fmt(after)}</small></article>`;
    }).join('')}`;
  }catch(e){console.warn('Could not load subscription adjustment notices',e);host.hidden=true;}
 }
 async function update(user){const box=$('subscription-countdown'),n=$('subscription-days-remaining'),note=$('subscription-countdown-note'),head=$('subscription-countdown-message'),ring=$('subscription-countdown-progress');if(!box||!n||!note||!head)return;if(!user){n.textContent='—';head.textContent='سجّلي الدخول لعرض اشتراككِ.';note.textContent='';return;}try{const ref=firebase.firestore().collection('members').doc(user.uid),snap=await ref.get();if(!snap.exists)throw Error('Member missing');const m=snap.data(),end=date(m.endDate),start=date(m.startDate);loadAdjustments(user.uid);if(!end){n.textContent='—';head.textContent='بيانات الاشتراك غير مكتملة';note.textContent='راجعي إدارة النادي لتحديث تاريخ الاشتراك.';return;}const today=key(new Date()),ek=key(end),rawDiff=num(ek)-num(today),daysRemaining=rawDiff<0?0:rawDiff+1,sk=start?key(start):today,total=Math.max(1,num(ek)-num(sk)+1),elapsed=Math.max(0,num(today)-num(sk)),pct=Math.max(0,Math.min(1,elapsed/total));state(box,rawDiff<0?'red':daysRemaining<=7?'orange':elapsed>=Math.ceil(total/2)?'yellow':'green');n.textContent=String(daysRemaining);const [h,msg]=copy(rawDiff<0?-1:daysRemaining,total);head.textContent=h;note.textContent=msg+' • نهاية الاشتراك: '+new Intl.DateTimeFormat('ar-SA',{timeZone:TZ,year:'numeric',month:'long',day:'numeric'}).format(end);if(ring)ring.style.strokeDashoffset=String(377*(1-pct));}
 catch(e){console.error(e);n.textContent='—';head.textContent='تعذر تحميل بيانات الاشتراك';note.textContent='حدّثي الصفحة وحاولي مجددًا.';}}
 document.addEventListener('DOMContentLoaded',()=>{if(!window.firebase||!firebase.auth||!firebase.firestore)return;firebase.auth().onAuthStateChanged(update);});
})();