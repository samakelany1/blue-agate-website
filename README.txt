Blue Agate - طلبات الغياب فقط

محتويات الحزمة:
- index.html: صفحة العضوة، وبها نموذج طلب الغياب وسجل الطلبات فقط.
- requests-member.js: إرسال طلب الغياب وتحميل سجل العضوة.
- admin.html: لوحة الإدارة مع قسم طلبات الغياب فقط.
- requests-admin.js: مراجعة طلبات الغياب واعتمادها أو رفضها.
- requests-navigation.js: فتح صفحة طلباتي من القائمة.
- requests.css: تنسيق واجهة الطلبات.
- firestore.rules: قواعد Firestore بعد حذف مسار الأعذار الطبية.

طريقة الرفع:
ارفعي الملفات إلى المجلد الرئيسي للموقع في GitHub، واستبدلي index.html وadmin.html والملفات المطابقة، وأضيفي الملفات الجديدة إذا لم تكن موجودة.
انسخي محتوى firestore.rules إلى Firebase Console > Firestore Database > Rules ثم Publish.

ملاحظة: لا توجد حاجة إلى Firebase Storage أو تفعيل الفوترة لهذه النسخة؛ تم حذف رفع التقارير الطبية بالكامل.
