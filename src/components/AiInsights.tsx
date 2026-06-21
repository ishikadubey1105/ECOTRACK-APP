import React, { useState, useEffect, useRef } from 'react';
import { CarbonLog, UserProfile, AiInsight, ChatMessage } from '../types';
import { 
  Sparkles, BrainCircuit, Send, RefreshCw, MessageSquare, 
  Leaf, Info, HelpCircle, ArrowRightCircle
} from 'lucide-react';

interface AiInsightsProps {
  logs: CarbonLog[];
  profile: UserProfile;
}

export default function AiInsights({ logs, profile }: AiInsightsProps) {
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [errorInsight, setErrorInsight] = useState('');

  // Chat panel states
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hello! I am Susty, your customized AI Carbon Coach. I have examined your carbon emission logs and target scores. Ask me any questions about electric vehicle efficiencies, home solar systems, meat-free diets, or compost techniques!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonalizedInsights();
  }, [logs.length]); // Refresh insights when logs count change

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchPersonalizedInsights = async () => {
    setLoadingInsight(true);
    setErrorInsight('');
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs, profile })
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve intelligence insights from backend.');
      }

      const data = await response.json();
      setInsight(data);
    } catch (err: any) {
      console.error(err);
      setErrorInsight(err.message || 'Unable to consult AI Core. Please check API Key configuration.');
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;

    const userMsgText = chatInput.trim();
    const formattedUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, formattedUserMsg]);
    setChatInput('');
    setSendingChat(true);

    try {
      const chatCopy = [...messages, formattedUserMsg];
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatCopy.slice(-6), // Send last few messages for rolling window context
          logs: logs.slice(-20) // Provide logs context
        })
      });

      if (!response.ok) {
        throw new Error('Chat coach response failed.');
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: data.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: "I am temporarily lost in the eco-cloud. Please double-check my server connection or ask again!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      
      {/* Personalized AI Insight Analysis Left Card */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        <div className="bg-white border border-[#E0E7DE] rounded-2xl p-5 shadow-xs flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E0E7DE] pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-[#4A6741]" />
                <h3 className="text-xs font-bold text-[#2D332C] uppercase tracking-widest font-mono">Personal AI Insights</h3>
              </div>
              <button 
                onClick={fetchPersonalizedInsights}
                disabled={loadingInsight}
                className="p-1.5 hover:bg-[#FDF6F0] border border-transparent hover:border-[#E0E7DE] text-[#5A6359] hover:text-[#2D332C] transition-all rounded-lg cursor-pointer"
                title="Refresh AI Insights"
              >
                <RefreshCw className={`w-4 h-4 ${loadingInsight ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingInsight ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-8 h-8 border-2 border-[#4A6741] border-t-transparent rounded-full animate-spin mx-auto animate-duration-1000"></div>
                <p className="text-xs text-[#5A6359] font-mono">Consulting Gemini climate model...</p>
              </div>
            ) : errorInsight ? (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl space-y-3">
                <div className="flex gap-2 items-start text-xs text-rose-850 font-mono leading-relaxed">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{errorInsight}</span>
                </div>
                <p className="text-[10px] text-[#5A6359] leading-normal font-mono">
                  Confirm GEMINI_API_KEY is configured in your AI Studio secrets sidebar to unlock smart insights.
                </p>
                <button 
                  onClick={fetchPersonalizedInsights}
                  className="w-full py-1.5 bg-white border border-[#E0E7DE] hover:border-[#4A6741]/40 text-xs text-[#2D332C] font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Retry API connection
                </button>
              </div>
            ) : insight ? (
              <div className="space-y-4">
                <div className="bg-[#FDF6F0] border border-[#E0E7DE] p-4 rounded-xl">
                  <div className="flex gap-2 items-center text-[#4A6741] font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-[#D4A373]" />
                    <span className="font-serif">{insight.title}</span>
                  </div>
                  <p className="text-xs text-[#5A6359] mt-2 leading-relaxed">
                    {insight.summary}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-[#E0E7DE]">
                    <span className="text-[9px] font-mono font-bold text-[#D4A373] tracking-widest block uppercase">CRITICAL ACTION PATH</span>
                    <p className="text-xs text-[#5A6359] mt-1 leading-relaxed">
                      {insight.co2ReductionTip}
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-[#E0E7DE]">
                    <span className="text-[9px] font-mono font-bold text-[#8BA888] tracking-widest block uppercase">SCORE EXPLANATION</span>
                    <p className="text-xs text-[#5A6359] mt-1 leading-relaxed">
                      {insight.scoreExplanation}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-[#5A6359]">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-[#5A6359]/50" />
                <p className="text-xs">No analysis available. Record footprint logs to trigger AI evaluations.</p>
              </div>
            )}
          </div>

          {insight && (
            <div className="border-t border-[#E0E7DE] pt-4 mt-6">
              <span className="text-[9px] font-mono font-bold text-[#5A6359] tracking-widest uppercase block mb-1">SUGGESTED QUEST</span>
              <div className="flex items-start gap-1 text-xs text-[#2D332C] bg-[#FDF6F0] p-2.5 rounded-xl border border-[#E0E7DE] leading-relaxed font-semibold">
                <ArrowRightCircle className="w-4.5 h-4.5 text-[#4A6741] flex-shrink-0 mt-0.5" />
                <span>&ldquo;{insight.suggestedAction}&rdquo;</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Sustainability Coach Chat Right Card */}
      <div className="lg:col-span-3 flex flex-col h-[520px]">
        <div className="bg-white border border-[#E0E7DE] rounded-2xl shadow-xs flex flex-col h-full overflow-hidden">
          
          {/* Coach Header */}
          <div className="bg-[#FDF6F0]/40 px-5 py-3.5 border-b border-[#E0E7DE] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-gradient-to-r from-[#4A6741] to-[#8BA888] p-2 rounded-xl text-white font-bold">
                  <Leaf className="w-5 h-5" />
                </div>
                <div className="h-2.5 w-2.5 rounded-full bg-[#8BA888] absolute -bottom-0.5 -right-0.5 border-2 border-white" />
              </div>
              <div>
                <h3 className="text-xs font-serif font-bold text-[#2D332C]">Susty</h3>
                <span className="text-[9px] text-[#4A6741] mt-0.5 font-bold block font-mono">AI SUSTAINABILITY COACH</span>
              </div>
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 font-sans text-sm bg-white">
            {messages.map((m) => {
              const isAssistant = m.sender === 'assistant';
              
              return (
                <div key={m.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${
                    isAssistant 
                      ? 'bg-[#FDF6F0] border-[#E0E7DE] text-[#2D332C]' 
                      : 'bg-[#4A6741] border-[#425d39] text-white font-medium'
                  }`}>
                    <p className="leading-relaxed whitespace-pre-line text-xs font-medium">
                      {m.text}
                    </p>
                    <span className={`text-[9px] block text-right mt-1.5 ${isAssistant ? 'text-[#5A6359]' : 'text-white/60'}`}>
                      {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}
            
            {sendingChat && (
              <div className="flex justify-start">
                <div className="bg-[#FDF6F0] border border-[#E0E7DE] rounded-2xl px-4 py-3 text-[#5A6359]">
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs font-mono">Writing tips</span>
                    <span className="h-1.5 w-1.5 bg-[#4A6741] rounded-full animate-bounce delay-75" />
                    <span className="h-1.5 w-1.5 bg-[#4A6741] rounded-full animate-bounce delay-150" />
                    <span className="h-1.5 w-1.5 bg-[#4A6741] rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Form Input */}
          <form onSubmit={handleSendChat} className="p-4 bg-white border-t border-[#E0E7DE] flex gap-2">
            <input
              type="text"
              required
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask Susty: e.g., 'What steps drop compost emissions?'"
              className="flex-1 h-11 px-4 bg-white border border-[#E0E7DE] focus:border-[#4A6741]/55 rounded-xl text-xs text-[#2D332C] placeholder-[#5A6359]/40 focus:outline-none focus:ring-1 focus:ring-[#4A6741]/40"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim()}
              className="bg-[#4A6741] hover:bg-[#3d5535] disabled:opacity-40 text-white font-bold p-3 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md shadow-[#4A6741]/10"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>

        </div>
      </div>

    </div>
  );
}
