const videoInput = document.getElementById('videoInput');
const stylePreset = document.getElementById('stylePreset');
const targetDurationInput = document.getElementById('targetDuration');
const maxClipDurationInput = document.getElementById('maxClipDuration');
const transitionDurationInput = document.getElementById('transitionDuration');
const analyzeBtn = document.getElementById('analyzeBtn');
const renderBtn = document.getElementById('renderBtn');
const downloadPlanBtn = document.getElementById('downloadPlanBtn');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const assetList = document.getElementById('assetList');
const timeline = document.getElementById('timeline');
const previewVideo = document.getElementById('previewVideo');
const progressBox = document.getElementById('progressBox');

let assets = [];
let latestPlan = null;
let finalVideoBlob = null;
let ffmpeg = null;

const styleRules = {
  daily: { pace: 1, minClip: 3, maxClip: 6, mood: '自然叙事' },
  travel: { pace: 1.35, minClip: 2, maxClip: 4, mood: '节奏明快' },
  food: { pace: 1.15, minClip: 2.5, maxClip: 5, mood: '细节+氛围' }
};

function seconds(n) { return `${n.toFixed(1)}s`; }
function setProgress(status, text) {
  progressBox.dataset.status = status;
  progressBox.textContent = text;
}

async function readVideoMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve({ name: file.name, file, sizeMB: (file.size / 1024 / 1024).toFixed(1), duration });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ name: file.name, file, sizeMB: (file.size / 1024 / 1024).toFixed(1), duration: 0 });
    };
    video.src = url;
  });
}

function renderAssets() {
  if (!assets.length) {
    assetList.textContent = '暂无素材';
    return;
  }
  assetList.innerHTML = assets.map((a, i) => `#${i + 1} ${a.name} · ${seconds(a.duration)} · ${a.sizeMB}MB`).join('\n');
}

function buildRoughCutPlan() {
  const style = styleRules[stylePreset.value];
  const target = Number(targetDurationInput.value || 60);
  const userMaxClip = Number(maxClipDurationInput.value || 5);
  const transition = Number(transitionDurationInput.value || 0.3);

  const clipMax = Math.min(userMaxClip, style.maxClip);
  const clipMin = style.minClip;
  const clips = [];

  let total = 0;
  for (const asset of assets) {
    if (total >= target) break;
    if (!asset.duration || asset.duration <= 1) continue;

    const thisClip = Math.max(clipMin, Math.min(clipMax, (clipMin + clipMax) / 2 / style.pace));
    const start = Math.max(0, (asset.duration - thisClip) / 2);
    const end = Math.min(asset.duration, start + thisClip);

    clips.push({
      source: asset.name,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      transition
    });

    total += end - start;
  }

  return {
    createdAt: new Date().toISOString(),
    preset: stylePreset.value,
    mood: style.mood,
    targetDurationSec: target,
    actualDurationSec: Number(total.toFixed(2)),
    transitionDurationSec: transition,
    clips
  };
}

function planToText(plan) {
  if (!plan || !plan.clips.length) return '素材不足，至少上传1个可读取时长的视频。';
  const lines = [];
  lines.push(`Vlog风格：${plan.preset}（${plan.mood}）`);
  lines.push(`目标时长：${plan.targetDurationSec}s，预计成片：${plan.actualDurationSec}s`);
  lines.push('');
  lines.push('粗剪时间线：');
  plan.clips.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.source} | ${seconds(c.start)} - ${seconds(c.end)} | 片段时长 ${seconds(c.duration)} | 转场 ${seconds(c.transition)}`);
  });
  lines.push('');
  lines.push('建议：按上述顺序导入剪映 / PR / CapCut，套用统一 LUT 与背景音乐后即可导出。');
  return lines.join('\n');
}

async function ensureFFmpeg() {
  if (ffmpeg) return ffmpeg;
  const { FFmpeg } = window.FFmpegWASM;
  ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
  });
  return ffmpeg;
}

async function generateVideo(plan) {
  if (!plan || !plan.clips.length) throw new Error('请先生成有效剪辑计划');
  const current = await ensureFFmpeg();
  const { fetchFile } = window.FFmpegUtil;

  setProgress('reading', '正在读取视频...');
  for (const asset of assets) {
    await current.writeFile(asset.name, await fetchFile(asset.file));
  }

  const clipFiles = [];
  setProgress('cutting', '正在裁剪...');
  for (let i = 0; i < plan.clips.length; i += 1) {
    const clip = plan.clips[i];
    const clipFile = `clip_${String(i).padStart(3, '0')}.mp4`;
    clipFiles.push(clipFile);
    await current.exec([
      '-ss', String(clip.start),
      '-to', String(clip.end),
      '-i', clip.source,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'veryfast',
      '-movflags', '+faststart',
      clipFile
    ]);
  }

  setProgress('merging', '正在合并...');
  const concatText = clipFiles.map((f) => `file '${f}'`).join('\n');
  await current.writeFile('concat.txt', new TextEncoder().encode(concatText));
  await current.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4']);

  const out = await current.readFile('output.mp4');
  const blob = new Blob([out.buffer], { type: 'video/mp4' });
  finalVideoBlob = blob;
  previewVideo.src = URL.createObjectURL(blob);
  downloadVideoBtn.disabled = false;
  setProgress('done', '生成完成');
}

videoInput.addEventListener('change', async () => {
  setProgress('reading', '正在读取视频...');
  const files = Array.from(videoInput.files || []);
  assets = [];
  for (const file of files) {
    const meta = await readVideoMeta(file);
    assets.push(meta);
  }
  renderAssets();
  latestPlan = null;
  finalVideoBlob = null;
  previewVideo.removeAttribute('src');
  downloadVideoBtn.disabled = true;
  setProgress('idle', `已加载 ${assets.length} 个素材`);
  timeline.textContent = `已加载 ${assets.length} 个素材，请点击“分析素材并自动粗剪”。`;
});

analyzeBtn.addEventListener('click', () => {
  latestPlan = buildRoughCutPlan();
  timeline.textContent = planToText(latestPlan);
});

renderBtn.addEventListener('click', async () => {
  try {
    if (!latestPlan) latestPlan = buildRoughCutPlan();
    timeline.textContent = planToText(latestPlan);
    await generateVideo(latestPlan);
  } catch (error) {
    console.error(error);
    setProgress('error', `处理失败：${error.message || '未知错误'}`);
    alert('生成失败，请检查素材编码是否兼容或稍后重试。');
  }
});

downloadVideoBtn.addEventListener('click', () => {
  if (!finalVideoBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(finalVideoBlob);
  a.download = 'vlog-final.mp4';
  a.click();
  URL.revokeObjectURL(a.href);
});

downloadPlanBtn.addEventListener('click', () => {
  if (!latestPlan) {
    alert('请先生成剪辑计划');
    return;
  }
  const blob = new Blob([JSON.stringify(latestPlan, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vlog-rough-cut-plan.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

copyPromptBtn.addEventListener('click', async () => {
  if (!latestPlan) {
    alert('请先生成剪辑计划');
    return;
  }
  const prompt = `请按以下粗剪计划自动剪成 Vlog，并保持节奏统一：\n\n${planToText(latestPlan)}`;
  await navigator.clipboard.writeText(prompt);
  alert('已复制，可粘贴给剪辑软件或AI工具。');
});
