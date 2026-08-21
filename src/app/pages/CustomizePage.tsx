import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Plus, Trash2, Save, UtensilsCrossed, MessageSquareDashed,
  X, CheckCircle2, Users, ClipboardList, Phone, GripVertical, Rocket, Upload,
} from "lucide-react";
import { PageHeader } from "../components/shared/PageHeader";
import { useAgent, AGENT_TYPES } from "../context/AgentContext";
import type { AgentType } from "../lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, description, action, children,
}: {
  icon: React.ElementType; title: string; description: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#EDE4D8] flex items-center justify-center shrink-0">
            <Icon size={15} className="text-[#50381F]" />
          </div>
          <div>
            <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">{title}</h2>
            <p className="m-0 text-[11px] text-[#9E9890]">{description}</p>
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function SaveBtn({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg border-none bg-[#50381F] text-[12px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors"
    >
      {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
      {saved ? "Saved!" : "Save"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTAURANT — types & data
// ─────────────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string; name: string; category: string;
  price: string; description: string; available: boolean;
}

const MENU_CATEGORIES = ["All", "Breakfast", "Main Course", "Starters", "Beverages", "Desserts", "Specials"];

const INITIAL_MENU: MenuItem[] = [
  { id: "1",  name: "Masala Dosa",    category: "Breakfast",   price: "₹120", description: "Crispy rice crepe with spiced potato filling", available: true  },
  { id: "2",  name: "Idli Sambar",    category: "Breakfast",   price: "₹80",  description: "Steamed rice cakes with lentil soup",          available: true  },
  { id: "3",  name: "Butter Chicken", category: "Main Course", price: "₹320", description: "Creamy tomato-based chicken curry",            available: true  },
  { id: "4",  name: "Dal Tadka",      category: "Main Course", price: "₹180", description: "Yellow lentils tempered with spices",          available: true  },
  { id: "5",  name: "Paneer Tikka",   category: "Starters",    price: "₹220", description: "Grilled cottage cheese with peppers",          available: true  },
  { id: "6",  name: "Samosa (2 pcs)", category: "Starters",    price: "₹60",  description: "Fried pastry with spiced potato filling",      available: false },
  { id: "7",  name: "Mango Lassi",    category: "Beverages",   price: "₹90",  description: "Chilled yogurt drink with fresh mango",        available: true  },
  { id: "8",  name: "Masala Chai",    category: "Beverages",   price: "₹40",  description: "Spiced Indian milk tea",                      available: true  },
  { id: "9",  name: "Gulab Jamun",    category: "Desserts",    price: "₹70",  description: "Soft milk dumplings in rose syrup",            available: true  },
  { id: "10", name: "Chef's Thali",   category: "Specials",    price: "₹450", description: "Complete meal with rotating daily specials",   available: true  },
];

// Add item modal
function AddMenuItemModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (item: Omit<MenuItem, "id">) => void;
}) {
  const [name, setName]               = useState("");
  const [category, setCategory]       = useState("Main Course");
  const [price, setPrice]             = useState("");
  const [description, setDescription] = useState("");
  const [available, setAvailable]     = useState(true);
  const [error, setError]             = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())  { setError("Item name is required."); return; }
    if (!price.trim()) { setError("Price is required."); return; }
    onAdd({ name: name.trim(), category, price: price.trim(), description: description.trim(), available });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF] shrink-0">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-[#1E1A14]">Add Menu Item</h2>
            <p className="m-0 mt-0.5 text-[11px] text-[#9E9890]">Add a new item to your menu</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#E2DDD5] border-none bg-transparent cursor-pointer">
            <X size={16} className="text-[#7A746C]" />
          </button>
        </div>
        <form id="add-menu-form" onSubmit={submit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {error && <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-3 py-2 text-[12px] text-[#DC2626] shrink-0">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Item Name</label>
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Biryani"
                className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white cursor-pointer transition-colors">
                {MENU_CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Price</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. ₹250"
                className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description"
                className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white transition-colors" />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input id="avail" type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: "#50381F", cursor: "pointer" }} />
              <label htmlFor="avail" className="text-[13px] text-[#1E1A14] cursor-pointer">Available</label>
            </div>
          </div>
        </form>
        <div className="shrink-0 border-t border-[#E2DDD5] px-6 py-4 flex gap-3 bg-[#FDFDFD]">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-[#E2DDD5] bg-white text-[13px] font-medium text-[#1E1A14] cursor-pointer hover:bg-[#F7F4EF] transition-colors">Cancel</button>
          <button type="submit" form="add-menu-form" className="flex-1 h-9 rounded-lg border-none bg-[#50381F] text-[13px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors">Add Item</button>
        </div>
      </div>
    </div>
  );
}

// Restaurant Customize view
function RestaurantCustomize() {
  const [items, setItems]                 = useState<MenuItem[]>(INITIAL_MENU);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showModal, setShowModal]         = useState(false);
  const [instructions, setInstructions]   = useState(
    "Greet the customer warmly by saying: \"Hello! Welcome to our restaurant. I'm your AI assistant and I'm happy to help you with orders, reservations, or any questions about our menu. How can I assist you today?\"\n\nAlways confirm the order before ending the call. If an item is unavailable, suggest the closest alternative."
  );
  const [savedInstr, setSavedInstr]       = useState(false);

  const filtered = activeCategory === "All" ? items : items.filter(i => i.category === activeCategory);

  const RESTAURANT_HINTS = ["Greet by name", "Mention daily specials", "Upsell desserts", "Confirm order before ending", "Speak slowly and clearly"];

  return (
    <>
      {/* Menu Items */}
      <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#EDE4D8] flex items-center justify-center shrink-0">
              <UtensilsCrossed size={15} className="text-[#50381F]" />
            </div>
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Menu Items</h2>
              <p className="m-0 text-[11px] text-[#9E9890]">{items.length} items · {items.filter(i => i.available).length} available</p>
            </div>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border-none bg-[#50381F] text-[12px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors">
            <Plus size={13} /> Add Item
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[#F0EDE8] overflow-x-auto">
          {MENU_CATEGORIES.map(cat => {
            const count = cat === "All" ? items.length : items.filter(i => i.category === cat).length;
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  activeCategory === cat ? "bg-[#50381F] text-white border-[#50381F]" : "bg-white text-[#7A746C] border-[#E2DDD5] hover:border-[#C9B99E]"
                }`}>
                {cat} <span className={`text-[10px] font-bold px-0.5 ${activeCategory === cat ? "text-white/70" : "text-[#9E9890]"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F7F4EF]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Item</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider hidden sm:table-cell">Category</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Price</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider hidden md:table-cell">Description</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#9E9890]">No items in this category.</td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className="border-t border-[#F0EDE8] hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-5 py-3"><p className="m-0 text-[13px] font-semibold text-[#1E1A14]">{item.name}</p></td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-[11px] font-medium text-[#7A746C] bg-[#F7F4EF] px-2 py-0.5 rounded-md">{item.category}</span>
                  </td>
                  <td className="px-3 py-3">
                    <input
                      value={item.price}
                      onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, price: e.target.value } : i))}
                      className="w-20 text-[13px] font-bold text-[#50381F] bg-transparent border-none outline-none hover:bg-[#F0EDE8] focus:bg-[#F0EDE8] focus:ring-1 focus:ring-[#C9B99E] rounded px-1 py-0.5 transition-colors"
                    />
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell"><p className="m-0 text-[12px] text-[#7A746C] max-w-[220px] truncate">{item.description}</p></td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => setItems(prev => prev.map(i => i.id === item.id ? { ...i, available: !i.available } : i))}
                      className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer border-none transition-colors ${
                        item.available ? "bg-[#DCFCE7] text-[#16A34A] hover:bg-[#BBF7D0]" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                      }`}>
                      {item.available ? "Available" : "Out of Stock"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-[#FEE2E2] text-[#9E9890] hover:text-[#DC2626] transition-colors border-none bg-transparent cursor-pointer">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Instructions */}
      <SectionCard
        icon={MessageSquareDashed}
        title="Custom Agent Instructions"
        description="Define how the agent greets and communicates with customers"
        action={<SaveBtn saved={savedInstr} onClick={() => { setSavedInstr(true); setTimeout(() => setSavedInstr(false), 2500); }} />}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {RESTAURANT_HINTS.map(hint => (
              <button key={hint} onClick={() => setInstructions(p => p + `\n• ${hint}.`)}
                className="h-7 px-3 rounded-full border border-[#E2DDD5] bg-[#F7F4EF] text-[11px] font-medium text-[#7A746C] cursor-pointer hover:border-[#C9B99E] hover:text-[#50381F] transition-colors">
                + {hint}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Instructions</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={8}
              className="w-full border border-[#E2DDD5] rounded-lg px-4 py-3 text-[13px] text-[#1E1A14] leading-relaxed outline-none focus:border-[#50381F] transition-colors bg-white resize-none" />
            <p className="text-[11px] text-[#9E9890]">Write instructions in plain English. The agent will follow these precisely during every call.</p>
          </div>
        </div>
      </SectionCard>

      {showModal && <AddMenuItemModal onClose={() => setShowModal(false)} onAdd={item => setItems(prev => [{ ...item, id: Date.now().toString() }, ...prev])} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI FEEDBACK — types & data
// ─────────────────────────────────────────────────────────────────────────────

interface Contact { id: string; name: string; phone: string; segment: string; status: "pending" | "called" | "unreachable"; }
interface FeedbackQuestion { id: string; question: string; type: "rating" | "yesno" | "open"; }

const INITIAL_CONTACTS: Contact[] = [
  { id: "1", name: "Priya Sharma",   phone: "+91 98765 43210", segment: "Premium",  status: "pending"     },
  { id: "2", name: "Rahul Gupta",    phone: "+91 87654 32109", segment: "Standard", status: "called"      },
  { id: "3", name: "Anjali Mehta",   phone: "+91 76543 21098", segment: "Premium",  status: "pending"     },
  { id: "4", name: "Vikram Singh",   phone: "+91 65432 10987", segment: "Standard", status: "unreachable" },
  { id: "5", name: "Neha Joshi",     phone: "+91 54321 09876", segment: "VIP",      status: "pending"     },
  { id: "6", name: "Arjun Patel",    phone: "+91 43210 98765", segment: "VIP",      status: "called"      },
];

const INITIAL_QUESTIONS: FeedbackQuestion[] = [
  { id: "1", question: "On a scale of 1–10, how satisfied are you with our service?",           type: "rating" },
  { id: "2", question: "Would you recommend us to a friend or colleague?",                       type: "yesno"  },
  { id: "3", question: "Was your issue resolved on the first call?",                             type: "yesno"  },
  { id: "4", question: "What could we do to improve your experience?",                           type: "open"   },
];

function AddContactModal({ onClose, onAdd }: { onClose: () => void; onAdd: (c: Omit<Contact, "id" | "status">) => void }) {
  const [name, setName]         = useState("");
  const [phone, setPhone]       = useState("");
  const [segment, setSegment]   = useState("Standard");
  const [error, setError]       = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())  { setError("Name is required."); return; }
    if (!phone.trim()) { setError("Phone is required."); return; }
    onAdd({ name: name.trim(), phone: phone.trim(), segment });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF] shrink-0">
          <div>
            <h2 className="m-0 text-[15px] font-bold text-[#1E1A14]">Add Contact</h2>
            <p className="m-0 mt-0.5 text-[11px] text-[#9E9890]">Add a customer to the feedback call list</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[#E2DDD5] border-none bg-transparent cursor-pointer">
            <X size={16} className="text-[#7A746C]" />
          </button>
        </div>
        <form id="add-contact-form" onSubmit={submit} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {error && <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-3 py-2 text-[12px] text-[#DC2626] shrink-0">{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Full Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya Sharma"
              className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
              className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white transition-colors" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#7A746C] uppercase tracking-wider">Segment</label>
            <select value={segment} onChange={e => setSegment(e.target.value)}
              className="h-10 border border-[#E2DDD5] rounded-lg px-3 text-[13px] outline-none focus:border-[#50381F] bg-white cursor-pointer transition-colors">
              {["Standard", "Premium", "VIP"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </form>
        <div className="shrink-0 border-t border-[#E2DDD5] px-6 py-4 flex gap-3 bg-[#FDFDFD]">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-[#E2DDD5] bg-white text-[13px] font-medium cursor-pointer hover:bg-[#F7F4EF] transition-colors">Cancel</button>
          <button type="submit" form="add-contact-form" className="flex-1 h-9 rounded-lg border-none bg-[#50381F] text-[13px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors">Add Contact</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP = {
  pending:     { label: "Pending",     color: "#D97706", bg: "#FEF3C7" },
  called:      { label: "Called",      color: "#16A34A", bg: "#DCFCE7" },
  unreachable: { label: "Unreachable", color: "#DC2626", bg: "#FEE2E2" },
} as const;

const Q_TYPE_LABEL = { rating: "1–10 Rating", yesno: "Yes / No", open: "Open Text" };
const Q_TYPE_COLOR = { rating: "#2563EB", yesno: "#16A34A", open: "#7C3AED" };

function FeedbackCustomize() {
  const [contacts, setContacts]         = useState<Contact[]>(INITIAL_CONTACTS);
  const [questions, setQuestions]       = useState<FeedbackQuestion[]>(INITIAL_QUESTIONS);
  const [showContactModal, setContactModal] = useState(false);
  const [newQ, setNewQ]                 = useState("");
  const [newQType, setNewQType]         = useState<FeedbackQuestion["type"]>("rating");
  const [filterSeg, setFilterSeg]       = useState("All");
  const [script, setScript]             = useState(
    "Hello, am I speaking with {customer_name}? Great! I'm calling on behalf of our team to get your feedback on your recent experience with us.\n\nThis will only take 2–3 minutes. Is this a good time to talk?\n\n[If yes] Wonderful! Let me get started with a few quick questions.\n[If no] No problem! When would be a better time to call you back?"
  );
  const [savedScript, setSavedScript]   = useState(false);

  const segments = ["All", "Standard", "Premium", "VIP"];
  const filteredContacts = filterSeg === "All" ? contacts : contacts.filter(c => c.segment === filterSeg);

  const addQuestion = () => {
    if (!newQ.trim()) return;
    setQuestions(prev => [...prev, { id: Date.now().toString(), question: newQ.trim(), type: newQType }]);
    setNewQ("");
  };

  return (
    <>
      {/* Contact List */}
      <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF]">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#EDE4D8] flex items-center justify-center shrink-0">
              <Users size={15} className="text-[#50381F]" />
            </div>
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Contact List</h2>
              <p className="m-0 text-[11px] text-[#9E9890]">
                {contacts.length} contacts · {contacts.filter(c => c.status === "pending").length} pending calls
              </p>
            </div>
          </div>
          <button onClick={() => setContactModal(true)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border-none bg-[#50381F] text-[12px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors">
            <Plus size={13} /> Add Contact
          </button>
        </div>

        {/* Segment filter */}
        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-[#F0EDE8]">
          {segments.map(seg => {
            const count = seg === "All" ? contacts.length : contacts.filter(c => c.segment === seg).length;
            return (
              <button key={seg} onClick={() => setFilterSeg(seg)}
                className={`flex items-center gap-1 h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  filterSeg === seg ? "bg-[#50381F] text-white border-[#50381F]" : "bg-white text-[#7A746C] border-[#E2DDD5] hover:border-[#C9B99E]"
                }`}>
                {seg} <span className={`text-[10px] font-bold ${filterSeg === seg ? "text-white/70" : "text-[#9E9890]"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Contact table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F7F4EF]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Name</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="px-3 py-3 text-left text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Segment</th>
                <th className="px-3 py-3 text-center text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#9E9890] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-[13px] text-[#9E9890]">No contacts in this segment.</td></tr>
              )}
              {filteredContacts.map(contact => {
                const s = STATUS_MAP[contact.status];
                return (
                  <tr key={contact.id} className="border-t border-[#F0EDE8] hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-5 py-3">
                      <p className="m-0 text-[13px] font-semibold text-[#1E1A14]">{contact.name}</p>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#7A746C]">
                        <Phone size={11} className="text-[#9E9890]" /> {contact.phone}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-medium text-[#7A746C] bg-[#F7F4EF] px-2 py-0.5 rounded-md">{contact.segment}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span style={{ fontSize: 11, fontWeight: 600, color: s.color, backgroundColor: s.bg, padding: "2px 8px", borderRadius: 12 }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setContacts(prev => prev.filter(c => c.id !== contact.id))}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-[#FEE2E2] text-[#9E9890] hover:text-[#DC2626] transition-colors border-none bg-transparent cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feedback Questions */}
      <SectionCard icon={ClipboardList} title="Feedback Questions" description="Questions the agent will ask during each feedback call">
        <div className="flex flex-col gap-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="flex items-start gap-3 p-3 border border-[#E2DDD5] rounded-lg bg-[#FAFAF8]">
              <GripVertical size={14} className="text-[#C9B99E] mt-0.5 shrink-0" />
              <span className="text-[13px] font-semibold text-[#9E9890] shrink-0 w-5">{idx + 1}.</span>
              <p className="m-0 flex-1 text-[13px] text-[#1E1A14] leading-relaxed">{q.question}</p>
              <span style={{ fontSize: 10, fontWeight: 700, color: Q_TYPE_COLOR[q.type], backgroundColor: `${Q_TYPE_COLOR[q.type]}15`, padding: "2px 6px", borderRadius: 8, whiteSpace: "nowrap" }}>
                {Q_TYPE_LABEL[q.type]}
              </span>
              <button onClick={() => setQuestions(prev => prev.filter(x => x.id !== q.id))}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-[#FEE2E2] text-[#9E9890] hover:text-[#DC2626] transition-colors border-none bg-transparent cursor-pointer shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Add question */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <input value={newQ} onChange={e => setNewQ(e.target.value)} onKeyDown={e => e.key === "Enter" && addQuestion()}
              placeholder="Type a new question and press Add…"
              className="flex-1 h-9 border border-[#E2DDD5] rounded-lg px-3 text-[13px] text-[#1E1A14] outline-none focus:border-[#50381F] bg-white transition-colors" />
            <select value={newQType} onChange={e => setNewQType(e.target.value as FeedbackQuestion["type"])}
              className="h-9 border border-[#E2DDD5] rounded-lg px-2 text-[12px] text-[#1E1A14] outline-none focus:border-[#50381F] bg-white cursor-pointer transition-colors">
              <option value="rating">Rating</option>
              <option value="yesno">Yes/No</option>
              <option value="open">Open</option>
            </select>
            <button onClick={addQuestion} className="flex items-center justify-center gap-1 h-9 px-3 rounded-lg border-none bg-[#50381F] text-[12px] font-semibold text-white cursor-pointer hover:bg-[#3D2914] transition-colors whitespace-nowrap">
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Call Script */}
      <SectionCard
        icon={MessageSquareDashed}
        title="Agent Call Script"
        description="Opening script the agent reads at the start of every feedback call"
        action={<SaveBtn saved={savedScript} onClick={() => { setSavedScript(true); setTimeout(() => setSavedScript(false), 2500); }} />}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {["Introduce yourself", "Ask permission to record", "Thank for their time", "Offer callback option"].map(hint => (
              <button key={hint} onClick={() => setScript(p => p + `\n• ${hint}.`)}
                className="h-7 px-3 rounded-full border border-[#E2DDD5] bg-[#F7F4EF] text-[11px] font-medium text-[#7A746C] cursor-pointer hover:border-[#C9B99E] hover:text-[#50381F] transition-colors">
                + {hint}
              </button>
            ))}
          </div>
          <textarea value={script} onChange={e => setScript(e.target.value)} rows={8}
            className="w-full border border-[#E2DDD5] rounded-lg px-4 py-3 text-[13px] text-[#1E1A14] leading-relaxed outline-none focus:border-[#50381F] transition-colors bg-white resize-none font-mono" />
          <p className="text-[11px] text-[#9E9890]">Use <code className="bg-[#F7F4EF] px-1 rounded text-[#50381F]">{"{customer_name}"}</code> as a placeholder — it will be replaced with the actual contact name during the call.</p>
        </div>
      </SectionCard>

      {showContactModal && (
        <AddContactModal onClose={() => setContactModal(false)} onAdd={c => setContacts(prev => [{ ...c, id: Date.now().toString(), status: "pending" }, ...prev])} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export — agent-aware router
// ─────────────────────────────────────────────────────────────────────────────

export function CustomizePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { agent, agentLabel, setAgent, addAgentDef } = useAgent();
  const [launched, setLaunched] = useState(false);

  const templateParam = searchParams.get("template") as AgentType | null;
  const catalog = AGENT_TYPES.find((t) => t.id === (templateParam ?? agent)) ?? AGENT_TYPES[0];

  const [agentName, setAgentName] = useState(catalog.label);
  const [instructions, setInstructions] = useState(
    `You are a helpful voice agent for ${catalog.label}. Follow the use-case script, confirm details, and keep responses concise.`,
  );
  const [voice, setVoice] = useState("Professional & Clear");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [kbFiles, setKbFiles] = useState<string[]>([]);

  useEffect(() => {
    if (templateParam && AGENT_TYPES.some((t) => t.id === templateParam)) {
      setAgent(templateParam);
      const c = AGENT_TYPES.find((t) => t.id === templateParam)!;
      setAgentName(c.label);
      setInstructions(
        `You are a helpful voice agent for ${c.label}. Follow the use-case script, confirm details, and keep responses concise.`,
      );
    }
  }, [templateParam, setAgent]);

  const isRestaurant = agent === "restaurant";

  const toggleLanguage = (lang: string) => {
    setLanguages((prev) =>
      prev.includes(lang) ? (prev.length === 1 ? prev : prev.filter((l) => l !== lang)) : [...prev, lang],
    );
  };

  const handleKbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setKbFiles((prev) => [...prev, ...files.map((f) => f.name)]);
    e.target.value = "";
  };

  const handleLaunch = () => {
    if (!catalog) return;
    addAgentDef({
      name: agentName.trim() || catalog.label,
      type: agent,
      category: catalog.category,
      description: instructions.trim() || catalog.description,
      icon: catalog.icon,
      color: catalog.color,
      status: "active",
      tone: voice,
      languages,
    });
    setLaunched(true);
    setTimeout(() => navigate("/dashboard/agents"), 800);
  };

  const VOICES = [
    "Professional & Clear",
    "Friendly & Warm",
    "Professional & Empathetic",
    "Energetic & Concise",
  ];
  const LANG_OPTIONS = ["English", "Hindi", "Tamil", "Telugu", "Gujarati", "Marathi"];

  return (
    <>
      <PageHeader
        title="Configure & Launch"
        subtitle="Agent name, custom instructions, voice, language, and knowledge base — then launch to My Agents"
        action={
          <button
            type="button"
            onClick={handleLaunch}
            disabled={launched}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border-none bg-[#50381F] text-white text-[13px] font-semibold cursor-pointer hover:bg-[#3D2914] disabled:opacity-70"
          >
            {launched ? <CheckCircle2 size={14} /> : <Rocket size={14} />}
            {launched ? "Launched!" : "Launch agent"}
          </button>
        }
      />

      <div className="mb-5 rounded-lg border border-[rgba(181,118,58,0.3)] bg-[rgba(181,118,58,0.08)] px-3 py-2 text-[12.5px] text-[#b5763a]">
        Config + Launch → new instance appears under My Agents
      </div>

      <div className="flex flex-col gap-5">
        {/* Shared PRD config fields */}
        <div className="bg-white border border-[#E2DDD5] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2DDD5] bg-[#F7F4EF]">
            <h2 className="m-0 text-[14px] font-semibold text-[#1E1A14]">Agent configuration</h2>
            <p className="m-0 text-[11px] text-[#9E9890]">Required fields before launch</p>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Agent name</label>
              <input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full h-10 px-3 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:border-[#C9B99E]"
                placeholder="e.g. Spice Garden Dinner Orders"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Custom instructions / prompt</label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-[13px] border border-[#E2DDD5] rounded-lg focus:outline-none focus:border-[#C9B99E] resize-y"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Voice</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full h-10 px-3 text-[13px] border border-[#E2DDD5] rounded-lg bg-white focus:outline-none focus:border-[#C9B99E]"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Languages</label>
              <div className="flex flex-wrap gap-1.5">
                {LANG_OPTIONS.map((lang) => {
                  const on = languages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`h-8 px-2.5 rounded-lg text-[12px] font-medium border cursor-pointer ${
                        on
                          ? "bg-[#50381F] text-white border-[#50381F]"
                          : "bg-white text-[#7A746C] border-[#E2DDD5]"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-[#7A746C] mb-1.5">Knowledge base upload</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E2DDD5] bg-white text-[13px] font-medium text-[#1E1A14] cursor-pointer hover:bg-[#F7F4EF]">
                  <Upload size={14} />
                  Upload files
                  <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx" className="hidden" onChange={handleKbUpload} />
                </label>
                {kbFiles.length === 0 ? (
                  <span className="text-[12px] text-[#9E9890]">PDF, DOCX, TXT, CSV, XLSX</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {kbFiles.map((f) => (
                      <span key={f} className="text-[11px] font-medium bg-[#EDE4D8] text-[#50381F] px-2 py-1 rounded-md">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {isRestaurant ? <RestaurantCustomize /> : <FeedbackCustomize />}
      </div>
    </>
  );
}
