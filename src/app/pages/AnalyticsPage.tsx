import { useEffect, useState } from "react";
import { Search, Download } from "lucide-react";
import { getAnalyticsMetrics, getCallDetails, toggleCallActionItem } from "../lib/api";
import type { CallDetail } from "../lib/types";
import { useAgent } from "../context/AgentContext";

import { PageHeader } from "../components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

export function AnalyticsPage() {
  const [metrics, setMetrics] = useState({
    avgDuration: "00:00",
    sentimentTrend: "+0.0%",
    escalationCount: 0,
    csatScore: 0,
  });

  const [calls, setCalls] = useState<CallDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const { agent, agentLabel } = useAgent();

  // Filters
  const [search, setSearch] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  // Selection for Sheet
  const [selectedCall, setSelectedCall] = useState<CallDetail | null>(null);

  useEffect(() => {
    getAnalyticsMetrics(agent).then(setMetrics);
  }, [agent]);

  useEffect(() => {
    setLoading(true);
    getCallDetails({
      search,
      agent,
      language: languageFilter,
      outcome: outcomeFilter,
    }).then((data) => {
      setCalls(data);
      setLoading(false);
    });
  }, [search, agent, languageFilter, outcomeFilter]);

  const handleToggleAction = async (callId: string, actionId: string) => {
    // Optimistic update
    if (selectedCall && selectedCall.id === callId) {
      const newCall = { ...selectedCall };
      const item = newCall.actionItems.find(i => i.id === actionId);
      if (item) item.done = !item.done;
      setSelectedCall(newCall);
    }
    
    setCalls(prev => prev.map(c => {
      if (c.id === callId) {
        const newActionItems = c.actionItems.map(i => 
          i.id === actionId ? { ...i, done: !i.done } : i
        );
        return { ...c, actionItems: newActionItems };
      }
      return c;
    }));

    await toggleCallActionItem(callId, actionId);
  };

  const handleExportCSV = () => {
    if (calls.length === 0) return;
    
    // Headers
    const headers = ["Date", "Caller ID", "Name", "Language", "Duration", "Outcome", "Sentiment", "Summary"];
    
    // Rows
    const rows = calls.map(c => [
      c.date,
      c.callerId,
      c.name,
      c.language,
      c.duration,
      c.outcome,
      c.sentiment.toString(),
      // Escape quotes in summary
      `"${c.summary.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `call_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.8) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 0.5) return "bg-blue-100 text-blue-800 border-blue-200";
    if (score >= 0.3) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <>
      <PageHeader 
        title="Call Analytics"
        subtitle={`Post-call review for ${agentLabel} — transcript, summary, sentiment, and action items`} 
      />

      {/* Global Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="shadow-none border-[#E2DDD5] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-[#7A746C] uppercase tracking-wider">Avg Duration</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-[#1E1A14]">{metrics.avgDuration}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[#E2DDD5] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-[#7A746C] uppercase tracking-wider">Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-[#22C55E]">{metrics.sentimentTrend}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[#E2DDD5] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-[#7A746C] uppercase tracking-wider">Escalations</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-[#DC2626]">{metrics.escalationCount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-[#E2DDD5] bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold text-[#7A746C] uppercase tracking-wider">CSAT Score</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-[#1E1A14]">{metrics.csatScore.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5.0</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 w-full">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input 
              type="text" 
              placeholder="Search caller name or ID..." 
              className="pl-9 bg-white border-[#E2DDD5]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-[140px] bg-white border-[#E2DDD5]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Hindi">Hindi</SelectItem>
              <SelectItem value="Tamil">Tamil</SelectItem>
              <SelectItem value="Gujarati">Gujarati</SelectItem>
            </SelectContent>
          </Select>

          <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
            <SelectTrigger className="w-[140px] bg-white border-[#E2DDD5]">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Outcomes</SelectItem>
              {agent === "restaurant" && (
                <>
                  <SelectItem value="Order Placed">Order Placed</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </>
              )}
              {agent === "loan" && (
                <>
                  <SelectItem value="Payment Committed">Payment Committed</SelectItem>
                  <SelectItem value="Escalated">Escalated</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div className="shrink-0">
          <Button variant="outline" className="bg-white border-[#E2DDD5]" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="rounded-xl border border-[#E2DDD5] bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-[#FDFDFD]">
            <TableRow className="border-[#E2DDD5] hover:bg-transparent">
              <TableHead className="font-semibold text-[#1E1A14]">Date</TableHead>
              <TableHead className="font-semibold text-[#1E1A14]">Caller</TableHead>
              <TableHead className="font-semibold text-[#1E1A14]">Language</TableHead>
              <TableHead className="font-semibold text-[#1E1A14]">Duration</TableHead>
              <TableHead className="font-semibold text-[#1E1A14]">Outcome</TableHead>
              <TableHead className="font-semibold text-[#1E1A14]">Sentiment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-[#7A746C]">Loading calls...</TableCell>
              </TableRow>
            ) : calls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-[#7A746C]">No calls found matching your filters.</TableCell>
              </TableRow>
            ) : (
              calls.map((call) => (
                <TableRow 
                  key={call.id} 
                  className="cursor-pointer hover:bg-[#F9F9F7] transition-colors"
                  onClick={() => setSelectedCall(call)}
                >
                  <TableCell className="text-[#7A746C] text-[13px]">{call.date}</TableCell>
                  <TableCell>
                    <div className="font-medium text-[#1E1A14]">{call.name}</div>
                    <div className="text-[11px] font-mono text-[#7A746C]">{call.callerId}</div>
                  </TableCell>
                  <TableCell className="text-[#4A453E]">{call.language}</TableCell>
                  <TableCell className="text-[13px] text-[#7A746C]">{call.duration}</TableCell>
                  <TableCell>
                    <span className="text-[13px] font-medium text-[#1E1A14]">{call.outcome}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-semibold text-[11px] ${getSentimentColor(call.sentiment)}`}>
                      {(call.sentiment * 10).toFixed(1)}/10
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Call Detail Sheet */}
      <Sheet open={!!selectedCall} onOpenChange={(open) => !open && setSelectedCall(null)}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto bg-white border-l-[#E2DDD5]">
          {selectedCall && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-bold text-[#1E1A14]">Call Details</SheetTitle>
                <SheetDescription className="text-[13px] text-[#7A746C]">
                  Review full interaction metadata, AI summary, and generated action items.
                </SheetDescription>
              </SheetHeader>

              {/* Metadata Badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                <Badge variant="secondary" className="bg-[#FDF3E3] text-[#C8872A] hover:bg-[#FDF3E3]">
                  {selectedCall.agent}
                </Badge>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                  {selectedCall.date}
                </Badge>
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                  {selectedCall.duration}
                </Badge>
                <Badge variant="outline" className={`font-semibold ${getSentimentColor(selectedCall.sentiment)}`}>
                  Sentiment: {(selectedCall.sentiment * 10).toFixed(1)}
                </Badge>
              </div>

              {/* Grid for Summary & Action Items */}
              <div className="grid gap-6 md:grid-cols-2 mb-6">
                {/* Summary Card */}
                <Card className="shadow-sm border-[#E2DDD5]">
                  <CardHeader className="pb-3 pt-4 px-4 bg-[#FDFDFD] border-b border-[#E2DDD5]">
                    <CardTitle className="text-sm font-semibold text-[#1E1A14]">AI Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-[13px] leading-relaxed text-[#1E1A14]">
                      {selectedCall.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Action Items Card */}
                <Card className="shadow-sm border-[#E2DDD5]">
                  <CardHeader className="pb-3 pt-4 px-4 bg-[#FDFDFD] border-b border-[#E2DDD5]">
                    <CardTitle className="text-sm font-semibold text-[#1E1A14]">Action Items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {selectedCall.actionItems.length === 0 ? (
                      <p className="text-[13px] text-[#7A746C]">No action items identified.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCall.actionItems.map((item) => (
                          <div key={item.id} className="flex items-start space-x-2">
                            <Checkbox 
                              id={item.id} 
                              checked={item.done}
                              onCheckedChange={() => handleToggleAction(selectedCall.id, item.id)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={item.id}
                              className={`text-[13px] leading-tight cursor-pointer ${item.done ? 'text-[#9E9890] line-through' : 'text-[#1E1A14]'}`}
                            >
                              {item.text}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Audio playback */}
              <div className="mb-6 rounded-lg border border-[#E2DDD5] bg-[#FDFDFD] p-4">
                <h4 className="font-semibold text-sm text-[#1E1A14] m-0 mb-2">Call recording</h4>
                <audio
                  controls
                  className="w-full h-10"
                  preload="none"
                  src={`data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=`}
                >
                  Your browser does not support audio playback.
                </audio>
                <p className="m-0 mt-2 text-[11px] text-[#9E9890]">
                  Demo placeholder recording · {selectedCall.duration} · {selectedCall.date}
                </p>
              </div>

              {/* Transcript */}
              <div>
                <h4 className="font-semibold text-sm text-[#1E1A14] mb-3">Call Transcript</h4>
                <div className="bg-[#F9F9F7] rounded-lg p-4 border border-[#E2DDD5] text-[13px] leading-relaxed text-[#1E1A14] whitespace-pre-wrap font-mono">
                  {selectedCall.transcript}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
