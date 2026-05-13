const form = document.getElementById('diagnosisForm');
const resultBox = document.getElementById('resultBox');
const historySelect = document.getElementById('historySelect');
const HISTORY_KEY = 'influencer_diagnosis_history_v1';

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


const screenshotInputs = Array.from(document.querySelectorAll('.screenshot-panel input[type="file"]'));
const previewTypeMap = {
  profileScreenshotPreview: 'profile',
  recentPostsScreenshotPreview: 'recentPosts',
  priceScreenshotPreview: 'price',
  audienceScreenshotPreview: 'audience'
};
const typeToPreviewId = Object.fromEntries(Object.entries(previewTypeMap).map(([k, v]) => [v, k]));
const pendingScreenshots = document.getElementById('pendingScreenshots');
const ocrStatus = document.getElementById('ocrStatus');
const screenshotStore = [];
const recognizedFormFieldMap = {
  recognizedProfileUrl: 'profileUrl',
  recognizedNickname: 'nickname',
  recognizedFollowers: 'followers',
  recognizedAvgLikes: 'avgLikes',
  recognizedAvgSaves: 'avgSaves',
  recognizedAvgComments: 'avgComments',
  recognizedMedianViews: 'medianViews',
  recognizedPrice: 'price',
  recognizedAudienceProfile: 'audienceProfile'
};
const ocrStatusMap = {
  idle: '等待截图',
  processing: '已收到截图，正在识别中...',
  success: '识别完成，请核对结果',
  error: '识别失败，请手动填写',
  unknown: '无法判断截图类型，请手动选择'
};

function setOcrStatus(status) {
  if (!ocrStatus) return;
  ocrStatus.dataset.status = status;
  ocrStatus.textContent = ocrStatusMap[status] || ocrStatusMap.idle;
}

function parseChineseNumber(raw) {
  if (!raw) return null;
  const text = String(raw).replace(/[,\s]/g, '');
  const matched = text.match(/(\d+(?:\.\d+)?)(万|w|W|千|k|K)?/);
  if (!matched) return null;
  let value = Number(matched[1]);
  if (!Number.isFinite(value)) return null;
  const unit = matched[2];
  if (unit === '万' || unit === 'w' || unit === 'W') value *= 10000;
  if (unit === '千' || unit === 'k' || unit === 'K') value *= 1000;
  return Math.round(value);
}

function extractMetric(text, labels, limits = { min: 0, max: Number.MAX_SAFE_INTEGER }) {
  const rows = String(text || '').split(/\n|[|]/).map((row) => row.trim()).filter(Boolean);
  for (const row of rows) {
    if (!labels.some((label) => row.includes(label))) continue;
    const allNumbers = Array.from(row.matchAll(/(\d+(?:\.\d+)?(?:万|w|W|千|k|K)?)/g)).map((m) => parseChineseNumber(m[1]));
    const candidate = allNumbers.find((value) => value !== null && value >= limits.min && value <= limits.max);
    if (candidate !== undefined) return candidate;
  }
  return null;
}

function fillRecognizedField(name, value) {
  if (value === null || value === undefined || Number.isNaN(value)) return;
  const input = document.querySelector(`[name="${name}"]`);
  if (input) input.value = String(value);
}

function fillRecognizedFieldsFromText(allText) {
  fillRecognizedField('recognizedFollowers', extractMetric(allText, ['粉丝'], { min: 100, max: 50000000 }));
  fillRecognizedField('recognizedAvgLikes', extractMetric(allText, ['平均点赞', '点赞均值', '点赞'], { min: 1, max: 2000000 }));
  fillRecognizedField('recognizedAvgSaves', extractMetric(allText, ['平均收藏', '收藏均值', '收藏'], { min: 1, max: 2000000 }));
  fillRecognizedField('recognizedAvgComments', extractMetric(allText, ['平均评论', '评论均值', '评论'], { min: 1, max: 500000 }));
  fillRecognizedField('recognizedMedianViews', extractMetric(allText, ['阅读中位数', '中位阅读', '平均阅读', '阅读'], { min: 1, max: 100000000 }));
  fillRecognizedField('recognizedPrice', extractMetric(allText, ['报价', '刊例价', '合作价格', '价格', '¥', '元'], { min: 100, max: 5000000 }));
}

function handleScreenshotPreview(input) {
  const previewId = input.dataset.preview;
  const preview = previewId ? document.getElementById(previewId) : null;
  if (!preview) return;

  const file = input.files && input.files[0];
  if (!file) {
    preview.removeAttribute('src');
    preview.classList.remove('is-visible');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = String(reader.result || '');
    preview.classList.add('is-visible');
  };
  reader.readAsDataURL(file);
}

function setOcrText(type, text) {
  const el = document.querySelector(`[data-ocr-text="${type}"]`);
  if (el) el.textContent = text || '（未识别到文字）';
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('OCR 引擎加载失败'));
    document.head.appendChild(s);
  });
  return window.Tesseract;
}

function classifyByKeywords(text) {
  const t = (text || '').toLowerCase();
  const rules = [
    ['profile', ['主页', '昵称', '粉丝', '获赞', '笔记']],
    ['recentPosts', ['近10', '点赞', '评论', '收藏', '阅读']],
    ['price', ['报价', '刊例', '合作', '预算', '元']],
    ['audience', ['粉丝画像', '年龄', '性别', '地域', '占比']]
  ];
  let best = ['', 0];
  rules.forEach(([type, keys]) => {
    const score = keys.reduce((s, k) => s + (t.includes(k) ? 1 : 0), 0);
    if (score > best[1]) best = [type, score];
  });
  return best[1] >= 2 ? best[0] : '';
}

function placeScreenshot(type, dataUrl, ocrText) {
  const preview = document.getElementById(typeToPreviewId[type]);
  if (!preview) return;
  preview.src = dataUrl;
  preview.classList.add('is-visible');
  setOcrText(type, ocrText);
}

function addPendingScreenshot(dataUrl, ocrText) {
  const row = document.createElement('div');
  row.className = 'pending-item';
  row.innerHTML = `<img src="${dataUrl}" alt="待确认截图"/><details class="ocr-details"><summary>识别到的文字</summary><pre class="ocr-text">${ocrText || '（未识别到文字）'}</pre></details>
  <select><option value="">请选择截图类型</option><option value="profile">达人主页截图</option><option value="recentPosts">近10篇数据截图</option><option value="price">报价截图</option><option value="audience">粉丝画像截图</option></select>`;
  row.querySelector('select').addEventListener('change', (e) => {
    const type = e.target.value;
    if (!type) return;
    placeScreenshot(type, dataUrl, ocrText);
    setOcrStatus('success');
    row.remove();
  });
  pendingScreenshots.prepend(row);
}

async function processImageFile(file) {
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
  const shot = { file, dataUrl, source: 'clipboard-or-upload', ocrText: '', type: '' };
  screenshotStore.push(shot);
  setOcrStatus('processing');
  let ocrText = '';
  try {
    const Tesseract = await ensureTesseract();
    const result = await Tesseract.recognize(file, 'chi_sim+eng');
    ocrText = result.data.text || '';
    shot.ocrText = ocrText;
  } catch (e) {
    console.warn(e);
    setOcrStatus('error');
    alert('识别失败，请手动填写识别结果。');
  }
  const type = classifyByKeywords(ocrText);
  shot.type = type;
  if (type) {
    placeScreenshot(type, dataUrl, ocrText);
    setOcrStatus('success');
  } else {
    addPendingScreenshot(dataUrl, ocrText);
    if (ocrText.trim()) setOcrStatus('unknown');
  }
}

function applyRecognizedDataToDiagnosisForm() {
  Object.entries(recognizedFormFieldMap).forEach(([recognizedName, diagnosisName]) => {
    const recognizedField = document.querySelector(`[name="${recognizedName}"]`);
    if (!recognizedField) return;

    const value = (recognizedField.value || '').trim();
    if (!value) return;

    if (form[diagnosisName]) {
      form[diagnosisName].value = value;
    }
  });
  alert('已将识别结果确认区内容填入诊断表单。');
}

screenshotInputs.forEach((input) => {
  input.addEventListener('change', async () => {
    handleScreenshotPreview(input);
    const file = input.files && input.files[0];
    if (file) await processImageFile(file);
  });
});

document.getElementById('recognizeFromScreenshots').addEventListener('click', async () => {
  if (!screenshotStore.length) {
    setOcrStatus('idle');
    alert('请先上传或粘贴截图。');
    return;
  }
  setOcrStatus('processing');
  const texts = [];
  let hasError = false;
  for (const item of screenshotStore) {
    try {
      let ocrText = item.ocrText || '';
      if (!ocrText) {
        const Tesseract = await ensureTesseract();
        const result = await Tesseract.recognize(item.file, 'chi_sim+eng');
        ocrText = result.data.text || '';
        item.ocrText = ocrText;
      }
      texts.push(ocrText);
      const inferredType = item.type || classifyByKeywords(ocrText);
      item.type = inferredType;
      if (inferredType) placeScreenshot(inferredType, item.dataUrl, ocrText);
      else if (ocrText.trim()) setOcrStatus('unknown');
    } catch (error) {
      console.warn(error);
      hasError = true;
    }
  }
  fillRecognizedFieldsFromText(texts.join('\n'));
  if (hasError) {
    setOcrStatus('error');
    alert('识别失败，请手动填写识别结果。');
  } else {
    setOcrStatus('success');
  }
});

document.getElementById('applyRecognizedData').addEventListener('click', applyRecognizedDataToDiagnosisForm);

document.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items || [];
  const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
  if (!imageItem) return;
  const file = imageItem.getAsFile();
  if (!file) return;
  e.preventDefault();
  await processImageFile(file);
});
