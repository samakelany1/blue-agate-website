إصلاح أداة استيراد اشتراكات نوشن - Blue Agate

سبب المشكلة:
كان في import-subscriptions.html تعبيرات نمطية مكتوبة بشرطات مائلة عكسية زائدة، فتسبب ذلك في SyntaxError وتوقف تشغيل JavaScript بالكامل.

الملفات:
- import-subscriptions.html: النسخة المصححة. ارفعي هذا الملف إلى جذر مجلد blue-agate-website في GitHub مع استبدال النسخة القديمة.
- Blue_Agate_Subscription_Import_Review.csv: ملف CSV تجريبي لزر استخدام الملف المرفق.
- Notion_Subscriptions.csv: نسخة البيانات المصدرة للمراجعة فقط؛ لا تُرفع للعموم إن كانت تحتوي بيانات مشتركات حقيقية.
- firestore-rules-subscription-import.txt: قواعد مقترحة تدمج بحذر مع قواعد Firestore الحالية، لا تستبدلي القواعد المنشورة بها بالكامل.

مهم:
- لا ترفعي firebase-config.js من هذه الحزمة؛ استخدمي ملف المشروع الحالي.
- لا تنفذي الاستيراد إلا بعد المعاينة والتأكد من قواعد Firestore.
- رفع ZIP وحده إلى GitHub Pages لا ينشر الملفات؛ فكّي الضغط ثم ارفعي الملفات المطلوبة إلى المستودع.
