export type ChatContext = "couple" | "friends" | "best_friends" | "family";
export type ChatPlatform = "whatsapp" | "imessage" | "telegram" | "other";

export interface ParticipantStat {
  name: string;
  count: number;
  percentage: number;
  words?: number;
  isUser?: boolean;
}

// ─────────────────────────────────────────────
// UNIFIED CHAT ROAST REPORT (free + premium)
// ─────────────────────────────────────────────

export interface AnalysisMetadata {
  inferred_relationship: string;
  grammar_used: string;
}

export interface ProofQuote {
  sender: string;
  context: string;
  text: string;
}

export interface DynamicAnalysis {
  section_title: string;
  intro_text: string;
  proof_quotes: ProofQuote[];
  punchline_text: string;
}

export interface UserRoastProfile {
  user_name: string;
  roast_title: string;
  psychological_analysis: string;
}

export interface FreeContent {
  headline: string;
  opening_intro: string;
  dynamic_analysis: DynamicAnalysis;
  primary_user_profile: UserRoastProfile;
}

export interface ToxicTrait {
  trait_name: string;
  explanation: string;
}

export interface PremiumContent {
  secondary_user_profile: UserRoastProfile;
  toxic_traits: ToxicTrait[];
  the_unspoken_truth: string;
  final_verdict: string;
}

export interface ChatRoastReport {
  analysis_metadata: AnalysisMetadata;
  free_content: FreeContent;
  paywall_teasers: string[];
  premium_content: PremiumContent;
  stats?: {
    totalMessages: number;
    participants: ParticipantStat[];
  };
}

// ─────────────────────────────────────────────
// DB & API RESPONSE TYPES
// ─────────────────────────────────────────────

export interface SummaryRecord {
  id: string;
  access_token: string;
  title: string;
  free_text: string;
  paid_text: string;
  paid: number;
  stripe_session_id: string | null;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
  email?: string | null;
}

export interface TeaserResponseData {
  id: string;
  title: string;
  intro: string;
  analysis_metadata?: AnalysisMetadata;
  free_content?: FreeContent;
  paywall_teasers?: string[];
  stats: {
    totalMessages: number;
    participants: ParticipantStat[];
  } | null;
  premium_content?: PremiumContent;
  paid: boolean;
  created_at: string;
  token?: string;
  pendingWebhook?: boolean;
}
