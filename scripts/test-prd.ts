import { preprocessChatText } from "../src/lib/preprocess";
import {
  createSummaryRecord,
  getSummaryTeaser,
  getSummaryFull,
  updateSummaryPaid,
  cleanupExpiredSummaries,
} from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

async function runTests() {
  console.log("==========================================");
  console.log("Running PRD Compliance & Security Tests");
  console.log("==========================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Phone number redaction test (PRD 6.2 & 14)
  const sampleChat = `
    [10/10/2024, 10:00] דני: תתקשרו אליי ל-054-1234567 או 0509988776
    [10/10/2024, 10:01] יוסי: המספר שלי זה +972-52-3344556 סבבה?
    [10/10/2024, 10:02] מיכל: נסגור את זה אחר כך
  `;

  const preprocessed = preprocessChatText(sampleChat);
  assert(
    !preprocessed.cleanedText.includes("054-1234567") &&
    !preprocessed.cleanedText.includes("0509988776") &&
    !preprocessed.cleanedText.includes("+972-52-3344556"),
    "Phone numbers are completely redacted from input"
  );
  assert(
    preprocessed.cleanedText.includes("[מספר]"),
    "Redacted phone numbers replaced with '[מספר]'"
  );
  assert(
    preprocessed.phoneNumbersRedactedCount >= 3,
    `Accurately detected phone numbers (found ${preprocessed.phoneNumbersRedactedCount})`
  );

  // 2. Truncation test (PRD 6.2)
  const longText = "A".repeat(100000) + "MIDDLE" + "B".repeat(100000) + "THE_END_CLIMAX";
  const truncatedResult = preprocessChatText(longText);
  assert(
    truncatedResult.isTruncated === true && truncatedResult.cleanedText.length <= 150000,
    "Long text is truncated to <= 150,000 characters"
  );
  assert(
    truncatedResult.cleanedText.includes("THE_END_CLIMAX"),
    "Truncation preserves the climax/end of the chat (last 150k characters)"
  );

  // 3. Database & Security Leaks Test (PRD 1.0, 6.4, 6.6, 14)
  const testId = uuidv4();
  const testToken = crypto.randomBytes(24).toString("hex");
  const secretPaidContent = "THIS_IS_VERY_SECRET_PAID_CONTENT_12345";

  createSummaryRecord({
    id: testId,
    access_token: testToken,
    title: "בדיקת אבטחה וכותרת",
    free_text: "פתיח חינמי ופומבי",
    paid_text: secretPaidContent,
  });

  // 3a. Teaser query MUST NOT return paid_text
  const teaser = getSummaryTeaser(testId);
  assert(teaser !== null, "Teaser record retrieved successfully");
  assert(
    (teaser as any).paid_text === undefined,
    "CRITICAL SECURITY: getSummaryTeaser does NOT contain paid_text"
  );
  assert(teaser?.paid === false, "Summary starts with paid = false");

  // 3b. Querying full summary before payment MUST return null (denied)
  const fullBeforePay = getSummaryFull(testId, testToken);
  assert(
    fullBeforePay === null,
    "SECURITY: getSummaryFull before payment returns null (denied)"
  );

  // 3c. Querying full summary with wrong token MUST return null
  const fullWrongToken = getSummaryFull(testId, "invalid_token_xyz");
  assert(
    fullWrongToken === null,
    "SECURITY: getSummaryFull with invalid token returns null (denied)"
  );

  // 3d. Update payment via simulated webhook
  updateSummaryPaid(testId, `stripe_session_test_${Date.now()}`);
  const teaserAfterPay = getSummaryTeaser(testId);
  assert(teaserAfterPay?.paid === true, "Summary marked paid after webhook update");

  // 3e. Now full summary with valid token is accessible
  const fullAfterPay = getSummaryFull(testId, testToken);
  assert(
    fullAfterPay !== null && fullAfterPay.paid_text === secretPaidContent,
    "SECURITY: Full paid content successfully accessed ONLY after valid payment + token"
  );

  // 4. Expiration cleanup test (PRD 8 & 14)
  const cleanedCount = cleanupExpiredSummaries();
  assert(typeof cleanedCount === "number", "Expired records cleanup ran without error");

  console.log("==========================================");
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
