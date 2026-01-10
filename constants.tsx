
import { ClimateLayerType } from './types';

export const GYEONGGI_BOUNDS: [number, number][] = [
  [36.8, 126.5], // Southwest
  [38.3, 127.8]  // Northeast
];

export const INITIAL_VIEW: [number, number] = [37.2635727, 127.0287149]; // Suwon center

// 경기도 기후플랫폼 GeoServer WMS/WFS API (프록시 경로 사용)
// API 키는 MapComponent에서 URL에 직접 추가
export const GYEONGGI_WMS_BASE_URL = '/wms';
export const GYEONGGI_WFS_BASE_URL = '/wfs';

export const LAYER_METADATA = {
  [ClimateLayerType.FLOOD_RISK]: {
    name: '침수흔적지도',
    color: '#ef4444',
    wmsLayer: 'spggcee:tm_fldn_trce',
    description: '침수 흔적 및 지형 기반 위험 지역입니다.'
  },
  [ClimateLayerType.HEATWAVE_VULNERABILITY]: {
    name: '폭염 등급 평가',
    color: '#f97316',
    wmsLayer: 'spggcee:rst_thrcf_evl_41',
    description: '도시 열섬 현상 및 폭염 취약성 등급 데이터입니다.'
  },
  [ClimateLayerType.ELDERLY_POPULATION]: {
    name: '고령인구 밀도',
    color: '#8b5cf6',
    wmsLayer: 'spggcee:tm_sigun_flod_dngr_evl_rnk',
    description: '통계청 SGIS 데이터 기반 60대 이상 고령인구 분포입니다.'
  },
  [ClimateLayerType.GREEN_SPACE]: {
    name: '녹지 현황도',
    color: '#22c55e',
    wmsLayer: 'spggcee:grbt',
    description: '도시 공원 및 녹지 구역 정보입니다.'
  },
  [ClimateLayerType.AIR_QUALITY]: {
    name: '실시간 대기질',
    color: '#06b6d4',
    wmsLayer: 'spggcee:grbt',
    description: '에어코리아 실시간 대기질 정보 (PM10, PM2.5, 통합대기환경지수)'
  },
  [ClimateLayerType.WEATHER]: {
    name: '실시간 기상',
    color: '#3b82f6',
    wmsLayer: null,  // WMS 레이어 없음 - 데이터 오버레이만 표시
    description: '경기도 AWS 실시간 기상관측 (기온, 습도, 풍속, 체감온도)'
  }
};
