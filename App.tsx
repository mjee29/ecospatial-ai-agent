
import React, { useState, useRef, useEffect } from 'react';
import MapComponent from './components/MapComponent';
import { chatWithAgent } from './services/geminiService';
import { getElderlyPopulation } from './services/sgisService';
import { getAirQuality } from './services/airkoreaService';
import { getWeather } from './services/weatherService';
import { getGreenSpaceData, formatBiotArea } from './services/greenSpaceService';
import { ActiveLayer, ClimateLayerType, Message } from './types';
import { INITIAL_VIEW } from './constants';
import {
  Loader2,
  Send,
  Map as MapIcon,
  Thermometer,
  Users,
  MessageSquare,
  ArrowLeft,
  Activity,
  Maximize2,
  Wind,
  MapPin
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
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // Prevent sending if API key missing — provide user-friendly feedback
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setMessages(prev => [...prev, { role: 'model', text: 'API Key가 설정되어 있지 않습니다. `.env.local`에 VITE_GEMINI_API_KEY를 추가하고 dev 서버를 재시작하세요.', timestamp: new Date() }]);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: new Date() }]);
    setIsLoading(true);

    // Abort previous in-flight request (if any) to avoid piling up slow requests
    if (inFlightController.current) {
      try { inFlightController.current.abort(); } catch (e) { /* ignore */ }
      inFlightController.current = null;
    }
    inFlightController.current = new AbortController();

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      // Use a timeout and allow geminiService to use its cache
      const response = await chatWithAgent(userMessage, history, { timeoutMs: 15000 });
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'updateMapLayers') {
            const { activeLayers: layers, locationName } = call.args as any;

            setViewMode('map');

            if (locationName) {
              const lowerLoc = locationName.toLowerCase();
              // 경기도 주요 도시 좌표 매핑
              const locationCoords: Record<string, [number, number]> = {
                '수원': [37.2635, 127.0287],
                '성남': [37.4201, 127.1265],
                '판교': [37.3947, 127.1112],
                '용인': [37.2411, 127.1776],
                '고양': [37.6583, 126.832],
                '안양': [37.3943, 126.9568],
                '남양주': [37.6360, 127.2165],
                '부천': [37.5034, 126.7660],
                '광명': [37.4786, 126.8644],
                '평택': [36.9921, 127.0857],
                '안산': [37.3219, 126.8309],
                '과천': [37.4292, 126.9876],
                '구리': [37.5943, 127.1295],
                '오산': [37.1498, 127.0772],
                '시흥': [37.3800, 126.8028],
                '군포': [37.3616, 126.9352],
                '의왕': [37.3447, 126.9685],
                '하남': [37.5392, 127.2147],
                '파주': [37.7126, 126.7610],
                '이천': [37.2719, 127.4348],
                '안성': [37.0078, 127.2797],
                '김포': [37.6153, 126.7156],
                '화성': [37.1995, 126.8313],
                '광주': [37.4095, 127.2550],
                '양주': [37.7854, 127.0456],
                '포천': [37.8949, 127.2003],
                '여주': [37.2984, 127.6374],
                '의정부': [37.7381, 127.0337],
                '연천': [38.0965, 127.0748],
                '가평': [37.8315, 127.5097],
                '양평': [37.4917, 127.4876],
              };

              for (const [city, coords] of Object.entries(locationCoords)) {
                if (lowerLoc.includes(city)) {
                  setViewState({ center: coords, zoom: 13 });
                  setCurrentLocationName(locationName);
                  break;
                }
              }
            }

            // Minimal diff: if requested layer types match current types, don't recreate layers (avoids force-remounting WMSTileLayers)
            // 단, locationName이 다르면 데이터 레이어(AIR_QUALITY, ELDERLY_POPULATION)는 업데이트 필요
            const requestedTypes = new Set((layers || []) as ClimateLayerType[]);
            const currentTypes = new Set(activeLayers.map(a => a.type));
            let needUpdate = false;
            if (requestedTypes.size !== currentTypes.size) needUpdate = true;
            else {
              for (const t of requestedTypes) {
                if (!currentTypes.has(t)) { needUpdate = true; break; }
              }
            }

            // locationName이 변경되면 데이터 레이어는 무조건 업데이트
            const hasDataLayer = requestedTypes.has(ClimateLayerType.AIR_QUALITY) ||
                                 requestedTypes.has(ClimateLayerType.ELDERLY_POPULATION) ||
                                 requestedTypes.has(ClimateLayerType.WEATHER) ||
                                 requestedTypes.has(ClimateLayerType.GREEN_SPACE);
            const currentLocationName = activeLayers.find(l => l.airQualityData)?.airQualityData?.locationName ||
                                        activeLayers.find(l => l.elderlyData)?.elderlyData?.districtName ||
                                        activeLayers.find(l => l.weatherData)?.weatherData?.sigun;
            // 데이터 레이어가 있고 locationName이 다르면 업데이트 (sigun에서 '시'/'군' 제거 후 비교)
            const normalizedCurrent = currentLocationName?.replace(/시$|군$/g, '');
            const normalizedNew = locationName?.replace(/시$|군$/g, '');
            if (hasDataLayer && locationName && normalizedNew !== normalizedCurrent) {
              needUpdate = true;
            }

            if (needUpdate) {
              const newActiveLayers: ActiveLayer[] = [];

              for (const type of layers || []) {
                const layerData: ActiveLayer = {
                  id: `layer-${type}-${Date.now()}`,
                  type,
                  opacity: 0.75,
                  visible: true
                };

                // ELDERLY_POPULATION 레이어이고 locationName이 있으면 SGIS API 호출
                if (type === ClimateLayerType.ELDERLY_POPULATION && locationName) {
                  try {
                    console.log('[App] Fetching elderly population data for:', locationName);
                    console.log('[App] Location name type:', typeof locationName, 'Value:', JSON.stringify(locationName));
                    const elderlyData = await getElderlyPopulation(locationName);
                    layerData.elderlyData = {
                      districtName: elderlyData.districtName,
                      seventyPlusCount: elderlyData.seventyPlusCount,
                      seventyPlusRatio: elderlyData.seventyPlusRatio,
                    };
                    console.log('[App] Elderly data fetched successfully:', layerData.elderlyData);
                  } catch (error) {
                    console.error('[App] Failed to fetch elderly population data:', error);
                    // 에러 메시지를 사용자에게 표시
                    setMessages(prev => [...prev, { 
                      role: 'model', 
                      text: `노인 인구 데이터 조회 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n이 오류가 반복되면 지역명이 올바른지 확인해주세요. 지원되는 지역: 경기도의 모든 시군구`, 
                      timestamp: new Date() 
                    }]);
                  }
                }

                // AIR_QUALITY 레이어이고 locationName이 있으면 에어코리아 API 호출
                if (type === ClimateLayerType.AIR_QUALITY && locationName) {
                  try {
                    console.log('[App] Fetching air quality data for:', locationName);
                    const airData = await getAirQuality(locationName);
                    layerData.airQualityData = {
                      stationName: airData.stationName,
                      locationName: airData.locationName,
                      measureTime: airData.measureTime,
                      lat: airData.lat,
                      lng: airData.lng,
                      khaiValue: airData.khaiValue,
                      khaiGrade: airData.khaiGrade,
                      pm10Value: airData.pm10Value,
                      pm10Grade: airData.pm10Grade,
                      pm25Value: airData.pm25Value,
                      pm25Grade: airData.pm25Grade,
                      so2Value: airData.so2Value,
                      coValue: airData.coValue,
                      o3Value: airData.o3Value,
                      no2Value: airData.no2Value
                    };
                    console.log('[App] Air quality data fetched successfully:', layerData.airQualityData);
                  } catch (error) {
                    console.error('[App] Failed to fetch air quality data:', error);
                  }
                }

                // WEATHER 레이어이고 locationName이 있으면 경기도 AWS 기상 API 호출
                if (type === ClimateLayerType.WEATHER && locationName) {
                  try {
                    console.log('[App] Fetching weather data for:', locationName);
                    const weatherData = await getWeather(locationName);
                    if (weatherData) {
                      layerData.weatherData = {
                        sigun: weatherData.sigun,
                        station: weatherData.station,
                        datetime: weatherData.datetime,
                        lat: weatherData.lat,
                        lon: weatherData.lon,
                        temperature_c: weatherData.temperature_c,
                        humidity_pct: weatherData.humidity_pct,
                        wind_speed_ms: weatherData.wind_speed_ms,
                        wind_direction_deg: weatherData.wind_direction_deg,
                        heat_index: weatherData.heat_index,
                        wind_chill: weatherData.wind_chill
                      };
                      console.log('[App] Weather data fetched successfully:', layerData.weatherData);
                    }
                  } catch (error) {
                    console.error('[App] Failed to fetch weather data:', error);
                  }
                }

                // GREEN_SPACE 레이어이고 locationName이 있으면 WFS에서 녹지 비오톱 데이터 조회
                if (type === ClimateLayerType.GREEN_SPACE && locationName) {
                  try {
                    console.log('[App] Fetching green space data for:', locationName);
                    const greenData = await getGreenSpaceData(locationName);
                    layerData.greenSpaceData = {
                      sggName: greenData.sggName,
                      totalBiotArea: greenData.totalBiotArea,
                      featureCount: greenData.featureCount,
                      classifications: greenData.topClassifications.map(c => ({
                        lclsfNm: c.lclsfNm,
                        mclsfNm: c.mclsfNm,
                        sclsfNm: c.sclsfNm,
                        dclsfNm: c.dclsfNm,
                        biotArea: c.biotArea
                      }))
                    };
                    console.log('[App] Green space data fetched successfully:', {
                      sggName: greenData.sggName,
                      totalBiotArea: formatBiotArea(greenData.totalBiotArea),
                      featureCount: greenData.featureCount
                    });
                  } catch (error) {
                    console.error('[App] Failed to fetch green space data:', error);
                  }
                }

                newActiveLayers.push(layerData);
              }

              setActiveLayers(newActiveLayers);
            }
          }
        }
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: response.text || "분석된 GIS 데이터를 지도에 시각화했습니다.", 
        timestamp: new Date() 
      }]);
    } catch (error: any) {
      if (error?.message === 'Request timed out') {
        setMessages(prev => [...prev, { role: 'model', text: '요청이 시간이 초과되었습니다. 네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.', timestamp: new Date() }]);
      } else if (error?.name === 'AbortError') {
        // User aborted the request — ignore since likely superseded by a new request
      } else {
        setMessages(prev => [...prev, { 
          role: 'model', 
          text: "데이터 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.", 
          timestamp: new Date() 
        }]);
      }
    } finally {
      setIsLoading(false);
      // clear controller
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
          {/* 선택 가능한 시/정보 안내 */}
          <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">검색 가능한 시</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {['수원', '성남', '용인', '고양', '안양', '부천', '평택', '안산', '화성', '남양주', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '오산', '이천', '하남'].map(city => (
                  <button
                    key={city}
                    onClick={() => setInputValue(`${city}시 `)}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">선택 가능한 정보</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[
                  { icon: <Thermometer size={12}/>, label: '기온/날씨', color: 'text-blue-500', keyword: '기상 정보' },
                  { icon: <Wind size={12}/>, label: '대기질', color: 'text-cyan-500', keyword: '대기질 정보' },
                  { icon: <Users size={12}/>, label: '노인인구', color: 'text-purple-500', keyword: '노인 인구 밀도' },
                  { icon: <MapPin size={12}/>, label: '녹지현황', color: 'text-green-500', keyword: '녹지 현황' },
                ].map((info, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputValue(prev => prev + info.keyword + ' ')}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <span className={info.color}>{info.icon}</span>
                    {info.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 빠른 예시 버튼 */}
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
             {[
               { icon: <Thermometer size={14}/>, label: '수원 날씨', color: 'text-blue-500', q: '수원시 기상 정보 보여줘' },
               { icon: <Wind size={14}/>, label: '성남 대기질', color: 'text-cyan-500', q: '성남시 대기질 정보 보여줘' },
               { icon: <Users size={14}/>, label: '용인 노인인구', color: 'text-purple-500', q: '용인시 노인 인구 밀도 보여줘' }
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


        <MapComponent
          activeLayers={activeLayers}
          viewState={viewState}
          locationName={currentLocationName}
          onRAGAnalysisGenerated={(analysis) => {
            // RAG 분석 결과를 채팅창에 자동 추가
            if (analysis && analysis.trim()) {
              setMessages(prev => {
                // 이미 같은 분석 메시지가 있으면 추가하지 않음
                const lastMsg = prev[prev.length - 1];
                if (lastMsg?.text === analysis) return prev;
                return [...prev, {
                  role: 'model',
                  text: analysis,
                  timestamp: new Date()
                }];
              });
            }
          }}
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
