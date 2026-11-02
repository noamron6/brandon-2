import nodemailer from "nodemailer";

export interface SendOtpResult {
  success: boolean;
  delivered: boolean;
  error?: string;
}

/**
 * Checks if real SMTP configuration is provided in environment variables.
 */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  return Boolean(user && pass && (host || process.env.GMAIL_USER));
}

/**
 * Sends a real OTP verification email using Nodemailer.
 * Falls back gracefully with informative details if SMTP is not set up.
 */
export async function sendOtpEmail(toEmail: string, code: string): Promise<SendOtpResult> {
  const cleanEmail = toEmail.trim().toLowerCase();

  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? "smtp.gmail.com" : "");
  const port = parseInt(process.env.SMTP_PORT || (host === "smtp.gmail.com" ? "465" : "587"), 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const from = process.env.SMTP_FROM || `"הבלש JHON 🕵️‍♂️" <${user || "support@chatwrapped.co.il"}>`;

  if (!user || !pass || !host) {
    console.warn("[Email OTP] SMTP credentials not fully configured in environment. Skipping network send.");
    return {
      success: true,
      delivered: false,
      error: "לא הוגדרו פרטי שרת דואר (SMTP) בסביבת המערכת.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <title>קוד אימות לדוח ה-Chat Wrapped</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; direction: rtl; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06); text-align: center; }
    .badge { display: inline-block; background-color: #0284c7; color: #ffffff; font-weight: bold; font-size: 14px; padding: 6px 14px; border-radius: 9999px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #0f172a; margin: 0 0 12px 0; font-weight: 800; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
    .code-box { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 14px; padding: 18px 24px; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0369a1; display: inline-block; margin: 10px 0 24px 0; }
    .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🕵️‍♂️ חקירת הבלש JHON הושלמה!</div>
    <h1>קוד האימות שלך לדוח ה-Chat Wrapped</h1>
    <p>הבלש JHON סיים לרחרח בהיסטוריית השיחה שלכם, למפות את הקליקות, לפצח את הסלנג ולחבר את הדו"ח הסאטירי המלא.</p>
    
    <div>הקוד שלך לכניסה:</div>
    <div class="code-box">${code}</div>

    <p>הקוד תקף ל-10 הדקות הקרובות. אם לא ביקשתם ניתוח לשיחה, ניתן להתעלם ממייל זה בבטחה.</p>
    
    <div class="footer">
      Chat Wrapped • הבלש JHON חוקר אתכם בחיוך 😉
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `קוד האימות שלך לדוח ה-Chat Wrapped מאת הבלש JHON הוא: ${code}\nהקוד תקף ל-10 דקות.`;

    await transporter.sendMail({
      from,
      to: cleanEmail,
      subject: `🕵️‍♂️ קוד האימות שלך ל-Chat Wrapped: ${code}`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Email OTP] Real verification email successfully sent to ${cleanEmail}`);
    return {
      success: true,
      delivered: true,
    };
  } catch (err: any) {
    console.error(`[Email OTP] Failed to send email to ${cleanEmail}:`, err);
    return {
      success: false,
      delivered: false,
      error: err.message || "שגיאה בשליחת הודעת המייל דרך שרת ה-SMTP",
    };
  }
}
