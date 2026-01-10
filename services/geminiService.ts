
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ClimateLayerType } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Explicit runtime guard: throw a structured error if missing so callers can react and show helpful UI
if (!apiKey) {
  console.error('VITE_GEMINI_API_KEY is not set in environment variables');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const hasGeminiApiKey = () => Boolean(apiKey);

const mapTools: FunctionDeclaration[] = [
  {
    name: "updateMapLayers",
    description: "Update the visible climate and social data layers on the map based on the user's request. Used for spatial analysis of risks and vulnerabilities.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        activeLayers: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
            enum: Object.values(ClimateLayerType)
          },
          description: "List of layers to activate or show. Can combine multiple layers for overlap analysis."
        },
        locationName: {
          type: Type.STRING,
          description: "The specific city (Si/Gun) or district in Gyeonggi-do to focus on (e.g., 수원, 용인, 판교)."
        },
        filterCondition: {
          type: Type.STRING,
          description: "Optional spatial filter or attribute query."
        }
      },
      required: ["activeLayers"]
    }
  }
];

// Simple in-memory cache to avoid repeated identical requests
const _chatCache = new Map<string, any>();

// RAG 분석 데이터 타입
interface RAGAnalysisData {
  locationName: string;
  elderlyData?: {
    districtName: string;
    totalPopulation: number;
    elderlyPopulation: number;
    elderlyRatio: number;
    sixtyCount: number;
    seventyPlusCount: number;
    avgAge: number;
  };
  airQualityData?: {
    stationName: string;
    locationName: string;
    measureTime: string;
    khaiValue: number;
    khaiGrade: number;
    pm10Value: number;
    pm10Grade: number;
    pm25Value: number;
    pm25Grade: number;
    so2Value: number;
    coValue: number;
    o3Value: number;
    no2Value: number;
  };
  weatherData?: {
    sigun: string;
    station: string;
    datetime: string;
    temperature_c: number;
    humidity_pct: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    heat_index: number | null;
    wind_chill: number | null;
  };
  // WMS 레이어 정보 (침수위험, 폭염취약성, 녹지현황 등)
  wmsLayers?: string[];
  // WFS에서 가져온 실제 feature 데이터
  wfsFeatureData?: Array<{
    layerName: string;
    featureCount: number;
    sampleProperties: Record<string, any>[];
  }>;
}

// 지도 확대 시 해당 지역 데이터를 기반으로 RAG 분석 생성
export const generateRAGAnalysis = async (data: RAGAnalysisData): Promise<string> => {
  if (!apiKey) {
    console.error('[RAG Analysis] API key missing');
    return '분석을 생성할 수 없습니다. API 키가 설정되지 않았습니다.';
  }

  // 데이터가 없으면 분석 불가
  if (!data.elderlyData && !data.airQualityData && !data.weatherData && (!data.wmsLayers || data.wmsLayers.length === 0)) {
    return '';
  }

  // 데이터 컨텍스트 구성
  let dataContext = `## ${data.locationName} 지역 현황 데이터\n\n`;

  if (data.elderlyData) {
    const e = data.elderlyData;
    dataContext += `### 고령인구 현황\n`;
    dataContext += `- 행정구역: ${e.districtName}\n`;
    dataContext += `- 총 인구: ${e.totalPopulation.toLocaleString()}명\n`;
    dataContext += `- 고령인구(65세 이상): ${e.elderlyPopulation.toLocaleString()}명\n`;
    dataContext += `- 고령화율: ${e.elderlyRatio.toFixed(1)}%\n`;
    dataContext += `- 60대 인구: ${e.sixtyCount.toLocaleString()}명\n`;
    dataContext += `- 70대 이상 인구: ${e.seventyPlusCount.toLocaleString()}명\n`;
    dataContext += `- 평균 연령: ${e.avgAge.toFixed(1)}세\n\n`;
  }

  if (data.airQualityData) {
    const a = data.airQualityData;
    const gradeLabels: Record<number, string> = { 1: '좋음', 2: '보통', 3: '나쁨', 4: '매우나쁨' };
    dataContext += `### 실시간 대기질 현황\n`;
    dataContext += `- 측정소: ${a.stationName}\n`;
    dataContext += `- 측정시간: ${a.measureTime}\n`;
    dataContext += `- 통합대기환경지수(KHAI): ${a.khaiValue} (${gradeLabels[a.khaiGrade] || '알 수 없음'})\n`;
    dataContext += `- PM10 (미세먼지): ${a.pm10Value} μg/m³ (${gradeLabels[a.pm10Grade] || '알 수 없음'})\n`;
    dataContext += `- PM2.5 (초미세먼지): ${a.pm25Value} μg/m³ (${gradeLabels[a.pm25Grade] || '알 수 없음'})\n`;
    dataContext += `- 오존(O₃): ${a.o3Value.toFixed(3)} ppm\n`;
    dataContext += `- 이산화질소(NO₂): ${a.no2Value.toFixed(3)} ppm\n`;
    dataContext += `- 일산화탄소(CO): ${a.coValue.toFixed(1)} ppm\n`;
    dataContext += `- 아황산가스(SO₂): ${a.so2Value.toFixed(3)} ppm\n\n`;
  }

  if (data.weatherData) {
    const w = data.weatherData;
    dataContext += `### 실시간 기상 현황\n`;
    dataContext += `- 관측소: ${w.station} (${w.sigun})\n`;
    dataContext += `- 관측시간: ${w.datetime}\n`;
    dataContext += `- 기온: ${w.temperature_c.toFixed(1)}°C\n`;
    dataContext += `- 습도: ${w.humidity_pct.toFixed(0)}%\n`;
    dataContext += `- 풍속: ${w.wind_speed_ms.toFixed(1)} m/s\n`;
    dataContext += `- 풍향: ${w.wind_direction_deg.toFixed(0)}°\n`;
    if (w.heat_index !== null) {
      dataContext += `- 열지수(체감온도): ${w.heat_index.toFixed(1)}°C\n`;
    }
    if (w.wind_chill !== null) {
      dataContext += `- 체감온도(바람): ${w.wind_chill.toFixed(1)}°C\n`;
    }
    dataContext += '\n';
  }

  // WMS 레이어 정보 추가
  if (data.wmsLayers && data.wmsLayers.length > 0) {
    dataContext += `### 활성화된 기후 분석 레이어\n`;
    data.wmsLayers.forEach(layer => {
      dataContext += `- ${layer}\n`;
    });
    dataContext += '\n';
  }

  // WFS 실제 데이터 추가
  if (data.wfsFeatureData && data.wfsFeatureData.length > 0) {
    dataContext += `### 지역 내 실제 피처 데이터\n`;
    data.wfsFeatureData.forEach(wfs => {
      dataContext += `\n#### ${wfs.layerName} (${wfs.featureCount}개 피처 발견)\n`;
      wfs.sampleProperties.forEach((props, idx) => {
        dataContext += `**피처 ${idx + 1}:**\n`;
        Object.entries(props).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            // 긴 값은 축약
            const displayValue = String(value).length > 100
              ? String(value).substring(0, 100) + '...'
              : String(value);
            dataContext += `  - ${key}: ${displayValue}\n`;
          }
        });
      });
    });
    dataContext += '\n';
  }

  try {
    console.log('[RAG Analysis] Generating analysis for:', data.locationName);
    console.log('[RAG Analysis] Data context:\n', dataContext);

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: 'user',
          parts: [{
            text: `다음은 ${data.locationName} 지역의 실시간 데이터입니다. 이 데이터를 기반으로 2-3문장의 간결한 분석을 제공해주세요.

${dataContext}

다음 지침을 따라주세요:
1. 해당 지역의 핵심 특징을 간결하게 설명
2. 고령인구가 있다면 고령화율과 취약계층 관점에서 설명
3. 대기질 데이터가 있다면 현재 상태와 건강 영향 설명
4. 기상 데이터가 있다면 현재 날씨와 체감 상태 설명
5. 실제 피처 데이터가 있다면 구체적인 수치와 속성을 인용 (예: "녹지율 23.5%", "침수위험등급 3등급" 등)
6. 활성화된 레이어가 있다면 해당 리스크 유형 언급 (침수위험, 폭염취약성, 녹지현황 등)
7. 복합 리스크가 있다면 강조 (예: 폭염+고령인구, 침수위험+취약계층 등)
8. 전문적이지만 이해하기 쉬운 한국어로 작성
9. 최대 3문장으로 제한`
          }]
        }
      ],
      config: {
        systemInstruction: `당신은 경기도 기후 데이터 분석 전문가입니다. 주어진 데이터를 기반으로 간결하고 유익한 분석을 제공합니다.
        숫자와 통계를 구체적으로 인용하며, 해당 지역 주민에게 유용한 정보를 전달합니다.
        응답은 반드시 2-3문장으로 제한하고, 자연스러운 한국어로 작성합니다.`
      }
    });

    const candidate = response.candidates?.[0];
    const text = candidate?.content?.parts?.find((p: any) => p.text)?.text || '';

    console.log('[RAG Analysis] Generated:', text);
    return text;
  } catch (error) {
    console.error('[RAG Analysis] Error:', error);
    return '데이터 분석 중 오류가 발생했습니다.';
  }
};

export const chatWithAgent = async (
  message: string,
  history: { role: 'user' | 'model', parts: { text: string }[] }[],
  options?: { timeoutMs?: number }
) => {
  const key = `${message}::${JSON.stringify(history)}`;
  if (_chatCache.has(key)) {
    console.log('[Gemini API] Returning cached response for key:', key);
    return _chatCache.get(key);
  }

  // If API key is missing, throw a structured error so the UI can display localized help
  if (!apiKey) {
    const err: any = new Error('API Key가 누락되었습니다.');
    err.statusCode = 'E002';
    err.messageKR = 'API Key가 누락되었습니다.';
    console.error('[Gemini API] Aborting request: API key missing (E002)');
    throw err;
  }

  const timeoutMs = options?.timeoutMs ?? 15000; // default 15s timeout

  try {
    console.log('[Gemini API] Sending request with message:', message);
    console.log('[Gemini API] Using API key:', apiKey ? 'API key is set' : 'API key is missing');

    const requestPromise = ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `당신은 대한민국 경기도의 기후 위기 대응을 지원하는 "EcoSpatial AI" 분석가입니다.
        당신의 임무는 사용자의 자연어 질문을 해석하여 경기도 기후플랫폼의 GIS 데이터와 실시간 통계 데이터를 지도로 시각화하고, 복합적인 리스크를 설명하는 것입니다.

        [데이터 소스]
        - 경기도 기후플랫폼 WMS: 침수흔적지도, 폭염 등급, 극한호우 위험도, 녹지 현황
        - 통계청 SGIS API: 시군구별 고령인구 데이터 (60대, 70대 이상 인구수/비율, 평균연령)
        - 환경부 에어코리아 API: 실시간 대기질 정보 (PM10, PM2.5, 통합대기환경지수, 오존, 이산화질소 등)
        - 경기도 AWS 기상관측 API: 실시간 기온, 습도, 풍속, 풍향, 체감온도(열지수/풍속체감온도)

        [분석 지침]
        1. 사용자가 특정 지역(예: '수원', '성남', '장안구')을 언급하면 'updateMapLayers'의 'locationName'에 해당 지명을 정확히 할당하세요.
        2. 기후 리스크(침수, 폭염)와 사회적 취약성(노인 인구, 고령인구, 대기질)을 동시에 언급하면 여러 레이어를 활성화하여 '중첩 분석(Overlap Analysis)'을 수행하세요.
        3. **고령인구 데이터 분석**: 노인 인구, 고령 인구 관련 요청 시 'elderly' 레이어를 활성화하세요. 시스템이 자동으로 SGIS API를 통해 해당 지역의 실시간 고령인구 통계를 가져옵니다.
        4. **대기질 데이터 분석**: 대기질, 미세먼지, PM2.5, PM10, 오존, 공기질 등의 키워드가 언급되면 'air_quality' 레이어를 활성화하세요. 시스템이 에어코리아 API를 통해 해당 지역 측정소의 실시간 대기질 데이터를 가져옵니다.
        5. **실시간 기상 데이터 분석**: 기온, 온도, 날씨, 습도, 풍속, 체감온도, 열지수 등의 키워드가 언급되면 'weather' 레이어를 활성화하세요. 시스템이 경기도 AWS 기상관측 API를 통해 해당 지역의 실시간 기상 데이터를 가져옵니다.
        6. 'updateMapLayers' 도구를 호출한 후에는 지도에 어떤 데이터가 표시되었는지, 그리고 그 데이터가 어떤 의미를 갖는지 전문가 수준의 한국어로 설명하세요.
           - 고령인구 데이터: 총인구, 고령인구 수, 고령화 비율, 평균연령 등을 구체적으로 언급
           - 대기질 데이터: PM10, PM2.5 농도와 등급(좋음/보통/나쁨/매우나쁨), 통합대기환경지수를 명확히 설명
           - 기상 데이터: 현재 기온, 습도, 풍속, 체감온도(여름철 열지수/겨울철 풍속체감온도)를 구체적으로 언급
           - 복합 분석: 폭염과 대기질이 동시에 나쁜 경우, 고령인구가 많은 지역의 침수 위험 등 복합 리스크를 강조
        7. "지도 보여줘"와 같은 단순 요청에는 현재 경기도에서 가장 이슈가 되는 기후 레이어(예: 폭염, 대기질)를 제안하며 보여주세요.
        8. 모든 지리적 범위는 '경기도' 내로 한정됩니다.
        9. WMS 데이터는 데모용 시각화이며, SGIS 고령인구 데이터, 에어코리아 대기질 데이터, 경기도 AWS 기상 데이터는 실제 공공 API를 통한 실시간 데이터임을 인지하고 설명하세요.`,
        tools: [{ functionDeclarations: mapTools }]
      }
    });

    // Simple timeout wrapper so long-running requests fail fast and don't block the UI
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeoutMs));

    const start = Date.now();
    const response = await Promise.race([requestPromise, timeoutPromise]) as any;
    const elapsed = Date.now() - start;

    console.log('[Gemini API] Response received in', elapsed, 'ms');

    // Parse the response properly
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    const parts = content?.parts || [];

    // Extract text parts
    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
    const text = textParts.join('');

    // Extract function calls
    const functionCalls = parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({
        name: p.functionCall.name,
        args: p.functionCall.args
      }));

    console.log('[Gemini API] Parsed text:', text);
    console.log('[Gemini API] Parsed functionCalls:', functionCalls);

    const result = { text, functionCalls };
    _chatCache.set(key, result);
    return result;
  } catch (error) {
    console.error("[Gemini API Error] Full error details:", error);
    if (error instanceof Error) {
      console.error("[Gemini API Error] Message:", error.message);
      console.error("[Gemini API Error] Stack:", error.stack);
    }
    throw error;
  }
};
