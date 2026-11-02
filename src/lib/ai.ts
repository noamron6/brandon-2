import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ChatContext,
  ParticipantStat,
  ChatRoastReport,
} from "./types";
import { ParsedMessage } from "./parser";

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a brilliant, ruthless, and deeply cynical Israeli stand-up comedian and psychological profiler. Your job is to analyze a WhatsApp chat history and roast the participants mercilessly.

CRITICAL INSTRUCTIONS:
1. GENDER & TONE: First, analyze the names and chat text to determine the gender of the participants (Male, Female, or Mixed) and the relationship (Friends, Couple, Family). YOU MUST use the correct Hebrew pronouns and grammar for them.
2. LENGTH & DEPTH: Do not write short, polite sentences. Write long, piercing, hilarious paragraphs. Exaggerate their flaws, mock their texting habits, and act exhausted by their nonsense.
3. SLANG: Use modern, authentic Israeli slang (e.g., פומו, חיבס, נסחפים, קרינג', חיים בסרט).
4. LANGUAGE: The output MUST be entirely in Hebrew (except JSON keys).
5. QUOTES: Use ONLY real, verbatim quotes from the provided message sample. Never invent quotes.

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
// MOCK GENERATOR (no API key / dev mode)
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

  const realQuote1 = sampleMessages?.find(
    (m) => m.text.length > 8 && m.text.length < 120
  );
  const realQuote2 = sampleMessages?.find(
    (m) =>
      m.text.length > 8 &&
      m.text.length < 120 &&
      m !== realQuote1
  );

  return {
    analysis_metadata: {
      inferred_relationship: "חבורת חברים",
      grammar_used: "זכר רבים",
    },
    free_content: {
      headline: `משבר זהות ו-V כחולים: הדוח הקשה של ${primary} ו-${secondary}`,
      opening_intro: `קראתי ${total} הודעות שלכם ואני עדיין מחפש את הנפש שלי. עברתי על ויכוחים קוסמיים על איפה לאכול, תירוצים שאפילו עורך דין סניגור היה מסרב לייצג, ודפוסים תקשורתיים שהיו מרתקים פסיכיאטרים בכל העולם. אתם לא קבוצת וואטסאפ — אתם ניסוי חברתי שיצא מידי שליטה, וה-IRB שאישר אתכם חייב לאבד את הרישיון.`,
      dynamic_analysis: {
        section_title: `החמ"ל של הפחדנות: איך ${primary} ו-${secondary} מנהלים את אי-הוודאות`,
        intro_text: `יש לכם הרגל שגורם לי לרצות לפתוח קרן גמלאות ולפרוש מיד: ${primary} שולח הצעה מלאת אנרגיה ו-${secondary} מגיב שעות מאוחר יותר כאילו ההודעה הגיעה בדואר שבוע ראשון. זה לא עצלות — זו אסטרטגיה. מישהו כאן חי בסרט שבו הוא הדמות הכי מבוקשת במסיבה, ומישהו אחר מחפש דרך לא לאכזב בלי להתחייב לשום דבר.`,
        proof_quotes: [
          {
            sender: realQuote1?.sender || primary,
            context: realQuote1?.time || "בשעה לא סבירה",
            text: realQuote1?.text || "יאללה חברים, מה הולך? מישהו חי פה?",
          },
          {
            sender: realQuote2?.sender || secondary,
            context: realQuote2?.time || "שלוש שעות מאוחר יותר",
            text: realQuote2?.text || "סבבה, הייתי עסוק.",
          },
        ],
        punchline_text: `זהו. זה הסיכום של מערכת היחסים שלכם בשני משפטים. ${primary} שורף קלוריות ו-${secondary} מנהל קריירה של העדרות מנוהלת. מחיאות כפיים לכולם.`,
      },
      primary_user_profile: {
        user_name: primary,
        roast_title: "מנכ״ל משרד הדמיון המודרך — יו״ר ועדת הבוטלים הלאומית",
        psychological_analysis: `${primary} הוא מה שקורה כשאדם עם פומו ענק כותב הודעות במקום לחיות את החיים שהוא תכנן. הטקסטים שלו מלאים בסימני קריאה שמסגירים חרדה מוסווית — כל "יאללה!!!" הוא בעצם "בבקשה תשימו לב אליי". הוא שולח הצעות גדולות ב-01:30 בלילה, נעלם כשצריך להוציא כרטיס אשראי, ובכל זאת מתפלא שאנשים מפסיקים לחכות לו. תסמונת קלאסית של אדם שמאמין שהכוונה מחשבה, וששליחת הודעה היא בעצמה מחוות. היה ״מנהל פרויקטים״ בחברת סטארטאפ שנסגרה בדיוק בגלל אנשים כמוהו.`,
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
        psychological_analysis: `${secondary} מייצג תופעה מרתקת שמדענים מכנים "פאסיב אגרסיב דיגיטלי מתקדם". הוא קורא הכל ברגע שזה מגיע — הנתונים מוכיחים — ואז בוחר לענות בשעה שמתאימה *לו*, שהיא תמיד השעה שפחות נוחה לאחר. זו לא עצלות, זו שליטה. ${secondary} הבין שבעידן הסמארטפון, הכוח הוא אצל מי שלא מגיב — ובנה קריירה שלמה על הכוח הזה. הבעיה? כולם ראו, כולם יודעים, ואף אחד לא אומר לו כי גם הם עושים את זה.`,
      },
      toxic_traits: [
        {
          trait_name: "תסמונת ה-V הכחולים ואי-המענה המתוכנן",
          explanation: `בקבוצה הזאת יש הסכמה לא כתובה ולא מדוברת: אפשר לראות הודעה, לחשוב עליה, להתלבט, לשתות קפה, ורק אז — אולי — לענות. ומה קורה כשמישהו *מעז* להצביע על ה-V הכחול? מיד מגיעה ההגנה הקלאסית: "הייתי עסוק", "לא ראיתי", "הטלפון היה שקט". אבל הנתונים לא משקרים — ממוצע זמן מענה של 4.2 שעות לשאלות "מה קורה?" ו-12 שניות לשאלות "מה אוכלים?" זה לא אקראי. זה פוליטיקה.`,
        },
        {
          trait_name: "תכנון-אובר של דברים שלא יקרו לעולם",
          explanation: `אתם מתכננים. הרבה. רק שהביצוע חי בממד מקביל שאף אחד מכם לא הגיע אליו עדיין. כל תוכנית מתחילה ב"יאללה, הפעם באמת!" ונגמרת ב"אוקיי בטח שבוע הבא". יש בצ'אט שלכם לפחות 7 תוכניות שהושקעו בהן יותר ממחצית שעה של הודעות ולא יצאו לפועל. ה-7 הן: טיול שבוע, ״ערב חברים רציני״, ״להתחיל לרוץ ביחד״, בישול ביחד, ״לראות סרט״, פגישה שהוזזה 4 פעמים, ועוד אחת שאפילו אתם לא זוכרים. המשך פורה.`,
        },
      ],
      the_unspoken_truth: `מה שאף אחד לא אומר בקבוצה הזאת הוא פשוט מאוד: ${primary} מרגיש שהוא משקיע יותר מ-${secondary}, ו-${secondary} מרגיש ש-${primary} דורש יותר ממה שהוא מסוגל לתת. שניהם צודקים. שניהם לא יגידו את זה. ובמקום שיחה של חמש דקות שתפתור הכל, הם יוסיפו עוד 2,000 הודעות לארכיון המתעסק בכלום ומרגיש שמשהו בעייתי אבל אי אפשר לשים עליו אצבע. זה המבנה המושלם להמשיך בדיוק כמו עכשיו עוד עשר שנים.`,
      final_verdict: `בעוד חמש שנים: ${primary} עדיין ישלח "יאללה מתי נפגש" ב-01:30 בלילה, ו-${secondary} עדיין ישים V כחול ויענה למחרת בארוחת צהריים. הקבוצה תהיה קיימת, לעתים רחוקות פעילה, ולעתים קרובות ישמשו בה להפצת מימים ולינקים שאף אחד לא לוחץ עליהם. מישהו יוסיף "חבר חדש" שאף אחד לא יזכור מי הזמין אותו, מישהו יעזוב בשקט ויחזור שבוע אחר כך בלי שיגידו כלום. בסופו של דבר, הקשר הזה יהיה בדיוק כמו הצ'אט — קיים, פעיל מדי פעם, ובלי שאיש יודע בדיוק למה.`,
    },
    stats: {
      totalMessages: total,
      participants,
    },
  };
}

// ─────────────────────────────────────────────
// MAIN GENERATOR (live API call)
// ─────────────────────────────────────────────

export async function generateChatRoastReport(
  participants: ParticipantStat[],
  context: ChatContext,
  userParticipant: string | undefined,
  totalMessages: number,
  sampleMessages: ParsedMessage[]
): Promise<ChatRoastReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";

  if (!apiKey || apiKey.trim() === "" || apiKey === "your-anthropic-key-here") {
    await new Promise((r) => setTimeout(r, 1200));
    return generateMockChatRoast(
      participants,
      userParticipant,
      totalMessages,
      sampleMessages
    );
  }

  const anthropic = new Anthropic({ apiKey });

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

  // Pick up to 40 varied messages across the chat for quote mining
  const messageSample = sampleMessages
    .filter((m) => m.text.length > 6 && m.text.length < 200)
    .reduce<ParsedMessage[]>((acc, m) => {
      // Spread selection: pick from beginning, middle, and end
      acc.push(m);
      return acc;
    }, [])
    .filter((_, i) => i % Math.max(1, Math.floor(sampleMessages.length / 40)) === 0)
    .slice(0, 40)
    .map((m) => `[${m.time || "?"}] ${m.sender}: ${m.text}`)
    .join("\n");

  const userPrompt = `Analyze this chat and generate the full roast report.

- Primary User: ${userParticipant || participants[0]?.name || "לא ידוע"}
- Other Participants: ${otherNames || "לא ידוע"}
- Chat Type: ${contextHebrewMap[context]}
- Total Messages: ${totalMessages}
- Participant breakdown: ${participantBreakdown}

Selected messages for quotes (use ONLY these for proof_quotes — exact text):
${messageSample || "(no sample available)"}

Generate the JSON now.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response: any = await (anthropic.messages.create as any)({
        model,
        max_tokens: 3000,
        temperature: 0.93,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock.type !== "text") throw new Error("No text in response");

      const parsed = cleanAndParseJson(firstBlock.text);
      const validated = ChatRoastZodSchema.parse(parsed);

      return {
        ...validated,
        stats: { totalMessages, participants },
      } as ChatRoastReport;
    } catch (err: any) {
      console.warn(`[AI Chat Roast] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === 1) await new Promise((r) => setTimeout(r, 900));
    }
  }

  return generateMockChatRoast(participants, userParticipant, totalMessages, sampleMessages);
}
