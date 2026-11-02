/**
 * Preprocessing logic as mandated by PRD Section 6.2
 */

// Regex for international (+972...) and Israeli local (05...) phone numbers,
// handling spaces, dashes, parentheses and prefixes.
const PHONE_NUMBER_REGEX = /(?:\+?972[-.\s]?|0)(?:5[0-9]|[2-489])[-.\s]?\d{3}[-.\s]?\d{4}/g;

// Also catch standard WhatsApp header numbers like [054-1234567] or +972 54-123-4567:
const PHONE_GENERAL_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3}[-.\s]?\d{3,4}/g;

export interface PreprocessResult {
  cleanedText: string;
  originalLength: number;
  isTruncated: boolean;
  phoneNumbersRedactedCount: number;
}

export function preprocessChatText(rawText: string): PreprocessResult {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("קובץ הטקסט ריק או לא תקין");
  }

  let text = rawText.trim();
  if (text.length === 0) {
    throw new Error("תוכן הצ'אט ריק");
  }

  // 1. Redact phone numbers
  let redactionCount = 0;
  
  text = text.replace(PHONE_NUMBER_REGEX, () => {
    redactionCount++;
    return "[מספר]";
  });

  text = text.replace(PHONE_GENERAL_REGEX, (match) => {
    // Avoid redacting simple short numbers or timestamps like 12:30 or 2024
    if (match.replace(/\D/g, "").length >= 7) {
      redactionCount++;
      return "[מספר]";
    }
    return match;
  });

  // 2. Truncate to maximum 150,000 characters
  // PRD 6.2: "אם הצ'אט ארוך יותר, נשלחים 150,000 התווים האחרונים, כי הם מכילים את הסיום והשיא."
  const MAX_CHARS = 150000;
  const originalLength = text.length;
  let isTruncated = false;

  if (text.length > MAX_CHARS) {
    text = text.slice(text.length - MAX_CHARS);
    isTruncated = true;
  }

  // 3. Final emptiness check
  if (text.replace(/\[מספר\]/g, "").trim().length < 20) {
    throw new Error("הצ'אט קצר מדי או אינו מכיל מספיק תוכן לעיבוד");
  }

  return {
    cleanedText: text,
    originalLength,
    isTruncated,
    phoneNumbersRedactedCount: redactionCount,
  };
}
