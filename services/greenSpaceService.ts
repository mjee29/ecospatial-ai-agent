/**
 * 녹지 비오톱 데이터 서비스
 * WFS에서 grbt(녹지 현황도) 데이터를 가져와 시군구별 biot_area 집계
 */

import { fetchWFSData, WFS_LAYER_CONFIG } from './wfsService';
import { GYEONGGI_WFS_BASE_URL } from '../constants';

export interface GreenSpaceClassification {
  lclsfNm: string;    // 대분류명
  mclsfNm: string;    // 중분류명
  sclsfNm: string;    // 소분류명
  dclsfNm: string;    // 세분류명
  biotArea: number;   // 비오톱 면적 (㎡)
}

export interface GreenSpaceData {
  sggName: string;                        // 시군구명
  sggCode: string;                        // 시군구코드
  totalBiotArea: number;                  // 총 비오톱 면적 (㎡)
  totalBiotAreaHa: number;                // 총 비오톱 면적 (ha)
  totalBiotAreaKm2: number;               // 총 비오톱 면적 (㎢)
  featureCount: number;                   // 피처 개수
  classifications: GreenSpaceClassification[];  // 분류별 상세
  topClassifications: GreenSpaceClassification[]; // 면적 상위 5개 분류
}

// 경기도 시군구 이름 매핑 (검색 키워드 → 실제 시군구명)
const SGG_NAME_MAPPING: Record<string, string[]> = {
  '수원': ['수원시', '수원시장안구', '수원시권선구', '수원시팔달구', '수원시영통구'],
  '성남': ['성남시', '성남시수정구', '성남시중원구', '성남시분당구'],
  '용인': ['용인시', '용인시처인구', '용인시기흥구', '용인시수지구'],
  '안양': ['안양시', '안양시만안구', '안양시동안구'],
  '안산': ['안산시', '안산시상록구', '안산시단원구'],
  '고양': ['고양시', '고양시덕양구', '고양시일산동구', '고양시일산서구'],
  '부천': ['부천시'],
  '광명': ['광명시'],
  '평택': ['평택시'],
  '시흥': ['시흥시'],
  '군포': ['군포시'],
  '의왕': ['의왕시'],
  '과천': ['과천시'],
  '하남': ['하남시'],
  '오산': ['오산시'],
  '이천': ['이천시'],
  '안성': ['안성시'],
  '김포': ['김포시'],
  '화성': ['화성시'],
  '광주': ['광주시'],
  '양주': ['양주시'],
  '포천': ['포천시'],
  '여주': ['여주시'],
  '의정부': ['의정부시'],
  '동두천': ['동두천시'],
  '구리': ['구리시'],
  '남양주': ['남양주시'],
  '파주': ['파주시'],
  '연천': ['연천군'],
  '가평': ['가평군'],
  '양평': ['양평군'],
};

/**
 * 지역명으로 녹지 비오톱 데이터 조회
 * @param locationName 지역명 (예: "수원", "성남시", "용인")
 * @returns 시군구별 녹지 비오톱 집계 데이터
 */
export const getGreenSpaceData = async (locationName: string): Promise<GreenSpaceData> => {
  try {
    console.log('[GreenSpace] Fetching data for:', locationName);

    const apiKey = import.meta.env.VITE_GG_CLIMATE_API_KEY;
    if (!apiKey) {
      throw new Error('경기도 기후 API 키가 설정되지 않았습니다.');
    }

    // 지역명 정규화
    const normalizedLocation = locationName.replace(/시$|군$/g, '').trim();
    const targetSggNames = SGG_NAME_MAPPING[normalizedLocation] || [locationName];

    console.log('[GreenSpace] Target SGG names:', targetSggNames);

    // WFS에서 녹지 데이터 가져오기
    const wfsUrl = GYEONGGI_WFS_BASE_URL;
    const typeName = WFS_LAYER_CONFIG.green_space.wfsTypeName;

    // CQL_FILTER로 해당 시군구 데이터만 필터링
    // sgg_nm 필드로 필터링
    const cqlFilter = targetSggNames.length === 1
      ? `sgg_nm LIKE '%${targetSggNames[0].replace(/시$/, '')}%'`
      : targetSggNames.map(name => `sgg_nm LIKE '%${name.replace(/시$/, '')}%'`).join(' OR ');

    const params = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: typeName,
      outputFormat: 'application/json',
      srsname: 'EPSG:4326',
      count: '5000', // 충분한 피처 수
      apiKey: apiKey,
      CQL_FILTER: cqlFilter
    });

    const url = `${wfsUrl}?${params.toString()}`;
    console.log('[GreenSpace] WFS Request URL:', url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`WFS 요청 실패: ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();

    if (!responseText.trim().startsWith('{')) {
      console.error('[GreenSpace] Response is not JSON:', responseText.substring(0, 300));
      throw new Error('서버가 JSON이 아닌 형식으로 응답했습니다.');
    }

    const data = JSON.parse(responseText);

    if (!data.features || !Array.isArray(data.features)) {
      console.error('[GreenSpace] Invalid response structure:', data);
      throw new Error('WFS 응답에 features 배열이 없습니다.');
    }

    console.log(`[GreenSpace] Fetched ${data.features.length} features`);

    // 데이터 집계
    let totalBiotArea = 0;
    const classificationsMap = new Map<string, GreenSpaceClassification>();
    let sggName = locationName;
    let sggCode = '';

    for (const feature of data.features) {
      const props = feature.properties || {};

      // 시군구명 저장 (첫 번째 피처에서)
      if (!sggCode && props.sgg_cd) {
        sggCode = props.sgg_cd;
      }
      if (props.sgg_nm) {
        sggName = props.sgg_nm;
      }

      // biotop_area 집계 (API 속성명은 biotop_area)
      const biotArea = parseFloat(props.biotop_area) || 0;
      totalBiotArea += biotArea;

      // 분류별 집계 (세분류 기준)
      const classKey = `${props.lclsf_nm || ''}-${props.mclsf_nm || ''}-${props.sclsf_nm || ''}-${props.dclsf_nm || ''}`;

      if (classificationsMap.has(classKey)) {
        const existing = classificationsMap.get(classKey)!;
        existing.biotArea += biotArea;
      } else {
        classificationsMap.set(classKey, {
          lclsfNm: props.lclsf_nm || '미분류',
          mclsfNm: props.mclsf_nm || '미분류',
          sclsfNm: props.sclsf_nm || '미분류',
          dclsfNm: props.dclsf_nm || '미분류',
          biotArea: biotArea
        });
      }
    }

    // 분류별 데이터를 배열로 변환하고 면적순 정렬
    const classifications = Array.from(classificationsMap.values())
      .sort((a, b) => b.biotArea - a.biotArea);

    // 상위 5개 분류 추출
    const topClassifications = classifications.slice(0, 5);

    const result: GreenSpaceData = {
      sggName: sggName,
      sggCode: sggCode,
      totalBiotArea: totalBiotArea,
      totalBiotAreaHa: totalBiotArea / 10000,  // ㎡ → ha
      totalBiotAreaKm2: totalBiotArea / 1000000, // ㎡ → ㎢
      featureCount: data.features.length,
      classifications: classifications,
      topClassifications: topClassifications
    };

    console.log('[GreenSpace] Aggregated data:', {
      sggName: result.sggName,
      totalBiotArea: result.totalBiotArea,
      totalBiotAreaKm2: result.totalBiotAreaKm2.toFixed(2) + ' ㎢',
      featureCount: result.featureCount,
      topClassifications: result.topClassifications.map(c => `${c.dclsfNm}: ${(c.biotArea / 10000).toFixed(2)} ha`)
    });

    return result;
  } catch (error) {
    console.error('[GreenSpace] Error fetching green space data:', error);
    throw error;
  }
};

/**
 * 녹지 면적을 읽기 쉬운 형식으로 포맷팅
 */
export const formatBiotArea = (areaM2: number): string => {
  if (areaM2 >= 1000000) {
    return `${(areaM2 / 1000000).toFixed(2)} ㎢`;
  } else if (areaM2 >= 10000) {
    return `${(areaM2 / 10000).toFixed(2)} ha`;
  } else {
    return `${areaM2.toLocaleString()} ㎡`;
  }
};
