/**
 * Climate Data Service
 * 경기도 시군구별 기후 위험 데이터를 제공하는 서비스
 * (실제 API 연동 전까지 Mock 데이터 사용)
 */

import { ClimateLayerType } from '../types';

// 기후 데이터 타입 정의
export interface ClimateRiskData {
  locationName: string;
  floodRisk?: {
    level: string;        // "1등급", "2등급", "3등급", "4등급", "5등급"
    score: number;        // 1-5
    description: string;
    affectedArea?: string;
  };
  heatwaveRisk?: {
    level: string;        // "매우위험", "위험", "주의", "관심", "안전"
    score: number;        // 1-5
    description: string;
    avgTemperature?: number;
  };
  greenSpace?: {
    coverage: string;     // "높음", "보통", "낮음"
    percentage: number;
    description: string;
  };
  airQuality?: {
    level: string;        // "좋음", "보통", "나쁨", "매우나쁨"
    pm25: number;
    pm10: number;
    description: string;
  };
}

// 경기도 시군구별 Mock 기후 데이터
const MOCK_CLIMATE_DATA: Record<string, ClimateRiskData> = {
  '수원': {
    locationName: '수원시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '중간 위험 지역으로, 영통구 일대 저지대에서 침수 이력이 있습니다.',
      affectedArea: '영통구, 권선구 일부'
    },
    heatwaveRisk: {
      level: '주의',
      score: 3,
      description: '도심 열섬 현상으로 여름철 평균 기온이 주변보다 1.5도 높습니다.',
      avgTemperature: 28.5
    },
    greenSpace: {
      coverage: '보통',
      percentage: 23.4,
      description: '광교산, 칠보산 등 외곽 녹지가 있으나 도심 녹지율은 낮은 편입니다.'
    }
  },
  '성남': {
    locationName: '성남시',
    floodRisk: {
      level: '3등급',
      score: 3,
      description: '분당구 탄천 주변과 중원구 저지대에서 침수 위험이 있습니다.',
      affectedArea: '분당구 탄천변, 중원구 일부'
    },
    heatwaveRisk: {
      level: '위험',
      score: 4,
      description: '고밀도 개발 지역으로 폭염 취약성이 높습니다. 특히 수정구 구도심이 취약합니다.',
      avgTemperature: 29.2
    },
    greenSpace: {
      coverage: '보통',
      percentage: 28.1,
      description: '청계산, 남한산성 등 산지가 있으나 분당 신도시 내 녹지는 제한적입니다.'
    }
  },
  '용인': {
    locationName: '용인시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '기흥구 일부 저지대와 처인구 하천 주변에서 침수 가능성이 있습니다.',
      affectedArea: '기흥구, 처인구 하천변'
    },
    heatwaveRisk: {
      level: '관심',
      score: 2,
      description: '녹지가 많아 상대적으로 폭염 위험이 낮은 편입니다.',
      avgTemperature: 27.3
    },
    greenSpace: {
      coverage: '높음',
      percentage: 45.2,
      description: '광교산, 석성산 등 풍부한 산림 자원을 보유하고 있습니다.'
    }
  },
  '고양': {
    locationName: '고양시',
    floodRisk: {
      level: '1등급',
      score: 1,
      description: '한강 및 공릉천 인접 지역으로 침수 위험이 높습니다. 일산서구 주의 필요.',
      affectedArea: '일산서구, 덕양구 한강변'
    },
    heatwaveRisk: {
      level: '주의',
      score: 3,
      description: '일산 신도시 지역 열섬 현상이 관측됩니다.',
      avgTemperature: 28.1
    },
    greenSpace: {
      coverage: '보통',
      percentage: 31.5,
      description: '북한산, 호수공원 등이 있으나 신도시 내 녹지율 개선이 필요합니다.'
    }
  },
  '안양': {
    locationName: '안양시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '안양천 주변 저지대에서 집중호우 시 침수 위험이 있습니다.',
      affectedArea: '만안구 안양천변'
    },
    heatwaveRisk: {
      level: '위험',
      score: 4,
      description: '인구밀도가 높고 콘크리트 비율이 높아 폭염에 취약합니다.',
      avgTemperature: 29.5
    },
    greenSpace: {
      coverage: '낮음',
      percentage: 18.3,
      description: '관악산 일부를 제외하면 녹지가 부족한 편입니다.'
    }
  },
  '부천': {
    locationName: '부천시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '굴포천 주변 지역에서 침수 이력이 있습니다.',
      affectedArea: '원미구, 소사구 일부'
    },
    heatwaveRisk: {
      level: '매우위험',
      score: 5,
      description: '고밀도 도시로 경기도 내 폭염 취약성이 가장 높은 지역 중 하나입니다.',
      avgTemperature: 30.1
    },
    greenSpace: {
      coverage: '낮음',
      percentage: 12.5,
      description: '도시화율이 높아 녹지 공간이 매우 부족합니다.'
    }
  },
  '광명': {
    locationName: '광명시',
    floodRisk: {
      level: '3등급',
      score: 3,
      description: '안양천 인접 지역 침수 위험이 있으나 전반적으로 양호합니다.',
      affectedArea: '철산동, 하안동 일부'
    },
    heatwaveRisk: {
      level: '위험',
      score: 4,
      description: '소규모 고밀도 도시로 열섬 효과가 강하게 나타납니다.',
      avgTemperature: 29.8
    },
    greenSpace: {
      coverage: '낮음',
      percentage: 15.7,
      description: '도덕산, 구름산 외 도심 녹지가 부족합니다.'
    }
  },
  '평택': {
    locationName: '평택시',
    floodRisk: {
      level: '1등급',
      score: 1,
      description: '안성천, 진위천 하류 저지대로 침수 위험이 매우 높습니다.',
      affectedArea: '팽성읍, 안중읍, 포승읍'
    },
    heatwaveRisk: {
      level: '관심',
      score: 2,
      description: '해안 인접으로 상대적으로 폭염 위험이 낮습니다.',
      avgTemperature: 27.5
    },
    greenSpace: {
      coverage: '보통',
      percentage: 35.2,
      description: '농경지와 산림이 혼재되어 있습니다.'
    }
  },
  '안산': {
    locationName: '안산시',
    floodRisk: {
      level: '1등급',
      score: 1,
      description: '시화호 인접 및 저지대가 많아 침수 위험이 높습니다.',
      affectedArea: '단원구 해안 지역, 상록구 일부'
    },
    heatwaveRisk: {
      level: '주의',
      score: 3,
      description: '공업지역 열 배출과 도시 열섬이 복합적으로 작용합니다.',
      avgTemperature: 28.3
    },
    greenSpace: {
      coverage: '보통',
      percentage: 25.8,
      description: '수리산, 대부도 등이 있으나 산업단지 비중이 높습니다.'
    }
  },
  '화성': {
    locationName: '화성시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '해안 저지대와 남양만 인근에서 침수 위험이 있습니다.',
      affectedArea: '남양읍, 우정읍 해안 지역'
    },
    heatwaveRisk: {
      level: '관심',
      score: 2,
      description: '넓은 면적과 해안 영향으로 폭염 위험이 상대적으로 낮습니다.',
      avgTemperature: 27.1
    },
    greenSpace: {
      coverage: '높음',
      percentage: 48.5,
      description: '농경지와 산림이 풍부하며 녹지율이 높습니다.'
    }
  },
  '의정부': {
    locationName: '의정부시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '중랑천 상류 지역으로 집중호우 시 주의가 필요합니다.',
      affectedArea: '의정부동, 호원동 하천변'
    },
    heatwaveRisk: {
      level: '주의',
      score: 3,
      description: '분지 지형으로 열이 축적되기 쉽습니다.',
      avgTemperature: 28.7
    },
    greenSpace: {
      coverage: '높음',
      percentage: 52.3,
      description: '도봉산, 수락산 등 산지가 많아 녹지율이 높습니다.'
    }
  },
  '파주': {
    locationName: '파주시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '임진강, 한강 인접 지역에서 침수 위험이 있습니다.',
      affectedArea: '문산읍, 파주읍 하천변'
    },
    heatwaveRisk: {
      level: '안전',
      score: 1,
      description: '북부 지역으로 상대적으로 기온이 낮고 폭염 위험이 낮습니다.',
      avgTemperature: 26.5
    },
    greenSpace: {
      coverage: '높음',
      percentage: 55.8,
      description: '감악산, 심학산 등 산지와 농경지가 풍부합니다.'
    }
  },
  '김포': {
    locationName: '김포시',
    floodRisk: {
      level: '1등급',
      score: 1,
      description: '한강 하류 저지대로 침수 위험이 매우 높습니다.',
      affectedArea: '고촌읍, 양촌읍 한강변'
    },
    heatwaveRisk: {
      level: '관심',
      score: 2,
      description: '한강과 해안 영향으로 폭염 위험이 상대적으로 낮습니다.',
      avgTemperature: 27.2
    },
    greenSpace: {
      coverage: '보통',
      percentage: 32.4,
      description: '농경지가 많고 문수산, 가현산 등이 있습니다.'
    }
  },
  '시흥': {
    locationName: '시흥시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '시화호 인접 및 저지대 침수 위험이 있습니다.',
      affectedArea: '정왕동, 월곶동 해안 지역'
    },
    heatwaveRisk: {
      level: '주의',
      score: 3,
      description: '공업지역과 도시 개발로 열섬 현상이 나타납니다.',
      avgTemperature: 28.4
    },
    greenSpace: {
      coverage: '보통',
      percentage: 28.7,
      description: '갯골생태공원, 소래산 등이 있습니다.'
    }
  },
  '남양주': {
    locationName: '남양주시',
    floodRisk: {
      level: '2등급',
      score: 2,
      description: '한강, 북한강 합류 지역으로 침수 주의가 필요합니다.',
      affectedArea: '와부읍, 조안면 한강변'
    },
    heatwaveRisk: {
      level: '관심',
      score: 2,
      description: '산지가 많고 한강 영향으로 폭염 위험이 낮습니다.',
      avgTemperature: 27.4
    },
    greenSpace: {
      coverage: '높음',
      percentage: 62.5,
      description: '천마산, 축령산 등 풍부한 산림 자원을 보유합니다.'
    }
  }
};

// 기본 데이터 (매핑되지 않은 지역용)
const DEFAULT_CLIMATE_DATA: ClimateRiskData = {
  locationName: '경기도',
  floodRisk: {
    level: '3등급',
    score: 3,
    description: '일반적인 침수 위험 수준입니다. 저지대 및 하천 인근 지역은 주의가 필요합니다.',
    affectedArea: '저지대 및 하천 인근'
  },
  heatwaveRisk: {
    level: '주의',
    score: 3,
    description: '여름철 폭염 발생 가능성이 있습니다.',
    avgTemperature: 28.0
  },
  greenSpace: {
    coverage: '보통',
    percentage: 30.0,
    description: '경기도 평균 녹지율입니다.'
  }
};

/**
 * 지역별 기후 위험 데이터를 조회합니다.
 */
export const getClimateRiskData = (locationName: string): ClimateRiskData => {
  // 지역명 정규화 (시/군 접미사 제거)
  const normalizedName = locationName.replace(/시$|군$/g, '').trim();

  const data = MOCK_CLIMATE_DATA[normalizedName] || MOCK_CLIMATE_DATA[locationName];

  if (data) {
    console.log('[ClimateData] Found data for:', locationName);
    return data;
  }

  console.log('[ClimateData] Using default data for:', locationName);
  return {
    ...DEFAULT_CLIMATE_DATA,
    locationName: locationName
  };
};

/**
 * 특정 레이어 타입에 해당하는 기후 데이터만 추출합니다.
 */
export const getClimateDataByLayerTypes = (
  locationName: string,
  layerTypes: ClimateLayerType[]
): Partial<ClimateRiskData> => {
  const fullData = getClimateRiskData(locationName);
  const result: Partial<ClimateRiskData> = {
    locationName: fullData.locationName
  };

  for (const layerType of layerTypes) {
    switch (layerType) {
      case ClimateLayerType.FLOOD_RISK:
        result.floodRisk = fullData.floodRisk;
        break;
      case ClimateLayerType.HEATWAVE_VULNERABILITY:
        result.heatwaveRisk = fullData.heatwaveRisk;
        break;
      case ClimateLayerType.GREEN_SPACE:
        result.greenSpace = fullData.greenSpace;
        break;
      case ClimateLayerType.AIR_QUALITY:
        result.airQuality = fullData.airQuality;
        break;
      // ELDERLY_POPULATION은 SGIS API에서 별도로 가져옴
    }
  }

  return result;
};

/**
 * Tool 실행 결과를 생성합니다.
 */
export const createToolResult = (
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
  const climateData = getClimateDataByLayerTypes(locationName, layerTypes);

  const result: any = {
    success: true,
    locationName,
    layersActivated: layerTypes,
    climateData: {}
  };

  // 각 레이어 타입에 따른 데이터 추가
  if (climateData.floodRisk) {
    result.climateData.floodRisk = climateData.floodRisk;
  }
  if (climateData.heatwaveRisk) {
    result.climateData.heatwaveRisk = climateData.heatwaveRisk;
  }
  if (climateData.greenSpace) {
    result.climateData.greenSpace = climateData.greenSpace;
  }
  if (climateData.airQuality) {
    result.climateData.airQuality = climateData.airQuality;
  }
  if (elderlyData) {
    result.climateData.elderlyData = elderlyData;
  }

  // 요약 메시지 생성
  const summaryParts: string[] = [`${locationName} 지역 분석 결과:`];

  if (climateData.floodRisk) {
    summaryParts.push(`- 침수 위험: ${climateData.floodRisk.level} (${climateData.floodRisk.description})`);
  }
  if (climateData.heatwaveRisk) {
    summaryParts.push(`- 폭염 위험: ${climateData.heatwaveRisk.level} (${climateData.heatwaveRisk.description})`);
  }
  if (climateData.greenSpace) {
    summaryParts.push(`- 녹지율: ${climateData.greenSpace.percentage}% (${climateData.greenSpace.coverage})`);
  }
  if (elderlyData) {
    summaryParts.push(`- 고령인구: ${elderlyData.elderlyPopulation.toLocaleString()}명 (${elderlyData.elderlyRatio.toFixed(1)}%), 평균연령 ${elderlyData.avgAge.toFixed(1)}세`);
  }

  result.message = summaryParts.join('\n');

  return result;
};
