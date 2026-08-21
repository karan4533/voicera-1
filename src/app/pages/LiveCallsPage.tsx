import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  Search, PhoneOff, Headphones, CheckCircle2, Activity, ChevronLeft
} from "lucide-react";
import { useAgent } from "../context/AgentContext";

// ── Types & Mock Data Generators ─────────────────────────────────────────────

interface TranscriptTurn {
  id: string;
  speaker: "Customer" | "Agent";
  text: string;
  timestamp: string;
}

interface MonitorCall {
  id: string;
  customerName: string;
  phone: string;
  agentType: string;
  language: string;
  startedAt: number;
  status: "Active" | "Hold" | "Ringing" | "Escalated";
  sentimentScore: number;
  latencyMs: number;
  resolutionPrediction: number;
  transcript: TranscriptTurn[];
}

const FIRST_NAMES = ["Rahul", "Priya", "Amit", "Sneha", "Vikram", "Neha", "Arjun", "Anjali", "Suresh", "Meena", "Karan", "Lakshmi"];
const LAST_NAMES = ["Sharma", "Gupta", "Patel", "Singh", "Joshi", "Nair", "Krishnan", "Mehta", "Iyer", "Rao"];
const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Marathi", "Gujarati"];

function generateMockPhone() {
  return `+91 9${Math.floor(Math.random() * 800000000 + 100000000)}`;
}

function generateMockCalls(count: number, agentLabel: string): MonitorCall[] {
  const calls: MonitorCall[] = [];
  for (let i = 0; i < count; i++) {
    const fName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const isHold = Math.random() > 0.85;
    const isEscalated = !isHold && Math.random() > 0.9;
    
    calls.push({
      id: `call-${i + 1}`,
      customerName: `${fName} ${lName}`,
      phone: generateMockPhone(),
      agentType: agentLabel,
      language: LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
      startedAt: Date.now() - Math.floor(Math.random() * 300000), // up to 5 mins ago
      status: isEscalated ? "Escalated" : isHold ? "Hold" : "Active",
      sentimentScore: 0.3 + Math.random() * 0.7, // 0.3 - 1.0
      latencyMs: 380 + Math.floor(Math.random() * 150),
      resolutionPrediction: 0.4 + Math.random() * 0.5,
      transcript: [
        { id: `t1-${i}`, speaker: "Agent", text: `Hello, am I speaking with ${fName}?`, timestamp: "00:05" },
        { id: `t2-${i}`, speaker: "Customer", text: "Yes, this is me. How can I help?", timestamp: "00:12" },
      ]
    });
  }
  return calls;
}

const CHAT_PHRASES = {
  Customer: [
    "Yes, that sounds right.",
    "Could you repeat that?",
    "I want to order chicken biryani.",
    "No, I don't think so.",
    "How long will it take?",
    "Can you help me with my EMI payment?",
    "I need to talk to a human.",
    "Thank you.",
    "What are the charges for that?"
  ],
  Agent: [
    "I can definitely help you with that.",
    "Let me pull up your account details.",
    "Sure. How many portions would you like?",
    "Your order has been confirmed.",
    "I have sent the payment link to your registered number.",
    "Please hold on for a moment while I check.",
    "Is there anything else I can assist you with today?",
    "Our delivery executive will reach you in 30 minutes."
  ]
};

// ── Components ───────────────────────────────────────────────────────────────

function formatTimer(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: MonitorCall["status"] }) {
  if (status === "Active") return <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Active</span>;
  if (status === "Hold") return <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> On Hold</span>;
  if (status === "Escalated") return <span className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> Escalated</span>;
  return <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Ringing</span>;
}

export function LiveCallsPage() {
  const [searchParams] = useSearchParams();
  const startId = searchParams.get("start");

  const { agentLabel } = useAgent();

  // State
  const [calls, setCalls] = useState<MonitorCall[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  
  const [searchTerm, setSearchTerm] = useState("");

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Init mock data
  useEffect(() => {
    let initial = generateMockCalls(12, agentLabel);
    
    // Support outbound Call Scheduler start flow
    if (startId) {
      const scheduled: MonitorCall = {
        id: `call-scheduled-${startId}`,
        customerName: "Scheduled Contact",
        phone: "+91 99999 88888",
        agentType: "Outbound Agent",
        language: "English",
        startedAt: Date.now(),
        status: "Active",
        sentimentScore: 0.6,
        latencyMs: 350,
        resolutionPrediction: 0.8,
        transcript: [
          { id: "s1", speaker: "Agent", text: "Hello, this is an outbound call simulation.", timestamp: "00:01" }
        ]
      };
      initial = [scheduled, ...initial];
      setSelectedCallId(scheduled.id);
    } else {
      setSelectedCallId(window.innerWidth >= 768 ? initial[0].id : null);
    }
    
    setCalls(initial);
  }, [startId, agentLabel]);

  // Live Timer
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Simulating random chat activity
  useEffect(() => {
    const chatInterval = setInterval(() => {
      setCalls(prev => {
        const next = [...prev];
        // Pick a random active call to add a message
        const activeIdx = next.findIndex(c => c.status === "Active" && Math.random() > 0.8);
        if (activeIdx >= 0) {
          const call = { ...next[activeIdx] };
          const isCustomer = Math.random() > 0.5;
          const phrases = isCustomer ? CHAT_PHRASES.Customer : CHAT_PHRASES.Agent;
          const newText = phrases[Math.floor(Math.random() * phrases.length)];
          
          const durMs = Date.now() - call.startedAt;
          const ts = formatTimer(durMs);
          
          call.transcript = [...call.transcript, {
            id: `msg-${Date.now()}`,
            speaker: isCustomer ? "Customer" : "Agent",
            text: newText,
            timestamp: ts
          }];
          
          // Slight sentiment shift
          if (isCustomer && newText.includes("human")) call.sentimentScore = Math.max(0, call.sentimentScore - 0.2);
          if (!isCustomer) call.sentimentScore = Math.min(1, call.sentimentScore + 0.05);

          next[activeIdx] = call;
        }
        return next;
      });
    }, 2500);
    
    return () => clearInterval(chatInterval);
  }, []);

  // Auto-scroll transcript
  const selectedCall = calls.find(c => c.id === selectedCallId);
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedCall?.transcript.length]);

  // Filtering
  const filteredCalls = calls.filter(c => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return c.customerName.toLowerCase().includes(q) || c.phone.includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col md:flex-row -m-4 sm:-m-6 lg:-m-7 bg-[#F7F4EF]" style={{ height: "calc(100vh - 56px)" }}>
      
      {/* ── Left Panel (35%): Live Calls List ───────────────────────────── */}
      <div className={`w-full md:w-[35%] md:min-w-[320px] md:max-w-[400px] bg-white border-r-0 md:border-r border-[#D6CFC4] flex-col z-10 ${selectedCall ? "hidden md:flex" : "flex"}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-[#D6CFC4] bg-[#F7F4EF]">
          <h2 className="text-[16px] font-bold text-[#1E1A16] mb-1 flex items-center gap-2">
            Live Calls Monitor <span className="bg-[#50381F] text-white text-[11px] px-2 py-0.5 rounded-full">{calls.filter(c => c.status === "Active").length} Active</span>
          </h2>
          <p className="text-[12px] text-[#7A746C] mb-4">In-progress calls across all active agents</p>
          
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A746C]" />
              <input 
                type="text" 
                placeholder="Search by name or phone..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-[12px] bg-white border border-[#D6CFC4] rounded-lg outline-none focus:border-[#50381F]"
              />
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filteredCalls.map(call => {
            const isSelected = call.id === selectedCallId;
            const durationMs = Date.now() - call.startedAt;
            const sentimentColor = call.sentimentScore > 0.65 ? "#16A34A" : call.sentimentScore > 0.4 ? "#D97706" : "#DC2626";

            return (
              <div 
                key={call.id}
                onClick={() => setSelectedCallId(call.id)}
                className={`p-4 border-b border-[#E2DDD5] cursor-pointer transition-colors ${
                  isSelected ? "bg-[#ECE6D9] border-l-4 border-l-[#50381F]" : "bg-white hover:bg-[#FAFAF8] border-l-4 border-l-transparent"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-[14px] font-bold text-[#1E1A16]">{call.customerName}</h3>
                    <p className="text-[12px] text-[#7A746C] font-mono mt-0.5">{call.phone}</p>
                  </div>
                  <StatusBadge status={call.status} />
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                  <span className="flex items-center gap-1 text-[#7A746C] font-medium">
                    <Headphones size={12} /> {call.agentType}
                  </span>
                  <span className="text-[#9E9890]">•</span>
                  <span className="text-[#7A746C] font-medium">{call.language}</span>
                  
                  <div className="w-full flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-[#1E1A16]">{formatTimer(durationMs)}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sentimentColor }} />
                      <span className="font-medium" style={{ color: sentimentColor }}>
                        {call.sentimentScore > 0.65 ? "Positive" : call.sentimentScore > 0.4 ? "Neutral" : "Negative"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredCalls.length === 0 && (
            <div className="p-8 text-center text-[12px] text-[#7A746C]">No calls matching criteria</div>
          )}
        </div>
      </div>

      {/* ── Right Panel (65%): Transcript Monitor ───────────────────────── */}
      <div className={`flex-1 flex flex-col bg-[#ECE6D9] min-w-0 ${!selectedCall ? "hidden md:flex" : "flex"}`}>
        
        {selectedCall ? (() => {
          const durationMs = Date.now() - selectedCall.startedAt;
          
          return (
            <>
              {/* Call Insights Panel */}
              <div className="bg-white px-4 md:px-6 py-4 border-b border-[#D6CFC4] flex items-center justify-between shadow-sm z-10 shrink-0 gap-3">
                <div className="flex items-center gap-3 md:gap-6 min-w-0">
                  {/* Mobile Back Button */}
                  <button 
                    onClick={() => setSelectedCallId(null)}
                    className="md:hidden p-1.5 -ml-2 rounded-lg text-[#7A746C] hover:bg-[#F7F4EF] cursor-pointer shrink-0"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {/* Avatar */}
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#50381F] text-white flex items-center justify-center font-bold text-base md:text-lg shadow-inner shrink-0">
                    {selectedCall.customerName.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  
                  <div className="min-w-0">
                    <h1 className="text-[16px] md:text-[18px] font-bold text-[#1E1A16] mb-0.5 truncate">{selectedCall.customerName}</h1>
                    <div className="flex items-center gap-2 sm:gap-3 text-[11px] md:text-[12px] text-[#7A746C] font-medium">
                      <span className="truncate">{selectedCall.phone}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{selectedCall.language}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="text-[#50381F] bg-[#F7F4EF] px-2 py-0.5 rounded-md border border-[#E2DDD5] hidden sm:inline truncate">{selectedCall.agentType}</span>
                    </div>
                  </div>
                </div>

                {/* Live Stats */}
                <div className="flex items-center gap-6 text-[12px] shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[#7A746C] mb-0.5 uppercase tracking-wider text-[10px] font-bold">Duration</span>
                    <span className="font-mono font-bold text-[14px] text-[#1E1A16]">{formatTimer(durationMs)}</span>
                  </div>
                </div>
              </div>

              {/* Chat Transcript Area */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-thin flex flex-col gap-4 relative">
                
                {/* Watermark/Background texture */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
                  <Activity size={240} />
                </div>

                <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
                  <div className="text-center my-2">
                    <span className="bg-[#E2DDD5] text-[#7A746C] text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full">
                      Call connected
                    </span>
                  </div>

                  {selectedCall.transcript.map(turn => {
                    const isAgent = turn.speaker === "Agent";
                    return (
                      <div key={turn.id} className={`flex w-full ${isAgent ? "justify-end" : "justify-start"}`}>
                        <div className={`flex flex-col ${isAgent ? "items-end" : "items-start"} max-w-[70%]`}>
                          <span className="text-[11px] font-semibold text-[#7A746C] mb-1 px-1">
                            {isAgent ? "AI Agent" : selectedCall.customerName.split(" ")[0]}
                          </span>
                          <div className={`px-4 py-2.5 text-[14px] leading-relaxed shadow-sm relative ${
                            isAgent 
                              ? "bg-[#50381F] text-white rounded-2xl rounded-tr-sm" 
                              : "bg-white text-[#1E1A16] border border-[#D6CFC4] rounded-2xl rounded-tl-sm"
                          }`}>
                            {turn.text}
                          </div>
                          <div className="text-[10px] text-[#9E9890] mt-1 px-1 font-mono">
                            {turn.timestamp} {isAgent && <CheckCircle2 size={10} className="inline ml-0.5 text-[#C9B99E]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={transcriptEndRef} className="h-4" />
                </div>
              </div>

              {/* Supervisor Controls Footer */}
              <div className="bg-white border-t border-[#D6CFC4] p-4 flex items-center justify-end shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
                  <button 
                    onClick={() => {
                      setCalls(prev => prev.filter(c => c.id !== selectedCall.id));
                      setSelectedCallId(calls.find(c => c.id !== selectedCall.id)?.id || null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#DC2626] text-white text-[12px] font-bold hover:bg-[#B91C1C] transition-colors"
                  >
                    <PhoneOff size={14} /> End Call
                  </button>
              </div>
            </>
          );
        })() : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-[#F7F4EF]">
            <div className="w-20 h-20 bg-[#ECE6D9] rounded-full flex items-center justify-center mb-6 shadow-inner border border-[#D6CFC4]">
              <Headphones size={32} className="text-[#7A746C]" />
            </div>
            <h2 className="text-[20px] font-bold text-[#1E1A16] mb-2">No Call Selected</h2>
            <p className="text-[14px] text-[#7A746C] max-w-md">
              Select an active call from the left panel to monitor the real-time transcript, latency, and sentiment.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
