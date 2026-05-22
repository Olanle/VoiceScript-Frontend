# VoiceScript — Frontend

AI-powered audio transcription web app. Upload an audio file and get a clean, formatted transcript in seconds.

## Live Demo
https://olanle.github.io/VoiceScript-Frontend

## How It Works
1. Upload an audio file (MP3, WAV, FLAC, M4A, OGG, WEBM)
2. Files over 24MB are automatically compressed before sending
3. Audio is sent to the VoiceScript backend for transcription via Groq Whisper
4. Raw transcript is formatted by a Groq LLM into clean, readable text
5. Copy or download your transcript

## Tech Stack
- Vanilla HTML, CSS, JavaScript
- Hosted on GitHub Pages

## Configuration
In `config.js`, set your backend URL:
```js
const CONFIG = {
  API_BASE_URL: 'https://voicescript-api.onrender.com'
};
```

## Related
- Backend repo: https://github.com/olanle/voicescript-backend
