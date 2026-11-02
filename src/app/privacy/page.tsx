import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6 text-slate-800">
      <Link href="/" className="text-xs text-sky-700 hover:underline font-bold">
        ← חזרה לדף הראשי
      </Link>

      <h1 className="text-3xl font-black text-slate-900">מדיניות פרטיות 🛡️</h1>
      <p className="text-xs text-slate-500">עודכן לאחרונה: 2025</p>

      <div className="friendly-card p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold text-sky-900">1. שמירה ועיבוד של קובצי הצ'אט</h2>
        <p>
          הפרטיות שלכם היא בעדיפות עליונה עבורנו. קובץ הצ'אט שמועלה על ידכם מעובד לצורך יצירת הכתבה בלבד.
          אנו <strong>איננו שומרים</strong> את תוכן הצ'אט המקורי במסדי הנתונים שלנו. לאחר הפקת הסיכום,
          טקסט הצ'אט נמחק מזיכרון השרת.
        </p>

        <h2 className="text-lg font-bold text-sky-900">2. הסרת מספרי טלפון ופרטים מזהים</h2>
        <p>
          לפני שליחת הטקסט למודל ה-AI, המערכת מבצעת סינון מקדים שמחליף מספרי טלפון (כגון 05X או +972)
          במחרוזת כללית [מספר] על מנת למנוע חשיפת פרטי תקשורת אישיים.
        </p>

        <h2 className="text-lg font-bold text-sky-900">3. שמירת הסיכום ותוקפו</h2>
        <p>
          הסיכום ההומוריסטי שנוצר (הכותרת ופסקאות הכתבה) נשמר לתקופה של עד 30 יום על מנת לאפשר לכם
          לחזור ולקרוא אותו באמצעות הקישור הייחודי שלכם. לאחר 30 יום, הרשומה נמחקת אוטומטית.
        </p>

        <h2 className="text-lg font-bold text-sky-900">4. תשלומים ואבטחה</h2>
        <p>
          כל סליקת התשלומים מבוצעת ישירות ובאופן מאובטח באמצעות ספק הסליקה Stripe בהתאם לתקני PCI-DSS
          המחמירים ביותר. פרטי כרטיס האשראי שלכם אינם עוברים ואינם נשמרים בשרתים שלנו.
        </p>

        <h2 className="text-lg font-bold text-sky-900">5. יצירת קשר</h2>
        <p>
          לשאלות בנוגע למדיניות הפרטיות, ניתן לפנות אלינו דרך עמוד התמיכה.
        </p>
      </div>
    </div>
  );
}
