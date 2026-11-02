import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-rubik",
});

export const metadata: Metadata = {
  title: "JHON • חדשות הצ'אט | הבלש שחושף את כל הסודות מהוואטסאפ",
  description:
    "העלו את היסטוריית הוואטסאפ והבלש JHON ינתח אותה ויכין לכם כתבה עיתונאית חברית, קלילה וקורעת מצחוק!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.variable}>
      <body className="font-rubik min-h-screen flex flex-col bg-[#f8fafc] text-slate-800 selection:bg-sky-200 selection:text-sky-900">
        {/* Soft, warm, playful ambient background blobs */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-sky-200/50 rounded-full blur-3xl" />
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-100/60 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl" />
        </div>

        {/* Friendly Top Navigation Bar */}
        <header className="relative z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 shadow-xs">
          <div className="max-w-5xl mx-auto px-4 h-18 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 group transition-transform active:scale-95"
            >
              {/* Circular Avatar in Header */}
              <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-sky-600 shadow-sm group-hover:rotate-6 transition-transform bg-white">
                <Image
                  src="/jhon.jpg"
                  alt="JHON Detective"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              <div className="flex flex-col">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors">
                  JHON • חדשות הצ'אט 🔍
                </span>
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  הבלש שמוציא את כל הסיפורים מהוואטסאפ
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3 sm:gap-5 text-sm">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                חינם לנסיון
              </span>
              <Link
                href="/privacy"
                className="text-slate-600 hover:text-sky-600 font-medium transition-colors"
              >
                פרטיות
              </Link>
              <Link
                href="/terms"
                className="text-slate-600 hover:text-sky-600 font-medium transition-colors"
              >
                תנאי שימוש
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 flex flex-col">{children}</main>

        {/* Friendly Footer */}
        <footer className="relative z-10 border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 mt-12">
          <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-base">☕️</span>
              <p>© 2025 חדשות הצ'אט • נוצר באהבה והומור לחברים</p>
            </div>
            <div className="flex items-center gap-4 font-medium">
              <span>🔒 100% פרטי • הטקסט לא נשמר</span>
              <span>•</span>
              <Link href="/privacy" className="hover:text-sky-600 hover:underline">
                מדיניות פרטיות
              </Link>
              <span>•</span>
              <Link href="/terms" className="hover:text-sky-600 hover:underline">
                תנאים
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
