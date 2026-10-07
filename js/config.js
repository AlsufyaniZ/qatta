// ─────────────────────────────────────────────
// إعدادات Firebase — Qatta (قطة)
// ─────────────────────────────────────────────
// 1) Firebase Console → Project settings → General → Your apps → أضف تطبيق Web (</>)
// 2) انسخ قيم firebaseConfig والصقها هنا.
//
// ملاحظة: هذه القيم ليست سرّية ويمكن رفعها على GitHub بأمان؛
// حماية البيانات تتم عبر قواعد Firestore (firestore.rules) والنطاقات المصرّح بها في Authentication.
//
// إذا تُركت القيم فارغة يعمل التطبيق في "الوضع التجريبي" ببيانات محلية داخل المتصفح.
// ويمكن فرض الوضع التجريبي دائماً بإضافة ?demo إلى الرابط.

export const firebaseConfig = {
  apiKey: "AIzaSyAVC9cImqXedYws6vBVWBbD9FtmyFGYpyU",
  authDomain: "qattaa.firebaseapp.com",
  projectId: "qattaa",
  storageBucket: "qattaa.firebasestorage.app",
  messagingSenderId: "525234288473",
  appId: "1:525234288473:web:49882a5e9212c37c9d3e48",
  measurementId: "G-VEHN223VJF"
};
