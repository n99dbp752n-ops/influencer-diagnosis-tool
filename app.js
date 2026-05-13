const form = document.getElementById('diagnosisForm');
const resultBox = document.getElementById('resultBox');
const historySelect = document.getElementById('historySelect');
const HISTORY_KEY = 'influencer_diagnosis_history_v1';

const screenshotTypeMeta = {
  profile: { previewId: 'profileScreenshotPreview', label: '达人主页截图' },
  recentPosts: { previewId: 'recentPostsScreenshotPreview', label: '近10篇数据截图' },
  price: { previewId: 'priceScreenshotPreview', label: '报价截图' },
  audience: { previewId: 'audienceScreenshotPreview', label: '粉丝画像截图' }
};

const screenshotKeywords = {
  profile: ['粉丝', '关注', '获赞', '小红书号', 'IP属地', '主页', '笔记', '用户名', '个人简介'],
  recentPosts: ['点赞', '收藏', '评论', '阅读', '浏览', '曝光', '互动', '近10篇', '笔记数据', '平均'],
  price: ['报价', '图文', '视频', '合作费用', '蒲公英', '服务费', '价格', '元'],
  audience: ['粉丝画像', '女性', '男性', '年龄', '地域', '城市', '25-34', '35-44', '购买力', '人群']
};

const sampleData = {
  profileUrl: 'https://www.xiaohongshu.com/user/profile/example', nickname: 'Mia通勤穿搭', followers: 128000,
  avgLikes: 1850, avgSaves: 620, avgComments: 230, medianViews: 32000, price: 18000,
  contentCategory: '通勤', audienceProfile: '女性为主25-40岁', hasSimilarBrandCoop: '是', adDensity: '中',
  contentStyle: '简约', imageQuality: 4, brandFit: 5, executionRisk: '低', historicalResult: '有'
};

function num(v) { return Number(v || 0); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function calcMetrics(data) {
  const avgEngagement = num(data.avgLikes) + num(data.avgSaves) + num(data.avgComments);
  const engagementRate = num(data.medianViews) > 0 ? avgEngagement / num(data.medianViews) : 0;
  const cpm = num(data.medianViews) > 0 ? (num(data.price) / num(data.medianViews)) * 1000 : 0;
  const cpe = avgEngagement > 0 ? num(data.price) / avgEngagement : 0;
  return { avgEngagement, engagementRate, cpm, cpe };
}

function scoreDataHealth({ engagementRate, cpm, cpe }) {
  let score = 0;
  if (engagementRate >= 0.12) score += 12;
  else if (engagementRate >= 0.08) score += 9;
  else if (engagementRate >= 0.05) score += 6;
  else score += 3;

  if (cpm <= 500) score += 7;
  else if (cpm <= 800) score += 5;
  else if (cpm <= 1200) score += 3;
  else score += 1;

  if (cpe <= 6) score += 6;
  else if (cpe <= 10) score += 4;
  else if (cpe <= 15) score += 2;
  else score += 1;

  return clamp(score, 0, 25);
}

function calculateScore(data, metrics) {
  const brandFitScore = num(data.brandFit) * 8;
  const dataHealthScore = scoreDataHealth(metrics);

  let riskScore = 20;
  if (data.executionRisk === '中') riskScore -= 6;
  if (data.executionRisk === '高') riskScore -= 14;
  if (data.adDensity === '中') riskScore -= 3;
  if (data.adDensity === '高') riskScore -= 8;
  if (data.historicalResult === '无') riskScore -= 3;
  riskScore = clamp(riskScore, 0, 20);

  let valueScore = 0;
  if (data.hasSimilarBrandCoop === '是') valueScore += 6;
  if (num(data.imageQuality) >= 4) valueScore += 4;
  if (['简约', '松弛', '精致'].includes(data.contentStyle)) valueScore += 5;
  valueScore = clamp(valueScore, 0, 15);

  const total = brandFitScore + dataHealthScore + riskScore + valueScore;
  return { brandFitScore, dataHealthScore, riskScore, valueScore, total };
}

function generateAdvice(data, metrics, scores) {
  const highFit = num(data.brandFit) >= 4 && ['女性为主25-40岁', '女性为主30-50岁'].includes(data.audienceProfile);
  const goodData = metrics.engagementRate >= 0.08 && metrics.cpe <= 10;
  const midData = metrics.engagementRate >= 0.05;
  const highRisk = data.executionRisk === '高' || data.adDensity === '高';
  const priceReasonable = metrics.cpm <= 800 && metrics.cpe <= 10;

  let influencerType = '待观察型';
  if (goodData && highFit) influencerType = '高潜转化型';
  else if (highFit) influencerType = '品牌形象型';
  else if (goodData) influencerType = '流量曝光型';

  let coopAdvice = '建议先小范围测试。';
  if (highFit && goodData && priceReasonable) coopAdvice = '建议报备合作 / 图文合作 / 上新重点合作。';
  else if (highFit && midData && num(data.imageQuality) >= 4) coopAdvice = '建议寄样 + 低服务费测试。';
  else if (goodData && !highFit) coopAdvice = '数据不错，但品牌调性一般，建议谨慎测试，不作为主推。';
  else if (!priceReasonable) coopAdvice = '报价偏高，建议压价 / 换合作方式 / 暂不合作。';
  if (highRisk) coopAdvice = '广告密度或执行风险偏高，不建议进入本期合作池。';

  let quoteRange = '建议置换或低预算测试。';
  if (highRisk) quoteRange = '执行风险高：不建议合作。';
  else if (highFit && goodData) quoteRange = `建议报价区间：¥${Math.round(num(data.price) * 0.8)} - ¥${Math.round(num(data.price))}`;
  else if ((highFit && midData) || (goodData && num(data.brandFit) === 3)) quoteRange = `建议报价区间：¥${Math.round(num(data.price) * 0.5)} - ¥${Math.round(num(data.price) * 0.7)}`;

  const enterPool = !highRisk && scores.total >= 60 ? '建议进入合作池' : '暂不进入合作池';

  return {
    influencerType,
    fitJudge: highFit ? '高匹配：人群与品牌方向较一致。' : '匹配一般：建议先做小样测试。',
    dataJudge: goodData ? '数据健康：互动效率较好。' : midData ? '数据中等：可测但需控预算。' : '数据偏弱：谨慎投入。',
    riskJudge: highRisk ? '风险偏高：重点关注执行稳定性和广告密度。' : '风险可控。',
    priceJudge: priceReasonable ? '报价基本合理。' : '报价偏高，当前数据支撑不足。',
    coopAdvice,
    quoteRange,
    enterPool,
    riskAlert: highRisk ? '风险提醒：请避免本期重点投放，必要时先走低成本试投。' : '风险提醒：可按常规流程推进。',
    bargainTip: priceReasonable ? '谈价建议：可争取赠送加拍素材或二次分发授权。' : '谈价建议：以CPM/CPE数据为依据，先压至建议区间再决定合作。'
  };
}

function toMarkdown(data, metrics, scores, advice) {
  return `# 达人诊断报告\n\n- 达人：${data.nickname}\n- 链接：${data.profileUrl}\n- 诊断总分：${scores.total}/100\n\n## 核心数据\n- 平均互动量：${metrics.avgEngagement.toFixed(0)}\n- 互动率：${(metrics.engagementRate * 100).toFixed(2)}%\n- CPM：${metrics.cpm.toFixed(2)}\n- CPE：${metrics.cpe.toFixed(2)}\n\n## 评分拆解\n- 品牌匹配度：${scores.brandFitScore}/40\n- 数据健康度：${scores.dataHealthScore}/25\n- 商业风险：${scores.riskScore}/20\n- 合作价值：${scores.valueScore}/15\n\n## 诊断结论\n- 达人类型：${advice.influencerType}\n- 品牌匹配度判断：${advice.fitJudge}\n- 数据健康度判断：${advice.dataJudge}\n- 商业风险判断：${advice.riskJudge}\n- 报价是否合理：${advice.priceJudge}\n- 建议合作形式：${advice.coopAdvice}\n- 建议报价区间：${advice.quoteRange}\n- 是否进入合作池：${advice.enterPool}\n- 风险提醒：${advice.riskAlert}\n- 谈价建议：${advice.bargainTip}\n`;
}

function getFormData() { return Object.fromEntries(new FormData(form).entries()); }
function fillForm(data) { Object.entries(data).forEach(([k, v]) => { if (form[k]) form[k].value = v; }); }

function render() {
  const data = getFormData();
  const metrics = calcMetrics(data);
  const scores = calculateScore(data, metrics);
  const advice = generateAdvice(data, metrics, scores);
  resultBox.textContent = toMarkdown(data, metrics, scores, advice);
}

function refreshHistoryOptions() {
  const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  historySelect.innerHTML = '<option value="">选择历史记录</option>';
  items.forEach((item, idx) => {
    const op = document.createElement('option');
    op.value = String(idx);
    op.textContent = `${item.nickname || '未命名'} - ${new Date(item.savedAt).toLocaleString()}`;
    historySelect.appendChild(op);
  });
}

function setScreenshotPreview(type, dataUrl, recognizedText = '') {
  const preview = document.getElementById(screenshotTypeMeta[type].previewId);
  const details = document.getElementById(`${type}OcrDetails`);
  const textBox = document.getElementById(`${type}OcrText`);
  preview.src = dataUrl;
  preview.classList.add('is-visible');
  textBox.textContent = recognizedText || '（未识别到文本）';
  details.classList.remove('hidden');
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function recognizeTextFromImage(file) {
  if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
    const result = await window.Tesseract.recognize(file, 'chi_sim+eng');
    return String(result?.data?.text || '').trim();
  }
  return mockRecognizeText(file);
}

async function mockRecognizeText() {
  return '';
}

function classifyScreenshotType(text) {
  const normalized = String(text || '').toLowerCase();
  let bestType = '';
  let bestScore = 0;

  Object.entries(screenshotKeywords).forEach(([type, keywords]) => {
    let score = 0;
    keywords.forEach((kw) => { if (normalized.includes(kw.toLowerCase())) score += 1; });
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  });

  return bestScore > 0 ? bestType : '';
}

function showPendingScreenshot(dataUrl, text) {
  const pendingPreview = document.getElementById('pendingScreenshotPreview');
  const pendingText = document.getElementById('pendingOcrText');
  const pendingPanel = document.getElementById('pendingScreenshotPanel');
  pendingPreview.src = dataUrl;
  pendingPreview.classList.add('is-visible');
  pendingText.textContent = text || '（未识别到文本）';
  pendingPanel.classList.remove('hidden');
}

function extractFieldsFromOcrText(text) {
  return {
    followers: '', avgLikes: '', avgSaves: '', avgComments: '', medianViews: '', price: '',
    audienceProfile: '', adDensity: '', contentStyle: '',
    rawText: text || ''
  };
}

async function processScreenshotFile(file) {
  const dataUrl = await readFileAsDataURL(file);
  const recognizedText = await recognizeTextFromImage(file);
  const type = classifyScreenshotType(recognizedText);
  extractFieldsFromOcrText(recognizedText);

  if (!type) {
    showPendingScreenshot(dataUrl, recognizedText);
    return;
  }

  setScreenshotPreview(type, dataUrl, recognizedText);
}

function handleScreenshotPreview(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  processScreenshotFile(file);
}

function applyRecognizedDataToDiagnosisForm() {
  const recognizedFormFieldMap = {
    recognizedProfileUrl: 'profileUrl', recognizedNickname: 'nickname', recognizedFollowers: 'followers', recognizedAvgLikes: 'avgLikes',
    recognizedAvgSaves: 'avgSaves', recognizedAvgComments: 'avgComments', recognizedMedianViews: 'medianViews', recognizedPrice: 'price',
    recognizedAudienceProfile: 'audienceProfile'
  };

  Object.entries(recognizedFormFieldMap).forEach(([recognizedName, diagnosisName]) => {
    const recognizedField = document.querySelector(`[name="${recognizedName}"]`);
    if (!recognizedField) return;
    const value = (recognizedField.value || '').trim();
    if (!value) return;
    if (form[diagnosisName]) form[diagnosisName].value = value;
  });
  alert('已将识别结果确认区内容填入诊断表单。');
}

Array.from(document.querySelectorAll('.screenshot-panel input[type="file"]')).forEach((input) => {
  input.addEventListener('change', () => handleScreenshotPreview(input));
});

document.addEventListener('paste', async (event) => {
  const items = Array.from(event.clipboardData?.items || []);
  const imageItem = items.find((it) => it.type.startsWith('image/'));
  if (!imageItem) return;
  event.preventDefault();
  const file = imageItem.getAsFile();
  if (!file) return;
  await processScreenshotFile(file);
});

document.querySelectorAll('.change-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sourceType = btn.dataset.type;
    const preview = document.getElementById(screenshotTypeMeta[sourceType].previewId);
    if (!preview.src) return;
    const text = document.getElementById(`${sourceType}OcrText`).textContent;
    showPendingScreenshot(preview.src, text);
    document.getElementById('pendingTypeSelect').value = sourceType;
    preview.removeAttribute('src');
    preview.classList.remove('is-visible');
    document.getElementById(`${sourceType}OcrDetails`).classList.add('hidden');
  });
});

document.getElementById('confirmPendingType').addEventListener('click', () => {
  const selected = document.getElementById('pendingTypeSelect').value;
  if (!selected) return;
  const preview = document.getElementById('pendingScreenshotPreview');
  const text = document.getElementById('pendingOcrText').textContent;
  if (!preview.src) return;
  setScreenshotPreview(selected, preview.src, text);
  document.getElementById('pendingScreenshotPanel').classList.add('hidden');
});

document.getElementById('recognizeFromScreenshots').addEventListener('click', () => {
  alert('当前版本暂未接入 OCR 自动填表，请人工核对后填写识别结果。');
});

document.getElementById('applyRecognizedData').addEventListener('click', applyRecognizedDataToDiagnosisForm);

form.addEventListener('submit', (e) => { e.preventDefault(); render(); });
document.getElementById('loadSample').addEventListener('click', () => fillForm(sampleData));
document.getElementById('copyResult').addEventListener('click', async () => { await navigator.clipboard.writeText(resultBox.textContent); alert('结果已复制'); });
document.getElementById('downloadMarkdown').addEventListener('click', () => {
  const blob = new Blob([resultBox.textContent], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '达人诊断报告.md'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('saveHistory').addEventListener('click', () => {
  const data = getFormData();
  const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  items.unshift({ ...data, savedAt: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
  refreshHistoryOptions();
  alert('已保存到本地历史');
});
document.getElementById('loadHistory').addEventListener('click', () => {
  const idx = historySelect.value;
  if (idx === '') return;
  const items = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  fillForm(items[Number(idx)] || {});
});
document.getElementById('clearHistory').addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY); refreshHistoryOptions();
});

refreshHistoryOptions();
