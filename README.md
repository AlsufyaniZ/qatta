# قطة — Qatta 🐱

### مدير المصاريف المشتركة | نسخة الويب

نسخة ويب من تطبيق «قطة» بنفس الشاشات والتصميم والمنطق، مبنية بـ HTML/CSS/JavaScript بدون أي build step، ومربوطة بـ **Firebase Authentication** و **Cloud Firestore**، وتُستضاف مجاناً على **GitHub Pages**.

---

## ✨ المزايا

- تسجيل الدخول بـ **البريد وكلمة المرور** أو **Google** (مع استعادة كلمة المرور وتوثيق البريد)
- إكمال الملف الشخصي (الاسم + رقم الجوال مع رمز الدولة)
- لوحة رئيسية: الرصيد الصافي، لي دين / أنا مدين، إحصائيات سريعة
- قائمة المصاريف مع فلاتر (الكل / أنا مدين / لي دين / مسوّى) وبطاقات قابلة للتوسيع
- تسوية حصة المشارك مباشرة من البطاقة، وحذف المصروف (للمالك)
- إضافة مصروف: المبلغ، الوصف، الفئة، المشاركون، التقسيم **بالتساوي** أو **مخصص** مع شريط تحقق، وملاحظة
- مشاركة المصروف مع مستخدمين آخرين عبر **البريد الإلكتروني** — يظهر المصروف في حسابهم ويستطيعون تسوية حصتهم
- مزامنة لحظية بين الأجهزة + عمل دون اتصال (Firestore offline cache)
- واجهة RTL عربية بالكامل، متجاوبة للجوال والحاسب، وقابلة للتثبيت كتطبيق (PWA manifest)
- **وضع تجريبي** يعمل فوراً ببيانات محلية قبل ربط Firebase

---

## 📁 هيكل المشروع

```
qatta-web/
├── index.html                 ← نقطة الدخول + شاشة البداية (Splash)
├── manifest.webmanifest       ← إعدادات التثبيت كتطبيق
├── assets/
│   ├── styles.css             ← نظام التصميم (DesignSystem)
│   └── icon.svg
├── js/
│   ├── config.js              ← ⚙️ ضع إعدادات Firebase هنا
│   ├── app.js                 ← الموجّه الرئيسي (ContentView)
│   ├── models.js              ← النماذج والحسابات (Models + منطق ViewModels)
│   ├── ui.js                  ← مكوّنات وأدوات الواجهة
│   ├── backend/
│   │   ├── firebase.js        ← Firebase Auth + Firestore
│   │   └── demo.js            ← بيانات تجريبية محلية (MockData)
│   └── views/
│       ├── auth.js            ← تسجيل الدخول / حساب جديد / استعادة
│       ├── profile.js         ← إكمال وتعديل الملف الشخصي
│       ├── home.js            ← اللوحة الرئيسية (HomeView)
│       └── add-expense.js     ← إضافة مصروف + إضافة مشارك
├── firestore.rules            ← قواعد الأمان
├── firebase.json              ← لنشر القواعد عبر Firebase CLI
└── .github/workflows/deploy.yml  ← نشر تلقائي على GitHub Pages
```

---

## 🗄 هيكل البيانات في Firestore

| المسار | الحقول |
|---|---|
| `users/{uid}` | `name`, `phone`, `email`, `avatarColor`, `createdAt`, `updatedAt` |
| `expenses/{id}` | `title`, `totalAmount`, `currency`, `category`, `paidByUserId`, `ownerId`, `participants[]`, `memberEmails[]`, `splitMethod`, `note`, `createdAt`, `updatedAt` |

كل عنصر في `participants`:
`{ id, name, phone, email, avatarColor, shareAmount, isPaid }`

- `ownerId` / `paidByUserId`: من أنشأ المصروف ودفعه.
- `memberEmails`: بريد المشاركين المسجّلين — من يسجّل بأحد هذه العناوين (ببريد موثّق) يرى المصروف في حسابه.

**قواعد الأمان** (`firestore.rules`):
- الملف الشخصي لا يقرؤه أو يعدّله إلا صاحبه.
- المصروف: المالك يقرأ ويعدّل ويحذف؛ المشارك (بريد موثّق) يقرأ ويحدّث حالة التسوية فقط.

---

## 🚀 خطوات التشغيل

### 1) جرّب محلياً (الوضع التجريبي)

```bash
cd qatta-web
python3 -m http.server 8000
# افتح http://localhost:8000
```

> لا تفتح `index.html` مباشرة بالنقر المزدوج — وحدات JavaScript تحتاج خادماً (أي خادم ثابت يكفي).

### 2) أنشئ مشروع Firebase

1. ادخل إلى [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Sign-in method** وفعّل:
   - **Email/Password**
   - **Google** (اختر بريد الدعم ثم Save)
3. **Build → Firestore Database → Create database** → اختر الموقع (مثلاً `me-central2` الدمام أو `europe-west`) → ابدأ بـ **Production mode**.
4. **Firestore → Rules**: انسخ محتوى ملف `firestore.rules` والصقه ثم **Publish**.
5. **Project settings (⚙️) → General → Your apps → أيقونة Web `</>`** → سجّل التطبيق (لا حاجة لـ Firebase Hosting) → انسخ كائن `firebaseConfig`.
6. الصق القيم في `js/config.js`:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

> هذه القيم **ليست سرّية** ويمكن رفعها على GitHub بأمان — الحماية تتم عبر قواعد Firestore والنطاقات المصرّح بها.

### 3) ارفع المشروع على GitHub

```bash
cd qatta-web
git init
git add .
git commit -m "Qatta web app"
git branch -M main
git remote add origin https://github.com/<USERNAME>/qatta.git
git push -u origin main
```

### 4) فعّل GitHub Pages

1. في المستودع: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. سيعمل ملف `.github/workflows/deploy.yml` تلقائياً مع كل `push` إلى `main`.
3. بعد دقيقة يصبح التطبيق متاحاً على: `https://<USERNAME>.github.io/qatta/`

### 5) اسمح لنطاق GitHub بتسجيل الدخول ⚠️

**Firebase Console → Authentication → Settings → Authorized domains → Add domain**:

```
<USERNAME>.github.io
```

بدون هذه الخطوة سيظهر خطأ `auth/unauthorized-domain` عند الدخول بـ Google.

---

## 🧪 الوضع التجريبي

- يعمل تلقائياً عندما تكون إعدادات `config.js` فارغة.
- يمكن فرضه حتى بعد الربط بإضافة `?demo` للرابط: `https://<USERNAME>.github.io/qatta/?demo`
- يحفظ البيانات في متصفحك فقط (localStorage)، ويمكن إعادتها من قائمة الحساب ← «إعادة البيانات التجريبية».

---

## 🔁 مقارنة مع تطبيق iOS

| تطبيق iOS (SwiftUI) | نسخة الويب |
|---|---|
| `QattaApp` / `ContentView` / `SplashView` | `index.html` + `js/app.js` |
| `PhoneLoginView` + `OTPVerificationView` | `views/auth.js` (بريد + Google) + `views/profile.js` (رقم الجوال) |
| `HomeView`, `ExpenseCard`, `FilterChip`… | `views/home.js` |
| `AddExpenseView`, `AddParticipantSheet` | `views/add-expense.js` |
| `Models.swift` + منطق `ViewModels.swift` | `js/models.js` |
| `DesignSystem.swift` | `assets/styles.css` + `js/ui.js` |
| `MockData` | `js/backend/demo.js` |
| `CNContactPickerViewController` (لم يُنفَّذ) | Contact Picker API (يعمل على Chrome لأندرويد) |

**تحسينات إضافية في نسخة الويب:**
- التقسيم المتساوي دقيق بالهللة (فرق التقريب يُضاف على حصة الدافع).
- زر الحفظ في التقسيم المخصص لا يتفعّل إلا عند توازن المبالغ.
- قبول الأرقام العربية (٠١٢٣…) في حقول المبالغ والجوال.
- حذف المصروف، تعديل الملف الشخصي، وإظهار اسم الدافع.

---

## ✅ قائمة المهام

- [x] Firebase Auth (بريد + Google + استعادة + توثيق)
- [x] Firestore persistence + مزامنة لحظية + offline
- [x] قواعد أمان Firestore
- [x] مشاركة المصاريف بين المستخدمين عبر البريد
- [x] Contact picker (على المتصفحات الداعمة)
- [x] نشر تلقائي على GitHub Pages
- [ ] إشعارات (Firebase Cloud Messaging)
- [ ] مشاركة المصروف عبر WhatsApp
- [ ] شاشة السجل والإحصائيات
- [ ] تقسيم بالنسبة المئوية
