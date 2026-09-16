# Blue Agate Trainer Portal

## الملفات
- staff.html: صفحة دخول ولوحة المدربة.
- staff.css: التصميم.
- staff.js: Firebase Auth + Firestore + الحضور والستريك.
- firestore-rules-staff.txt: قواعد Firestore المطلوبة.

## قبل الاستخدام
1. ارفعي الملفات الأربعة إلى نفس مجلد موقع GitHub Pages.
2. افتحي:
   https://samakelany1.github.io/blue-agate-website/staff.html
3. أنشئي حساب المدربة في Firebase Authentication.
4. أنشئي مستند:
   staff/{UID}
   بالحقول:
   name: اسم المدربة
   email: بريدها
   role: "trainer"
   active: true
5. جدول المدربة يوضع في:
   staff/{UID}/classes/{classId}
   والحقول:
   dateKey: "YYYY-MM-DD"
   time: "4:30 م"
   className: "HIIT"
   status: "مجدول"

ملاحظة: التصميم الحالي لا يغير أي ملف من بوابة المشتركات أو لوحة الإدارة.
