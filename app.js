const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Multer 설정 (메모리에 저장)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// =============================================
// 당뇨 예측 엔진 (Mayo Clinic 기준)
// =============================================

/**
 * Mayo Clinic 기반 당뇨 위험도 계산
 * 위험 요소:
 * - 공복 혈당 (Fasting Blood Sugar)
 * - BMI (체질량지수)
 * - 식이 점수 (Diet Score)
 * - 나이
 * - 가족력
 */

class DiabetesPredictor {
  constructor() {
    // Mayo Clinic 위험도 범주
    this.fbs_categories = {
      normal: { min: 0, max: 99, risk: 0 },
      prediabetic: { min: 100, max: 125, risk: 0.5 },
      diabetic: { min: 126, max: 999, risk: 1 }
    };

    this.bmi_categories = {
      underweight: { min: 0, max: 18.4, risk: 0.1 },
      normal: { min: 18.5, max: 24.9, risk: 0.2 },
      overweight: { min: 25, max: 29.9, risk: 0.5 },
      obese1: { min: 30, max: 34.9, risk: 0.8 },
      obese2: { min: 35, max: 999, risk: 1 }
    };
  }

  // 1. 혈당 위험도 계산
  calculateFBSRisk(fbs) {
    for (const [category, range] of Object.entries(this.fbs_categories)) {
      if (fbs >= range.min && fbs <= range.max) {
        return range.risk;
      }
    }
    return 1; // 기본값
  }

  // 2. BMI 위험도 계산
  calculateBMIRisk(weight, height) {
    const bmi = weight / (height * height); // height는 미터
    for (const [category, range] of Object.entries(this.bmi_categories)) {
      if (bmi >= range.min && bmi <= range.max) {
        return { bmi, risk: range.risk };
      }
    }
    return { bmi, risk: 1 };
  }

  // 3. 식단 점수 계산 (낮을수록 좋음)
  calculateDietScore(dietData) {
    let score = 0;

    // 탄수화물 분석
    if (dietData.carbs) {
      if (dietData.carbs > 200) score += 0.5; // 높은 탄수
      if (dietData.carbs > 300) score += 0.3; // 매우 높은 탄수
    }

    // 당분 분석
    if (dietData.sugar) {
      if (dietData.sugar > 50) score += 0.4; // 높은 당분
      if (dietData.sugar > 100) score += 0.4; // 매우 높은 당분
    }

    // 섬유질 분석 (높을수록 좋음 - 역점수)
    if (dietData.fiber) {
      if (dietData.fiber > 25) score -= 0.3;
    }

    // 단백질 분석
    if (dietData.protein) {
      if (dietData.protein > 80) score -= 0.2; // 건강한 단백질
    }

    // 음료 분석
    if (dietData.sugaryDrinks) {
      score += dietData.sugaryDrinks * 0.2;
    }

    // 알코올
    if (dietData.alcohol) {
      score += dietData.alcohol * 0.15;
    }

    return Math.max(0, Math.min(1, score)); // 0-1 범위
  }

  // 4. 예상 수명 계산 (Mayo Clinic 참고)
  predictLifeExpectancy(currentAge, diabetesRisk, genderFactor = 1) {
    // 기본 평균 수명 (한국)
    const baseExpectancy = currentAge + 82 - currentAge;
    
    // 위험도에 따른 수명 감소
    const lifeReduction = diabetesRisk * 8; // 최대 8년 감소
    
    // 성별 팩터 적용
    const adjusted = baseExpectancy - (lifeReduction * genderFactor);
    
    return Math.round(adjusted * 10) / 10;
  }

  // 5. 종합 위험도 계산
  calculateComprehensiveRisk(data) {
    const fbsRisk = this.calculateFBSRisk(data.fbs);
    const { bmi, risk: bmiRisk } = this.calculateBMIRisk(data.weight, data.height);
    const dietScore = this.calculateDietScore(data.diet);
    
    // 나이 팩터 (45세 이상 위험도 증가)
    let ageFactor = data.age < 45 ? 0.7 : data.age < 60 ? 1 : 1.2;
    
    // 가족력 팩터
    let familyFactor = data.familyHistory ? 1.3 : 1;
    
    // 종합 위험도 (0-1)
    const comprehensiveRisk = Math.min(
      1,
      (fbsRisk * 0.3 + bmiRisk * 0.3 + dietScore * 0.4) * ageFactor * familyFactor * 0.8
    );
    
    return {
      fbsRisk,
      bmiRisk,
      bmi,
      dietScore,
      ageFactor,
      familyFactor,
      comprehensiveRisk
    };
  }

  // 6. 위험도 분류
  getRiskCategory(risk) {
    if (risk < 0.3) return { level: 'LOW', color: '#4CAF50', label: '낮음' };
    if (risk < 0.6) return { level: 'MEDIUM', color: '#FFC107', label: '중간' };
    if (risk < 0.8) return { level: 'HIGH', color: '#FF9800', label: '높음' };
    return { level: 'CRITICAL', color: '#F44336', label: '매우 높음' };
  }

  // 7. 권장사항 생성
  getRecommendations(riskData) {
    const recommendations = [];

    if (riskData.fbsRisk > 0.5) {
      recommendations.push('혈당 관리: 공복 혈당이 높습니다. 정기적인 혈당 검사를 권장합니다.');
    }

    if (riskData.bmiRisk > 0.5) {
      recommendations.push('체중 관리: 현재 BMI (' + riskData.bmi.toFixed(1) + ')를 기준으로 체중 감량이 필요합니다.');
    }

    if (riskData.dietScore > 0.6) {
      recommendations.push('식단 개선: 탄수화물과 당분 섭취를 줄이고 섬유질 섭취를 늘려보세요.');
    }

    if (riskData.comprehensiveRisk > 0.7) {
      recommendations.push('의료 상담: 당뇨병 전문의와 상담을 강력히 권장합니다.');
    } else if (riskData.comprehensiveRisk > 0.5) {
      recommendations.push('정기 검진: 최소 년 2회 당뇨병 검진을 권장합니다.');
    }

    if (!recommendations.length) {
      recommendations.push('현재 당뇨병 위험도가 낮습니다. 건강한 식단과 운동을 계속 유지하세요.');
    }

    return recommendations;
  }
}

// =============================================
// API 엔드포인트
// =============================================

const predictor = new DiabetesPredictor();

// 예측 요청 처리
app.post('/api/predict', (req, res) => {
  try {
    const {
      age,
      weight,
      height,
      fbs, // Fasting Blood Sugar
      gender,
      familyHistory,
      diet
    } = req.body;

    // 입력 검증
    if (!age || !weight || !height || !fbs) {
      return res.status(400).json({
        error: '필수 정보를 모두 입력해주세요 (나이, 체중, 키, 공복혈당)'
      });
    }

    // 위험도 계산
    const riskData = predictor.calculateComprehensiveRisk({
      age: parseInt(age),
      weight: parseFloat(weight),
      height: parseFloat(height) / 100, // cm를 m로 변환
      fbs: parseInt(fbs),
      familyHistory: familyHistory === 'true' || familyHistory === true,
      diet: diet || {}
    });

    // 위험도 분류
    const riskCategory = predictor.getRiskCategory(riskData.comprehensiveRisk);

    // 수명 예측
    const genderFactor = gender === 'female' ? 0.9 : 1.1;
    const predictedAge = predictor.predictLifeExpectancy(age, riskData.comprehensiveRisk, genderFactor);

    // 권장사항
    const recommendations = predictor.getRecommendations(riskData);

    // 결과 반환
    res.json({
      success: true,
      input: {
        age,
        weight,
        height,
        fbs,
        gender,
        familyHistory
      },
      riskAssessment: {
        diabetesRisk: (riskData.comprehensiveRisk * 100).toFixed(1) + '%',
        riskLevel: riskCategory.label,
        riskColor: riskCategory.color
      },
      healthMetrics: {
        bmi: riskData.bmi.toFixed(1),
        fbsLevel: fbs + ' mg/dL',
        dietScore: (riskData.dietScore * 100).toFixed(1)
      },
      prediction: {
        currentAge: age,
        predictedLifeExpectancy: predictedAge,
        yearsAtRisk: Math.round((82 - predictedAge) * 10) / 10
      },
      recommendations: recommendations,
      disclaimer: '본 서비스는 교육용 정보이며, 의료 진단 또는 치료 권고가 아닙니다. 정확한 진단을 위해 전문 의료진 상담이 필수입니다.'
    });
  } catch (error) {
    console.error('예측 오류:', error);
    res.status(500).json({ error: '예측 처리 중 오류가 발생했습니다.' });
  }
});

// 건강 팁 제공
app.get('/api/tips/:category', (req, res) => {
  const tips = {
    diet: [
      '통곡물을 선택하세요 (흰 쌀과 빵보다)',
      '매 식사마다 단백질을 포함시키세요',
      '당분이 높은 음료(소다, 주스)를 피하세요',
      '신선한 채소와 과일을 늘리세요',
      '포션 사이즈를 줄여보세요'
    ],
    exercise: [
      '주 3-4회 150분의 중간 강도 운동',
      '저항 운동을 주 2회 추가하세요',
      '매일 30분 이상 걷기',
      '앉아있는 시간을 줄이세요',
      '계단을 이용해 일상 활동 증가'
    ],
    monitoring: [
      '정기적으로 혈당을 모니터링하세요',
      '체중을 주 1-2회 측정하세요',
      '혈압을 주 1회 확인하세요',
      '콜레스테롤 수치를 연 1-2회 점검하세요',
      '당화혈색소(HbA1c)를 3-6개월마다 확인하세요'
    ]
  };

  const category = req.params.category || 'diet';
  res.json({
    category: category,
    tips: tips[category] || tips.diet
  });
});

// =============================================
// 이미지 분석 및 챗봇 API
// =============================================

/**
 * Claude Vision을 사용하여 음식 이미지 분석
 */
async function analyzeFoodImage(base64Image) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        error: 'API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정하세요.',
        fallback: true
      };
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image.replace(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, '')
              }
            },
            {
              type: 'text',
              text: `이 음식 사진을 분석해주세요. 다음 정보를 JSON 형식으로 제공해주세요:
{
  "foodName": "음식 이름",
  "carbs": 탄수화물(g),
  "sugar": 당분(g),
  "fiber": 식이섬유(g),
  "protein": 단백질(g),
  "calories": 칼로리(kcal),
  "servingSize": "1인분 (g)",
  "healthRating": "매우나쁨/나쁨/보통/좋음/매우좋음",
  "description": "음식에 대한 설명과 건강 조언"
}

JSON만 반환해주세요.`
            }
          ]
        }
      ]
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    const content = response.data.content[0].text;
    try {
      return JSON.parse(content);
    } catch {
      // JSON 파싱 실패 시 텍스트 반환
      return { description: content };
    }
  } catch (error) {
    console.error('이미지 분석 오류:', error.response?.data || error.message);
    return {
      error: '이미지 분석 중 오류가 발생했습니다.',
      details: error.message
    };
  }
}

/**
 * 이미지 분석 엔드포인트
 */
app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '이미지를 선택해주세요.' });
    }

    // Base64로 변환
    const base64Image = req.file.buffer.toString('base64');

    // 이미지 분석
    const analysisResult = await analyzeFoodImage(base64Image);

    if (analysisResult.error && analysisResult.fallback) {
      // API 키 없을 때 기본값 반환
      return res.json({
        success: false,
        message: analysisResult.error,
        fallback: true
      });
    }

    res.json({
      success: true,
      analysis: analysisResult
    });
  } catch (error) {
    console.error('이미지 분석 오류:', error);
    res.status(500).json({ error: '이미지 분석 처리 중 오류가 발생했습니다.' });
  }
});

/**
 * 챗봇 대화 및 당뇨 예측 엔드포인트
 */
app.post('/api/chat', (req, res) => {
  try {
    const { message, userProfile, analyzedFood } = req.body;

    if (!message) {
      return res.status(400).json({ error: '메시지를 입력해주세요.' });
    }

    // 사용자 프로필에서 필수 정보 추출
    const age = parseInt(userProfile?.age) || 40;
    const weight = parseFloat(userProfile?.weight) || 70;
    const height = parseFloat(userProfile?.height) / 100 || 1.75;
    const fbs = parseInt(userProfile?.fbs) || 100;
    const gender = userProfile?.gender || 'male';
    const familyHistory = userProfile?.familyHistory === 'true' || userProfile?.familyHistory === true;

    // 분석된 음식 정보 추가
    const dietData = {
      carbs: analyzedFood?.carbs || userProfile?.diet?.carbs || 0,
      sugar: analyzedFood?.sugar || userProfile?.diet?.sugar || 0,
      fiber: analyzedFood?.fiber || userProfile?.diet?.fiber || 0,
      protein: analyzedFood?.protein || userProfile?.diet?.protein || 0,
      sugaryDrinks: analyzedFood?.sugaryDrinks || userProfile?.diet?.sugaryDrinks || 0,
      alcohol: analyzedFood?.alcohol || userProfile?.diet?.alcohol || 0,
      calories: analyzedFood?.calories || 0
    };

    // 당뇨 예측 실행
    const riskData = predictor.calculateComprehensiveRisk({
      age,
      weight,
      height,
      fbs,
      familyHistory,
      diet: dietData
    });

    const riskCategory = predictor.getRiskCategory(riskData.comprehensiveRisk);
    const genderFactor = gender === 'female' ? 0.9 : 1.1;
    const predictedAge = predictor.predictLifeExpectancy(age, riskData.comprehensiveRisk, genderFactor);
    const recommendations = predictor.getRecommendations(riskData);

    // 챗봇 응답 생성
    let chatResponse = '';
    const riskPercent = (riskData.comprehensiveRisk * 100).toFixed(0);
    const yearsAtRisk = Math.round((82 - predictedAge) * 10) / 10;

    if (message.toLowerCase().includes('몇') || message.toLowerCase().includes('살')) {
      // "몇 살까지 살아요?" 질문에 대한 응답
      chatResponse = `🩺 현재 당뇨병 위험도를 바탕으로 분석하면, 약 <strong>${predictedAge}세</strong>까지 예상됩니다.\n\n`;
      chatResponse += `📊 상세 정보:\n`;
      chatResponse += `• 당뇨병 위험도: ${riskPercent}% (${riskCategory.label})\n`;
      chatResponse += `• BMI: ${riskData.bmi.toFixed(1)}\n`;
      chatResponse += `• 공복혈당: ${fbs} mg/dL\n`;
      chatResponse += `• 식단 점수: ${(riskData.dietScore * 100).toFixed(0)}점\n\n`;
      chatResponse += `💡 건강 개선 권장사항:\n`;
      recommendations.forEach((rec, idx) => {
        chatResponse += `${idx + 1}. ${rec}\n`;
      });

      if (riskPercent >= 70) {
        chatResponse += `\n⚠️ <strong>당뇨병 위험도가 높습니다.</strong> 전문 의료진과 상담하시기 바랍니다.`;
      }
    } else {
      // 일반 질문에 대한 응답
      chatResponse = `안녕하세요! 저는 Mayo Clinic 기준의 당뇨병 전문의 AI입니다.\n\n`;
      chatResponse += `현재 당신의 당뇨병 위험도는 <strong>${riskPercent}%</strong>이며, `;
      chatResponse += `예상 수명은 <strong>약 ${predictedAge}세</strong>입니다.\n\n`;
      chatResponse += `"몇 살까지 살아요?" 라고 물어보시면 더 자세한 건강 정보와 권장사항을 드리겠습니다.`;
    }

    res.json({
      success: true,
      message: chatResponse,
      prediction: {
        predictedAge: predictedAge,
        riskPercent: riskPercent,
        riskLevel: riskCategory.label,
        recommendations: recommendations
      }
    });
  } catch (error) {
    console.error('챗봇 오류:', error);
    res.status(500).json({ error: '챗봇 처리 중 오류가 발생했습니다.' });
  }
});

// 홈페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🩺 당뇨병 예측 서비스가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT} 에 접속하세요.`);
});
