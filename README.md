# Hospital Voice Translator

A real-time voice translation system designed for hospital settings, enabling seamless communication between international patients and native doctors across language barriers.

## Features

- **Real-time Voice Translation**: Turkish ↔ English with <1 second latency
- **Voice Cloning**: Preserves speaker's natural voice characteristics and emotions
- **Professional Medical Focus**: Optimized for medical terminology and accuracy
- **Automatic Matching**: Doctor-patient pairing with no manual intervention
- **WebRTC Audio**: High-quality real-time audio capture and playback
- **Live Transcription**: See conversations in real-time with confidence indicators
- **Modern UI**: Professional, accessible interface designed for hospital environments

## Technology Stack

### Backend
- **Node.js/Express**: Server framework
- **Socket.IO**: Real-time WebSocket communication
- **ElevenLabs API**: Voice cloning and speech synthesis
- **Deepgram/AssemblyAI**: Speech-to-text with fallback
- **DeepL**: High-accuracy medical translation

### Frontend
- **React 18**: Modern UI framework
- **Styled Components**: Component-based styling
- **WebRTC**: Native browser audio capture
- **Socket.IO Client**: Real-time communication

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser with microphone access
- Stable internet connection

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd hospital-voice-translator
   npm run install-all
   ```

2. **Start Development**
   ```bash
   npm run dev
   ```

3. **Access Application**
   - Open `http://localhost:3000` in your browser
   - Allow microphone permissions when prompted

### Production Deployment

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm start
   ```

## Usage Workflow

### 1. Voice Setup
- Select your role (Doctor or Patient)
- Choose your language (English or Turkish)
- Upload a clear voice sample (30-60 seconds recommended)
- Wait for voice cloning to complete (~30-60 seconds)

### 2. Automatic Matching
- System automatically matches doctors with patients
- Pairing based on different languages for translation
- Both parties go online when voice cloning is complete

### 3. Real-time Translation
- Start speaking - system automatically detects voice
- See live transcription of your speech
- Hear translated audio in partner's cloned voice
- View conversation history with confidence indicators

### 4. Session Management
- Latency monitoring with quality indicators
- Automatic session handling and reconnection
- Clean session termination

## API Configuration

The system uses the following APIs (configured in `server/config.js`):

- **Deepgram**: `ac7348411e473e250a47cad34103b64b78b1cf63`
- **AssemblyAI**: `1e185c65aebb42578011d117dbcc05dc`
- **ElevenLabs**: `sk_82bd7211c3e282771b2535b9d8442f7fc0cc1fe9eae9821f`
- **DeepL**: `efefaee3-fbc9-4f0f-a045-21338791cf15:fx`

## Architecture

### Real-time Pipeline
1. **Audio Capture** → WebRTC microphone input
2. **Speech-to-Text** → Deepgram/AssemblyAI transcription
3. **Translation** → DeepL medical-accurate translation
4. **Voice Synthesis** → ElevenLabs cloned voice generation
5. **Audio Playback** → Partner receives translated audio

### Session Flow
```
Doctor (EN) ↔ WebSocket Server ↔ Patient (TR)
     ↓              ↓              ↓
Voice Clone    API Services    Voice Clone
     ↓              ↓              ↓
  Speaking  → Translation → Hearing
```

## Performance Optimizations

- **Streaming APIs**: Real-time processing wherever possible
- **Chunked Audio**: 500ms audio segments for low latency
- **Fallback Systems**: Multiple STT providers for reliability
- **Voice Caching**: Cloned voices reused throughout session
- **Efficient Synthesis**: ElevenLabs Flash models for speed

## Supported Features

### Languages
- English (US/UK variants)
- Turkish
- Extensible architecture for additional languages

### Audio Formats
- Input: WebRTC audio streams
- Processing: 16kHz mono audio
- Output: MP3 synthesis from ElevenLabs

### Medical Accuracy
- Preserves numbers, dosages, and medical terms
- Medical terminology protection in translations
- Confidence indicators for transcription quality

## Browser Requirements

- Chrome/Edge 88+ (recommended)
- Firefox 85+
- Safari 14+
- Microphone permissions required
- WebRTC support (all modern browsers)

## Development

### Project Structure
```
hospital-voice-translator/
├── server/                 # Backend Node.js application
│   ├── services/          # API integration services
│   ├── config.js          # Configuration and API keys
│   └── index.js           # Main server file
├── client/                # React frontend application
│   ├── src/components/    # React components
│   ├── src/App.js         # Main app component
│   └── public/            # Static assets
├── package.json           # Server dependencies
└── README.md              # This file
```

### Available Scripts

- `npm run dev` - Start development (both server and client)
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run install-all` - Install all dependencies

### Environment Variables

Set these in production:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Troubleshooting

### Common Issues

1. **Microphone Not Working**
   - Check browser permissions
   - Ensure HTTPS in production
   - Try refreshing the page

2. **Voice Cloning Fails**
   - Check audio file format (MP3, WAV, M4A)
   - Ensure file size < 10MB
   - Use clear, noise-free recordings

3. **High Latency**
   - Check internet connection
   - Monitor API status (Deepgram, ElevenLabs)
   - Consider geographic proximity to servers

4. **Translation Errors**
   - Speak clearly and slowly
   - Check DeepL API quota
   - Verify language selection

### Debug Mode

Enable detailed logging by setting browser console to verbose mode.

## Security Considerations

- API keys are server-side only
- Audio data processed in real-time (not stored)
- HTTPS required for production WebRTC
- Session data automatically cleaned up

## Future Enhancements

- Additional language pairs
- Emotion detection and transfer
- Medical domain-specific models
- Session recording capabilities
- Advanced noise cancellation
- Multi-party conversations

## Support

For technical issues or questions about the Hospital Voice Translator system, please refer to the documentation or contact the development team.

## License

This project is designed for hospital and medical use cases. Please ensure compliance with relevant healthcare data regulations in your jurisdiction.
