
# 🌍 EcoSpatial AI: Climate Analysis Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Gemini](https://img.shields.io/badge/AI-Gemini%203%20Pro-orange.svg)](https://ai.google.dev/)

**EcoSpatial AI**는 자연어를 통해 복잡한 기후 데이터와 지리 정보 시스템(GIS)을 제어하는 인공지능 에이전트입니다. 사용자는 대화를 통해 경기도의 기후 리스크(침수, 폭염)와 사회적 취약성(노인 인구 밀도) 데이터를 즉시 지도로 시각화하고 분석할 수 있습니다.

## ✨ 핵심 기능

- **자연어 GIS 제어**: "수원시의 노인 인구와 폭염 취약 지역을 겹쳐서 보여줘"와 같은 명령 수행.
- **Spatial RAG (Retrieval-Augmented Generation)**: AI가 질문의 맥락에 맞는 WMS(Web Map Service) 레이어를 판단하여 실시간 호출.
- **실시간 데이터 시각화**: 경기도 기후플랫폼의 실제 레이어를 활용한 인터랙티브 맵.
- **반응형 대시보드**: 데스크탑과 모바일 환경을 모두 지원하는 현대적인 UI.

## 🚀 빠른 시작 (Fork & Run)

### 1. 저장소 복제 (또는 Fork 후 복제)
```bash
git clone https://github.com/your-username/ecospatial-ai-agent.git
cd ecospatial-ai-agent
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.example` 파일을 복사하여 `.env` 파일을 만들고, [Google AI Studio](https://aistudio.google.com/)에서 발급받은 API 키를 입력하세요.
```bash
cp .env.example .env
# .env 파일을 열어 API_KEY=내_키_값 수정
```

### 4. 개발 서버 실행
```bash
npm start
```

## 🛠 기술 스택

- **Frontend**: React 19, Tailwind CSS, Lucide Icons
- **Mapping**: Leaflet, React-Leaflet (WMS Integration)
- **AI Engine**: Google Gemini 3 Pro (Function Calling 활용)
- **Environment**: Vite, TypeScript

## 🧠 아키텍처: Spatial RAG

이 에이전트는 사용자의 질문을 받으면 다음 과정을 거칩니다:
1. **의도 파악**: 지명(Location)과 분석 대상(Layer) 추출.
2. **도구 호출**: `updateMapLayers` 함수를 통해 필요한 WMS 레이어 ID와 지도 중심 좌표 결정.
3. **동적 렌더링**: Leaflet 엔진이 기후플랫폼 서버에서 데이터를 가져와 레이어 중첩.
4. **결과 요약**: 시각화된 데이터의 의미를 사용자에게 한국어로 상세 설명.

## 📄 라이선스
이 프로젝트는 MIT 라이선스를 따릅니다. 자유롭게 Fork하여 기여해 주세요!
