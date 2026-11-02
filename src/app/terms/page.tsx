import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 flex flex-col gap-6 text-slate-800">
      <Link href="/" className="text-xs text-sky-700 hover:underline font-bold">
        ← חזרה לדף הראשי
      </Link>

      <h1 className="text-3xl font-black text-slate-900">תנאי שימוש 📜</h1>
      <p className="text-xs text-slate-500">עודכן לאחרונה: 2025</p>

      <div className="friendly-card p-6 sm:p-8 space-y-4 text-sm leading-relaxed text-slate-700">
        <h2 className="text-lg font-bold text-sky-900">1. הסכמה לתנאים</h2>
        <p>
          השימוש באתר ובשירות "חדשות הצ'אט" מהווה הסכמה מלאה לכל התנאים המפורטים להלן. אם אינך מסכים לתנאי כלשהו,
          הנך מתבקש שלא להשתמש בשירות.
        </p>

        <h2 className="text-lg font-bold text-sky-900">2. אופי השירות והתוכן</h2>
        <p>
          השירות מיועד למטרות בידור והומור בלבד. הכתבות הנוצרות מיוצרות באמצעות מודלי בינה מלאכותית (AI)
          ואינן מהוות עובדות עיתונאיות אמיתיות, לשון הרע או קביעה עובדתית לגבי מי מהמשתתפים.
        </p>

        <h2 className="text-lg font-bold text-sky-900">3. תוכן בלתי מורשה ובטיחות</h2>
        <p>
          חל איסור מוחלט להעלות צ'אטים המכילים איומים, דברי הסתה, פגיעה עצמית, חומרים פוגעניים הנוגעים לקטינים
          או כל תוכן המנוגד לחוק. המערכת עושה שימוש במנגנוני סינון ובטיחות אוטומטיים לדחיית תכנים אלו.
        </p>

        <h2 className="text-lg font-bold text-sky-900">4. תשלומים וביטולים</h2>
        <p>
          התשלום על סך 20 ש"ח עבור פתיחת הכתבה המלאה הינו תשלום חד-פעמי. בהתאם לחוק הגנת הצרכן,
          מאחר ומדובר בתוכן דיגיטלי הניתן להורדה ולקריאה מיידית, לא יינתן החזר כספי לאחר פתיחת התוכן,
          אלא במקרה של כשל טכני מוכח שלא אפשר את הצגת התוכן.
        </p>

        <h2 className="text-lg font-bold text-sky-900">5. הגבלת אחריות</h2>
        <p>
          האתר אינו אחראי לנזק עקיף, ישיר או תוצאתי שעלול להיגרם משיתוף הכתבה על ידכם ברשתות חברתיות
          או בין חברי הקבוצה. השימוש באחריות המשתמש בלבד.
        </p>
      </div>
    </div>
  );
}
