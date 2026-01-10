/**
 * Climate Data Service
 * 경기도 기후 데이터를 WFS API를 통해 실제로 조회하는 서비스
 */

import { ClimateLayerType } from '../types';

// ============================================
// 1. LAYER_CONFIG 상수 정의
// ============================================
interface LayerConfig {
  layerId: string;
  filterCol: string | null;
}

const LAYER_CONFIG: Record<string, LayerConfig> = {
  [ClimateLayerType.FLOOD_RISK]: {
    layerId: 'spggcee:tm_fldn_trce',
    filterCol: null  // 필터 없이 전체 조회
  },
  [ClimateLayerType.HEATWAVE_VULNERABILITY]: {
    layerId: 'spggcee:rst_thrcf_evl_41',
    filterCol: null  // 필터 없이 전체 조회
  },
  [ClimateLayerType.GREEN_SPACE]: {
    layerId: 'spggcee:grbt',
    filterCol: 'sgg_nm'  // 시군구명으로 필터링
  }
};

// ============================================
// 2. fetchWFSData 함수 구현
// ============================================
export const fetchWFSData = async (
  layerType: ClimateLayerType,
  locationName: string
): Promise<any> => {
  const config = LAYER_CONFIG[layerType];
  if (!config) {
    console.log('[ClimateData] No config for layer type:', layerType);
    return null;
  }

  const apiKey = import.meta.env.VITE_GG_CLIMATE_API_KEY;
  if (!apiKey) {
    console.error('[ClimateData] GG Climate API key is missing');
    return null;
  }

  // 지역명 정규화 (시/군 접미사 제거)
  const normalizedName = locationName.replace(/시$|군$/g, '').trim();

  const params = new URLSearchParams({
    apiKey,
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: config.layerId,
    outputFormat: 'application/json',
    maxFeatures: '5'  // 데이터 폭탄 방지
  });

  // filterCol이 있는 경우에만 CQL_FILTER 추가
  if (config.filterCol) {
    params.set('CQL_FILTER', `${config.filterCol} LIKE '%${normalizedName}%'`);
  }

  const url = `/api/proxy?${params.toString()}`;
  console.log(`[ClimateData] Fetching ${layerType}:`, url);

  try {
    const response = await fetch(url);

    // XML 에러 응답 체크 (레이어가 존재하지 않는 경우)
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('xml')) {
      const text = await response.text();
      console.warn(`[ClimateData] ${layerType} returned XML (possibly error):`, text.substring(0, 200));
      return null;
    }

    if (!response.ok) {
      console.error(`[ClimateData] ${layerType} request failed:`, response.status);
      return null;
    }

    const data = await response.json();
    console.log(`[ClimateData] ${layerType} response:`, {
      totalFeatures: data.totalFeatures,
      returned: data.features?.length || 0
    });

    return data;
  } catch (error) {
    console.error(`[ClimateData] ${layerType} fetch error:`, error);
    return null;
  }
};

// ============================================
// 3. summarizeGeoData 함수 구현
// ============================================
export const summarizeGeoData = (
  layerType: ClimateLayerType,
  geoJson: any
): string => {
  if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
    return `${layerType}: 데이터 없음`;
  }

  const features = geoJson.features;
  const totalFeatures = geoJson.totalFeatures || features.length;
  const summaryParts: string[] = [];

  summaryParts.push(`[${layerType}] 총 ${totalFeatures}개 피처 중 ${features.length}개 샘플:`);

  // 레이어별 속성 추출
  features.slice(0, 3).forEach((feature: any, idx: number) => {
    const props = feature.properties || {};

    if (layerType === ClimateLayerType.FLOOD_RISK) {
      // 침수 흔적 레이어: fldn_dowa(침수심), fldn_grd(침수등급), fldn_dstr_nm(재해명)
      const depth = props.fldn_dowa ?? props.FLD_DEPTH ?? '정보없음';
      const grade = props.fldn_grd ?? props.FLD_GRADE ?? '정보없음';
      const disasterName = props.fldn_dstr_nm ?? props.DSTR_NM ?? '정보없음';
      summaryParts.push(`  ${idx + 1}. 침수심: ${depth}m, 등급: ${grade}, 재해명: ${disasterName}`);
    }
    else if (layerType === ClimateLayerType.HEATWAVE_VULNERABILITY) {
      // 폭염 취약성 레이어
      const vulnLevel = props.vuln_level ?? props.VULN_LV ?? '정보없음';
      const temp = props.avg_temp ?? props.AVG_TEMP ?? '정보없음';
      summaryParts.push(`  ${idx + 1}. 취약등급: ${vulnLevel}, 평균기온: ${temp}`);
    }
    else if (layerType === ClimateLayerType.GREEN_SPACE) {
      // 녹지 레이어: sgg_nm(시군구명), lclsf_nm(대분류), biotop_area(면적)
      const district = props.sgg_nm ?? '정보없음';
      const category = props.lclsf_nm ?? props.lnd_cgy_nm ?? '정보없음';
      const area = props.biotop_area ? `${Number(props.biotop_area).toFixed(2)}m²` : '정보없음';
      summaryParts.push(`  ${idx + 1}. 지역: ${district}, 유형: ${category}, 면적: ${area}`);
    }
    else {
      // 기타 레이어
      const keys = Object.keys(props).slice(0, 3);
      const propsStr = keys.map(k => `${k}: ${props[k]}`).join(', ');
      summaryParts.push(`  ${idx + 1}. ${propsStr}`);
    }
  });

  return summaryParts.join('\n');
};

// ============================================
// 4. createToolResult 함수 (비동기, Promise.all 사용)
// ============================================
export const createToolResult = async (
  locationName: string,
  layerTypes: ClimateLayerType[],
  elderlyData?: {
    totalPopulation: number;
    elderlyPopulation: number;
    elderlyRatio: number;
    avgAge: number;
    sixtyCount: number;
    seventyPlusCount: number;
  }
) => {
  console.log('[ClimateData] 실제 기후 데이터 조회 중...', { locationName, layerTypes });

  const result: any = {
    success: true,
    locationName,
    layersActivated: layerTypes,
    wfsData: {},
    summaries: []
  };

  // Promise.all을 사용해 여러 레이어 데이터를 병렬로 가져오기
  const fetchPromises = layerTypes
    .filter(lt => LAYER_CONFIG[lt])  // 설정된 레이어만
    .map(async (layerType) => {
      try {
        const geoJson = await fetchWFSData(layerType, locationName);
        return { layerType, geoJson };
      } catch (error) {
        console.error(`[ClimateData] Error fetching ${layerType}:`, error);
        return { layerType, geoJson: null };
      }
    });

  const fetchResults = await Promise.all(fetchPromises);

  // 결과 처리
  for (const { layerType, geoJson } of fetchResults) {
    if (geoJson && geoJson.features && geoJson.features.length > 0) {
      result.wfsData[layerType] = {
        totalFeatures: geoJson.totalFeatures || geoJson.features.length,
        featureCount: geoJson.features.length,
        features: geoJson.features.slice(0, 5)
      };

      // 텍스트 요약 생성
      const summary = summarizeGeoData(layerType, geoJson);
      result.summaries.push(summary);
    } else {
      result.summaries.push(`[${layerType}] 데이터를 가져오지 못했습니다.`);
    }
  }

  // 고령인구 데이터 추가 (SGIS API에서 가져온 경우)
  if (elderlyData) {
    result.elderlyData = elderlyData;
    result.summaries.push(
      `[ELDERLY_POPULATION] ${locationName}: 총인구 ${elderlyData.totalPopulation.toLocaleString()}명, ` +
      `고령인구 ${elderlyData.elderlyPopulation.toLocaleString()}명 (${elderlyData.elderlyRatio.toFixed(1)}%), ` +
      `평균연령 ${elderlyData.avgAge.toFixed(1)}세`
    );
  }

  // 최종 메시지 생성
  result.message = [
    `=== ${locationName} 기후 데이터 분석 결과 ===`,
    '',
    ...result.summaries
  ].join('\n');

  console.log('[ClimateData] Tool result created:', result);
  return result;
};
