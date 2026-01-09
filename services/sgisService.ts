/**
 * SGIS API Service
 * 통계청 SGIS Open API를 사용하여 경기도 거주인구 데이터를 가져옵니다.
 *
 * API 문서: https://sgis.kostat.go.kr/developer/html/newOpenApi/api/dataApi/addressBoundary.html
 */

const CONSUMER_KEY = import.meta.env.VITE_SGIS_CONSUMER_KEY;
const CONSUMER_SECRET = import.meta.env.VITE_SGIS_CONSUMER_SECRET;

const SGIS_AUTH_URL = 'https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json';
const SGIS_POPULATION_URL = 'https://sgisapi.kostat.go.kr/OpenAPI3/startupbiz/pplsummary.json';

// 경기도 시군구 행정구역 코드 매핑
export const GYEONGGI_DISTRICT_CODES: Record<string, string> = {
  '수원시': '41110',
  '수원': '41110',
  '성남시': '41130',
  '성남': '41130',
  '의정부시': '41150',
  '의정부': '41150',
  '안양시': '41170',
  '안양': '41170',
  '부천시': '41190',
  '부천': '41190',
  '광명시': '41210',
  '광명': '41210',
  '평택시': '41220',
  '평택': '41220',
  '동두천시': '41250',
  '동두천': '41250',
  '안산시': '41270',
  '안산': '41270',
  '고양시': '41280',
  '고양': '41280',
  '과천시': '41290',
  '과천': '41290',
  '구리시': '41310',
  '구리': '41310',
  '남양주시': '41360',
  '남양주': '41360',
  '오산시': '41370',
  '오산': '41370',
  '시흥시': '41390',
  '시흥': '41390',
  '군포시': '41410',
  '군포': '41410',
  '의왕시': '41430',
  '의왕': '41430',
  '하남시': '41450',
  '하남': '41450',
  '용인시': '41460',
  '용인': '41460',
  '파주시': '41480',
  '파주': '41480',
  '이천시': '41500',
  '이천': '41500',
  '안성시': '41550',
  '안성': '41550',
  '김포시': '41570',
  '김포': '41570',
  '화성시': '41590',
  '화성': '41590',
  '광주시': '41610',
  '광주': '41610',
  '양주시': '41630',
  '양주': '41630',
  '포천시': '41650',
  '포천': '41650',
  '여주시': '41670',
  '여주': '41670',
  '연천군': '41800',
  '연천': '41800',
  '가평군': '41820',
  '가평': '41820',
  '양평군': '41830',
  '양평': '41830',
  '판교': '41130', // 판교는 성남시
  '장안구': '41110', // 수원시 장안구
};

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
    avg_age: string;
    sixty_per: string; // 60대 비율
    sixty_cnt: string; // 60대 인구수
    seventy_more_than_per: string; // 70대 이상 비율
    seventy_more_than_cnt: string; // 70대 이상 인구수
    tot_ppltn: string; // 총인구
  }>;
  errMsg: string;
  errCd: number;
}

export interface ElderlyPopulationData {
  districtName: string;
  districtCode: string;
  totalPopulation: number;
  elderlyPopulation: number; // 60대 + 70대 이상
  elderlyRatio: number; // 퍼센트
  sixtyCount: number;
  sixtyRatio: number;
  seventyPlusCount: number;
  seventyPlusRatio: number;
  avgAge: number;
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
 * 특정 행정구역의 거주인구 고령층 데이터를 조회합니다.
 * @param locationName - 지역명 (예: '수원시', '성남시', '판교')
 */
export const getElderlyPopulation = async (locationName: string): Promise<ElderlyPopulationData> => {
  try {
    // 지역명을 행정구역 코드로 변환
    const normalizedName = locationName.replace(/시$|군$/g, '').trim();
    const districtCode = GYEONGGI_DISTRICT_CODES[normalizedName] || GYEONGGI_DISTRICT_CODES[locationName];

    if (!districtCode) {
      throw new Error(`'${locationName}' 지역의 행정구역 코드를 찾을 수 없습니다. 경기도 내 시군구만 지원됩니다.`);
    }

    // OAuth 토큰 발급
    const accessToken = await authenticateSGIS();

    // 거주인구 데이터 조회
    console.log(`[SGIS API] Fetching elderly population for ${locationName} (${districtCode})...`);
    const response = await fetch(
      `${SGIS_POPULATION_URL}?accessToken=${accessToken}&adm_cd=${districtCode}`
    );

    if (!response.ok) {
      throw new Error(`SGIS 데이터 조회 실패: ${response.status} ${response.statusText}`);
    }

    const data: SGISPopulationResponse = await response.json();

    if (data.errCd !== 0) {
      throw new Error(`SGIS API 오류: ${data.errMsg} (코드: ${data.errCd})`);
    }

    if (!data.result || data.result.length === 0) {
      throw new Error(`'${locationName}'에 대한 인구 데이터가 없습니다.`);
    }

    const populationData = data.result[0];

    // 숫자 파싱
    const sixtyCount = parseInt(populationData.sixty_cnt) || 0;
    const seventyPlusCount = parseInt(populationData.seventy_more_than_cnt) || 0;
    const totalPopulation = parseInt(populationData.tot_ppltn) || 0;
    const elderlyPopulation = sixtyCount + seventyPlusCount;
    const elderlyRatio = totalPopulation > 0 ? (elderlyPopulation / totalPopulation) * 100 : 0;

    const result: ElderlyPopulationData = {
      districtName: locationName,
      districtCode,
      totalPopulation,
      elderlyPopulation,
      elderlyRatio: parseFloat(elderlyRatio.toFixed(2)),
      sixtyCount,
      sixtyRatio: parseFloat(populationData.sixty_per) || 0,
      seventyPlusCount,
      seventyPlusRatio: parseFloat(populationData.seventy_more_than_per) || 0,
      avgAge: parseFloat(populationData.avg_age) || 0,
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
  const districts = Object.keys(GYEONGGI_DISTRICT_CODES)
    .filter(name => name.endsWith('시') || name.endsWith('군'));

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