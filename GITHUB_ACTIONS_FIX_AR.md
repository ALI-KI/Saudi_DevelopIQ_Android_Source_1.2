# إصلاح فشل GitHub Actions في إصدار 1.2.1

**السبب:** `android-actions/setup-android@v3` يحاول تحميل الحزمة القديمة `tools` المحذوفة من Android SDK فيفشل `sdkmanager`.

**التعديل في** `.github/workflows/android-apk.yml`:

```yaml
- name: Setup Android SDK (no deprecated tools package)
  uses: android-actions/setup-android@v4
  with:
    packages: 'platform-tools'
```

**الخطوات:** افتح مستودع GitHub > `.github/workflows/android-apk.yml` > Edit > استبدل محتوى الملف بالمرفق ثم Commit. افتح Actions > Saudi DevelopIQ - Android APK > Run workflow. إذا نجحت كل الخطوات، حمل `SaudiDevelopIQ-Android-APK` من Artifacts.

لم يتم اختبار تجميع APK فعليًا، والتعديل يعالج خطأ SDK الظاهر فقط.
