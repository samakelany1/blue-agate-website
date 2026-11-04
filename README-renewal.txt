استبدلي index.html وadmin.html وsubscription-countdown.js وrequests.css. أضيفي renewal-requests-admin.js.
أضيفي مقطع القواعد الموجود في firestore-renewal-request-rules.txt داخل match /members/{userId} ثم Publish.
زر التجديد يظهر عند بقاء 7 أيام أو أقل أو بعد انتهاء الاشتراك. الطلب يظهر بلوحة الإدارة ولا يجدد تلقائياً؛ الإدارة تستخدم أزرار التجديد الحالية بعد التواصل مع العضوة. لم يتم تعديل منطق التجديد الحالي.
