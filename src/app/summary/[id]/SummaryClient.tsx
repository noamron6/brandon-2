"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  TeaserResponseData,
  FreeContent,
  PremiumContent,
  ParticipantStat,
} from "@/lib/types";

export default function SummaryClient({ id }: { id: string }) {
  const searchParams = useSearchParams();

  const urlToken = searchParams.get("token");
  const urlSessionId = searchParams.get("session_id");
  const isCanceled = searchParams.get("canceled");
  const isSimulatedPayment = searchParams.get("simulate_payment");

  const [data, setData] = useState<TeaserResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch summary data
  const fetchSummary = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      let endpoint = `/api/summary/${id}`;
      const queryParams = new URLSearchParams();

      if (urlToken) {
        queryParams.set("token", urlToken);
      } else if (urlSessionId) {
        queryParams.set("session_id", urlSessionId);
      }

      if (queryParams.toString()) {
        endpoint += `?${queryParams.toString()}`;
      }

      const res = await fetch(endpoint);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "שגיאה בטעינת הנתונים");
      }

      setData(json);

      if (urlSessionId && !json.paid) {
        setIsVerifyingPayment(true);
      } else if (json.paid) {
        setIsVerifyingPayment(false);
      }
    } catch (err: any) {
      setError(err.message || "שגיאה בטעינת הדוח");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(true);
  }, [id, urlToken, urlSessionId]);

  // Polling every 3 seconds if returning with session_id
  useEffect(() => {
    if (!isVerifyingPayment || data?.paid) return;

    const interval = setInterval(() => {
      fetchSummary(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVerifyingPayment, data?.paid]);

  // Handle Checkout initiation
  const handleCheckout = async () => {
    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "שגיאה ביצירת קישור לתשלום");
      }

      if (json.alreadyPaid && json.redirectUrl) {
        window.location.href = json.redirectUrl;
        return;
      }

      if (json.url) {
        window.location.href = json.url;
      } else {
        throw new Error("לא התקבל קישור תשלום");
      }
    } catch (err: any) {
      console.error(err);
      setCheckoutError(err.message || "שגיאה בפתיחת עמוד התשלום");
      setIsCheckingOut(false);
    }
  };

  // Local simulated payment confirmation
  const handleSimulatePaymentConfirm = async () => {
    try {
      setIsCheckingOut(true);
      const res = await fetch("/api/simulate-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          session_id: urlSessionId || "dev_session_manual",
        }),
      });

      const json = await res.json();
      if (json.success && json.token) {
        window.location.href = `/summary/${id}?token=${json.token}`;
      } else {
        await fetchSummary(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCopyLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-sky-600 border-t-transparent animate-spin" />
        <p className="text-slate-600 font-medium">טוען את דוח החקירה של הבלש...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-3xl">
          ⚠️
        </div>
        <h2 className="text-2xl font-bold text-slate-900">לא ניתן להציג את הדוח</h2>
        <p className="text-slate-600 text-sm max-w-md">{error || "הדוח המבוקש אינו קיים או שפג תוקפו."}</p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition-all"
        >
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  const isFullPaid = Boolean(data.paid && data.premium_content);
  const premiumContent = data.premium_content;
  const stats = data.stats;
  const paywallTeasers = data.paywall_teasers || [];

  // Robust fallback: ensure the story on the group and primary user roast ALWAYS render
  const fallbackPrimaryName = stats?.participants?.[0]?.name || "המשתמש המוביל";
  const fallbackSecondaryName = stats?.participants?.[1]?.name || "החברים";

  const freeContent = data.free_content || {
    headline: data.title || `חקירת עומק: הדינמיקה של ${fallbackPrimaryName} ו-${fallbackSecondaryName}`,
    opening_intro:
      data.intro ||
      `קראנו את היסטוריית השיחה שלכם. מדובר ברכבת הרים של הצעות, ביטולים, ודינמיקה שגורמת לכל צופה מהצד לתהות איך אתם עדיין שורדים יחד.`,
    dynamic_analysis: {
      section_title: `החמ"ל שלא נרדם: הסיפור מאחורי ההודעות של ${fallbackPrimaryName}`,
      intro_text: `דפוס השיחה מציג הרגל עקבי: ${fallbackPrimaryName} יוזם רעיונות ותוכניות, בעוד שאר הקבוצה מגיבה באיחור אופנתי או מתעלמת באלגנטיות עד שמדובר באוכל או רכילות עסיסית.`,
      proof_quotes: [],
      punchline_text: `הקבוצה הזו מתנהלת כמו חמ"ל חירום — המון רעש, דיווחים דחופים, ואפס החלטות שמתבצעות בזמן.`,
    },
    primary_user_profile: {
      user_name: fallbackPrimaryName,
      roast_title: "מנכ״ל משרד הדמיון המודרך — שיאן ההודעות",
      psychological_analysis: `${fallbackPrimaryName} שולט בסטטיסטיקת ההודעות ביד רמה. הניתוח הפסיכולוגי מצביע על אדם שלא יכול לסבול שקט בקבוצה: שולח הודעות בצרורות, מעלה הצעות מגלומניות באמצע הלילה, ונעלם בדיוק ברגע שצריך לבצע. קלאסיקה של שיאן דיבור דיגיטלי.`,
    },
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8 pb-24">
      {/* Top Bar: Analyze Another Chat */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <Link
          href="/"
          className="text-xs sm:text-sm font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1.5 transition-colors"
        >
          <span>←</span>
          <span>נתח צ'אט נוסף</span>
        </Link>

        {isFullPaid ? (
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
            <span>✓</span>
            <span>דוח פרימיום מלא פתוח</span>
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">
            🔒 תצוגה מקדימה חינמית
          </span>
        )}
      </div>

      {/* Canceled Notice */}
      {isCanceled && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-2">
          <span>ℹ️</span>
          <span>תהליך התשלום בוטל. ניתן לפתוח את הדוח המלא בכל עת.</span>
        </div>
      )}

      {/* Webhook Polling Notice */}
      {isVerifyingPayment && !isFullPaid && (
        <div className="p-5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
            <div className="text-sm font-medium">
              מאמתים את התשלום שלך... הדף יתרענן ברגע שהאימות יושלם.
            </div>
          </div>
          <button
            type="button"
            onClick={handleSimulatePaymentConfirm}
            className="px-3.5 py-1.5 rounded-xl bg-sky-600 text-white font-bold text-xs hover:bg-sky-500 transition-all cursor-pointer whitespace-nowrap"
          >
            אמת תשלום מיד (בדיקה מקומית)
          </button>
        </div>
      )}

      {/* Simulated Payment Developer Action Banner */}
      {isSimulatedPayment && !isFullPaid && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <div>
            <strong>סביבת בדיקה מהירה: </strong>
            לחצו לפתיחת כל פרקי הדוח המלא בסימולציה מיידית.
          </div>
          <button
            type="button"
            onClick={handleSimulatePaymentConfirm}
            disabled={isCheckingOut}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-900 font-bold hover:bg-amber-400 transition-all whitespace-nowrap cursor-pointer shadow-xs"
          >
            {isCheckingOut ? "מעבד..." : "השלם בדיקת תשלום (20 ₪)"}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MAIN HEADLINE & INTRO */}
      {/* ========================================================================= */}
      <article className="friendly-card p-6 sm:p-10 shadow-lg border-slate-200 flex flex-col gap-6 relative">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 text-xs text-slate-500">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full overflow-hidden border-2 border-sky-600 bg-white">
              <Image src="/jhon.jpg" alt="JHON Detective" fill className="object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-slate-900 text-xs">דוח חקירה מאת הבלש JHON 🔍</span>
              <span className="text-[10px] text-slate-400">
                {new Date(data.created_at).toLocaleDateString("he-IL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.analysis_metadata && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200">
                🎯 {data.analysis_metadata.inferred_relationship} ({data.analysis_metadata.grammar_used})
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 font-bold text-xs border border-sky-100">
              Chat Roast רשמי
            </span>
          </div>
        </div>

        {/* Big Provocative Headline */}
        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
          {freeContent?.headline || data.title}
        </h1>

        {/* Opening Intro */}
        <div className="text-slate-700 text-base sm:text-lg leading-relaxed space-y-4">
          {(freeContent?.opening_intro || data.intro)?.split("\n\n").map((para, i) => (
            <p key={i} className="font-normal text-slate-700">
              {para}
            </p>
          ))}
        </div>

        {/* ========================================================================= */}
        {/* STATS: Total message count & "Who talks more" */}
        {/* ========================================================================= */}
        {stats && stats.participants && stats.participants.length > 0 && (
          <div className="mt-2 p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>📊</span>
                <span>מדד הדיבור: מי חופר יותר בקבוצה?</span>
              </h3>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-200">
                סה״כ {stats.totalMessages} הודעות נבדקו
              </span>
            </div>

            <div className="space-y-3">
              {stats.participants.map((p, idx) => (
                <div key={p.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-800">
                      <span>{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</span>
                      <span>{p.name}</span>
                      {p.isUser && (
                        <span className="text-[10px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-semibold">
                          (אתם)
                        </span>
                      )}
                    </span>
                    <span className="text-slate-500 font-mono">
                      {p.count} הודעות ({p.percentage}%)
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        idx === 0
                          ? "bg-sky-600"
                          : idx === 1
                          ? "bg-emerald-500"
                          : idx === 2
                          ? "bg-amber-500"
                          : "bg-indigo-400"
                      }`}
                      style={{ width: `${Math.max(p.percentage, 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FREE CONTENT: AI ROAST (The Group Story + Primary User Profile) */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-6 mt-2 animate-fadeIn">
          {/* Group Story & Dynamic Analysis Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 text-white flex flex-col gap-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h3 className="font-black text-base sm:text-lg text-white">
                  הסיפור על הקבוצה: {freeContent.dynamic_analysis.section_title}
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
                טעימה חינמית ✓
              </span>
            </div>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {freeContent.dynamic_analysis.intro_text}
            </p>

            {/* WhatsApp-style proof quotes */}
            {freeContent.dynamic_analysis.proof_quotes &&
              freeContent.dynamic_analysis.proof_quotes.length > 0 && (
                <div className="flex flex-col gap-2.5 my-1">
                  <span className="text-[11px] font-bold text-slate-400">
                    הוכחות מהשטח (ציטוטים אמיתיים שנשלחו בצ'אט):
                  </span>
                  <div className="flex flex-col gap-2">
                    {freeContent.dynamic_analysis.proof_quotes.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="self-start max-w-sm sm:max-w-md bg-[#dcf8c6] text-slate-900 rounded-2xl rounded-tl-xs px-4 py-2.5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-4 mb-0.5">
                          <span className="font-bold text-xs text-[#075e54]">
                            {q.sender}
                          </span>
                          {q.context && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {q.context}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium leading-snug">
                          &ldquo;{q.text}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <p className="text-amber-300 text-sm sm:text-base font-bold leading-relaxed border-t border-slate-700 pt-3">
              {freeContent.dynamic_analysis.punchline_text}
            </p>
          </div>

          {/* Primary User Profile (The Person who talks the most in the group) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col gap-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                    פרופיל סאטירי • הדמות שהכי מדברת בקבוצה
                  </span>
                  <h3 className="font-black text-slate-900 text-lg sm:text-xl">
                    {freeContent.primary_user_profile.user_name}
                  </h3>
                </div>
              </div>
              <span className="bg-amber-400 text-slate-900 font-bold text-xs px-3 py-1 rounded-full shadow-2xs">
                {freeContent.primary_user_profile.roast_title}
              </span>
            </div>
            <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
              {freeContent.primary_user_profile.psychological_analysis}
            </p>
          </div>

          {/* Paywall Teasers: Dynamic hints about locked chapters */}
          {paywallTeasers.length > 0 && !isFullPaid && (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">
                🔒 מה מחכה לכם בדוח המלא:
              </p>
              {paywallTeasers.map((hint, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium"
                >
                  <span className="text-base mt-0.5 shrink-0">
                    {i === 0 ? "🎭" : i === 1 ? "🚩" : "🔮"}
                  </span>
                  <span>{hint}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* IF NOT PAID: PAYWALL SCREEN */}
        {/* ========================================================================= */}
        {!isFullPaid && (
          <div className="relative mt-4 pt-6 border-t border-slate-200 flex flex-col gap-6">
            {/* Blurred Teaser Preview */}
            <div
              aria-hidden="true"
              className="relative select-none pointer-events-none filter blur-[7px] opacity-30 text-slate-400 space-y-6 leading-relaxed"
            >
              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                <h3 className="font-bold text-lg text-slate-800">🎭 הפרופיל הפסיכולוגי של המשתתף השני</h3>
                <p>שר הסינון ומנכ״ל אגף ה-V הכחולים... פאסיב אגרסיב דיגיטלי מתקדם...</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                <h3 className="font-bold text-lg text-slate-800">🚩 הדגלים האדומים והתכונות הרעילות</h3>
                <p>תסמונת ההודעה הקולית המיותרת, ביטולים שיטתיים ותכנון-אובר של דברים שלא יקרו...</p>
              </div>
              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                <h3 className="font-bold text-lg text-slate-800">🔮 פיל בחדר ותחזית ל-5 השנים הבאות</h3>
                <p>מה שאף אחד לא מעז לומר בקשר הזה, ואיפה תמצאו את עצמכם בעוד 5 שנים...</p>
              </div>
            </div>

            {/* Paywall CTA Card */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-t from-white via-white/95 to-transparent rounded-2xl">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-sky-600 shadow-md mb-2 bg-white">
                <Image src="/jhon.jpg" alt="JHON Detective" fill className="object-cover" />
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1.5">
                דוח החקירה המלא נעול 🔒
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm max-w-md mb-4 leading-relaxed">
                רוצים לגלות את הפרופיל של המשתתף השני, התכונות הרעילות המשותפות,
                הפיל בחדר והתחזית ל-5 השנים הבאות?
              </p>

              {/* List of Unlocked Features */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700 mb-5 max-w-sm w-full text-right">
                <div className="flex items-center gap-1.5 bg-sky-50 px-2.5 py-1.5 rounded-lg border border-sky-100">
                  <span>🎭</span>
                  <span>פרופיל המשתתף השני</span>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100">
                  <span>🚩</span>
                  <span>תכונות רעילות והרגלים</span>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-100">
                  <span>🐘</span>
                  <span>הפיל שבחדר (האמת המרה)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                  <span>🔮</span>
                  <span>תחזית ל-5 השנים הבאות</span>
                </div>
              </div>

              {checkoutError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                  {checkoutError}
                </div>
              )}

              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-white text-base sm:text-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>{isCheckingOut ? "מעביר לתשלום מאובטח..." : "פתח את הדוח המלא • 20 ₪"}</span>
                <span>⚡</span>
              </button>

              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span>תשלום חד-פעמי ומאובטח</span>
                <span>•</span>
                <span>קישור אישי קבוע לשיתוף</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* IF PAID: THE FULL PREMIUM CONTENT */}
        {/* ========================================================================= */}
        {isFullPaid && premiumContent && (
          <div className="border-t border-slate-200 pt-8 flex flex-col gap-10 animate-fadeIn">
            {/* 1. Secondary User Profile */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-sky-100 pb-2">
                <span className="text-2xl">🎭</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  פרק 1: מסדר זיהוי – הפרופיל של {premiumContent.secondary_user_profile.user_name}
                </h2>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-extrabold text-slate-900 text-lg">
                    {premiumContent.secondary_user_profile.user_name}
                  </h3>
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200">
                    {premiumContent.secondary_user_profile.roast_title}
                  </span>
                </div>
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                  {premiumContent.secondary_user_profile.psychological_analysis}
                </p>
              </div>
            </section>

            {/* 2. Toxic Traits */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                <span className="text-2xl">🚩</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  פרק 2: התכונות הרעילות והדגלים האדומים
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                דפוסי ההתנהגות המעצבנים והרעילים ביותר שזוהו בצ'אט שלכם:
              </p>

              <div className="grid grid-cols-1 gap-3">
                {premiumContent.toxic_traits.map((trait, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <h4 className="font-black text-slate-900 text-base">
                        {trait.trait_name}
                      </h4>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed">
                      {trait.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. The Unspoken Truth */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-amber-100 pb-2">
                <span className="text-2xl">🐘</span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  פרק 3: הפיל שבחדר (מה שאף אחד מכם לא מעז לומר)
                </h2>
              </div>

              <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-3">
                <p className="text-slate-800 text-sm sm:text-base leading-relaxed font-medium">
                  {premiumContent.the_unspoken_truth}
                </p>
              </div>
            </section>

            {/* 4. Final Verdict */}
            <section className="p-6 sm:p-8 rounded-2xl bg-slate-900 text-white flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-400 bg-white">
                  <Image src="/jhon.jpg" alt="JHON" fill className="object-cover" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">גזר הדין הסופי: איפה תהיו בעוד 5 שנים? 🔮</h3>
                  <span className="text-xs text-amber-300 font-mono">מסקנות סופיות של החקירה</span>
                </div>
              </div>

              <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                {premiumContent.final_verdict}
              </p>

              <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs">
                <span className="font-bold text-amber-400">הבלש JHON 🔍</span>
                <span className="text-slate-400">דוח Chat Roast מאומת</span>
              </div>
            </section>

            {/* Actions: Share & Print */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>{copiedLink ? "✓ הקישור הועתק בהצלחה!" : "🔗 שתף דוח (העתק קישור)"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all cursor-pointer"
                >
                  🖨️ הדפס / שמור כ-PDF
                </button>
              </div>

              <Link
                href="/"
                className="text-xs sm:text-sm text-sky-700 hover:underline font-bold"
              >
                + נתח צ'אט נוסף
              </Link>
            </div>
          </div>
        )}
      </article>

      {/* Sticky Watermark Footer */}
      <div className="fixed bottom-3 right-1/2 translate-x-1/2 z-30 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md text-white/90 border border-slate-700/60 px-4 py-1.5 rounded-full text-[11px] font-bold shadow-lg flex items-center gap-2">
          <span>🔍</span>
          <span>JHON • Chat Roast Private Report</span>
        </div>
      </div>
    </div>
  );
}
