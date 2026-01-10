
import React, { useState, useRef, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import { chatWithAgent, sendToolResult, updateConversationContext, clearChatCache, ToolExecutionResult } from './services/geminiService';
import { getElderlyPopulation, GYEONGGI_DISTRICT_CODES } from './services/sgisService';
import { createToolResult } from './services/climateDataService';
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
  // Keep track of in-flight requests so we can abort if user sends another request
  const inFlightController = useRef<AbortController | null>(null);

  // Show persistent warning if required API key(s) are missing
  const [missingApiWarning, setMissingApiWarning] = useState<string | null>(null);

  useEffect(() => {
    // runtime check for Gemini API key and GG Climate key
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const ggKey = import.meta.env.VITE_GG_CLIMATE_API_KEY;
    if (!geminiKey) setMissingApiWarning('Gemini API Key (VITE_GEMINI_API_KEY)가 누락되었습니다. `.env.local`에 추가하고 dev 서버를 재시작하세요.');
    else if (!ggKey) setMissingApiWarning('경기도 기후 API Key (VITE_GG_CLIMATE_API_KEY)가 누락되었습니다. `.env.local`에 추가하고 dev 서버를 재시작하세요.');
    else setMissingApiWarning(null);
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 경기도 시군구 중심 좌표 매핑
  const DISTRICT_COORDINATES: Record<string, { center: [number, number], zoom: number }> = {
    '수원': { center: [37.2635, 127.0287], zoom: 13 },
    '성남': { center: [37.4201, 127.1265], zoom: 13 },
    '판교': { center: [37.3947, 127.1119], zoom: 14 },
    '용인': { center: [37.2411, 127.1776], zoom: 12 },
    '고양': { center: [37.6583, 126.832], zoom: 12 },
    '안양': { center: [37.3943, 126.9568], zoom: 13 },
    '부천': { center: [37.5034, 126.7660], zoom: 13 },
    '광명': { center: [37.4786, 126.8645], zoom: 14 },
    '평택': { center: [36.9921, 127.0857], zoom: 12 },
    '안산': { center: [37.3219, 126.8309], zoom: 13 },
    '과천': { center: [37.4292, 126.9876], zoom: 14 },
    '의왕': { center: [37.3448, 126.9683], zoom: 14 },
    '군포': { center: [37.3617, 126.9352], zoom: 14 },
    '시흥': { center: [37.3800, 126.8029], zoom: 13 },
    '하남': { center: [37.5393, 127.2147], zoom: 13 },
    '의정부': { center: [37.7381, 127.0338], zoom: 13 },
    '구리': { center: [37.5943, 127.1295], zoom: 14 },
    '남양주': { center: [37.6360, 127.2165], zoom: 12 },
    '파주': { center: [37.7126, 126.7610], zoom: 12 },
    '김포': { center: [37.6153, 126.7156], zoom: 12 },
    '화성': { center: [37.1996, 126.8312], zoom: 11 },
    '광주': { center: [37.4294, 127.2551], zoom: 13 },
    '이천': { center: [37.2792, 127.4350], zoom: 12 },
    '양주': { center: [37.7853, 127.0456], zoom: 12 },
    '포천': { center: [37.8949, 127.2003], zoom: 12 },
    '여주': { center: [37.2983, 127.6375], zoom: 12 },
    '동두천': { center: [37.9035, 127.0606], zoom: 13 },
    '오산': { center: [37.1499, 127.0770], zoom: 14 },
    '안성': { center: [37.0080, 127.2798], zoom: 12 },
    '연천': { center: [38.0966, 127.0748], zoom: 12 },
    '가평': { center: [37.8315, 127.5095], zoom: 12 },
    '양평': { center: [37.4917, 127.4872], zoom: 12 }
  };

  /**
   * Tool Execution Loop가 적용된 메시지 전송 함수
   * 1. 사용자 질문 → AI 호출
   * 2. AI가 function call 반환 → Tool 실행 (지도 업데이트 + 데이터 조회)
   * 3. Tool 실행 결과를 AI에게 다시 전송 (Second Turn)
   * 4. AI가 최종 답변 생성
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Prevent sending if API key missing
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setMessages(prev => [...prev, { role: 'model', text: 'API Key가 설정되어 있지 않습니다. `.env.local`에 VITE_GEMINI_API_KEY를 추가하고 dev 서버를 재시작하세요.', timestamp: new Date() }]);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    // Abort previous in-flight request
    if (inFlightController.current) {
      try { inFlightController.current.abort(); } catch (e) { /* ignore */ }
      inFlightController.current = null;
    }
    inFlightController.current = new AbortController();

    try {
      // 새 요청 시 캐시 초기화 (매번 새 데이터 조회)
      clearChatCache();

      // Step 1: 대화 히스토리 구성 (최근 6개 메시지만 유지하여 컨텍스트 혼란 방지)
      const recentMessages = messages.slice(-6);
      const history = recentMessages.map(m => ({
        role: m.role as 'user' | 'model',
        parts: [{ text: m.text }]
      }));

      // Step 2: 첫 번째 AI 호출
      console.log('[App] Step 1: Sending user message to AI');
      const firstResponse = await chatWithAgent(userMessage, history, { timeoutMs: 15000 });

      // Step 3: Function Call이 있는 경우 Tool Execution Loop 실행
      if (firstResponse.functionCalls && firstResponse.functionCalls.length > 0) {
        for (const call of firstResponse.functionCalls) {
          if (call.name === 'updateMapLayers') {
            const { activeLayers: layers, locationName } = call.args as any;
            console.log('[App] Step 2: Executing updateMapLayers tool', { layers, locationName });

            setViewMode('map');

            // 지도 뷰 업데이트
            if (locationName) {
              const normalizedName = locationName.replace(/시$|군$/g, '').trim();
              const coords = DISTRICT_COORDINATES[normalizedName] || DISTRICT_COORDINATES[locationName];
              if (coords) {
                setViewState({ center: coords.center, zoom: coords.zoom });
              }
            }

            // 레이어 생성 및 데이터 조회
            const newActiveLayers: ActiveLayer[] = [];
            const normalizedLocation = locationName?.replace(/시$|군$/g, '').trim();
            const districtCode = normalizedLocation
              ? (GYEONGGI_DISTRICT_CODES[normalizedLocation] || GYEONGGI_DISTRICT_CODES[locationName])
              : undefined;

            // 고령인구 데이터 조회 (SGIS API)
            let elderlyDataForTool: any = undefined;

            for (const type of layers || []) {
              const layerData: ActiveLayer = {
                id: `layer-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type,
                opacity: 0.75,
                visible: true,
                locationName: locationName || undefined,
                districtCode: districtCode || undefined
              };

              // ELDERLY_POPULATION 레이어: SGIS API 호출
              if (type === ClimateLayerType.ELDERLY_POPULATION && locationName) {
                try {
                  console.log('[App] Fetching elderly population data for:', locationName);
                  const elderlyData = await getElderlyPopulation(locationName);
                  layerData.elderlyData = {
                    districtName: elderlyData.districtName,
                    totalPopulation: elderlyData.totalPopulation,
                    elderlyPopulation: elderlyData.elderlyPopulation,
                    elderlyRatio: elderlyData.elderlyRatio,
                    sixtyCount: elderlyData.sixtyCount,
                    seventyPlusCount: elderlyData.seventyPlusCount,
                    avgAge: elderlyData.avgAge
                  };
                  elderlyDataForTool = layerData.elderlyData;
                  console.log('[App] Elderly data fetched:', elderlyDataForTool);
                } catch (error) {
                  console.error('[App] Failed to fetch elderly population data:', error);
                }
              }

              newActiveLayers.push(layerData);
            }

            setActiveLayers(newActiveLayers);

            // 대화 컨텍스트 업데이트
            updateConversationContext(
              locationName,
              layers as ClimateLayerType[],
              layers?.length > 0 ? `${layers.join(', ')} 분석` : undefined
            );

            // Step 4: Tool 실행 결과 생성 (기후 데이터 포함 - WFS API 호출)
            console.log('[App] Step 3: Creating tool execution result');
            console.log('실제 기후 데이터 조회 중...');
            const toolResultData = await createToolResult(
              locationName || '경기도',
              layers as ClimateLayerType[],
              elderlyDataForTool
            );

            // [추가] 가져온 WFS 데이터를 지도 레이어 상태에 반영
            setActiveLayers(prevLayers => prevLayers.map(layer => {
              const data = toolResultData.wfsData?.[layer.type];
              if (data) {
                console.log(`[App] Injecting GeoJSON into layer ${layer.type}`);
                return { ...layer, geoJson: data };
              }
              return layer;
            }));

            const toolExecutionResult: ToolExecutionResult = {
              toolName: 'updateMapLayers',
              args: call.args,
              result: toolResultData
            };

            console.log('[App] Tool execution result:', toolExecutionResult);

            // Step 5: Tool 결과를 AI에게 다시 전송하여 최종 답변 생성
            console.log('[App] Step 4: Sending tool result to AI for final response');
            const updatedHistory = [
              ...history,
              { role: 'user' as const, parts: [{ text: userMessage }] }
            ];

            const finalResponse = await sendToolResult(
              userMessage,
              updatedHistory,
              toolExecutionResult,
              { timeoutMs: 15000 }
            );

            console.log('[App] Step 5: Received final response from AI');

            // 최종 답변 추가
            setMessages(prev => [...prev, {
              role: 'model',
              text: finalResponse.text || "데이터 분석이 완료되었습니다.",
              timestamp: new Date()
            }]);

            return; // Tool Loop 완료
          }
        }
      }

      // Function Call이 없는 경우: 일반 텍스트 응답
      setMessages(prev => [...prev, {
        role: 'model',
        text: firstResponse.text || "질문을 이해했습니다. 더 구체적인 분석이 필요하시면 지역과 분석 유형을 알려주세요.",
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error('[App] Error in handleSendMessage:', error);
      if (error?.message === 'Request timed out') {
        setMessages(prev => [...prev, { role: 'model', text: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', timestamp: new Date() }]);
      } else if (error?.name === 'AbortError') {
        // User aborted — ignore
      } else {
        setMessages(prev => [...prev, {
          role: 'model',
          text: "데이터 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
          timestamp: new Date()
        }]);
      }
    } finally {
      setIsLoading(false);
      inFlightController.current = null;
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

          {/* GG API key status (dev helper) */}
          <div className="hidden md:flex items-center gap-3">
            {import.meta.env.VITE_GG_CLIMATE_API_KEY ? (
              <div className="text-sm text-slate-500">GG Key: <span className="font-mono text-xs ml-1">{import.meta.env.VITE_GG_CLIMATE_API_KEY.slice(0,4)}****{import.meta.env.VITE_GG_CLIMATE_API_KEY.slice(-4)}</span></div>
            ) : (
              <div className="text-sm text-amber-600">GG Key 없음</div>
            )}
            <button
              onClick={() => { window.location.reload(); }}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* API Key Warning Banner */}
        {missingApiWarning && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
            <strong className="font-bold">API Key 누락:</strong>
            <span className="ml-2">{missingApiWarning}</span>
          </div>
        )}

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
