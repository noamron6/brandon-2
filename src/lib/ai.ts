import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ChatContext,
  ParticipantStat,
  ChatRoastReport,
} from "./types";
import { ParsedMessage, isSystemOrGarbageMessage } from "./parser";

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a brilliant, ruthless, and deeply cynical Israeli stand-up comedian and psychological profiler. Your job is to analyze a WhatsApp chat history and roast the participants mercilessly.

CRITICAL INSTRUCTIONS:
1. GENDER & TONE: First, analyze the names and chat text to determine the gender of the participants (Male, Female, or Mixed) and the relationship (Friends, Couple, Family). YOU MUST use the correct Hebrew pronouns and grammar for them.
2. LENGTH & DEPTH: Do not write short, polite sentences. Write long, piercing, hilarious paragraphs. Exaggerate their flaws, mock their texting habits, and act exhausted by their nonsense.
3. SLANG: Use modern, authentic Israeli slang (e.g., פומו, חיבס, נסחפים, קרינג', חיים בסרט).
4. LANGUAGE: The output MUST be entirely in Hebrew (except JSON keys).
5. QUOTES: Use ONLY real, verbatim quotes from the provided message sample. Never invent quotes. NEVER quote system messages like encryption notices or media omitted.

Return ONLY a valid JSON object with this exact structure, without any Markdown or text outside the JSON:

{
  "analysis_metadata": {
    "inferred_relationship": "e.g., זוג, חברות טובות, חבורת בנים",
    "grammar_used": "e.g., נקבה רבות, זכר רבים"
  },
  "free_content": {
    "headline": "A provocative, tabloid-style headline mentioning participant names.",
    "opening_intro": "3-4 long sentences expressing shock and disgust. Mention the total messages and describe the vibe as if you suffered reading it.",
    "dynamic_analysis": {
      "section_title": "A sarcastic title for their communication dynamic.",
      "intro_text": "A full paragraph analyzing their weirdest shared habit.",
      "proof_quotes": [
        {
          "sender": "Name",
          "context": "Time/Date or situation",
          "text": "Exact verbatim quote 1 from the sample."
        },
        {
          "sender": "Name",
          "context": "Time/Date or situation",
          "text": "Exact verbatim quote 2 from the sample."
        }
      ],
      "punchline_text": "2-3 sentences mocking these specific quotes."
    },
    "primary_user_profile": {
      "user_name": "The primary user name.",
      "roast_title": "Humiliating, funny Hebrew title.",
      "psychological_analysis": "A deep, long mocking paragraph (4-5 sentences) analyzing their psychological flaws based on how they text."
    }
  },
  "paywall_teasers": [
    "A brutal hint about the other participant's profile.",
    "A hint about their red flags or toxic habits.",
    "A satirical prediction about their future together."
  ],
  "premium_content": {
    "secondary_user_profile": {
      "user_name": "The other main participant.",
      "roast_title": "Humiliating title for them.",
      "psychological_analysis": "A deep, long mocking paragraph (4-5 sentences) roasting them for being passive-aggressive, needy, or delusional."
    },
    "toxic_traits": [
      {
        "trait_name": "Name of a toxic trait they share.",
        "explanation": "A hilarious paragraph explaining how this trait manifests in their daily texts."
      },
      {
        "trait_name": "Another toxic trait.",
        "explanation": "Roasting their specific annoying habits."
      }
    ],
    "the_unspoken_truth": "A brutal, funny paragraph revealing the elephant in the room about their relationship.",
    "final_verdict": "A long concluding paragraph summarizing where this relationship is heading in 5 years."
  }
}`;

// ─────────────────────────────────────────────
// ZOD VALIDATION SCHEMA
// ─────────────────────────────────────────────

const UserRoastProfileSchema = z.object({
  user_name: z.string().min(1),
  roast_title: z.string().min(3),
  psychological_analysis: z.string().min(20),
});

const ProofQuoteSchema = z.object({
  sender: z.string(),
  context: z.string(),
  text: z.string(),
});

const ChatRoastZodSchema = z.object({
  analysis_metadata: z.object({
    inferred_relationship: z.string().min(2),
    grammar_used: z.string().min(2),
  }),
  free_content: z.object({
    headline: z.string().min(5),
    opening_intro: z.string().min(20),
    dynamic_analysis: z.object({
      section_title: z.string().min(3),
      intro_text: z.string().min(10),
      proof_quotes: z.array(ProofQuoteSchema).min(1),
      punchline_text: z.string().min(10),
    }),
    primary_user_profile: UserRoastProfileSchema,
  }),
  paywall_teasers: z.array(z.string().min(5)).min(1).max(5),
  premium_content: z.object({
    secondary_user_profile: UserRoastProfileSchema,
    toxic_traits: z.array(
      z.object({
        trait_name: z.string().min(3),
        explanation: z.string().min(10),
      })
    ).min(1),
    the_unspoken_truth: z.string().min(20),
    final_verdict: z.string().min(20),
  }),
});

// ─────────────────────────────────────────────
// JSON CLEANER
// ─────────────────────────────────────────────

function cleanAndParseJson(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

// ─────────────────────────────────────────────
// GEMINI 1.5 FLASH CALLER (REST)
// ─────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<any> {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.92,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty content");
  return cleanAndParseJson(text);
}

// ─────────────────────────────────────────────
// CLAUDE CALLER (SDK)
// ─────────────────────────────────────────────

async function callClaude(apiKey: string, prompt: string): Promise<any> {
  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
  const anthropic = new Anthropic({ apiKey: apiKey.trim() });

  const response: any = await (anthropic.messages.create as any)({
    model,
    max_tokens: 3000,
    temperature: 0.93,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const firstBlock = response.content?.[0];
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error("Claude returned non-text response");
  }

  return cleanAndParseJson(firstBlock.text);
}

// ─────────────────────────────────────────────
// MOCK GENERATOR (Dev / Offline fallback)
// ─────────────────────────────────────────────

export function generateMockChatRoast(
  participants: ParticipantStat[],
  userParticipant?: string,
  totalMessages?: number,
  sampleMessages?: ParsedMessage[]
): ChatRoastReport {
  const primary = userParticipant || participants[0]?.name || "דני";
  const secondary =
    participants.find((p) => p.name !== primary)?.name || participants[1]?.name || "מיכל";
  const total = totalMessages ?? participants.reduce((s, p) => s + p.count, 0);

  // Filter messages to pick genuine conversational quotes (no system garbage!)
  const cleanMessages = (sampleMessages || []).filter(
    (m) =>
      !isSystemOrGarbageMessage(m.text) &&
      m.text.length >= 4 &&
      m.text.length <= 150 &&
      !m.text.includes("הוצפנו") &&
      !m.text.includes("מוצפנות") &&
      !m.text.includes("שיחה קולית")
  );

  const realQuote1 = cleanMessages.find((m) => m.sender === primary) || cleanMessages[0];
  const realQuote2 =
    cleanMessages.find((m) => m.sender === secondary && m !== realQuote1) ||
    cleanMessages[1] ||
    cleanMessages[0];

  return {
    analysis_metadata: {
      inferred_relationship: "חבורת חברים",
      grammar_used: "זכר רבים",
    },
    free_content: {
      headline: `חקירת עומק: מה באמת קורה בצ'אט של ${primary} ו-${secondary}?`,
      opening_intro: `קראתי ${total} הודעות שלכם והמוח שלי מבקש להתפטר. מהשנייה הראשונה שמנתחים את השיחה הזאת ברור שלא מדובר בהתנהלות של אנשים בוגרים, אלא בקומדיית טעויות בלתי נגמרת. ${primary} מוביל את שיאי ההודעות בביטחון עצמי מופרז, בעוד ${secondary} מתמחה בהתעלמות מנומסת ופסיב-אגרסיב דיגיטלי.`,
      dynamic_analysis: {
        section_title: `החמ"ל של הקבוצה: תכנון אינסופי של תוכניות שלא קורות`,
        intro_text: `הדפוס המרכזי שחוזר על עצמו לאורך מאות הודעות הוא פשוט: ${primary} זורק רעיונות מלאי התלהבות, שאר הקבוצה מורחת את הזמן בדיונים עקרים על איפה ומתי, והכל מסתיים באפס מעשים והרבה סינונים. הנה דוגמה חיה מתוך השיחה:`,
        proof_quotes: [
          {
            sender: realQuote1?.sender || primary,
            context: realQuote1?.time || "באמצע היום",
            text: realQuote1?.text || "יאללה מה עושים? חייבים לסגור משהו",
          },
          {
            sender: realQuote2?.sender || secondary,
            context: realQuote2?.time || "כעבור כמה שעות",
            text: realQuote2?.text || "סבבה תעדכנו מה נסגר",
          },
        ],
        punchline_text: `זהו תמצית הקשר שלכם במשפט אחד: מישהו שורף אנרגיה ומישהו אחר משאיר לעצמו פתח מילוט של 100%.`,
      },
      primary_user_profile: {
        user_name: primary,
        roast_title: "מנכ״ל משרד הדמיון המודרך ושיאן ההודעות",
        psychological_analysis: `${primary} לא מסוגל לסבול דממת אלחוט בצ'אט. הוא חייב להיות זה שיוזם, מציע ומציף את הקבוצה בהודעות בכל שעה ביממה, מתוך פחד עמוק להחמיץ משהו (FOMO כרוני). הבעיה היא שברגע שצריך לסגור תאריך או לקחת אחריות, הוא נעלם כאילו לא היה. אדם שמאמין שכתיבת הודעה שווה להוצאה לפועל.`,
      },
    },
    paywall_teasers: [
      `הפרופיל המלא של ${secondary}: הפסיב-אגרסיב שמאחורי ה-V הכחולים — מה זה באמת אומר עליו`,
      `דגלים אדומים: 2 דפוסים שגיליתי בצ'אט שלכם שאמורים לשלוח אתכם לטיפול — אבל אתם בטח לא תלכו`,
      `תחזית 2030: מי יחסום את מי ראשון, ומה יהיה הסיבה הרשמית שאף אחד לא יאמין לה`,
    ],
    premium_content: {
      secondary_user_profile: {
        user_name: secondary,
        roast_title: "שר הסינון ומנכ״ל אגף ה-V הכחולים",
        psychological_analysis: `${secondary} מייצג תופעה מרתקת של שליטה דרך אי-מענה. הוא רואה כל הודעה שניה אחרי שהיא מגיעה, אבל עונה רק כשזה נוח לו בלבד. היכולת שלו לקרוא הצעה, להתעלם ממנה לשש שעות ואז לחזור עם 'אה לא ראיתי' היא פסגת אמנות התירוצים.`,
      },
      toxic_traits: [
        {
          trait_name: "תסמונת ה-V הכחולים והמענה המתוזמן",
          explanation: `בקבוצה הזו קיימת הסכמה שבשתיקה: הודעות על נושאים רציניים זוכות לשתיקה של 4 שעות, אבל מספיק שמישהו מזכיר אוכל או שולח סרטון כדי שכולם יגיבו תוך 10 שניות.`,
        },
        {
          trait_name: "תכנון-אובר שמסתיים בביטול",
          explanation: `רמת ההשקעה בשיחות תכנון היא מגלומנית, אך שיעור הביצוע בפועל עומד על אחוזים בודדים. הקבוצה מתמחה בשיחות של 50 הודעות על מקום ישיבה שמסתיימות ב'טוב נדבר מחר'.`,
        },
      ],
      the_unspoken_truth: `מה שאף אחד לא אומר בצ'אט הזה הוא ש-${primary} מרגיש שהוא היחיד שמחזיק את הקשר, בעוד ש-${secondary} מרגיש שמופעל עליו לחץ מתמיד. שניהם לא מדברים על זה ישירות וממשיכים במשחק הפסיב-אגרסיב הדיגיטלי.`,
      final_verdict: `בעוד חמש שנים: ${primary} עדיין ישלח הצעות נלהבות בשעות לא שגרתיות, ו-${secondary} עדיין ישים V כחול ויענה למחרת בצהריים. הצ'אט ימשיך להתקיים כארכיון של כוונות טובות שלא מומשו מעולם.`,
    },
    stats: {
      totalMessages: total,
      participants,
    },
  };
}

// ─────────────────────────────────────────────
// MAIN GENERATOR (Calls Gemini 1.5 Flash or Claude)
// ─────────────────────────────────────────────

export async function generateChatRoastReport(
  participants: ParticipantStat[],
  context: ChatContext,
  userParticipant: string | undefined,
  totalMessages: number,
  sampleMessages: ParsedMessage[]
): Promise<ChatRoastReport> {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Filter messages to clean out WhatsApp system disclaimers
  const filteredMessages = sampleMessages.filter(
    (m) =>
      !isSystemOrGarbageMessage(m.text) &&
      m.text.length >= 3 &&
      !m.text.includes("הוצפנו") &&
      !m.text.includes("מוצפנות") &&
      !m.text.includes("שיחה קולית")
  );

  // If no API key configured, use mock
  if (
    (!geminiKey || geminiKey.trim() === "" || geminiKey.includes("your-gemini-key")) &&
    (!anthropicKey || anthropicKey.trim() === "" || anthropicKey.includes("your-anthropic-key"))
  ) {
    console.warn(
      "[AI Chat Roast] No GEMINI_API_KEY or ANTHROPIC_API_KEY found in .env.local! Using mock data generator."
    );
    await new Promise((r) => setTimeout(r, 1200));
    return generateMockChatRoast(
      participants,
      userParticipant,
      totalMessages,
      filteredMessages
    );
  }

  const contextHebrewMap: Record<ChatContext, string> = {
    couple: "קשר רומנטי / זוגי",
    friends: "קבוצת חברים",
    best_friends: "חברים הכי טובים",
    family: "קבוצה משפחתית",
  };

  const otherNames = participants
    .filter((p) => p.name !== userParticipant)
    .map((p) => p.name)
    .join(", ");

  const participantBreakdown = participants
    .map((p) => `${p.name}: ${p.count} הודעות (${p.percentage}%)`)
    .join(", ");

  // Pick up to 50 genuine conversation messages across the chat
  const step = Math.max(1, Math.floor(filteredMessages.length / 50));
  const messageSample = filteredMessages
    .filter((_, i) => i % step === 0)
    .slice(0, 50)
    .map((m) => `[${m.time || "?"}] ${m.sender}: ${m.text}`)
    .join("\n");

  const userPrompt = `Analyze this chat and generate the full roast report.

- Primary User: ${userParticipant || participants[0]?.name || "לא ידוע"}
- Other Participants: ${otherNames || "לא ידוע"}
- Chat Type: ${contextHebrewMap[context] || "קבוצת חברים"}
- Total Messages: ${totalMessages}
- Participant breakdown: ${participantBreakdown}

Selected messages for quotes (use ONLY these real messages for proof_quotes — exact verbatim text):
${messageSample || "(no sample available)"}

Generate the JSON now.`;

  // Attempt 1: Gemini (if key exists)
  if (geminiKey && geminiKey.trim() !== "" && !geminiKey.includes("your-gemini-key")) {
    try {
      console.log("[AI Chat Roast] Calling Google Gemini 1.5 Flash...");
      const rawJson = await callGemini(geminiKey, userPrompt);
      const validated = ChatRoastZodSchema.parse(rawJson);
      return {
        ...validated,
        stats: { totalMessages, participants },
      } as ChatRoastReport;
    } catch (err: any) {
      console.warn("[AI Chat Roast] Gemini call failed:", err.message || err);
    }
  }

  // Attempt 2: Claude (if key exists)
  if (anthropicKey && anthropicKey.trim() !== "" && !anthropicKey.includes("your-anthropic-key")) {
    try {
      console.log("[AI Chat Roast] Calling Claude...");
      const rawJson = await callClaude(anthropicKey, userPrompt);
      const validated = ChatRoastZodSchema.parse(rawJson);
      return {
        ...validated,
        stats: { totalMessages, participants },
      } as ChatRoastReport;
    } catch (err: any) {
      console.warn("[AI Chat Roast] Claude call failed:", err.message || err);
    }
  }

  console.warn("[AI Chat Roast] All LLM calls failed. Falling back to mock generator.");
  return generateMockChatRoast(
    participants,
    userParticipant,
    totalMessages,
    filteredMessages
  );
}
