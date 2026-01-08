
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
        당신의 임무는 사용자의 자연어 질문을 해석하여 경기도 기후플랫폼의 GIS 데이터를 지도로 시각화하고, 복합적인 리스크를 설명하는 것입니다.

        [분석 지침]
        1. 사용자가 특정 지역(예: '수원', '성남')을 언급하면 'updateMapLayers'의 'locationName'에 해당 지명을 할당하세요.
        2. 기후 리스크(침수, 폭염)와 사회적 취약성(노인 인구)을 동시에 언급하면 두 레이어를 모두 활성화하여 '중첩 분석(Overlap Analysis)'을 수행하세요.
        3. 'updateMapLayers' 도구를 호출한 후에는 지도에 어떤 데이터가 표시되었는지, 그리고 그 데이터가 어떤 의미를 갖는지 전문가 수준의 한국어로 설명하세요.
        4. "지도 보여줘"와 같은 단순 요청에는 현재 경기도에서 가장 이슈가 되는 기후 레이어(예: 폭염)를 제안하며 보여주세요.
        5. 모든 지리적 범위는 '경기도' 내로 한정됩니다.
        6. 현재는 데모 데이터를 사용 중이므로, 실제 경기도 데이터가 아니라 시각화 예시임을 안내하세요.`,
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
