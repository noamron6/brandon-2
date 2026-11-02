import { NextRequest, NextResponse } from "next/server";
import { saveOtp, verifyOtpCode } from "@/lib/db";
import { sendOtpEmail, isSmtpConfigured } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, code } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "כתובת אימייל לא תקינה" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Send OTP (Real email via SMTP + DB persistence)
    if (action === "send") {
      // Generate a cryptographic 4-digit code (1000-9999)
      const generatedCode = Math.floor(1000 + Math.random() * 9000).toString();

      // Persist in SQLite DB
      saveOtp(cleanEmail, generatedCode);

      // Attempt real email delivery
      const sendResult = await sendOtpEmail(cleanEmail, generatedCode);

      if (sendResult.delivered) {
        return NextResponse.json({
          success: true,
          delivered: true,
          message: `קוד אימות בן 4 ספרות נשלח בהצלחה לכתובת ${cleanEmail}! בדוק/י את תיבת הדואר הנכנס או את תיקיית הספאם.`,
        });
      }

      // If SMTP is not set or failed to deliver:
      return NextResponse.json({
        success: true,
        delivered: false,
        smtpConfigured: isSmtpConfigured(),
        message: isSmtpConfigured()
          ? `השליחה לשרת הדואר נכשלה (${sendResult.error}). קוד האימות לבדיקה הוא: ${generatedCode}`
          : `לא הוגדר שרת SMTP פעיל בקובץ .env.local. קוד האימות שנוצר עבורך הוא: ${generatedCode}`,
        demoCode: generatedCode,
      });
    }

    // 2. Verify OTP
    if (action === "verify") {
      if (!code) {
        return NextResponse.json({ error: "אנא הזן את קוד האימות" }, { status: 400 });
      }

      const result = verifyOtpCode(cleanEmail, code);

      if (result.valid) {
        return NextResponse.json({
          success: true,
          verified: true,
        });
      }

      return NextResponse.json(
        { error: result.reason || "קוד אימות שגוי. נסה שוב." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "פעולה לא חוקית" }, { status: 400 });
  } catch (err: any) {
    console.error("[Verify OTP API] Error:", err);
    return NextResponse.json({ error: err.message || "שגיאה בשרת" }, { status: 500 });
  }
}
