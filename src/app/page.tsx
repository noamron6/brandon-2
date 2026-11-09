"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChatContext, ChatPlatform } from "@/lib/types";

const FUNNY_LOADING_MESSAGES = [
  "הבלש JHON פותח את ארכיון ההודעות הסודי...",
  "מחשב כמה פעמים דני אמר 'חחח' בלי שבאמת צחק...",
  "מאתר מילים מוזרות למילון הסלנג של הקבוצה...",
  "סופר הודעות שנמחקו בבהלה...",
  "מפענח את 'רגע הדרמה' שבו הכל היה חייב לעצור...",
  "מנסח את ספר החוקים הלא כתובים שלכם...",
  "מכין את התחזית העתידית לשנת 2035...",
];

const SAMPLE_CHAT_TEXT = `[12/10/2024, 18:30:15] דני: חברים יקרים, מה עושים היום בערב?
[12/10/2024, 18:31:02] מיכל: אני גמורה מעייפות מהעבודה, אל תבנו עליי.
[12/10/2024, 18:31:40] יוסי: שווארמה?
[12/10/2024, 18:32:10] דני: יוסי רק שווארמה יש לך בראש. בואו נשב בבר נורמלי.
[12/10/2024, 18:35:22] מיכל: טוב אם זה שווארמה אז אני באה בעצם.
[12/10/2024, 18:36:00] אלון: 054-9988776 זה המספר של המקום, תזמינו מקום.
[12/10/2024, 18:36:45] יוסי: מי מזמין מקום לשווארמה יא הזוי? באים, עומדים בתור, לוקחים עמבה.
[12/10/2024, 18:37:12] דני: מיכל אמרת שאת עייפה לפני שתי דקות בדיוק?!
[12/10/2024, 18:37:50] מיכל: עייפה לדברים משעממים, לא ללאפה כבש.
[12/10/2024, 18:40:00] אלון: מי אוסף אותי? אין לי כוח להזיז את האוטו.
[12/10/2024, 18:41:15] יוסי: [מדבקה של חתול כועס]
[12/10/2024, 18:42:00] דני: אלון אתה גר 200 מטר משם, תלך ברגל תעשה טובה.
[12/10/2024, 18:45:10] אלון: טוב עזבו לא משנה, אני מכין טוסט.
[12/10/2024, 18:46:05] מיכל: הנה הוא מתחיל...
[12/10/2024, 18:48:30] יוסי: אני כבר פה ויש תור עד צומת גולני. מי שמגיע ראשון מקבל צ'יפס.`;

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard Steps: 1: Context & Platform -> 2: Upload -> 3: Data Cleansing & Who are you -> 4: Email OTP -> 5: Processing
  const [step, setStep] = useState<number>(1);

  // Form State
  const [context, setContext] = useState<ChatContext>("friends");
  const [platform, setPlatform] = useState<ChatPlatform>("whatsapp");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawChatText, setRawChatText] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Participant cleansing state
  const [detectedNames, setDetectedNames] = useState<string[]>([]);
  const [nameMapping, setNameMapping] = useState<Record<string, string>>({});
  const [userParticipant, setUserParticipant] = useState<string>("");

  // Email & OTP state
  const [email, setEmail] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpDelivery, setOtpDelivery] = useState<{
    delivered: boolean;
    message: string;
    demoCode?: string;
  } | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);

  // General Loading & Error
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Rotate funny loading messages
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % FUNNY_LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Extract participants when raw chat text changes
  const extractParticipantsFromText = (text: string) => {
    const lines = text.split(/\r?\n/).slice(0, 300);
    const namesSet = new Set<string>();
    const pattern = /^\[?(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*(?:-|–)?\s*([^:]+):/i;

    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const name = match[2].trim();
        if (name && !name.includes("messages and calls are end-to-end encrypted")) {
          namesSet.add(name);
        }
      } else {
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0 && colonIdx < 25) {
          const name = line.slice(0, colonIdx).trim();
          if (name && !name.includes("[") && !name.includes("http")) {
            namesSet.add(name);
          }
        }
      }
    }

    const foundNames = Array.from(namesSet).slice(0, 8);
    setDetectedNames(foundNames.length > 0 ? foundNames : ["דני", "מיכל", "יוסי", "אלון"]);
    setUserParticipant(foundNames[0] || "דני");

    // Initialize mapping
    const initMap: Record<string, string> = {};
    for (const n of foundNames) {
      initMap[n] = n;
    }
    setNameMapping(initMap);
  };

  const handleFileSelected = async (file: File) => {
    setErrorMessage(null);
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setErrorMessage("יש להעלות קובץ מסוג .txt בלבד (ייצוא צ'אט מוואטסאפ או טלגרם).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("גודל הקובץ עולה על 5MB המותרים.");
      return;
    }

    setSelectedFile(file);
    const text = await file.text();
    setRawChatText(text);
    extractParticipantsFromText(text);
    setStep(3); // Proceed to Data Cleansing & "Which one is you?"
  };

  const handleLoadSample = () => {
    setErrorMessage(null);
    setSelectedFile(null);
    setRawChatText(SAMPLE_CHAT_TEXT);
    extractParticipantsFromText(SAMPLE_CHAT_TEXT);
    setStep(3); // Proceed to participant setup
  };

  // Step 4: OTP Send
  const handleSendOtp = async () => {
    if (!email || !email.includes("@")) {
      setErrorMessage("אנא הזן כתובת אימייל תקינה.");
      return;
    }
    setErrorMessage(null);
    setIsVerifyingOtp(true);

    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בשליחת קוד אימות");

      setOtpSent(true);
      setOtpDelivery({
        delivered: Boolean(data.delivered),
        message: data.message || "קוד אימות נשלח!",
        demoCode: data.demoCode,
      });
      setOtpCode(""); // Leave blank so user inputs the code sent to their email
    } catch (err: any) {
      setErrorMessage(err.message || "שגיאה בשליחת קוד");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 4: Verify OTP and Submit for Full AI Analysis
  const handleVerifyOtpAndGenerate = async () => {
    if (!otpCode) {
      setErrorMessage("אנא הזן את קוד האימות בן 4 הספרות.");
      return;
    }
    setErrorMessage(null);
    setIsVerifyingOtp(true);

    try {
      const verifyRes = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, code: otpCode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "קוד אימות שגוי");

      // Validated! Now submit to AI generator
      setIsLoading(true);
      setStep(5); // Show loading state

      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      } else {
        formData.append("text", rawChatText);
      }
      formData.append("context", context);
      formData.append("nameMapping", JSON.stringify(nameMapping));
      formData.append("userParticipant", userParticipant);
      formData.append("email", email);

      const response = await fetch("/api/summarize", {
        method: "POST",
        body: selectedFile
          ? formData
          : JSON.stringify({
              text: rawChatText,
              context,
              nameMapping,
              userParticipant,
              email,
            }),
        headers: selectedFile ? undefined : { "Content-Type": "application/json" },
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "אירעה שגיאה בעיבוד הצ'אט");
      }

      // Success -> Redirect to Free Teaser Page!
      window.location.href = `/summary/${resData.id}`;
    } catch (err: any) {
      setErrorMessage(err.message || "שגיאה בתהליך. אנא נסה שנית.");
      setIsLoading(false);
      setStep(4);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative group">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-sky-600 shadow-xl shadow-sky-500/15 relative bg-white">
            <Image
              src="/jhon.jpg"
              alt="JHON Detective"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              priority
            />
          </div>
          <div className="absolute -bottom-2 right-1/2 translate-x-1/2 bg-amber-400 text-slate-900 font-extrabold text-xs px-3.5 py-1 rounded-full shadow-md border-2 border-white whitespace-nowrap">
            הבלש JHON • Chat Wrapped 🔍
          </div>
        </div>

        <div className="max-w-2xl flex flex-col gap-2 mt-2">
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            ה-Chat Wrapped שלכם: דוח חקירה סאטירי קורע! 🕵️‍♂️
          </h1>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            העלו את היסטוריית השיחה – והבלש JHON מנתח את הדינמיקה, משרטט פרופיל פסיכולוגי לכל חבר,
            בונה את מילון הסלנג שלכם ומנבא מה יקרה לכם ב-2035.
          </p>
        </div>

        {/* Progress Step Indicator */}
        <div className="flex items-center gap-2 mt-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-xs text-xs font-bold text-slate-500">
          <span className={`px-2 py-0.5 rounded-full ${step >= 1 ? "bg-sky-600 text-white" : "bg-slate-100"}`}>1. הגדרות</span>
          <span>←</span>
          <span className={`px-2 py-0.5 rounded-full ${step >= 2 ? "bg-sky-600 text-white" : "bg-slate-100"}`}>2. העלאת צ'אט</span>
          <span>←</span>
          <span className={`px-2 py-0.5 rounded-full ${step >= 3 ? "bg-sky-600 text-white" : "bg-slate-100"}`}>3. מי זה מי</span>
          <span>←</span>
          <span className={`px-2 py-0.5 rounded-full ${step >= 4 ? "bg-sky-600 text-white" : "bg-slate-100"}`}>4. אימות ודוח</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: Context & Platform Selection (PRD Section 3.1) */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="friendly-card p-6 sm:p-8 flex flex-col gap-6 shadow-md border-slate-200 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🎯</span>
              <span>שלב 1: איזה סוג צ'אט מנתחים היום?</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              סוג הצ'אט ישפיע ישירות על סגנון העקיצות, הניתוח הפסיכולוגי וההומור של JHON.
            </p>
          </div>

          {/* Context Selection Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: "friends", label: "קבוצת חברים", icon: "🍻", desc: "הברזות, ויכוחי אוכל וסלנג" },
              { id: "couple", label: "קשר רומנטי", icon: "💑", desc: "מי אוהב יותר, דרמות ומחוות" },
              { id: "best_friends", label: "חברים הכי טובים", icon: "🤞", desc: "תלות הדדית וסודות לילה" },
              { id: "family", label: "קבוצה משפחתית", icon: "🏡", desc: "שבת שלום, סטיקרים ומי בא" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setContext(item.id as ChatContext)}
                className={`p-4 rounded-2xl border text-right flex flex-col gap-1.5 transition-all cursor-pointer ${
                  context === item.id
                    ? "border-sky-600 bg-sky-50 shadow-xs ring-2 ring-sky-500/20"
                    : "border-slate-200 hover:border-sky-300 bg-slate-50/40"
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="font-bold text-slate-900 text-sm">{item.label}</span>
                <span className="text-[11px] text-slate-500">{item.desc}</span>
              </button>
            ))}
          </div>

          {/* Platform Selection */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700">פלטפורמת השיחה:</label>
            <div className="flex flex-wrap gap-2.5">
              {[
                { id: "whatsapp", label: "WhatsApp", icon: "💬" },
                { id: "imessage", label: "iMessage", icon: "🍎" },
                { id: "telegram", label: "Telegram", icon: "✈️" },
                { id: "other", label: "אחר / קובץ טקסט", icon: "📄" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id as ChatPlatform)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    platform === p.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-4 rounded-2xl font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-[0.99] transition-all shadow-md shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>המשך להעלאת הקובץ</span>
            <span>←</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: File Upload & Guide (PRD Section 3.1) */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div className="friendly-card p-6 sm:p-8 flex flex-col gap-6 shadow-md border-slate-200 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>📁</span>
                <span>שלב 2: העלאת קובץ הצ'אט</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                קובץ .txt מיוצא (ללא מדיה). הטקסט מעובד ולא נשמר בשרת!
              </p>
            </div>

            {/* Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold hover:bg-amber-100 transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>📖</span>
              <span>איך מייצאים צ'אט?</span>
            </button>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragOver
                ? "border-sky-500 bg-sky-50 scale-[1.01]"
                : "border-slate-300 hover:border-sky-500 hover:bg-slate-50/80 bg-slate-50/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
              }}
            />

            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-3xl">
              📂
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-bold text-slate-800 text-base sm:text-lg">
                גררו לכאן את קובץ ה-.txt של הצ'אט או לחצו לבחירה
              </span>
              <span className="text-xs text-slate-500">
                קבצי .txt בלבד • עד 5MB
              </span>
            </div>
          </div>

          {/* Quick Sample Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleLoadSample}
              className="text-xs sm:text-sm text-slate-600 hover:text-sky-700 transition-colors flex items-center gap-2 py-1 cursor-pointer"
            >
              <span>💡 רוצים לבדוק מיד בלי קובץ?</span>
              <span className="font-bold text-sky-700 hover:underline">
                טען צ'אט לדוגמה (קבוצת שווארמה)
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              → חזרה להגדרות
            </button>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: Data Cleansing & "Which one is you?" (PRD Section 3.1) */}
      {/* ========================================================================= */}
      {step === 3 && (
        <div className="friendly-card p-6 sm:p-8 flex flex-col gap-6 shadow-md border-slate-200 animate-fadeIn">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>🎭</span>
              <span>שלב 3: מי זה מי בצ'אט?</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              ודאו שהשמות נכונים וברורים כדי שהדוח ייצא קורע, וסמנו{" "}
              <strong>איזה מהם זה אתם</strong> כדי שהבלש JHON יפנה אליכם ישירות!
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-700">
              משתתפים שזוהו בשיחה (סמנו מי אתם ושנו שמות אם צריך):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detectedNames.map((origName) => {
                const isSelectedUser = userParticipant === (nameMapping[origName] || origName);
                return (
                  <div
                    key={origName}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                      isSelectedUser
                        ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-500/20"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[11px] text-slate-400 font-mono">
                        בצ'אט המקורי: {origName.slice(0, 20)}
                      </span>
                      <input
                        type="text"
                        value={nameMapping[origName] || origName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNameMapping((prev) => ({ ...prev, [origName]: val }));
                          if (isSelectedUser) setUserParticipant(val);
                        }}
                        className="text-sm font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 focus:outline-sky-500"
                        placeholder="שם לתצוגה"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setUserParticipant(nameMapping[origName] || origName)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isSelectedUser
                          ? "bg-sky-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isSelectedUser ? "✓ זה אני!" : "זה אני?"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-3 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer text-sm"
            >
              ← החלף קובץ
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-sky-600 hover:bg-sky-500 active:scale-[0.99] transition-all shadow-md shadow-sky-500/20 cursor-pointer text-sm"
            >
              המשך לשלב האימות והדוח ←
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: Lead Collection & OTP Verification (PRD Section 3.1) */}
      {/* ========================================================================= */}
      {step === 4 && (
        <div className="friendly-card p-6 sm:p-8 flex flex-col gap-6 shadow-md border-slate-200 animate-fadeIn max-w-xl mx-auto w-full">
          <div className="text-center border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl mx-auto mb-2">
              ✉️
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              שלב 4: לאן לשלוח את הדוח הסודי?
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              הזן את האימייל שלך לקבלת קישור אישי מאובטח לדוח החקירה.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                כתובת האימייל שלך:
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  disabled={otpSent}
                  className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-sky-500 font-medium"
                />
                {!otpSent && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isVerifyingOtp}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {isVerifyingOtp ? "שולח..." : "שלח קוד"}
                  </button>
                )}
              </div>
            </div>

            {otpSent && (
              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-sky-50/70 border border-sky-200 animate-fadeIn">
                {otpDelivery?.delivered ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-start gap-2.5">
                    <span className="text-xl">✉️</span>
                    <div className="flex flex-col gap-0.5">
                      <strong className="text-emerald-950 font-bold">הודעת מייל אמיתית נשלחה בהצלחה!</strong>
                      <p className="text-emerald-800 leading-relaxed">
                        קוד אימות בן 4 ספרות נשלח לכתובת <strong>{email}</strong>. אנא בדקו בתיבת הדואר הנכנס (Inbox) או בספאם והזינו את הקוד כאן.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="text-lg">💡</span>
                      <div>
                        <strong>סביבת פיתוח מקומית (טרם הוגדרו פרטי SMTP ב-.env.local):</strong>
                        <p className="mt-0.5 text-amber-800">
                          {otpDelivery?.message}
                        </p>
                      </div>
                    </div>
                    {otpDelivery?.demoCode && (
                      <button
                        type="button"
                        onClick={() => setOtpCode(otpDelivery.demoCode!)}
                        className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-xs whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
                      >
                        הזן קוד ({otpDelivery.demoCode})
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-sky-900">
                    הזינו את קוד האימות (OTP):
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isVerifyingOtp}
                    className="text-xs text-sky-700 hover:text-sky-900 hover:underline font-bold cursor-pointer"
                  >
                    שלח קוד שוב ↺
                  </button>
                </div>

                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="0000"
                  className="text-center text-2xl font-black tracking-widest bg-white border border-sky-300 rounded-xl py-2.5 focus:outline-sky-500 font-mono shadow-inner"
                />
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                ⚠️ {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={otpSent ? handleVerifyOtpAndGenerate : handleSendOtp}
              disabled={isVerifyingOtp}
              className="w-full py-4 rounded-2xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-2 text-base"
            >
              <span>{otpSent ? "אמת קוד והפק את ה-Chat Wrapped! 🚀" : "שלח קוד אימות והמשך ←"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: Loading State with Humorous Messages (PRD Section 3.1 & 5) */}
      {/* ========================================================================= */}
      {isLoading && (
        <div className="friendly-card p-10 flex flex-col items-center justify-center gap-6 text-center shadow-lg border-sky-300 animate-fadeIn">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-3xl">
              🔍
            </div>
          </div>

          <div className="flex flex-col gap-2 max-w-md">
            <h2 className="text-2xl font-black text-slate-900">
              הבלש JHON חוקר את השיחה...
            </h2>
            <p className="text-sky-700 text-base min-h-[3rem] flex items-center justify-center font-bold transition-all duration-300">
              "{FUNNY_LOADING_MESSAGES[loadingMsgIndex]}"
            </p>
            <span className="text-xs text-slate-500">
              מנתח התפלגות הודעות, סלנג, שיאי דרמה ונבואות לעשור הבא...
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPORT GUIDE MODAL (PRD Section 3.1) */}
      {/* ========================================================================= */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="friendly-card p-6 sm:p-8 max-w-lg w-full flex flex-col gap-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="text-right">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>📱</span>
                <span>מדריך קצר: איך לייצא צ'אט מוואטסאפ?</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                תוך 10 שניות מקבלים קובץ .txt מוכן להעלאה
              </p>
            </div>

            <div className="flex flex-col gap-4 text-xs sm:text-sm text-slate-700">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="text-sky-900 block font-bold mb-1">באייפון (iPhone):</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>כנסו לצ'אט הרצוי ולחצו על שם איש הקשר / שם הקבוצה למעלה.</li>
                  <li>גללו מטה ובחרו <strong>"ייצוא צ'אט" (Export Chat)</strong>.</li>
                  <li>בחרו <strong>"ללא מדיה" (Without Media)</strong>.</li>
                  <li>שמרו את הקובץ במכשיר או שלחו אותו לעצמכם והעלו לכאן.</li>
                </ol>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <strong className="text-sky-900 block font-bold mb-1">באנדרואיד (Android):</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>כנסו לצ'אט ולחצו על <strong>שלוש הנקודות</strong> בצד העליון.</li>
                  <li>בחרו <strong>עוד (More) &gt; ייצוא צ'אט (Export Chat)</strong>.</li>
                  <li>בחרו <strong>"ללא מדיה"</strong>.</li>
                  <li>העלו את קובץ ה-.txt לכאן.</li>
                </ol>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-3 rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-500 transition-all cursor-pointer text-sm"
            >
              הבנתי, בואו נמשיך!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
