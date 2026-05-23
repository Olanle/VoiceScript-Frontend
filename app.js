let selectedFile        = null;
let rawTranscript       = '';
let formattedTranscript = '';
let processStart        = 0;

const audioFileInput = document.getElementById('audioFile');
const uploadZone     = document.getElementById('uploadZone');
const filePreview    = document.getElementById('filePreview');
const fileNameEl     = document.getElementById('fileName');
const fileSizeEl     = document.getElementById('fileSize');
const fileRemove     = document.getElementById('fileRemove');
const transcribeBtn  = document.getElementById('transcribeBtn');
const progressPanel  = document.getElementById('progressPanel');
const outputSection  = document.getElementById('output-section');
const formattedOut   = document.getElementById('formattedOutput');
const rawOut         = document.getElementById('rawOutput');
const copyBtn        = document.getElementById('copyBtn');
const downloadBtn    = document.getElementById('downloadBtn');
const resetBtn       = document.getElementById('resetBtn');
const errorToast     = document.getElementById('errorToast');
const toastMsg       = document.getElementById('toastMsg');

// ── Helpers ────────────────────────────────────────────────────
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function setFile(file) {
  if (!file) return;
  selectedFile = file;
  fileNameEl.textContent = file.name;
  fileSizeEl.textContent = formatBytes(file.size);
  filePreview.classList.add('show');
  transcribeBtn.disabled = false;
}

function clearFile() {
  selectedFile = null;
  audioFileInput.value = '';
  filePreview.classList.remove('show');
  transcribeBtn.disabled = true;
}

function showError(msg) {
  toastMsg.textContent = msg;
  errorToast.classList.add('show');
  setTimeout(() => errorToast.classList.remove('show'), 7000);
}

// ── Upload Zone ────────────────────────────────────────────────
uploadZone.addEventListener('click', () => audioFileInput.click());

uploadZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); audioFileInput.click(); }
});

audioFileInput.addEventListener('change', e => {
  if (e.target.files[0]) setFile(e.target.files[0]);
});

fileRemove.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

// ── Step UI ────────────────────────────────────────────────────
function setStepActive(n) {
  document.getElementById(`step${n}`).classList.add('active');
  document.getElementById(`step${n}-ind`).innerHTML = '<div class="spinner"></div>';
}
function setStepDone(n, icon = '✓') {
  const el = document.getElementById(`step${n}`);
  el.classList.remove('active');
  el.classList.add('done');
  document.getElementById(`step${n}-ind`).innerHTML = icon;
}
function setStepError(n) {
  const el = document.getElementById(`step${n}`);
  el.classList.remove('active');
  el.classList.add('error');
  document.getElementById(`step${n}-ind`).innerHTML = '✕';
}
function setStepDetail(n, text) {
  document.getElementById(`step${n}-detail`).textContent = text;
}

// ── Audio Compression ──────────────────────────────────────────
async function compressAudio(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const decoded = await audioContext.decodeAudioData(arrayBuffer);

      let monoData;
      if (decoded.numberOfChannels === 1) {
        monoData = decoded.getChannelData(0);
      } else {
        const ch0 = decoded.getChannelData(0);
        const ch1 = decoded.getChannelData(1);
        monoData = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) {
          monoData[i] = (ch0[i] + ch1[i]) / 2;
        }
      }
      audioContext.close();

      const playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const playbackBuffer = playbackCtx.createBuffer(1, monoData.length, 16000);
      playbackBuffer.copyToChannel(monoData, 0);

      const playbackSource = playbackCtx.createBufferSource();
      playbackSource.buffer = playbackBuffer;

      const streamDest = playbackCtx.createMediaStreamDestination();
      playbackSource.connect(streamDest);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(streamDest.stream, {
        mimeType,
        audioBitsPerSecond: 20000,
      });

      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        playbackCtx.close();
        resolve(blob);
      };
      recorder.onerror = e => reject(new Error('Compression error: ' + e.error));

      recorder.start();
      playbackSource.start();
      playbackSource.onended = () => setTimeout(() => recorder.stop(), 300);

    } catch (err) {
      reject(new Error('Audio compression failed: ' + err.message));
    }
  });
}

// ── Main Transcription Flow ────────────────────────────────────
transcribeBtn.addEventListener('click', async () => {
  if (!selectedFile) return showError('Please select an audio file first.');

  outputSection.classList.remove('show');
  progressPanel.classList.add('show');
  transcribeBtn.disabled = true;
  processStart = Date.now();

  for (let i = 1; i <= 4; i++) {
    document.getElementById(`step${i}`).classList.remove('active', 'done', 'error');
    document.getElementById(`step${i}-ind`).innerHTML = String(i);
  }

  const model      = document.querySelector('input[name="groqModel"]:checked').value;
  const LIMIT_BYTES = 24 * 1024 * 1024;

  try {
    // ── Step 1 — Prepare Audio ────────────────────────────────
    setStepActive(1);

    let audioBlob;
    if (selectedFile.size > LIMIT_BYTES) {
      setStepDetail(1, `File is ${formatBytes(selectedFile.size)} — compressing to 20kbps…`);
      audioBlob = await compressAudio(selectedFile);
      setStepDetail(1, `Compressed to ${formatBytes(audioBlob.size)} ✓`);
    } else {
      setStepDetail(1, `File is ${formatBytes(selectedFile.size)} — no compression needed ✓`);
      audioBlob = selectedFile;
    }
    setStepDone(1);

    // ── Step 2 — Transcribe via Render backend ────────────────
    setStepActive(2);
    setStepDetail(2, 'Sending audio to server for transcription…');

    const formData = new FormData();
    formData.append('audio', audioBlob, selectedFile.name.replace(/\.[^.]+$/, '') + '.webm');

    const transcribeRes = await fetch(`${CONFIG.API_BASE_URL}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.json().catch(() => ({}));
      throw new Error(`Transcription error (${transcribeRes.status}): ${err?.error || transcribeRes.statusText}`);
    }

    const transcribeData = await transcribeRes.json();
    rawTranscript = transcribeData.transcript?.trim();

    if (!rawTranscript) throw new Error('Server returned an empty transcript. Try a clearer audio file.');
    setStepDetail(2, `Done — ${rawTranscript.split(/\s+/).length} words transcribed`);
    setStepDone(2);

    // ── Step 3 — Format via Render backend ───────────────────
    setStepActive(3);
    setStepDetail(3, `Formatting transcript on server…`);

    const formatRes = await fetch(`${CONFIG.API_BASE_URL}/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: rawTranscript, model }),
    });

    if (!formatRes.ok) {
      const err = await formatRes.json().catch(() => ({}));
      throw new Error(`Formatting error (${formatRes.status}): ${err?.error || formatRes.statusText}`);
    }

    const formatData = await formatRes.json();
    formattedTranscript = formatData.formatted?.trim() || rawTranscript;

    setStepDetail(3, 'Formatting complete ✓');
    setStepDone(3);

    // ── Step 4 — Done ─────────────────────────────────────────
    setStepActive(4);
    const elapsed = ((Date.now() - processStart) / 1000).toFixed(1);
    setStepDetail(4, `Completed in ${elapsed}s — transcript ready below`);
    setStepDone(4, '✦');

    renderOutput(elapsed);

  } catch (err) {
    console.error(err);
    for (let i = 1; i <= 4; i++) {
      if (document.getElementById(`step${i}`).classList.contains('active')) {
        setStepError(i); break;
      }
    }
    showError(err.message || 'An unexpected error occurred.');
    transcribeBtn.disabled = false;
  }
});

// ── Render Output ──────────────────────────────────────────────
function renderOutput(elapsed) {
  formattedOut.textContent = formattedTranscript;
  rawOut.textContent = rawTranscript;

  const words   = formattedTranscript.split(/\s+/).filter(Boolean).length;
  const chars   = formattedTranscript.length;
  const readMin = Math.max(1, Math.round(words / 200));

  document.getElementById('stat-words').textContent = words.toLocaleString();
  document.getElementById('stat-chars').textContent = chars.toLocaleString();
  document.getElementById('stat-time').textContent  = readMin + ' min';
  document.getElementById('stat-proc').textContent  = elapsed + 's';

  outputSection.classList.add('show');
  outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  transcribeBtn.disabled = false;
  transcribeBtn.textContent = '✦ Transcribe Again';
}

// ── Tabs ───────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Copy ───────────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
  const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
  const text = activeTab === 'formatted' ? formattedTranscript : rawTranscript;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '✓ Copied!';
    copyBtn.classList.add('success-flash');
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; copyBtn.classList.remove('success-flash'); }, 2000);
  });
});

// ── Download ───────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  const blob = new Blob([formattedTranscript || rawTranscript], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = (selectedFile?.name?.replace(/\.[^.]+$/, '') || 'transcript') + '_voicescript.txt';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Reset ──────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  outputSection.classList.remove('show');
  progressPanel.classList.remove('show');
  clearFile();
  rawTranscript = '';
  formattedTranscript = '';
  for (let i = 1; i <= 4; i++) {
    document.getElementById(`step${i}`).classList.remove('active', 'done', 'error');
    document.getElementById(`step${i}-ind`).innerHTML = String(i);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  transcribeBtn.textContent = '✦ Transcribe Audio';
});
