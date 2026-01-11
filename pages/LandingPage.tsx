/**
 * Landing Page
 * 서비스 소개 및 로그인/회원가입/체험하기 버튼
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Activity, Map, Users, Wind, ArrowRight, Sparkles } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, setIsDemo } = useAuth();

  // 로그인된 유저는 대시보드로 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const handleDemo = () => {
    setIsDemo(true);
    navigate('/dashboard');
  };

  // 로딩 중이거나 로그인된 유저면 아무것도 렌더링하지 않음
  if (loading || user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
          <div className="absolute top-60 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20">
          {/* Header */}
          <nav className="flex items-center justify-between mb-20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
                <Activity size={24} strokeWidth={2.5} />
              </div>
              <span className="text-xl font-bold text-white">EcoSpatial AI</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2.5 text-slate-300 hover:text-white font-medium transition-colors"
              >
                로그인
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/30"
              >
                회원가입
              </button>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-sm font-medium mb-8">
              <Sparkles size={16} />
              AI 기반 기후 데이터 분석 플랫폼
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
              경기도 기후 데이터를
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                AI로 분석하세요
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed">
              침수 위험, 폭염 취약성, 대기질, 노인 인구 밀도 등 다양한 기후 데이터를
              대화형 AI와 함께 지도에서 시각화하고 분석합니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleDemo}
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-500 hover:to-purple-500 transition-all shadow-xl shadow-indigo-500/30"
              >
                체험하기
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-lg hover:bg-white/10 transition-all"
              >
                무료로 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
            <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6">
              <Map size={28} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">실시간 GIS 시각화</h3>
            <p className="text-slate-400 leading-relaxed">
              경기도 기후플랫폼의 WMS 레이어를 활용한 실시간 기후 데이터 지도 시각화
            </p>
          </div>

          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
            <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
              <Users size={28} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">사회적 취약성 분석</h3>
            <p className="text-slate-400 leading-relaxed">
              통계청 SGIS 데이터를 활용한 노인 인구 밀도 및 사회적 취약 지역 분석
            </p>
          </div>

          <div className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all">
            <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center mb-6">
              <Wind size={28} className="text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">대기질 & 기상 정보</h3>
            <p className="text-slate-400 leading-relaxed">
              에어코리아 및 경기도 AWS 기상관측 데이터를 통한 실시간 환경 정보 제공
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          EcoSpatial AI - Gyeonggi Climate Data Analysis Platform
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
