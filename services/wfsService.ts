/**
 * WFS (Web Feature Service) 데이터 조회 서비스
 * GeoJSON 형식의 벡터 데이터를 가져와 지도에 표시
 */

export interface WFSFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
  properties: Record<string, any>;
}

export interface WFSFeatureCollection {
  type: 'FeatureCollection';
  features: WFSFeature[];
}

/**
 * WFS 요청을 통해 GeoJSON 데이터 가져오기
 * 
 * @param wfsUrl - WFS 서버 URL
 * @param typeName - 요청할 feature type (예: "spggcee:tm_fldn_trce")
 * @param bbox - 바운딩박스 (minLon, minLat, maxLon, maxLat)
 * @param maxFeatures - 최대 feature 개수
 * @param apiKey - 경기도 기후플랫폼 API 키
 * @returns GeoJSON FeatureCollection
 */
export const fetchWFSData = async (
  wfsUrl: string,
  typeName: string,
  bbox?: { minLat: number; minLon: number; maxLat: number; maxLon: number },
  maxFeatures: number = 1000,
  apiKey?: string
): Promise<WFSFeatureCollection> => {
  try {
    console.log('[WFS] Fetching features:', typeName);

    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: typeName,
      outputFormat: 'application/json',
      srsname: 'EPSG:4326'
    });

    // version 2.0.0에서는 count 파라미터 사용 (maxFeatures 대신)
    params.append('count', maxFeatures.toString());

    // API 키가 제공되면 추가
    if (apiKey) {
      params.append('apiKey', apiKey);
    }

    // 바운딩박스가 제공되면 추가
    // EPSG:4326 좌표계에서는 (ymin,xmin,ymax,xmax) 순서 필요
    if (bbox) {
      const bboxParam = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
      params.append('bbox', bboxParam);
      console.log('[WFS] BBox (ymin,xmin,ymax,xmax):', bboxParam);
    }

    const url = `${wfsUrl}?${params.toString()}`;
    console.log('[WFS] Request URL:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`WFS 요청 실패: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    
    // JSON 응답 검증
    if (!responseText.trim().startsWith('{')) {
      console.error('[WFS] Response is not JSON');
      console.error('[WFS] Response preview:', responseText.substring(0, 300));
      throw new Error('서버가 JSON이 아닌 형식으로 응답했습니다.');
    }

    const data: WFSFeatureCollection = JSON.parse(responseText);

    // 응답 구조 검증
    if (!data.features || !Array.isArray(data.features)) {
      console.error('[WFS] Invalid response structure:', data);
      throw new Error('WFS 응답에 features 배열이 없습니다.');
    }

    console.log(`[WFS] Fetched ${data.features.length} features from ${typeName}`);
    return data;
  } catch (error) {
    console.error('[WFS] Error fetching WFS data:', error);
    throw error;
  }
};

/**
 * WFS와 WMS를 모두 지원하는 레이어 정의
 * WFS로 벡터 데이터를 가져오고, WMS는 배경으로 사용 가능
 */
export const WFS_LAYER_CONFIG = {
  flood_risk: {
    wfsTypeName: 'spggcee:tm_fldn_trce',
    wmsLayer: 'spggcee:tm_fldn_trce',
    name: '침수흔적지도',
    description: '침수 흔적 및 지형 기반 위험 지역입니다.',
    color: '#ef4444',
    featureKey: 'properties' // GeoJSON에서 표시할 속성 그룹
  },
  heatwave: {
    wfsTypeName: 'spggcee:rst_thrcf_evl_41',
    wmsLayer: 'spggcee:rst_thrcf_evl_41',
    name: '폭염 등급 평가',
    description: '도시 열섬 현상 및 폭염 취약성 등급 데이터입니다.',
    color: '#f97316',
    featureKey: 'properties'
  },
  green_space: {
    wfsTypeName: 'spggcee:grbt',
    wmsLayer: 'spggcee:grbt',
    name: '녹지 현황도',
    description: '도시 공원 및 녹지 구역 정보입니다.',
    color: '#22c55e',
    featureKey: 'properties'
  },
  elderly_population: {
    wfsTypeName: 'spggcee:tm_sigun_flod_dngr_evl_rnk',
    wmsLayer: 'spggcee:tm_sigun_flod_dngr_evl_rnk',
    name: '고령인구 밀도',
    description: '통계청 SGIS 데이터 기반 60대 이상 고령인구 분포입니다.',
    color: '#8b5cf6',
    featureKey: 'properties'
  }
};

/**
 * WFS 데이터에서 display할 속성을 추출
 * 
 * @param feature - WFS Feature 객체
 * @param maxProperties - 표시할 최대 속성 개수
 * @returns 표시 가능한 속성 목록
 */
export const extractFeatureProperties = (
  feature: WFSFeature,
  maxProperties: number = 10
): Array<{ key: string; value: string | number | boolean }> => {
  const props: Array<{ key: string; value: string | number | boolean }> = [];
  
  if (!feature.properties) return props;

  const keys = Object.keys(feature.properties).slice(0, maxProperties);
  
  keys.forEach(key => {
    const value = feature.properties[key];
    // null, undefined 값 제외
    if (value !== null && value !== undefined && value !== '') {
      props.push({
        key: key
          .replace(/_/g, ' ')
          .replace(/^[a-z]/, c => c.toUpperCase()),
        value: value
      });
    }
  });

  return props;
};
