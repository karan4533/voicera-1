// ── Agent Types ────────────────────────────────────────────────────────────────

export type AgentType =
  | "restaurant"
  | "loan"
  | "shop"
  | "customer-support"
  | "healthcare"
  | "real-estate"
  | "insurance"
  | "hr"
  | "banking"
  | "custom";

export type AgentStatus = "active" | "paused" | "draft" | "archived";

export interface AgentDefinition {
  id: string;
  name: string;
  type: AgentType;
  category: string;
  description: string;
  icon: string;
  color: string;
  status: AgentStatus;
  stats: {
    callsToday: number;
    resolutionRate: number;
    avgDuration: string;
  };
  knowledgeBaseId?: string;
  tone?: string;
  languages?: string[];
  createdAt: string;
}

export type CallStatus = "Active" | "Ringing" | "Hold" | "Completed";

// ── Call Reminders ─────────────────────────────────────────────────────────────

export type ReminderDomain =
  | "restaurant"
  | "loan"
  | "shop"
  | "customer-support"
  | "healthcare"
  | "real-estate"
  | "insurance"
  | "hr"
  | "banking"
  | "custom";

export type ReminderStatus = "pending" | "calling" | "completed" | "no-answer" | "rescheduled";

export interface ReminderCallHistory {
  id: string;
  calledAt: string;
  duration: string;
  outcome: string;
  summary: string;
}

export interface ReminderContact {
  id: string;
  name: string;
  phone: string;
  location: string;
  priority: "High" | "Normal" | "Low";
  tags: string[];
  notes: string;
  domain: ReminderDomain;
  status: ReminderStatus;
  scheduledAt: string | null;
  /** Domain-specific dynamic fields — rendered generically, no per-domain UI needed */
  attributes: Record<string, string | number | boolean>;
  callHistory: ReminderCallHistory[];
  attemptNumber: number;
  totalAttempts: number;
}


// ── Live Call Session ──────────────────────────────────────────────────────────

export interface TranscriptTurn {
  id: string;
  speaker: "AI" | "Customer";
  text: string;
  timestamp: string;
}

export interface LiveCallSession {
  contactId: string;
  contact: ReminderContact;
  startedAt: number;
  status: "dialing" | "active" | "hold" | "ending";
  sentiment: number;       // 0–1 (e.g. 0.72 = 72% Positive)
  engagement: number;      // 0–1 (e.g. 0.85 = 85%)
  nluConfidence: number;   // 0–1
  aiSpeaking: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  autoSummarize: boolean;
  transcript: TranscriptTurn[];
}

export interface ActiveCall {
  id: string;
  callerId: string;
  name: string;
  startedAt: number;
  agent: string;
  language: string;
  status: CallStatus;
}

export interface CompletedCall {
  id: string;
  callerId: string;
  name: string;
  duration: string;
  agent: string;
  language: string;
  outcome: string;
  completedAt: string;
}

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CallDetail {
  id: string;
  callerId: string;
  name: string;
  duration: string;
  agent: string;
  language: string;
  outcome: string;
  date: string;
  sentiment: number;
  transcript: string;
  summary: string;
  actionItems: ActionItem[];
}

export type IndexStatus = "pending" | "indexing" | "indexed" | "error";

export interface KnowledgeFile {
  id: string;
  name: string;
  category: "menu" | "faq" | "product" | "policy" | "custom";
  format: string;
  size: string;
  status: IndexStatus;
  uploadedAt: string;
  agentId?: string;
}

export type SyncStatus = "connected" | "syncing" | "error" | "disconnected";

export interface DataSource {
  id: string;
  name: string;
  description: string;
  status: SyncStatus;
  lastSync: string;
}

export interface CampaignCustomer {
  id: string;
  name: string;
  phone: string;
  amountDue: number;
  dpdBucket: string;
  status: "pending" | "completed" | "committed" | "no-answer" | "escalated";
  attempts: number;
}

export type CampaignState = "idle" | "running" | "paused" | "stopped";

export interface CampaignStats {
  completed: number;
  committed: number;
  noAnswer: number;
  escalated: number;
  pending: number;
  total: number;
}

export interface AppSettings {
  sipProvider: string;
  concurrentChannels: number;
  inboundDid: string;
  callRecording: boolean;
  sttEngine: string;
  ttsEngine: string;
  llmModel: string;
  languages: string[];
  agentTone: string;
  maxTurnsBeforeEscalation: number;
  silenceTimeout: number;
  escalationFallback: string;
  callingWindowStart: string;
  callingWindowEnd: string;
  maxDailyAttempts: number;
  retryInterval: number;
  outboundConcurrency: number;
  postCallSms: boolean;
  traiDndCheck: boolean;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  activeCalls: number;
  avgLatency: number;
}

export interface DashboardMetrics {
  totalCalls: number;
  activeCalls: number;
  connectedCalls: number;
  pendingFollowUps: number;
  todayCalls: number;
  avgDuration: string;
  resolutionRate: number;
  escalationCount: number;
  activeChannels: number;
  avgLatency: number;
}

export interface AnalyticsMetrics {
  avgDuration: string;
  sentimentTrend: string;
  escalationCount: number;
  csatScore: number;
}

export interface CallVolumePoint {
  day: string;
  calls: number;
  resolved: number;
}

export interface SentimentPoint {
  day: string;
  score: number;
}

export interface LanguageDistribution {
  language: string;
  count: number;
  percentage: number;
}

export interface ClientDomain {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: "active" | "draft";
}

export interface ExtractedEntity {
  id: string;
  type: "Lead" | "Booking" | "Order" | "Enquiry" | "Payment";
  customerName: string;
  contact: string;
  attributes: Record<string, string | number>;
  status: "Pending" | "Synced" | "Action Required";
  timestamp: string;
  callId?: string;
  summary?: string;
  transcript?: string;
}

// ── CSV Import ─────────────────────────────────────────────────────────────────

export interface CsvProductRow {
  itemName: string;
  category: string;
  price: string;
  description: string;
  availability: string;
  sku: string;
}
