# EcoSpatial AI: Climate Analysis Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%202.0-orange.svg)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Auth-Supabase-green.svg)](https://supabase.com/)

**EcoSpatial AI**는 자연어를 통해 복잡한 기후 데이터와 지리 정보 시스템(GIS)을 제어하는 인공지능 에이전트입니다. 사용자는 대화를 통해 경기도의 기후 리스크(침수, 폭염)와 사회적 취약성(노인 인구 밀도), 실시간 대기질 및 기상 정보를 즉시 지도로 시각화하고 분석할 수 있습니다.

## 핵심 기능

### AI 기반 GIS 분석
- **자연어 GIS 제어**: "수원시의 노인 인구와 대기질 정보를 같이 보여줘"와 같은 명령 수행
- **Spatial RAG**: AI가 질문의 맥락에 맞는 데이터 레이어를 판단하여 실시간 호출
- **다중 데이터 소스 통합**: 기후, 대기질, 기상, 인구 데이터를 하나의 지도에 시각화

### 데이터 레이어
- **실시간 대기질** (에어코리아): PM10, PM2.5, 오존, 통합대기환경지수
- **실시간 기상** (경기도 AWS): 기온, 습도, 풍속, 체감온도
- **노인 인구 밀도** (통계청 SGIS): 70세 이상 인구 비율
- **녹지 현황** (경기도 기후플랫폼): 비오톱 면적 및 분류
- **침수 위험 지역** (경기도 기후플랫폼 WMS)

### 사용자 기능
- **회원 인증**: 이메일/비밀번호 로그인, 회원가입, 회원탈퇴
- **채팅 기록 저장**: 로그인 시 대화 내용이 자동 저장되어 언제든 다시 확인 가능
- **체험 모드**: 로그인 없이도 모든 분석 기능 사용 가능
- **반응형 UI**: 데스크탑/모바일 지원, 채팅창 크기 조절 가능

## 빠른 시작

### 1. 저장소 복제
```bash
git clone https://github.com/mjee29/ecospatial-ai-agent.git
cd ecospatial-ai-agent
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.local` 파일을 생성하고 다음 API 키들을 입력하세요:

```env
# Google Gemini AI
VITE_GEMINI_API_KEY=your_gemini_api_key

# 경기도 기후플랫폼
VITE_GG_CLIMATE_API_KEY=your_gg_climate_api_key

# 통계청 SGIS
VITE_SGIS_CONSUMER_KEY=your_sgis_key
VITE_SGIS_CONSUMER_SECRET=your_sgis_secret

# 에어코리아
VITE_AIRKOREA_SERVICE_KEY=your_airkorea_key

# 경기도 AWS 기상관측
VITE_GG_AWS_API_KEY=your_gg_aws_key

# Supabase (인증 및 데이터베이스)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Supabase 설정 (선택사항)
채팅 저장 기능을 사용하려면 Supabase에서 다음 테이블을 생성하세요:

```sql
-- 채팅 테이블
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT '새 채팅',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 메시지 테이블
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own chats" ON chats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own messages" ON messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM chats WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid())
  );
```

### 5. 개발 서버 실행
```bash
npm start
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| **Frontend** | React 19, TypeScript, Tailwind CSS |
| **Mapping** | Leaflet, React-Leaflet (WMS/WFS) |
| **AI Engine** | Google Gemini 2.0 Flash (Function Calling) |
| **Authentication** | Supabase Auth |
| **Database** | Supabase PostgreSQL |
| **Build Tool** | Vite |

## 아키텍처: Spatial RAG

```
사용자 질문
    ↓
[Gemini AI] 의도 파악 (지명 + 분석 대상)
    ↓
[Function Calling] updateMapLayers 호출
    ↓
[Data Services] 병렬 데이터 수집
    ├── 에어코리아 API (대기질)
    ├── 경기도 AWS API (기상)
    ├── SGIS API (인구)
    └── 기후플랫폼 WMS/WFS (기후 레이어)
    ↓
[Leaflet] 지도 시각화
    ↓
[RAG Analysis] 데이터 기반 분석 결과 생성
```

## 프로젝트 구조

```
ecospatial-ai-agent/
├── components/
│   ├── MapComponent.tsx     # 지도 및 데이터 시각화
│   └── ChatSidebar.tsx      # 채팅 기록 사이드바
├── pages/
│   ├── LandingPage.tsx      # 랜딩 페이지
│   ├── LoginPage.tsx        # 로그인
│   ├── RegisterPage.tsx     # 회원가입
│   └── DashboardPage.tsx    # 메인 대시보드
├── services/
│   ├── geminiService.ts     # Gemini AI 연동
│   ├── supabaseService.ts   # 인증 및 DB
│   ├── sgisService.ts       # 통계청 인구 데이터
│   ├── airkoreaService.ts   # 에어코리아 대기질
│   ├── weatherService.ts    # 경기도 기상 데이터
│   └── greenSpaceService.ts # 녹지 데이터
├── contexts/
│   └── AuthContext.tsx      # 인증 상태 관리
└── hooks/
    └── useAuth.ts           # 인증 훅
```

## 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
