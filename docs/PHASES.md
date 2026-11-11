# مراحل التنفيذ

1. **التأسيس:** مستودع خاص ومتطلبات ثابتة وهوية بصرية.
2. **النموذج البصري:** صفحة رئيسية قابلة للاختبار، بلا بيانات إنتاج.
3. **الوظائف:** الخطط والجداول والاحتياط والمتابعة والاختبارات والإنماء المهني والإنجازات.
4. **الربط الآمن:** Supabase مستقل، صلاحيات إدارة خاصة، وروابط رفع محمية للمعلمين.
5. **القبول:** اختبارات بناء وعمليات فعلية وخصوصية وتقارير.

لا يبدأ إنشاء قاعدة البيانات أو استيراد بيانات المعلمين قبل اعتماد نموذج البيانات وقواعد الصلاحيات.

## تقدم الوظائف على main

- مكتمل: 2-C1 مكتبة الخطط، 2-C2 توثيق الشواهد، 2-C3 النسخ والاستعادة، 2-D1 الجداول الأساسية.
- 2-D2: استيراد أفقي مع تحقق اكتمال اليوم ومعاينة الغياب (انظر SCHEDULE_PHASE_2D2.md).
- 2-D3: تسجيل غياب يومي، اقتراح بدائل، سجل للأيام، ملخص مغطى/غير مغطى ونصيب البدلاء، حفظ معالجة محلية قابلة لإعادة الفتح أو التراجع، ونسخة احتياطية كاملة قابلة للنقل يدويًا بين الأجهزة.
- المتابعة الفنية: تسجيل يدوي للموضوعات والحصص المخططة ومواعيد الإنجاز من النشرة الفعلية؛ تحديث الحصص المنفذة ومؤشرات اليوم. لا توجد موضوعات أو مواعيد افتراضية. البيانات محلية على الجهاز.
- الترتيب الحالي مستند إلى مرجع مسار المحفوظ: الأقل رصيدًا، ثم القسم المطابق للمادة الصريحة في الجدول، ثم الأقل تكليفًا في اليوم، مع أولوية يدوية أخيرة. لم يتسن التحقق من كود مسار الحي أو قواعد المدرسة التفصيلية؛ لذلك تبقى الاقتراحات للمراجعة ولا تُرسل المنظومة تكليفات أو إشعارات.
- التالي: التحقق من اقتراحات البدائل على جدول المدرسة المعتمد، ثم اعتماد سياسة الاستثناءات والرصيد. لا يبدأ إنشاء قاعدة البيانات أو استيراد بيانات المعلمين قبل اعتماد نموذج البيانات وقواعد الصلاحيات.
- لاحقًا: الاختبارات والتحصيل، الإنماء المهني، الإنجازات والتقارير، ثم الربط الآمن والقبول النهائي.

### Phase 2-D3: local daily cover tracking

- Absence and cover assignments are stored per school date in this browser. The daily summary shows absent teachers, required lessons, assigned lessons, uncovered lessons, and each substitute's assigned count.
- The user can save a day's local processing state, reopen it with confirmation, or undo the whole day's record with confirmation. Saved processing is not an official approval and does not send assignments or messages.
- Candidate ranking follows the documented reference: least balance through the selected date, matching department when the lesson text identifies one, then least assignments that day; manual priority and name break a final tie. Live Masar code and school-specific rules remain unverified, so this is an advisory policy, not a claim of exact behavioral parity.
- A full local backup can transfer tasks, plans and evidence, schedules, cover history, and technical follow-up manually. Data is not synchronized automatically. Final production acceptance still depends on checking a real schedule and confirming exemption and balance rules.
