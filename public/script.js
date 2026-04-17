// =============================================
// 폼 제출 처리
// =============================================

document.getElementById('predictionForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // 폼 데이터 수집
  const formData = {
    age: document.getElementById('age').value,
    weight: document.getElementById('weight').value,
    height: document.getElementById('height').value,
    fbs: document.getElementById('fbs').value,
    gender: document.getElementById('gender').value,
    familyHistory: document.getElementById('familyHistory').value,
    diet: {
      carbs: document.getElementById('carbs').value || 0,
      sugar: document.getElementById('sugar').value || 0,
      fiber: document.getElementById('fiber').value || 0,
      protein: document.getElementById('protein').value || 0,
      sugaryDrinks: document.getElementById('sugaryDrinks').value || 0,
      alcohol: document.getElementById('alcohol').value || 0
    }
  };

  try {
    // API 호출
    const response = await fetch('/api/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('예측 요청 실패');
    }

    const result = await response.json();

    if (result.success) {
      displayResults(result);
    } else {
      alert('오류: ' + result.error);
    }
  } catch (error) {
    console.error('오류:', error);
    alert('예측 처리 중 오류가 발생했습니다.');
  }
});

// =============================================
// 결과 표시
// =============================================

function displayResults(result) {
  // 결과 섹션 표시
  const resultSection = document.getElementById('resultSection');
  resultSection.classList.remove('hidden');

  // 위험도 카드 업데이트
  const riskCard = document.getElementById('riskCard');
  const riskPercentage = document.getElementById('riskPercentage');
  const riskLevel = document.getElementById('riskLevel');
  const riskDescription = document.getElementById('riskDescription');

  const risk = parseFloat(result.riskAssessment.diabetesRisk);
  riskPercentage.textContent = result.riskAssessment.diabetesRisk;
  riskLevel.textContent = result.riskAssessment.diabetesRisk + ' (' + result.riskAssessment.riskLevel + ')';
  riskCard.style.background = `linear-gradient(135deg, ${result.riskAssessment.riskColor}33 0%, ${result.riskAssessment.riskColor}66 100%)`;

  // 위험도 설명
  const riskDescriptions = {
    '낮음': '현재 당뇨병 위험도가 낮습니다. 건강한 생활 습관을 계속 유지하세요.',
    '중간': '당뇨병 전 단계(Prediabetes) 범위입니다. 식단과 운동을 개선하면 진행을 막을 수 있습니다.',
    '높음': '당뇨병 위험도가 높습니다. 의료 전문가와 상담하고 식단 및 운동 계획을 수립하세요.',
    '매우 높음': '당뇨병 위험도가 매우 높습니다. 즉시 의료 전문가 상담이 필수입니다.'
  };
  riskDescription.textContent = riskDescriptions[result.riskAssessment.riskLevel] || '';

  // 건강 지표 업데이트
  document.getElementById('bmiValue').textContent = result.healthMetrics.bmi;
  document.getElementById('fbsValue').textContent = result.healthMetrics.fbsLevel;
  document.getElementById('dietScore').textContent = result.healthMetrics.dietScore;
  document.getElementById('lifeExpectancy').textContent = result.prediction.predictedLifeExpectancy;

  // 권장사항 표시
  const recommendationsList = document.getElementById('recommendations');
  recommendationsList.innerHTML = '';
  result.recommendations.forEach((rec) => {
    const li = document.createElement('li');
    li.textContent = rec;
    recommendationsList.appendChild(li);
  });

  // 페이지를 결과 섹션으로 스크롤
  setTimeout(() => {
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// =============================================
// 폼 리셋
// =============================================

function resetForm() {
  document.getElementById('predictionForm').reset();
  document.getElementById('resultSection').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// 건강 팁 로드
// =============================================

async function loadTips(category) {
  try {
    const response = await fetch(`/api/tips/${category}`);
    const data = await response.json();

    const tipsContainer = document.getElementById(`${category}-tips`);
    
    // 토글
    if (tipsContainer.classList.contains('hidden')) {
      // 열기
      tipsContainer.innerHTML = '<ul>' + data.tips.map(tip => `<li>${tip}</li>`).join('') + '</ul>';
      tipsContainer.classList.remove('hidden');
    } else {
      // 닫기
      tipsContainer.classList.add('hidden');
    }
  } catch (error) {
    console.error('팁 로드 오류:', error);
  }
}

// =============================================
// 유틸리티 함수
// =============================================

// BMI 계산
function calculateBMI(weight, height) {
  return (weight / (height * height)).toFixed(1);
}

// 혈당 분류
function getFBSCategory(fbs) {
  if (fbs < 100) return '정상';
  if (fbs < 126) return '전당뇨 단계';
  return '당뇨병';
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('🩺 당뇨병 예측 서비스 시작');
  
  // 초기 팁 로드 (선택사항)
  // loadTips('diet');
});
