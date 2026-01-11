/**
 * SGIS API Service
 * 통계청 SGIS Open API를 사용하여 경기도 거주인구 데이터를 가져옵니다.
 *
 * API 문서: https://sgis.kostat.go.kr/developer/html/newOpenApi/api/dataApi/addressBoundary.html
 */

const CONSUMER_KEY = import.meta.env.VITE_SGIS_CONSUMER_KEY;
const CONSUMER_SECRET = import.meta.env.VITE_SGIS_CONSUMER_SECRET;

// 프록시를 통해 CORS 우회
// 인증과 데이터 API 모두 mods.go.kr 도메인 사용 (토큰 호환성)
const SGIS_AUTH_URL = '/sgis-data/OpenAPI3/auth/authentication.json';
const SGIS_POPULATION_URL = '/sgis-data/OpenAPI3/startupbiz/pplsummary.json';
const SGIS_ADDR_STAGE_URL = '/sgis-data/OpenAPI3/addr/stage.json';

// 경기도 시도 코드 (SGIS 코드 체계: 31, 행정표준코드: 41)
const GYEONGGI_SIDO_CODE = '31';

// 행정동 코드 캐시
const districtCodeCache: Map<string, string> = new Map();

// 경기도 시군구 이름 매핑 (검색용)
const DISTRICT_NAME_VARIANTS: Record<string, string[]> = {
  '수원': ['수원시', '수원'],
  '성남': ['성남시', '성남'],
  '의정부': ['의정부시', '의정부'],
  '안양': ['안양시', '안양'],
  '부천': ['부천시', '부천'],
  '광명': ['광명시', '광명'],
  '평택': ['평택시', '평택'],
  '동두천': ['동두천시', '동두천'],
  '안산': ['안산시', '안산'],
  '고양': ['고양시', '고양'],
  '과천': ['과천시', '과천'],
  '구리': ['구리시', '구리'],
  '남양주': ['남양주시', '남양주'],
  '오산': ['오산시', '오산'],
  '시흥': ['시흥시', '시흥'],
  '군포': ['군포시', '군포'],
  '의왕': ['의왕시', '의왕'],
  '하남': ['하남시', '하남'],
  '용인': ['용인시', '용인'],
  '파주': ['파주시', '파주'],
  '이천': ['이천시', '이천'],
  '안성': ['안성시', '안성'],
  '김포': ['김포시', '김포'],
  '화성': ['화성시', '화성'],
  '광주': ['광주시', '광주'],
  '양주': ['양주시', '양주'],
  '포천': ['포천시', '포천'],
  '여주': ['여주시', '여주'],
  '연천': ['연천군', '연천'],
  '가평': ['가평군', '가평'],
  '양평': ['양평군', '양평'],
};

// SGIS 주소 단계 조회 API 응답 인터페이스
interface SGISAddrStageResponse {
  id: string;
  result: Array<{
    cd: string;        // 행정구역 코드
    addr_name: string; // 시군구명
    full_addr: string; // 전체주소
    x_coor: string;    // UTM-K X좌표
    y_coor: string;    // UTM-K Y좌표
  }>;
  errMsg: string;
  errCd: number;
}

interface SGISAuthResponse {
  id: string;
  result: {
    accessToken: string;
    accessTimeout: string;
  };
  errMsg: string;
  errCd: number;
}

interface SGISPopulationResponse {
  id: string;
  result: Array<{
    adm_cd: string; // 행정구역 코드
    adm_nm: string; // 행정구역 이름
    teenage_less_than_per: string; // 10대 미만 인구비율
    teenage_less_than_cnt: string; // 10대 미만 인구수
    teenage_per: string; // 10대 인구비율
    teenage_cnt: string; // 10대 인구수
    twenty_per: string; // 20대 인구비율
    twenty_cnt: string; // 20대 인구수
    thirty_per: string; // 30대 인구비율
    thirty_cnt: string; // 30대 인구수
    forty_per: string; // 40대 인구비율
    forty_cnt: string; // 40대 인구수
    fifty_per: string; // 50대 인구비율
    fifty_cnt: string; // 50대 인구수
    sixty_per: string; // 60대 인구비율
    sixty_cnt: string; // 60대 인구수
    seventy_more_than_per: string; // 70대 이상 인구비율
    seventy_more_than_cnt: string; // 70대 이상 인구수
  }>;
  errMsg: string;
  errCd: number;
}

export interface ElderlyPopulationData {
  districtName: string;
  districtCode: string;
  seventyPlusCount: number; // 70대 이상 인구수
  seventyPlusRatio: number; // 70대 이상 인구비율
}

// Access Token 캐시 (1시간 유효)
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * SGIS OAuth 인증을 수행하여 Access Token을 발급받습니다.
 */
export const authenticateSGIS = async (): Promise<string> => {
  // 캐시된 토큰이 유효하면 재사용
  if (cachedToken && Date.now() < tokenExpiry) {
    console.log('[SGIS API] Using cached access token');
    return cachedToken;
  }

  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
    throw new Error('SGIS API 키가 설정되지 않았습니다. .env.local에 VITE_SGIS_CONSUMER_KEY와 VITE_SGIS_CONSUMER_SECRET를 추가하세요.');
  }

  try {
    console.log('[SGIS API] Authenticating...');
    const response = await fetch(`${SGIS_AUTH_URL}?consumer_key=${CONSUMER_KEY}&consumer_secret=${CONSUMER_SECRET}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`SGIS 인증 실패: ${response.status} ${response.statusText}`);
    }

    const data: SGISAuthResponse = await response.json();

    if (data.errCd !== 0) {
      throw new Error(`SGIS API 오류: ${data.errMsg} (코드: ${data.errCd})`);
    }

    cachedToken = data.result.accessToken;
    // 토큰 만료 시간 설정 (50분 후 - 여유시간 확보)
    tokenExpiry = Date.now() + 50 * 60 * 1000;

    console.log('[SGIS API] Authentication successful');
    return cachedToken;
  } catch (error) {
    console.error('[SGIS API] Authentication error:', error);
    throw error;
  }
};

/**
 * SGIS API를 통해 시군구명으로 행정구역 코드를 조회합니다.
 * @param locationName - 지역명 (예: '수원시', '수원', '성남')
 * @returns 행정구역 코드 (5자리 시군구)
 */
export const getDistrictCode = async (locationName: string): Promise<string> => {
  // 캐시 확인
  const normalizedName = locationName.replace(/시$|군$/g, '').trim();
  if (districtCodeCache.has(normalizedName)) {
    console.log(`[SGIS API] Using cached district code for ${normalizedName}`);
    return districtCodeCache.get(normalizedName)!;
  }

  // OAuth 토큰 발급
  const accessToken = await authenticateSGIS();

  console.log(`[SGIS API] Fetching district codes for 경기도...`);

  // 경기도(41) 시군구 목록 조회
  const response = await fetch(
    `${SGIS_ADDR_STAGE_URL}?accessToken=${accessToken}&cd=${GYEONGGI_SIDO_CODE}`
  );

  if (!response.ok) {
    throw new Error(`SGIS 주소 조회 실패: ${response.status} ${response.statusText}`);
  }

  const data: SGISAddrStageResponse = await response.json();

  if (data.errCd !== 0) {
    throw new Error(`SGIS API 오류: ${data.errMsg} (코드: ${data.errCd})`);
  }

  if (!data.result || data.result.length === 0) {
    throw new Error(`경기도 시군구 목록을 찾을 수 없습니다.`);
  }

  console.log(`[SGIS API] Found ${data.result.length} districts in 경기도`);

  // 시군구명이 포함된 행정구역 찾기
  const matchingDistrict = data.result.find(item =>
    item.addr_name.includes(normalizedName)
  );

  if (!matchingDistrict) {
    console.error(`[SGIS API] Available districts:`, data.result.map(r => r.addr_name));
    throw new Error(`'${locationName}' 지역의 행정구역 코드를 찾을 수 없습니다.`);
  }

  const districtCode = matchingDistrict.cd;
  console.log(`[SGIS API] Found district code: ${districtCode} for ${matchingDistrict.addr_name}`);

  // 캐시에 저장
  districtCodeCache.set(normalizedName, districtCode);

  return districtCode;
};

/**
 * 특정 행정구역의 거주인구 고령층 데이터를 조회합니다.
 * @param locationName - 지역명 (예: '수원시', '성남시', '판교')
 */
export const getElderlyPopulation = async (locationName: string): Promise<ElderlyPopulationData> => {
  try {
    // 경기도 API로 행정동 코드 조회
    const districtCode = await getDistrictCode(locationName);

    // OAuth 토큰 발급
    const accessToken = await authenticateSGIS();

    // 거주인구 데이터 조회 (GET 방식)
    const requestUrl = `${SGIS_POPULATION_URL}?accessToken=${accessToken}&adm_cd=${districtCode}`;
    console.log(`[SGIS API] Fetching elderly population for ${locationName} (${districtCode})...`);
    console.log(`[SGIS API] Request URL: ${SGIS_POPULATION_URL}?accessToken=***&adm_cd=${districtCode}`);

    const response = await fetch(requestUrl);

    if (!response.ok) {
      throw new Error(`SGIS 데이터 조회 실패: ${response.status} ${response.statusText}`);
    }

    const data: SGISPopulationResponse = await response.json();

    console.log('[SGIS API] Raw response:', JSON.stringify(data, null, 2));

    // errCd가 0이 아닌 경우 에러 처리
    if (data.errCd && data.errCd !== 0) {
      // 특별 에러 메시지: adm_cd가 잘못되었을 가능성
      if (data.errCd === -100) {
        console.error(`[SGIS API] 검색 결과 없음. 요청한 행정구역 코드: ${districtCode}`);
        console.error('[SGIS API] 가능한 원인: 잘못된 행정구역 코드 또는 SGIS API에 해당 데이터 없음');
        throw new Error(`SGIS API 오류: 검색결과가 존재하지 않습니다 (코드: ${data.errCd}). 요청한 adm_cd: ${districtCode}`);
      }
      throw new Error(`SGIS API 오류: ${data.errMsg} (코드: ${data.errCd})`);
    }

    // result가 배열인 경우 처리
    if (!data.result || data.result.length === 0) {
      throw new Error(`'${locationName}'에 대한 인구 데이터가 없습니다. API 응답 구조 확인 필요.`);
    }

    // result가 배열이므로, 요청한 adm_cd와 일치하는 데이터 찾기
    // 또는 배열의 첫 번째 요소 사용
    const populationData = data.result.find(item => item.adm_cd === districtCode) || data.result[0];

    console.log('[SGIS API] Selected population data:', populationData);

    // 70대 이상 인구 데이터 파싱
    const seventyPlusCount = parseInt(populationData.seventy_more_than_cnt) || 0;
    const seventyPlusRatio = parseFloat(populationData.seventy_more_than_per) || 0;

    const result: ElderlyPopulationData = {
      districtName: populationData.adm_nm || locationName,
      districtCode: populationData.adm_cd || districtCode,
      seventyPlusCount,
      seventyPlusRatio,
    };

    console.log('[SGIS API] Successfully fetched elderly population data:', result);
    return result;
  } catch (error) {
    console.error('[SGIS API] Error fetching elderly population:', error);
    throw error;
  }
};

/**
 * 경기도 전체 시군구의 고령인구 데이터를 배치로 조회합니다.
 */
export const getAllGyeonggiElderlyPopulation = async (): Promise<ElderlyPopulationData[]> => {
  const districts = Object.keys(DISTRICT_NAME_VARIANTS);

  const results: ElderlyPopulationData[] = [];

  for (const district of districts) {
    try {
      const data = await getElderlyPopulation(district);
      results.push(data);
      // API Rate Limit 방지를 위한 지연
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`[SGIS API] Failed to fetch data for ${district}:`, error);
    }
  }

  return results;
};
