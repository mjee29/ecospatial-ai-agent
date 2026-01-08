
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ClimateLayerType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

export const chatWithAgent = async (
  message: string, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[]
) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
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
        5. 모든 지리적 범위는 '경기도' 내로 한정됩니다.`,
        tools: [{ functionDeclarations: mapTools }]
      }
    });

    return response;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
