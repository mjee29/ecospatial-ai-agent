/**
 * Dashboard Page
 * 기존 App.tsx 기반 + 인증/채팅저장 기능 추가
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import ChatSidebar from '../components/ChatSidebar';
import { chatWithAgent } from '../services/geminiService';
import { getElderlyPopulation } from '../services/sgisService';
import { getAirQuality } from '../services/airkoreaService';
import { getWeather } from '../services/weatherService';
import {
  signOut,
  createChat,
  getUserChats,
  getChatMessages,
  saveMessage,
  updateChatTitle,
  deleteChat,
  deleteAccount,
  DbChat
} from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { ActiveLayer, ClimateLayerType, Message } from '../types';
import { INITIAL_VIEW } from '../constants';
import html2canvas from 'html2canvas';
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
  Droplets,
  MapPin,
  LogOut,
  Download,
  User,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  ChevronDown
} from 'lucide-react';

type ViewMode = 'chat' | 'map';

const WELCOME_MESSAGE: Message = {
  role: 'model',
  text: "안녕하세요! EcoSpatial AI 에이전트입니다. 경기도의 기후 데이터와 사회적 취약성 지표를 분석해 드릴 수 있습니다. '수원시의 침수 위험과 노인 인구 밀도를 같이 보여줘'와 같이 질문해 보세요.",
  timestamp: new Date()
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isDemo } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // 채팅 관련 상태
  const [chats, setChats] = useState<DbChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [showChatList, setShowChatList] = useState(true);

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [activeLayers, setActiveLayers] = useState<ActiveLayer[]>([]);
  const [viewState, setViewState] = useState({ center: INITIAL_VIEW, zoom: 12 });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [savingMap, setSavingMap] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inFlightController = useRef<AbortController | null>(null);

  // 채팅창 크기 조절
  const [chatWidth, setChatWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const minWidth = 320;

  const [missingApiWarning, setMissingApiWarning] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // SSR 대응
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 유저 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // 리사이즈 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const maxWidth = window.innerWidth * 0.6; // 최대 60%
      const newWidth = e.clientX - (showChatList && user && !isDemo ? 256 : 0); // 채팅 목록 너비 고려
      setChatWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, showChatList, user, isDemo]);

  // API 키 체크
  useEffect(() => {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const ggKey = import.meta.env.VITE_GG_CLIMATE_API_KEY;
    if (!geminiKey) setMissingApiWarning('Gemini API Key가 누락되었습니다.');
    else if (!ggKey) setMissingApiWarning('경기도 기후 API Key가 누락되었습니다.');
    else setMissingApiWarning(null);
  }, []);

  // 채팅 목록 로드 (로그인 유저만)
  useEffect(() => {
    if (user && !isDemo) {
      loadChats();
    }
  }, [user, isDemo]);

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const userChats = await getUserChats();
      setChats(userChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setChatsLoading(false);
    }
  };

  // 채팅 선택 시 메시지 로드
  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    try {
      const dbMessages = await getChatMessages(chatId);
      const loadedMessages: Message[] = dbMessages.map(m => ({
        role: m.role,
        text: m.text,
        timestamp: new Date(m.timestamp)
      }));
      setMessages(loadedMessages.length > 0 ? loadedMessages : [WELCOME_MESSAGE]);
      setActiveLayers([]);
      setCurrentLocationName('');
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // 새 채팅 생성
  const handleNewChat = async () => {
    if (isDemo && !user) {
      if (confirm('채팅을 저장하려면 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login');
      }
      return;
    }

    // 로그인 유저: DB에 새 채팅 생성
    if (user) {
      try {
        const newChat = await createChat();
        setChats(prev => [newChat, ...prev]);
        setCurrentChatId(newChat.id);
      } catch (error) {
        console.error('Failed to create chat:', error);
      }
    }

    setMessages([{
      role: 'model',
      text: "새로운 대화를 시작합니다. 무엇을 분석해 드릴까요?",
      timestamp: new Date()
    }]);
    setActiveLayers([]);
    setCurrentLocationName('');
  };

  // 채팅 삭제
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      '정말 회원 탈퇴하시겠습니까?\n\n모든 채팅 기록이 삭제되며, 이 작업은 되돌릴 수 없습니다.'
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      await deleteAccount();
      alert('회원 탈퇴가 완료되었습니다.');
      navigate('/');
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('회원 탈퇴에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setDeletingAccount(false);
      setShowUserMenu(false);
    }
  };

  const handleSaveMap = async () => {
    if (!mapContainerRef.current) return;
    setSavingMap(true);
    try {
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1e293b'
      });
      const link = document.createElement('a');
      link.download = `ecospatial-map-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Failed to save map:', error);
      alert('지도 저장에 실패했습니다.');
    } finally {
      setSavingMap(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      setMessages(prev => [...prev, { role: 'model', text: 'API Key가 설정되어 있지 않습니다.', timestamp: new Date() }]);
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');

    const userMsg: Message = { role: 'user', text: userMessage, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // DB에 유저 메시지 저장 (로그인 유저만)
    let chatId = currentChatId;
    if (user && !isDemo) {
      try {
        // currentChatId가 없으면 새 채팅 생성
        if (!chatId) {
          const newTitle = userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
          const newChat = await createChat(newTitle);
          chatId = newChat.id;
          setCurrentChatId(chatId);
          setChats(prev => [newChat, ...prev]);
        }

        await saveMessage(chatId, 'user', userMessage);

        // 첫 메시지면 채팅 제목 업데이트 (기존 '새 채팅'인 경우)
        const chat = chats.find(c => c.id === chatId);
        if (chat && chat.title === '새 채팅') {
          const newTitle = userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
          await updateChatTitle(chatId, newTitle);
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c));
        }
      } catch (error) {
        console.error('Failed to save user message:', error);
      }
    }

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

      const response = await chatWithAgent(userMessage, history, { timeoutMs: 15000 });

      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          if (call.name === 'updateMapLayers') {
            const { activeLayers: layers, locationName } = call.args as any;
            setViewMode('map');

            if (locationName) {
              const lowerLoc = locationName.toLowerCase();
              const locationCoords: Record<string, [number, number]> = {
                '수원': [37.2635, 127.0287], '성남': [37.4201, 127.1265],
                '판교': [37.3947, 127.1112], '용인': [37.2411, 127.1776],
                '고양': [37.6583, 126.832], '안양': [37.3943, 126.9568],
                '남양주': [37.6360, 127.2165], '부천': [37.5034, 126.7660],
                '광명': [37.4786, 126.8644], '평택': [36.9921, 127.0857],
                '안산': [37.3219, 126.8309], '과천': [37.4292, 126.9876],
                '구리': [37.5943, 127.1295], '오산': [37.1498, 127.0772],
                '시흥': [37.3800, 126.8028], '군포': [37.3616, 126.9352],
                '의왕': [37.3447, 126.9685], '하남': [37.5392, 127.2147],
                '파주': [37.7126, 126.7610], '이천': [37.2719, 127.4348],
                '안성': [37.0078, 127.2797], '김포': [37.6153, 126.7156],
                '화성': [37.1995, 126.8313], '광주': [37.4095, 127.2550],
                '양주': [37.7854, 127.0456], '포천': [37.8949, 127.2003],
                '여주': [37.2984, 127.6374], '의정부': [37.7381, 127.0337],
                '연천': [38.0965, 127.0748], '가평': [37.8315, 127.5097],
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

            const requestedTypes = new Set((layers || []) as ClimateLayerType[]);
            const currentTypes = new Set(activeLayers.map(a => a.type));
            let needUpdate = requestedTypes.size !== currentTypes.size;
            if (!needUpdate) {
              for (const t of requestedTypes) {
                if (!currentTypes.has(t)) { needUpdate = true; break; }
              }
            }

            const hasDataLayer = requestedTypes.has(ClimateLayerType.AIR_QUALITY) ||
                                 requestedTypes.has(ClimateLayerType.ELDERLY_POPULATION) ||
                                 requestedTypes.has(ClimateLayerType.WEATHER);
            const prevLocationName = activeLayers.find(l => l.airQualityData)?.airQualityData?.locationName ||
                                     activeLayers.find(l => l.elderlyData)?.elderlyData?.districtName ||
                                     activeLayers.find(l => l.weatherData)?.weatherData?.sigun;
            if (hasDataLayer && locationName && locationName.replace(/시$|군$/g, '') !== prevLocationName?.replace(/시$|군$/g, '')) {
              needUpdate = true;
            }

            if (needUpdate) {
              const newActiveLayers: ActiveLayer[] = [];
              for (const type of layers || []) {
                const layerData: ActiveLayer = { id: `layer-${type}-${Date.now()}`, type, opacity: 0.75, visible: true };

                if (type === ClimateLayerType.ELDERLY_POPULATION && locationName) {
                  try {
                    const elderlyData = await getElderlyPopulation(locationName);
                    layerData.elderlyData = { districtName: elderlyData.districtName, seventyPlusCount: elderlyData.seventyPlusCount, seventyPlusRatio: elderlyData.seventyPlusRatio };
                  } catch (error) { console.error('Failed to fetch elderly data:', error); }
                }

                if (type === ClimateLayerType.AIR_QUALITY && locationName) {
                  try {
                    const airData = await getAirQuality(locationName);
                    layerData.airQualityData = {
                      stationName: airData.stationName, locationName: airData.locationName, measureTime: airData.measureTime,
                      lat: airData.lat, lng: airData.lng, khaiValue: airData.khaiValue, khaiGrade: airData.khaiGrade,
                      pm10Value: airData.pm10Value, pm10Grade: airData.pm10Grade, pm25Value: airData.pm25Value, pm25Grade: airData.pm25Grade,
                      so2Value: airData.so2Value, coValue: airData.coValue, o3Value: airData.o3Value, no2Value: airData.no2Value
                    };
                  } catch (error) { console.error('Failed to fetch air quality:', error); }
                }

                if (type === ClimateLayerType.WEATHER && locationName) {
                  try {
                    const weatherData = await getWeather(locationName);
                    if (weatherData) {
                      layerData.weatherData = {
                        sigun: weatherData.sigun, station: weatherData.station, datetime: weatherData.datetime,
                        lat: weatherData.lat, lon: weatherData.lon, temperature_c: weatherData.temperature_c,
                        humidity_pct: weatherData.humidity_pct, wind_speed_ms: weatherData.wind_speed_ms,
                        wind_direction_deg: weatherData.wind_direction_deg, heat_index: weatherData.heat_index, wind_chill: weatherData.wind_chill
                      };
                    }
                  } catch (error) { console.error('Failed to fetch weather:', error); }
                }

                newActiveLayers.push(layerData);
              }
              setActiveLayers(newActiveLayers);
            }
          }
        }
      }

      const modelText = response.text || "분석된 GIS 데이터를 지도에 시각화했습니다.";
      const modelMsg: Message = { role: 'model', text: modelText, timestamp: new Date() };
      setMessages(prev => [...prev, modelMsg]);

      // DB에 모델 응답 저장
      if (user && !isDemo && chatId) {
        try {
          await saveMessage(chatId, 'model', modelText);
        } catch (error) {
          console.error('Failed to save model message:', error);
        }
      }
    } catch (error: any) {
      let errorText = "데이터 연동 중 오류가 발생했습니다.";
      if (error?.message === 'Request timed out') errorText = '요청 시간이 초과되었습니다.';
      else if (error?.name === 'AbortError') return;

      setMessages(prev => [...prev, { role: 'model', text: errorText, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
      inFlightController.current = null;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-900 font-sans overflow-hidden text-slate-900">
      {/* 채팅 목록 사이드바 (로그인 유저만) */}
      {user && !isDemo && showChatList && (
        <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-800">채팅 기록</h2>
            <button onClick={() => setShowChatList(false)} className="p-1 hover:bg-slate-100 rounded">
              <PanelLeftClose size={18} className="text-slate-500" />
            </button>
          </div>
          <ChatSidebar
            chats={chats}
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            loading={chatsLoading}
            isDemo={isDemo}
          />
        </aside>
      )}

      {/* 메인 채팅 패널 */}
      <aside
        className={`relative fixed inset-0 z-50 md:relative md:inset-auto ${
          viewMode === 'chat' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } bg-white shadow-2xl transition-transform duration-300 ease-in-out flex flex-col`}
        style={isMounted && window.innerWidth >= 768 ? {
          width: chatWidth,
          minWidth: minWidth
        } : undefined}
      >
        {/* 리사이즈 핸들 */}
        <div
          className="hidden md:block absolute right-0 top-0 bottom-0 w-2 cursor-col-resize group z-20"
          onMouseDown={() => setIsResizing(true)}
        >
          <div className="absolute right-0 top-0 bottom-0 w-1 bg-slate-200 group-hover:bg-indigo-500 transition-colors" />
        </div>
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {user && !isDemo && !showChatList && (
              <button onClick={() => setShowChatList(true)} className="p-2 hover:bg-slate-100 rounded-xl">
                <PanelLeft size={20} className="text-slate-500" />
              </button>
            )}
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <Activity size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">EcoSpatial AI</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isDemo ? 'Demo Mode' : 'Connected'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user && !isDemo && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <User size={14} className="text-slate-500" />
                  <span className="text-xs font-medium text-slate-600 max-w-[80px] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* 드롭다운 메뉴 */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-400">로그인 계정</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <LogOut size={14} />
                      로그아웃
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deletingAccount}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deletingAccount ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      회원 탈퇴
                    </button>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setViewMode('map')} className="md:hidden p-2 bg-slate-100 rounded-xl text-slate-600">
              <Maximize2 size={20} />
            </button>

            {/* GG API key status */}
            <div className="hidden md:flex items-center gap-2">
              {import.meta.env.VITE_GG_CLIMATE_API_KEY ? (
                <div className="text-xs text-slate-500">
                  GG: <span className="font-mono">{import.meta.env.VITE_GG_CLIMATE_API_KEY.slice(0,4)}...{import.meta.env.VITE_GG_CLIMATE_API_KEY.slice(-4)}</span>
                </div>
              ) : (
                <div className="text-xs text-amber-600">GG Key 없음</div>
              )}
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-2 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                새로고침
              </button>
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="p-3 border-b border-slate-100 flex gap-2">
          <button onClick={handleNewChat} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 text-sm">
            <MessageSquare size={16} />
            새 채팅
          </button>
          <button onClick={handleSaveMap} disabled={savingMap} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 text-sm disabled:opacity-50">
            {savingMap ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            지도 저장
          </button>
        </div>

        {/* Demo Mode Banner */}
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-amber-800">체험 모드 - 채팅이 저장되지 않습니다</span>
            <button onClick={() => navigate('/login')} className="text-xs font-semibold text-amber-600 hover:text-amber-800 underline">로그인</button>
          </div>
        )}

        {missingApiWarning && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800">
            <strong>API Key 누락:</strong> {missingApiWarning}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-slate-100 text-slate-800 rounded-bl-none'
              }`}>
                {m.text}
              </div>
              <span className="text-[10px] mt-1 text-slate-400 px-1">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 px-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-slate-400">분석 중...</span>
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
                  { icon: <Droplets size={12}/>, label: '폭염취약성', color: 'text-orange-500', keyword: '폭염 취약성' },
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

      {/* Map */}
      <main ref={mapContainerRef} className={`flex-1 relative h-full bg-slate-100 ${viewMode === 'map' ? 'block' : 'hidden md:block'}`}>
        <div className="absolute top-4 left-4 z-[2000] flex gap-2">
          <button onClick={() => setViewMode('chat')}
            className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur rounded-xl shadow-lg text-slate-800 font-bold hover:bg-white border border-slate-200 md:hidden">
            <ArrowLeft size={18} className="text-indigo-600" />
            채팅
          </button>

          <div className="hidden md:flex bg-white/90 backdrop-blur p-1 rounded-xl shadow-lg border border-slate-200">
            <button onClick={() => setViewMode('chat')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${viewMode === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <MessageSquare size={14} /> AI
            </button>
            <button onClick={() => setViewMode('map')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}>
              <MapIcon size={14} /> 지도
            </button>
          </div>
        </div>

        <MapComponent
          activeLayers={activeLayers}
          viewState={viewState}
          locationName={currentLocationName}
          onRAGAnalysisGenerated={(analysis: string) => {
            if (analysis?.trim()) {
              setMessages(prev => {
                if (prev[prev.length - 1]?.text === analysis) return prev;
                return [...prev, { role: 'model', text: analysis, timestamp: new Date() }];
              });
            }
          }}
        />

        <div className="absolute bottom-4 right-4 z-[2000] pointer-events-none">
          <div className="bg-slate-900/50 backdrop-blur px-3 py-1.5 rounded-full text-[9px] text-white/80 font-medium">
            Data: GG Climate Platform
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
