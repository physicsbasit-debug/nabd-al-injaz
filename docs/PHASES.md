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
- 2-D3: تسجيل غياب يومي، اقتراح يدوي أو آلي للحصص، سجل للأيام، ملخص مغطى/غير مغطى ونصيب البدلاء، حفظ معالجة محلية قابلة لإعادة الفتح أو التراجع.
- المتابعة الفنية: تسجيل يدوي للموضوعات والحصص المخططة ومواعيد الإنجاز من النشرة الفعلية؛ تحديث الحصص المنفذة ومؤشرات اليوم. لا توجد موضوعات أو مواعيد افتراضية. البيانات محلية على الجهاز.
- التالي: تدقيق قواعد مسار الدقيقة إن توفر رابط فعّال أو توثيقها، ثم قبول سياسة التوزيع والاستثناءات قبل اعتماد الترتيب الإنتاجي النهائي. لا تُرسل المنظومة تكليفات أو إشعارات.
- لاحقًا: الاختبارات والتحصيل، الإنماء المهني، الإنجازات والتقارير، ثم الربط الآمن والقبول النهائي.

### Phase 2-D3: local daily cover tracking

- Absence and cover assignments are stored per school date in this browser. The daily summary shows absent teachers, required lessons, assigned lessons, uncovered lessons, and each substitute's assigned count.
- The user can save a day's local processing state, reopen it with confirmation, or undo the whole day's record with confirmation. Saved processing is not an official approval and does not send assignments or messages.
- Allocation still requires verified teacher schedules, excludes absent, busy, and exempt teachers, and ranks available substitutes by recorded balance then explicit priority. The exact live Masar scoring and approval workflow could not be verified from the historical URL, so no claim of an exact algorithm match is made.
- Daily history and allocation data remain browser-local; they are not shared across devices. Final production acceptance depends on confirmation of the school's rules for exemptions, balances, and any department/specialty matching.
