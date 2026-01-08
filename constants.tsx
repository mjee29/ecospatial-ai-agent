
import { ClimateLayerType } from './types';

export const GYEONGGI_BOUNDS: [number, number][] = [
  [36.8, 126.5], // Southwest
  [38.3, 127.8]  // Northeast
];

export const INITIAL_VIEW: [number, number] = [37.2635727, 127.0287149]; // Suwon center

// 경기기후플랫폼의 실제 API 엔드포인트 및 레이어 정보 (예시 포함)
export const GYEONGGI_WMS_URL = 'https://climate.gg.go.kr/ols/data/api/wms';

export const LAYER_METADATA = {
  [ClimateLayerType.FLOOD_RISK]: {
    name: '침수위험지역',
    color: '#ef4444',
    wmsLayer: 'v_flood_risk_area', // 플랫폼 내 실제 레이어 ID로 추정
    description: '침수 흔적 및 지형 기반 위험 지역입니다.'
  },
  [ClimateLayerType.HEATWAVE_VULNERABILITY]: {
    name: '폭염취약성',
    color: '#f97316',
    wmsLayer: 'v_heat_vulner_area',
    description: '도시 열섬 현상 및 취약계층 분포 기반 데이터입니다.'
  },
  [ClimateLayerType.ELDERLY_POPULATION]: {
    name: '노인 인구 밀도',
    color: '#8b5cf6',
    wmsLayer: 'v_pop_elder_density',
    description: '65세 이상 인구 거주 밀도입니다.'
  },
  [ClimateLayerType.GREEN_SPACE]: {
    name: '녹지 및 공원',
    color: '#22c55e',
    wmsLayer: 'v_park_area',
    description: '도시 공원 및 녹지 구역 정보입니다.'
  },
  [ClimateLayerType.AIR_QUALITY]: {
    name: '대기질 정보',
    color: '#06b6d4',
    wmsLayer: 'v_air_quality_index',
    description: '대기 오염도 및 미세먼지 수치입니다.'
  }
};
