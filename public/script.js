// =============================================
// 전역 변수
// =============================================

let currentUserProfile = {};
let currentAnalyzedFood = null;
let chatHistory = [];

// =============================================
// 탭 전환 기능
// =============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    
    // 모든 탭 비활성화
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
    });
    
    // 선택된 탭 활성화
    document.getElementById(`${tabName}-tab`).classList.add('active');
    btn.classList.add('active');
  });
});

// =============================================
// 폼 제출 처리 (수동 입력)
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

  // 사용자 프로필 저장 (챗봇용)
  currentUserProfile = formData;

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
// 결과 표시 (수동 입력)
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
// 폼 리셋 (수동 입력)
// =============================================

function resetForm() {
  document.getElementById('predictionForm').reset();
  document.getElementById('resultSection').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// 이미지 분석 기능
// =============================================

const uploadBox = document.getElementById('uploadBox');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');

// 드래그 앤 드롭
uploadBox.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadBox.style.backgroundColor = 'rgba(33, 150, 243, 0.15)';
});

uploadBox.addEventListener('dragleave', () => {
  uploadBox.style.backgroundColor = 'rgba(33, 150, 243, 0.05)';
});

uploadBox.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadBox.style.backgroundColor = 'rgba(33, 150, 243, 0.05)';
  
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleImageSelect(files[0]);
  }
});

// 파일 입력
imageInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleImageSelect(e.target.files[0]);
  }
});

function handleImageSelect(file) {
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일을 선택해주세요.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('previewImg');
    img.src = e.target.result;
    imagePreview.classList.remove('hidden');
    document.getElementById('analyzeBtn').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  imageInput.value = '';
  imagePreview.classList.add('hidden');
  document.getElementById('analyzeBtn').classList.add('hidden');
  document.getElementById('analysisResult').classList.add('hidden');
}

async function analyzeImage() {
  const file = imageInput.files[0];
  if (!file) {
    alert('이미지를 선택해주세요.');
    return;
  }

  // 로딩 표시
  document.getElementById('analysisLoading').classList.remove('hidden');
  document.getElementById('analysisResult').classList.add('hidden');

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/api/analyze-image', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      currentAnalyzedFood = result.analysis;
      displayAnalysisResult(result.analysis);
    } else {
      alert('이미지 분석 실패: ' + (result.message || result.error));
    }
  } catch (error) {
    console.error('이미지 분석 오류:', error);
    alert('이미지 분석 중 오류가 발생했습니다.');
  } finally {
    document.getElementById('analysisLoading').classList.add('hidden');
  }
}

function displayAnalysisResult(analysis) {
  document.getElementById('foodName').textContent = analysis.foodName || '음식 분석 결과';
  document.getElementById('foodDescription').textContent = analysis.description || '';
  document.getElementById('foodCarbs').textContent = (analysis.carbs || 0) + 'g';
  document.getElementById('foodProtein').textContent = (analysis.protein || 0) + 'g';
  document.getElementById('foodSugar').textContent = (analysis.sugar || 0) + 'g';
  document.getElementById('foodFiber').textContent = (analysis.fiber || 0) + 'g';
  document.getElementById('foodCalories').textContent = (analysis.calories || 0) + 'kcal';
  document.getElementById('foodRating').textContent = analysis.healthRating || '-';

  // 건강도 표시
  const healthRatingDiv = document.getElementById('healthRating');
  const ratingColors = {
    '매우나쁨': '#F44336',
    '나쁨': '#FF9800',
    '보통': '#FFC107',
    '좋음': '#8BC34A',
    '매우좋음': '#4CAF50'
  };
  const ratingColor = ratingColors[analysis.healthRating] || '#999';
  healthRatingDiv.innerHTML = `
    <div style="padding: 15px; background-color: ${ratingColor}20; border-left: 4px solid ${ratingColor}; border-radius: 4px; margin-top: 15px;">
      <strong style="color: ${ratingColor};">건강 평가: ${analysis.healthRating || '분석 중'}</strong>
    </div>
  `;

  document.getElementById('analysisResult').classList.remove('hidden');
}

// =============================================
// 챗봇 기능
// =============================================

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) {
    return;
  }

  // 사용자 메시지 표시
  addChatMessage(message, 'user');
  input.value = '';

  // 챗봇이 프로필 정보가 없으면 경고
  if (Object.keys(currentUserProfile).length === 0) {
    addChatMessage('먼저 건강 정보를 입력해주세요. "👤 정보 입력" 버튼을 클릭하세요.', 'bot');
    return;
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        userProfile: currentUserProfile,
        analyzedFood: currentAnalyzedFood
      })
    });

    const result = await response.json();

    if (result.success) {
      addChatMessage(result.message, 'bot');
    } else {
      addChatMessage('오류가 발생했습니다: ' + result.error, 'bot');
    }
  } catch (error) {
    console.error('챗봇 오류:', error);
    addChatMessage('챗봇 처리 중 오류가 발생했습니다.', 'bot');
  }
}

function addChatMessage(text, sender) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.innerHTML = text; // HTML 렌더링 지원
  
  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);
  
  // 자동 스크롤
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleChatKeypress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

function openProfileSetupForChat() {
  // 수동 입력 탭으로 전환
  document.querySelector('[data-tab="manual"]').click();
  alert('건강 정보를 입력하고 나면 챗봇 탭에서 질문하세요!');
}

function openImageUploadForChat() {
  // 사진 분석 탭으로 전환
  document.querySelector('[data-tab="image"]').click();
  alert('음식 사진을 분석하고 나면 챗봇 탭에서 질문하세요!');
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
// 페이지 로드 시 초기화
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🩺 당뇨병 예측 서비스 시작');
});
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
