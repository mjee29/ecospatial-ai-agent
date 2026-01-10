
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ClimateLayerType } from "../types";
import { GYEONGGI_DISTRICT_CODES } from "./sgisService";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// 대화 컨텍스트 추적을 위한 상태
interface ConversationContext {
  lastLocationName: string | null;
  lastLayerTypes: ClimateLayerType[];
  lastAnalysisTopic: string | null;
}

let conversationContext: ConversationContext = {
  lastLocationName: null,
  lastLayerTypes: [],
  lastAnalysisTopic: null
};

// 컨텍스트 업데이트 함수 (외부에서 호출)
export const updateConversationContext = (
  locationName?: string,
  layerTypes?: ClimateLayerType[],
  analysisTopic?: string
) => {
  if (locationName) conversationContext.lastLocationName = locationName;
  if (layerTypes && layerTypes.length > 0) conversationContext.lastLayerTypes = layerTypes;
  if (analysisTopic) conversationContext.lastAnalysisTopic = analysisTopic;
  console.log('[Context] Updated conversation context:', conversationContext);
};

// 컨텍스트 초기화
export const resetConversationContext = () => {
  conversationContext = {
    lastLocationName: null,
    lastLayerTypes: [],
    lastAnalysisTopic: null
  };
};

// 현재 컨텍스트 조회
export const getConversationContext = () => ({ ...conversationContext });

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
// 주의: Tool call이 포함된 응답은 캐시하지 않음 (매번 새 데이터 조회 필요)
const _chatCache = new Map<string, any>();

// 캐시 초기화 함수 (새 분석 요청 시 호출)
export const clearChatCache = () => {
  _chatCache.clear();
  console.log('[Gemini API] Cache cleared');
};

// Tool 실행 결과 타입
export interface ToolExecutionResult {
  toolName: string;
  args: any;
  result: {
    success: boolean;
    locationName?: string;
    layersActivated?: string[];
    climateData?: {
      floodRisk?: { level: string; description: string };
      heatwaveRisk?: { level: string; description: string };
      elderlyData?: {
        totalPopulation: number;
        elderlyPopulation: number;
        elderlyRatio: number;
        avgAge: number;
      };
      greenSpace?: { coverage: string; description: string };
    };
    message: string;
  };
}

// 확장된 히스토리 타입 (function role 포함)
type ChatHistoryItem =
  | { role: 'user' | 'model'; parts: { text: string }[] }
  | { role: 'function'; parts: { functionResponse: { name: string; response: any } }[] };

/**
 * AI에게 Tool 실행 결과를 전송하고 최종 답변을 받는 함수
 * Gemini의 Multi-turn Function Calling 패턴 구현
 */
export const sendToolResult = async (
  originalMessage: string,
  history: ChatHistoryItem[],
  toolResult: ToolExecutionResult,
  options?: { timeoutMs?: number }
): Promise<{ text: string; functionCalls?: any[] }> => {
  if (!apiKey) {
    throw new Error('API Key가 누락되었습니다.');
  }

  const timeoutMs = options?.timeoutMs ?? 15000;

  try {
    console.log('[Gemini API] Sending tool result for:', toolResult.toolName);
    console.log('[Gemini API] Tool result data:', toolResult.result);

    // Function response를 포함한 새 히스토리 구성
    const updatedHistory: any[] = [
      ...history,
      // AI의 function call 응답 (model role)
      {
        role: 'model',
        parts: [{
          functionCall: {
            name: toolResult.toolName,
            args: toolResult.args
          }
        }]
      },
      // Tool 실행 결과 (function role)
      {
        role: 'function',
        parts: [{
          functionResponse: {
            name: toolResult.toolName,
            response: toolResult.result
          }
        }]
      }
    ];

    const requestPromise = ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: updatedHistory,
      config: {
        systemInstruction: getSystemInstruction(),
        tools: [{ functionDeclarations: mapTools }]
      }
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
    );

    const response = await Promise.race([requestPromise, timeoutPromise]) as any;

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
    const text = textParts.join('');

    const functionCalls = parts
      .filter((p: any) => p.functionCall)
      .map((p: any) => ({
        name: p.functionCall.name,
        args: p.functionCall.args
      }));

    console.log('[Gemini API] Final response after tool result:', text);

    return { text, functionCalls };
  } catch (error) {
    console.error("[Gemini API Error] sendToolResult:", error);
    throw error;
  }
};

// System Instruction을 별도 함수로 분리 (재사용)
const getSystemInstruction = () => `당신은 대한민국 경기도의 기후 위기 대응을 지원하는 "EcoSpatial AI" 분석가입니다.
당신의 임무는 사용자의 자연어 질문을 해석하여 경기도 기후플랫폼의 GIS 데이터와 실시간 통계 데이터를 지도로 시각화하고, 복합적인 리스크를 설명하는 것입니다.

[데이터 소스]
- 경기도 기후플랫폼 WMS: 침수흔적지도, 폭염 등급, 극한호우 위험도, 녹지 현황
- 통계청 SGIS API: 시군구별 고령인구 데이터 (60대, 70대 이상 인구수/비율, 평균연령)

[분석 지침]
1. 사용자가 특정 지역(예: '수원', '성남', '장안구')을 언급하면 'updateMapLayers'의 'locationName'에 해당 지명을 정확히 할당하세요.
2. 기후 리스크(침수, 폭염)와 사회적 취약성(노인 인구, 고령인구)을 동시에 언급하면 두 레이어를 모두 활성화하여 '중첩 분석(Overlap Analysis)'을 수행하세요.
3. **고령인구 데이터 분석**: 노인 인구, 고령 인구 관련 요청 시 'elderly' 레이어를 활성화하세요.
4. **Tool 실행 결과 활용 (매우 중요!)**:
   - 'updateMapLayers' 도구 호출 후, 시스템이 해당 지역의 실제 기후 데이터를 조회하여 결과를 전달합니다.
   - 이 결과에 포함된 구체적인 수치(침수위험 등급, 폭염 등급, 고령인구 비율 등)를 반드시 답변에 포함하세요.
   - 예: "성남시의 침수 위험 등급은 2등급이며, 폭염 취약성은 '주의' 수준입니다."
5. 모든 지리적 범위는 '경기도' 내로 한정됩니다.

[멀티턴 대화 처리]
6. **후속 질문 맥락 유지**: "그럼 B 지역은?", "거기는 어때?" 같은 후속 질문은 이전 분석 주제를 유지하세요.
7. **분석 주제 연속성**: 지역만 변경되고 분석 주제가 명시되지 않으면, 이전과 동일한 레이어 타입을 유지하세요.

[답변 형식]
- 구체적인 수치와 등급을 포함하여 전문가 수준의 분석 결과를 제공하세요.
- 데이터가 제공되면 반드시 해당 수치를 인용하여 설명하세요.`;

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
        systemInstruction: getSystemInstruction(),
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

    // Function call이 포함된 응답은 캐시하지 않음 (매번 새 데이터 조회 필요)
    if (functionCalls.length === 0) {
      _chatCache.set(key, result);
    } else {
      console.log('[Gemini API] Skipping cache for function call response');
    }

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
