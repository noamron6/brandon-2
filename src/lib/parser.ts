import { ParticipantStat } from "./types";

export interface ParsedMessage {
  time: string;
  sender: string;
  text: string;
}

export interface DramaSpike {
  timeWindow: string;
  messageCount: number;
  sampleQuotes: Array<{ sender: string; text: string }>;
}

export interface ParsedChatAnalysis {
  totalMessages: number;
  participants: ParticipantStat[];
  messages: ParsedMessage[];
  spikes: DramaSpike[];
  candidateSlang: string[];
  cleanTranscriptForAI: string;
}

const COMMON_STOP_WORDS = new Set([
  "של", "את", "זה", "עם", "על", "לא", "כן", "מה", "איך", "כי", "אם", "אז", "גם",
  "היה", "הוא", "היא", "הם", "אנחנו", "טוב", "בסדר", "יש", "אין", "לי", "לך", "לו",
  "לה", "לנו", "לכם", "להם", "אני", "אתה", "את", "הזה", "הזאת", "האלה", "שלי",
  "שלך", "שלו", "שלה", "שלנו", "פה", "שם", "כבר", "עוד", "רק", "כל", "יותר", "אחרי",
  "לפני", "עכשיו", "אולי", "ממש", "מאוד", "יאללה", "סבבה", "הכי", "כמו", "אבל", "או",
  "media", "omitted", "image", "sticker", "audio", "video", "ללא", "מדיה", "הושמטה",
]);

const SYSTEM_MESSAGE_PATTERNS = [
  /ההודעות והשיחות מוצפנות מקצה לקצה/i,
  /מוצפנות מקצה לקצה/i,
  /Messages and calls are end-to-end encrypted/i,
  /end-to-end encrypted/i,
  /מדיה לא נכללה/i,
  /מדיה הושמטה/i,
  /<Media omitted>/i,
  /<מדיה הושמטה>/i,
  /שיחה קולית/i,
  /שיחת וידאו/i,
  /Missed voice call/i,
  /Missed video call/i,
  /voice call/i,
  /video call/i,
  /הודעה זו נמחקה/i,
  /ההודעה הזו נמחקה/i,
  /This message was deleted/i,
  /You deleted this message/i,
  /קוד אבטחה/i,
  /security code/i,
  /נוספ.*לקבוצה/i,
  /עזב.*את הקבוצה/i,
  /הסיר.*את/i,
  /שינה.*את נושא/i,
  /שינה.*את תמונת/i,
  /יצר.*את הקבוצה/i,
];

export function isSystemOrGarbageMessage(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 2) return true;
  return SYSTEM_MESSAGE_PATTERNS.some((pattern) => pattern.test(clean));
}

/**
 * Extracts participant messages and metadata from WhatsApp and standard chat exports
 */
export function parseChatHistory(
  rawText: string,
  nameMapping?: Record<string, string>,
  userParticipant?: string
): ParsedChatAnalysis {
  const lines = rawText.split(/\r?\n/);
  const parsedMessages: ParsedMessage[] = [];

  // Common WhatsApp regex patterns:
  // 1. [12/10/24, 18:30:15] Dani: Hello
  // 2. 12/10/24, 18:30 - Dani: Hello
  // 3. 12.10.2024, 18:30 - Dani: Hello
  const pattern1 = /^\[?(\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}[,\s]+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*(?:-|–)?\s*([^:]+):\s*(.*)$/i;

  let currentMsg: ParsedMessage | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(pattern1);
    if (match) {
      if (currentMsg && !isSystemOrGarbageMessage(currentMsg.text)) {
        parsedMessages.push(currentMsg);
      }
      let sender = match[2].trim();
      // Apply name mapping if provided
      if (nameMapping && nameMapping[sender]) {
        sender = nameMapping[sender];
      }

      currentMsg = {
        time: match[1].trim(),
        sender,
        text: match[3].trim(),
      };
    } else if (currentMsg) {
      // Continuation line of previous message
      currentMsg.text += " " + trimmed;
    }
  }

  if (currentMsg && !isSystemOrGarbageMessage(currentMsg.text)) {
    parsedMessages.push(currentMsg);
  }

  // Fallback if formatting didn't match standard WhatsApp headers
  if (parsedMessages.length === 0) {
    // Attempt simple "Name: text"
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx > 0 && idx < 30) {
        let sender = line.slice(0, idx).trim();
        if (nameMapping && nameMapping[sender]) {
          sender = nameMapping[sender];
        }
        const text = line.slice(idx + 1).trim();
        if (!isSystemOrGarbageMessage(text)) {
          parsedMessages.push({
            time: "",
            sender,
            text,
          });
        }
      }
    }
  }

  const totalMessages = parsedMessages.length;

  // 1. Participant count & distribution
  const counts: Record<string, { count: number; words: number }> = {};
  for (const msg of parsedMessages) {
    if (!counts[msg.sender]) {
      counts[msg.sender] = { count: 0, words: 0 };
    }
    counts[msg.sender].count++;
    counts[msg.sender].words += msg.text.split(/\s+/).length;
  }

  const participants: ParticipantStat[] = Object.entries(counts)
    .map(([name, data]) => ({
      name,
      count: data.count,
      words: data.words,
      percentage: totalMessages > 0 ? Math.round((data.count / totalMessages) * 100) : 0,
      isUser: userParticipant ? name === userParticipant : false,
    }))
    .sort((a, b) => b.count - a.count);

  // 2. Candidate slang & internal group words extraction (PRD Section 5.1)
  const wordFrequencies: Record<string, number> = {};
  for (const msg of parsedMessages) {
    // Filter out URLs, media tags, numbers
    const cleanText = msg.text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\[מספר\]/g, "")
      .replace(/[0-9]+/g, "")
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'״׳]/g, " ");

    const words = cleanText.split(/\s+/);
    for (const w of words) {
      const lower = w.trim();
      if (
        lower.length >= 3 &&
        lower.length <= 16 &&
        !COMMON_STOP_WORDS.has(lower) &&
        !/^[a-zA-Z]+$/.test(lower) // Keep Hebrew or slang
      ) {
        wordFrequencies[lower] = (wordFrequencies[lower] || 0) + 1;
      }
    }
  }

  // Top candidate slang repeated >= 2 times
  const candidateSlang = Object.entries(wordFrequencies)
    .filter(([word, freq]) => freq >= 2 && !word.startsWith("חחח"))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // 3. Drama Spike Detection (Burst of messages in short sequence)
  const spikes: DramaSpike[] = [];
  if (parsedMessages.length >= 8) {
    const windowSize = 10;
    let maxClusterStart = 0;
    let maxClusterDensity = 0;

    for (let i = 0; i < parsedMessages.length - windowSize; i += 5) {
      const slice = parsedMessages.slice(i, i + windowSize);
      // Density: shorter text with high message frequency
      const density = slice.length;
      if (density > maxClusterDensity) {
        maxClusterDensity = density;
        maxClusterStart = i;
      }
    }

    const spikeSlice = parsedMessages.slice(maxClusterStart, maxClusterStart + 6);
    spikes.push({
      timeWindow: spikeSlice[0]?.time || "",
      messageCount: spikeSlice.length,
      sampleQuotes: spikeSlice.map((m) => ({ sender: m.sender, text: m.text })),
    });
  }

  // 4. Compact clean transcript for AI prompt (up to 120,000 chars)
  const transcriptLines = parsedMessages
    .slice(-800) // Focus on recent and climax messages
    .map((m) => `${m.sender}: ${m.text}`);
  const cleanTranscriptForAI = transcriptLines.join("\n").slice(-120000);

  return {
    totalMessages,
    participants,
    messages: parsedMessages,
    spikes,
    candidateSlang,
    cleanTranscriptForAI,
  };
}
