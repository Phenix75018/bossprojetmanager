import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Bot, Send, X, Sparkles, Loader2, Plus, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Suggestion { label: string; type: "navigate" | "info"; payload: string; }
interface Msg {
  id?: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: Suggestion[];
}
interface Conv { id: string; title: string; updated_at: string; }

export function CopilotWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide on shared/public pages and auth
  const hidden = !user ||
    location.pathname.startsWith("/share") ||
    location.pathname.includes("/share/") ||
    location.pathname === "/auth" ||
    location.pathname === "/reset-password" ||
    location.pathname === "/";

  useEffect(() => {
    if (open && user) loadConversations();
  }, [open, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function loadConversations() {
    const { data } = await supabase
      .from("copilot_conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    setConvs(data || []);
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("copilot_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at");
    setMessages((data || []).map((m: any) => ({
      id: m.id, role: m.role, content: m.content, suggestions: m.suggestions || []
    })));
    setConvId(id);
    setShowHistory(false);
  }

  function newConversation() {
    setConvId(null);
    setMessages([]);
    setShowHistory(false);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("copilot_conversations").delete().eq("id", id);
    if (convId === id) newConversation();
    loadConversations();
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !user) return;
    setInput("");
    setLoading(true);

    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      // Ensure conversation exists
      let cid = convId;
      if (!cid) {
        const { data: conv } = await supabase
          .from("copilot_conversations")
          .insert({
            user_id: user.id,
            title: text.slice(0, 60),
            context_route: location.pathname,
          })
          .select()
          .single();
        cid = conv?.id || null;
        setConvId(cid);
      }

      if (cid) {
        await supabase.from("copilot_messages").insert({
          conversation_id: cid, user_id: user.id, role: "user", content: text,
        });
      }

      const { data, error } = await supabase.functions.invoke("copilot-chat", {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          route: location.pathname,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: Msg = {
        role: "assistant",
        content: data.content || "",
        suggestions: data.suggestions || [],
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (cid) {
        await supabase.from("copilot_messages").insert({
          conversation_id: cid, user_id: user.id, role: "assistant",
          content: assistantMsg.content, suggestions: (assistantMsg.suggestions ?? []) as any,
        });
        await supabase
          .from("copilot_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", cid);
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur de l'assistant");
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestion(s: Suggestion) {
    if (s.type === "navigate") {
      window.location.href = s.payload;
    } else {
      setInput(s.payload);
    }
  }

  if (hidden) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-2xl hover:scale-110 transition-all flex items-center justify-center group"
          aria-label="Ouvrir Boss Copilot"
        >
          <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-emerald-500 rounded-full animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <div className="font-serif text-base leading-tight">Boss Copilot</div>
                <div className="text-[10px] opacity-80">Assistant IA contextuel</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={() => setShowHistory(s => !s)} title="Historique">
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={newConversation} title="Nouvelle conversation">
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* History panel */}
          {showHistory ? (
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1">
                {convs.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">Aucune conversation</div>
                )}
                {convs.map(c => (
                  <button key={c.id}
                    onClick={() => loadMessages(c.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg hover:bg-muted flex items-center justify-between group",
                      convId === c.id && "bg-muted"
                    )}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(c.updated_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <button onClick={(e) => deleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-8 space-y-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-serif text-lg">Bonjour 👋</div>
                      <p className="text-sm text-muted-foreground mt-1 px-4">
                        Pose-moi une question sur ton projet, ton plan d'action, ton budget ou ton calendrier.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 px-3 mt-4">
                      {[
                        "Quelles sont mes tâches prioritaires cette semaine ?",
                        "Résume l'état de mon projet principal",
                        "Quels événements ai-je à venir ?",
                      ].map(s => (
                        <button key={s} onClick={() => setInput(s)}
                          className="text-xs text-left px-3 py-2 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
                          💡 {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    )}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
                          {m.suggestions.map((s, j) => (
                            <button key={j} onClick={() => handleSuggestion(s)}
                              className="text-xs px-2 py-1 rounded-md bg-background hover:bg-accent hover:text-accent-foreground border border-border transition-colors">
                              {s.type === "navigate" ? "→ " : "💬 "}{s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Réflexion…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Pose ta question…"
                    className="min-h-[44px] max-h-32 resize-none text-sm"
                    disabled={loading}
                  />
                  <Button onClick={send} disabled={!input.trim() || loading} size="icon" className="h-11 w-11 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Propulsé par DeepSeek · Lecture des données projet en temps réel
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
