# VoiceScript — Frontend

AI-powered audio transcription web app. Upload an audio file and get a clean, formatted transcript in seconds powered by Groq Whisper and your choice of formatting model.

## Live Demo
https://olanle.github.io/VoiceScript-Frontend

## How It Works
1. Upload an audio file (MP3, WAV, FLAC, M4A, OGG, WEBM)
2. Files over 24MB are automatically compressed to 20kbps before sending
3. Audio is sent to the VoiceScript backend for transcription via Groq Whisper large-v3-turbo
4. Raw transcript is formatted by your selected model into clean, readable text
5. Copy or download your finished transcript

## Formatting Models Available
| Model | Provider | Quality | Speed |
|---|---|---|---|
| Gemini 2.5 Flash | Google | Very Good | Very Fast |
| Gemini 2.5 Pro | Google | Excellent | Slower |
| Llama 3.3 70B | Groq | Very Good | Very Fast |
| Llama 3.1 8B | Groq | Good | Fastest |

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
