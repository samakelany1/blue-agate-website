تشغيل معالجة الغياب اليومية لنادي العقيق الأزرق عبر GitHub Actions

لماذا هذه النسخة؟
- تتجنب نشر Cloud Functions، الذي يتطلب خطة Firebase Blaze.
- تشغّل المعالجة يوميًا عبر GitHub Actions الساعة 12:10 بعد منتصف الليل بتوقيت السعودية، مع خيار تشغيل يدوي.
- لا تعدّل واجهة الموقع ولا قواعد Firestore.

مهم جدًا قبل التشغيل:
1) لا تشغّلي هذا النظام على بيانات العضوات الحقيقية قبل مراجعة قواعد الخصم وتجربته على مشروع/بيانات اختبار.
2) يحتاج GitHub Actions إلى سرّ اسمه FIREBASE_SERVICE_ACCOUNT_JSON يحتوي JSON لحساب خدمة Google/Firebase بصلاحية مناسبة على Firestore.
3) لا ترفعي ملف حساب الخدمة إلى المستودع، ولا ترسليه في المحادثة. أضيفيه فقط في GitHub: Settings > Secrets and variables > Actions > New repository secret.
4) حساب الخدمة يمنح صلاحيات قوية. أنشئي حسابًا مخصصًا بأقل صلاحيات لازمة، ولا تشاركي السر.
5) جدولة GitHub Actions قد تتأخر أحيانًا؛ ليست ضمانًا دقيقًا للدقيقة. المستودعات العامة عادةً لا تُحاسب على دقائق GitHub-hosted Actions القياسية، أما الخاصة فلها حصص وحدود حسب الخطة.

طريقة التركيب المختصرة:
- ارفعي محتويات هذه الحزمة إلى جذر مستودع موقع Blue Agate الحالي، مع دمج مجلد .github بدل حذف أي ملفات workflows موجودة.
- أضيفي السر FIREBASE_SERVICE_ACCOUNT_JSON في إعدادات المستودع.
- افتحي تبويب Actions، واختاري Blue Agate Daily Absence Processing، ثم Run workflow لتجربة تشغيل يدوي.
- راجعي سجل التشغيل وبيانات الاختبار قبل تفعيل الجدولة للعضوات الحقيقيات.

ملاحظات منطق النظام:
- يعالج الأيام من بعد attendanceLastProcessedDate حتى أمس بتوقيت الرياض.
- الجمعة والإغلاقات المسجلة في clubCalendar/{YYYY-MM-DD} وأيام الإيقاف المعتمدة مستثناة.
- إذا وُجد سجل حضور في members/{uid}/attendance/{YYYY-MM-DD} فلا يخصم يوم غياب لذلك اليوم.
- أيام الغياب تخصم أولًا من graceAbsenceDaysRemaining ثم من attendanceDaysRemaining.
- لا يبدأ الاشتراك حتى وجود attendancePlanStartedAt و attendanceLastProcessedDate الناتجين عن أول تسجيل حضور.

هذه الحزمة بديل تشغيلي يحتاج إعداد GitHub Secret ومراجعة صلاحيات الحساب؛ ليست تفعيلًا تلقائيًا جاهزًا بمجرد فك الضغط.
