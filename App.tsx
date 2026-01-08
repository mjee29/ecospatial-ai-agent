
import React, { useState, useRef, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import { chatWithAgent } from './services/geminiService';
import { ActiveLayer, ClimateLayerType, Message } from './types';
import { INITIAL_VIEW } from './constants';
import { 
  Loader2, 
  Send, 
  Map as MapIcon, 
  ShieldAlert, 
  Thermometer, 
  Users, 
  Menu, 
  Info, 
  MessageSquare, 
  ArrowLeft,
  Settings,
  Activity,
  Maximize2
} from 'lucide-react';

type ViewMode = 'chat' | 'map';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "안녕하세요! EcoSpatial AI 에이전트입니다. 경기도의 기후 데이터와 사회적 취약성 지표를 분석해 드릴 수 있습니다. '수원시의 침수 위험과 노인 인구 밀도를 같이 보여줘'와 같이 질문해 보세요.",
      timestamp: new Date()
    }
  ]);
  const [activeLayers, setActiveLayers] = useState<ActiveLayer[]>([]);
  const [viewState, setViewState] = useState({ center: INITIAL_VIEW, zoom: 12 });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await chatWithAgent(userMessage, history);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'updateMapLayers') {
            const { activeLayers: layers, locationName } = call.args as any;
            
            setViewMode('map');

            if (locationName) {
              const lowerLoc = locationName.toLowerCase();
              if (lowerLoc.includes('수원')) setViewState({ center: [37.2635, 127.0287], zoom: 13 });
              else if (lowerLoc.includes('성남') || lowerLoc.includes('판교')) setViewState({ center: [37.4201, 127.1265], zoom: 13 });
              else if (lowerLoc.includes('용인')) setViewState({ center: [37.2411, 127.1776], zoom: 12 });
              else if (lowerLoc.includes('고양')) setViewState({ center: [37.6583, 126.832], zoom: 12 });
              else if (lowerLoc.includes('안양')) setViewState({ center: [37.3943, 126.9568], zoom: 13 });
            }

            const newActiveLayers = layers.map((type: ClimateLayerType) => ({
              id: `layer-${type}-${Date.now()}`,
              type,
              opacity: 0.75,
              visible: true
            }));
            setActiveLayers(newActiveLayers);
          }
        }
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: response.text || "분석된 GIS 데이터를 지도에 시각화했습니다.", 
        timestamp: new Date() 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: "데이터 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 font-sans overflow-hidden text-slate-900">
      {/* Sidebar Chat Panel */}
      <aside 
        className={`fixed inset-0 z-50 md:relative md:inset-auto ${
          viewMode === 'chat' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${sidebarOpen ? 'w-full md:w-[420px]' : 'w-0'} bg-white shadow-2xl transition-all duration-500 ease-in-out flex flex-col`}
      >
        {/* Header */}
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
              <Activity size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900">EcoSpatial AI</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gyeonggi Climate Node</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setViewMode('map')} 
            className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-white scroll-smooth">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[90%] px-5 py-4 rounded-[24px] text-sm leading-relaxed ${
                m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-xl shadow-indigo-100' 
                  : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-bl-none'
              }`}>
                {m.text}
              </div>
              <span className="text-[10px] mt-2 font-medium text-slate-400 px-2">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-3 px-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Spatial Reasoning...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Controls */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
             {[
               { icon: <ShieldAlert size={14}/>, label: '수원 침수', color: 'text-rose-500', q: '수원시 침수 위험 구역 보여줘' },
               { icon: <Thermometer size={14}/>, label: '용인 폭염', color: 'text-orange-500', q: '용인시 폭염 취약성 분석해줘' },
               { icon: <Users size={14}/>, label: '노인 인구', color: 'text-indigo-500', q: '성남시 노인 인구 밀도 레이어 추가' }
             ].map((btn, idx) => (
               <button 
                 key={idx}
                 onClick={() => setInputValue(btn.q)}
                 className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm"
               >
                 <span className={btn.color}>{btn.icon}</span>
                 {btn.label}
               </button>
             ))}
          </div>
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="데이터 분석 질문을 입력하세요..."
              className="w-full bg-white border border-slate-200 rounded-3xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none shadow-sm placeholder:text-slate-300"
              rows={2}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-3 bottom-3 p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-indigo-200 active:scale-95"
            >
              <Send size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Map Content */}
      <main className={`flex-1 relative h-full bg-slate-100 ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
        {/* Navigation Overlays */}
        <div className="absolute top-6 left-6 z-[2000] flex gap-3">
          <button 
            onClick={() => setViewMode('chat')}
            className="flex items-center gap-2 px-5 py-3 bg-white/90 backdrop-blur rounded-2xl shadow-xl text-slate-800 font-bold hover:bg-white transition-all hover:scale-[1.02] border border-slate-200 md:hidden"
          >
            <ArrowLeft size={20} className="text-indigo-600" />
            분석 대화
          </button>
          
          <div className="hidden md:flex bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-xl border border-slate-200">
            <button 
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'chat' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MessageSquare size={16} />
              분석 AI
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'map' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapIcon size={16} />
              GIS 지도
            </button>
          </div>
        </div>

        {/* Status HUD (Top Right) */}
        <div className="absolute top-6 right-6 z-[2000] space-y-4 max-w-[280px]">
           <div className="bg-slate-900/90 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-white/10 text-white">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">Analysis HUD</span>
                 <Settings size={14} className="text-slate-500 hover:rotate-90 transition-transform cursor-pointer" />
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-[11px] text-slate-400 font-medium">Active Layers</span>
                    <span className="text-2xl font-black text-indigo-400 leading-none">{activeLayers.length}</span>
                 </div>
                 <div className="flex justify-between items-end">
                    <span className="text-[11px] text-slate-400 font-medium">Region Focus</span>
                    <span className="text-xs font-bold truncate ml-4">Gyeonggi-do</span>
                 </div>
                 {activeLayers.length > 0 && (
                   <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                     <div className="flex flex-wrap gap-1.5">
                       {activeLayers.map(l => (
                         <div key={l.id} className="w-2 h-2 rounded-full bg-emerald-500" title={l.type} />
                       ))}
                     </div>
                   </div>
                 )}
              </div>
           </div>
        </div>

        <MapComponent 
          activeLayers={activeLayers} 
          viewState={viewState}
        />

        {/* Footer Credit */}
        <div className="absolute bottom-6 right-6 z-[2000] pointer-events-none">
          <div className="bg-slate-900/40 backdrop-blur px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
             <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
               <span className="text-[9px] font-black text-white/80 uppercase tracking-wider">WMS Active</span>
             </div>
             <div className="w-px h-3 bg-white/20" />
             <span className="text-[9px] text-white/60 font-medium italic">Data Source: GG Climate Platform</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
