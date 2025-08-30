# Universal Voice Translation API Documentation

## 🌍 Overview

The Universal Voice Translation API enables real-time voice translation between any two people speaking different languages while preserving their original voice characteristics, emotions, and personality. This powerful API can be integrated into any application requiring cross-language communication.

### Core Features
- **Real-time voice translation** between 125+ languages
- **Voice preservation** - maintain original speaker's characteristics
- **Emotion detection and preservation** 
- **WebSocket streaming** for real-time communication
- **Session management** for multi-participant conversations
- **Webhook notifications** for real-time events
- **RESTful API** with comprehensive endpoints

### Use Cases
- **Call Centers**: Customer support across language barriers
- **Telemedicine**: Patient-doctor consultations in any language
- **Business Meetings**: International conference calls
- **Emergency Services**: Crisis communication
- **Education**: Language learning and tutoring
- **Social Applications**: Cross-cultural communication

---

## 🔐 Authentication

All API requests require authentication using an API key.

### API Key Format
```
vt_live_sk_[64-character-hex-string]  // Production
vt_test_sk_[64-character-hex-string]  // Testing
```

### Authentication Methods

#### 1. Header Authentication (Recommended)
```http
X-API-Key: vt_live_sk_your_api_key_here
```

#### 2. Query Parameter
```http
GET /api/sessions?apiKey=vt_live_sk_your_api_key_here
```

### Rate Limits
- **Standard**: 1000 requests/minute, 100 translations/minute
- **Premium**: 5000 requests/minute, 500 translations/minute
- **Enterprise**: Custom limits available

---

## 📋 Session Management

### Create Session
Create a new translation session between two participants.

```http
POST /api/sessions
```

**Request Body:**
```json
{
  "participants": [
    {
      "id": "user_123",
      "name": "John Doe",
      "language": "en",
      "voiceId": "j9VKhOt1XPLj283lSboj",
      "role": "caller"
    },
    {
      "id": "agent_456", 
      "name": "Maria Garcia",
      "language": "es",
      "voiceId": "spanish_voice_id",
      "role": "agent"
    }
  ],
  "metadata": {
    "applicationId": "call-center-v1",
    "sessionType": "customer_support",
    "department": "technical"
  },
  "options": {
    "enableEmotionDetection": true,
    "enableRecording": false,
    "autoTranscript": true,
    "webhookUrl": "https://your-app.com/webhooks"
  }
}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "status": "created",
  "participants": [
    {
      "id": "user_123",
      "name": "John Doe", 
      "language": "en",
      "role": "caller"
    },
    {
      "id": "agent_456",
      "name": "Maria Garcia",
      "language": "es", 
      "role": "agent"
    }
  ],
  "websocketUrl": "ws://localhost:3001/api/translate?sessionId=sess_abc123",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": "2024-01-15T11:30:00Z"
}
```

### Get Session
Retrieve session information and status.

```http
GET /api/sessions/{sessionId}
```

**Response:**
```json
{
  "sessionId": "sess_abc123",
  "status": "active",
  "participants": [
    {
      "id": "user_123",
      "name": "John Doe",
      "language": "en",
      "role": "caller",
      "connected": true,
      "lastActivity": "2024-01-15T10:35:00Z"
    }
  ],
  "metadata": {
    "createdAt": "2024-01-15T10:30:00Z",
    "duration": 300000,
    "totalMessages": 15,
    "totalTranslations": 12
  }
}
```

### List Sessions
Get all sessions for your API key.

```http
GET /api/sessions?status=active&limit=20&offset=0
```

### End Session
Terminate a session and cleanup resources.

```http
DELETE /api/sessions/{sessionId}
```

---

## 🎙️ Real-time Translation

Real-time translation uses WebSocket connections for low-latency audio streaming.

### WebSocket Connection
```javascript
const ws = new WebSocket(
  'ws://localhost:3001/api/translate?sessionId=sess_abc123&participantId=user_123&apiKey=your_api_key'
);
```

### Audio Streaming
Send audio data for real-time translation:

```javascript
// Send audio chunk
ws.send(JSON.stringify({
  type: 'audio',
  audioData: base64AudioData,
  format: 'webm',
  sampleRate: 16000
}));
```

### Text Translation
Send text for translation:

```javascript
ws.send(JSON.stringify({
  type: 'text',
  text: 'Hello, how can I help you?',
  sourceLanguage: 'en',
  targetLanguage: 'es'
}));
```

### Message Types

#### Incoming Messages

**Connection Confirmed:**
```json
{
  "type": "connected",
  "sessionId": "sess_abc123",
  "participantId": "user_123",
  "partner": {
    "id": "agent_456",
    "language": "es",
    "name": "Maria Garcia"
  }
}
```

**Transcription Result:**
```json
{
  "type": "transcription",
  "text": "Hello, how can I help you?",
  "language": "en",
  "confidence": 0.95,
  "isFinal": true,
  "timestamp": "2024-01-15T10:31:00Z"
}
```

**Translation Result:**
```json
{
  "type": "translation",
  "originalText": "Hello, how can I help you?",
  "translatedText": "Hola, ¿cómo puedo ayudarte?",
  "sourceLanguage": "en",
  "targetLanguage": "es",
  "confidence": 0.92,
  "timestamp": "2024-01-15T10:31:01Z"
}
```

**Synthesized Audio:**
```json
{
  "type": "audio",
  "audioData": "base64_encoded_mp3_data",
  "format": "mp3",
  "language": "es",
  "voiceId": "spanish_voice_id",
  "timestamp": "2024-01-15T10:31:02Z"
}
```

---

## 🎤 Voice Synthesis

### Synthesize Text
Generate speech from text with voice preservation.

```http
POST /api/synthesize
```

**Request Body:**
```json
{
  "text": "Hello, how are you today?",
  "language": "en",
  "voiceId": "j9VKhOt1XPLj283lSboj",
  "options": {
    "emotion": "happy",
    "speed": 1.0,
    "pitch": 1.0
  }
}
```

**Response:**
```json
{
  "audioData": "base64_encoded_audio",
  "format": "mp3",
  "duration": 2.3,
  "language": "en",
  "voiceId": "j9VKhOt1XPLj283lSboj"
}
```

### List Available Voices
Get all available voices for each language.

```http
GET /api/voices?language=en
```

**Response:**
```json
{
  "voices": [
    {
      "voiceId": "j9VKhOt1XPLj283lSboj",
      "name": "Professional Male",
      "language": "en",
      "gender": "male",
      "accent": "american",
      "description": "Clear, professional voice suitable for business"
    }
  ]
}
```

---

## 🔗 Webhooks

Webhooks provide real-time notifications about session events.

### Webhook Events

#### Participant Connected
```json
{
  "event": "participant.connected",
  "sessionId": "sess_abc123",
  "participantId": "user_123",
  "timestamp": "2024-01-15T10:31:00Z"
}
```

#### Translation Completed
```json
{
  "event": "translation.completed",
  "sessionId": "sess_abc123", 
  "participantId": "user_123",
  "translation": {
    "originalText": "Hello world",
    "translatedText": "Hola mundo",
    "sourceLanguage": "en",
    "targetLanguage": "es",
    "confidence": 0.95
  },
  "timestamp": "2024-01-15T10:31:05Z"
}
```

#### Session Ended
```json
{
  "event": "session.ended",
  "sessionId": "sess_abc123",
  "duration": 1800000,
  "reason": "normal_termination",
  "timestamp": "2024-01-15T11:00:00Z"
}
```

### Webhook Security
Webhooks include a signature for verification:

```http
X-Webhook-Signature: sha256=your_calculated_signature
X-Webhook-ID: webhook_unique_id
X-Webhook-Timestamp: 2024-01-15T10:31:00Z
```

**Signature Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## 🌍 Supported Languages

The API supports 125+ languages for speech recognition, 31+ for translation, and 29+ for voice synthesis.

### Popular Language Codes
- **English**: `en`, `en-US`, `en-GB`
- **Spanish**: `es`, `es-ES`, `es-MX`
- **French**: `fr`, `fr-FR`, `fr-CA`
- **German**: `de`, `de-DE`
- **Italian**: `it`, `it-IT`
- **Portuguese**: `pt`, `pt-BR`, `pt-PT`
- **Turkish**: `tr`, `tr-TR`
- **Chinese**: `zh`, `zh-CN`, `zh-TW`
- **Japanese**: `ja`, `ja-JP`
- **Korean**: `ko`, `ko-KR`
- **Arabic**: `ar`, `ar-SA`
- **Hindi**: `hi`, `hi-IN`
- **Russian**: `ru`, `ru-RU`

---

## 📊 Usage Examples

### Call Center Integration

```javascript
// Create session for customer call
const session = await fetch('/api/sessions', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    participants: [
      {
        id: 'customer_123',
        name: 'John Smith',
        language: 'en',
        voiceId: 'english_voice_id',
        role: 'customer'
      },
      {
        id: 'agent_456',
        name: 'Ana Rodriguez', 
        language: 'es',
        voiceId: 'spanish_voice_id',
        role: 'agent'
      }
    ],
    metadata: {
      applicationId: 'call-center-v1',
      ticketId: 'TICKET-789',
      department: 'customer_service'
    },
    options: {
      webhookUrl: 'https://your-call-center.com/webhooks'
    }
  })
});

// Connect via WebSocket
const ws = new WebSocket(
  `ws://localhost:3001/api/translate?sessionId=${session.sessionId}&participantId=customer_123&apiKey=your_api_key`
);

// Handle real-time translation
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'transcription':
      displayTranscription(message.text);
      break;
    case 'translation':
      displayTranslation(message.translatedText);
      break;
    case 'audio':
      playTranslatedAudio(message.audioData);
      break;
  }
};
```

### Medical Consultation

```javascript
// Setup telemedicine session
const medicalSession = await createSession({
  participants: [
    {
      id: 'patient_789',
      name: 'Ahmed Hassan',
      language: 'ar',
      voiceId: 'arabic_voice_id',
      role: 'patient'
    },
    {
      id: 'doctor_123',
      name: 'Dr. Jennifer Williams',
      language: 'en', 
      voiceId: 'english_doctor_voice',
      role: 'doctor'
    }
  ],
  metadata: {
    applicationId: 'telemedicine-v2',
    appointmentId: 'APPT-456',
    specialty: 'cardiology'
  },
  options: {
    enableEmotionDetection: true,
    enableRecording: true, // For medical records
    priority: 'high'
  }
});
```

### Emergency Services

```javascript
// Emergency 911 translation
const emergencySession = await createSession({
  participants: [
    {
      id: 'caller_emergency',
      name: 'Emergency Caller',
      language: 'zh',
      voiceId: 'chinese_voice_id',
      role: 'caller'
    },
    {
      id: 'dispatcher_123',
      name: 'Emergency Dispatcher',
      language: 'en',
      voiceId: 'dispatcher_voice_id', 
      role: 'dispatcher'
    }
  ],
  metadata: {
    applicationId: 'emergency-911',
    priority: 'critical',
    location: 'coordinates_or_address'
  },
  options: {
    maxDuration: 7200000, // 2 hours
    priority: 'critical',
    enableRecording: true
  }
});
```

---

## ⚡ Performance & Limits

### Latency Targets
- **Speech-to-Text**: <500ms
- **Translation**: <300ms  
- **Text-to-Speech**: <800ms
- **Total End-to-End**: <2 seconds

### File Size Limits
- **Audio chunks**: 4MB max
- **Session duration**: 2 hours default (configurable)
- **Concurrent sessions**: 100 per API key (Enterprise: unlimited)

### Rate Limits
- **API calls**: 1000/minute
- **Translation requests**: 100/minute
- **WebSocket connections**: 50 concurrent
- **Webhook retries**: 3 attempts with exponential backoff

---

## 🔧 Error Handling

### HTTP Status Codes
- **200**: Success
- **201**: Created (sessions)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid API key)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (session/resource not found)
- **429**: Rate Limit Exceeded
- **500**: Internal Server Error

### Error Response Format
```json
{
  "error": "Session not found",
  "code": "SESSION_NOT_FOUND",
  "details": "Session sess_abc123 does not exist or has expired",
  "timestamp": "2024-01-15T10:31:00Z",
  "requestId": "req_xyz789"
}
```

### Common Error Codes
- `MISSING_API_KEY`: API key not provided
- `INVALID_API_KEY`: API key is invalid or expired
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `SESSION_NOT_FOUND`: Session doesn't exist
- `INVALID_PARTICIPANTS`: Invalid participant configuration
- `TRANSLATION_FAILED`: Translation service error
- `SYNTHESIS_FAILED`: Voice synthesis error
- `WEBSOCKET_AUTH_FAILED`: WebSocket authentication failed

---

## 🛡️ Security & Privacy

### Data Security
- **TLS 1.3** encryption for all API calls
- **API key rotation** available
- **Request signing** for webhooks
- **Rate limiting** to prevent abuse

### Privacy
- **Audio data** processed in real-time, not stored
- **Transcriptions** temporary, cleared after session
- **Translations** not logged in production
- **GDPR/CCPA** compliant data handling

### Best Practices
1. **Rotate API keys** regularly
2. **Use HTTPS** for webhook endpoints
3. **Validate webhook signatures**
4. **Implement exponential backoff** for retries
5. **Monitor rate limits**
6. **Handle WebSocket reconnections**

---

## 📞 Support & Resources

### Getting Started
1. **Get API Key**: Contact sales@voicetranslation.com
2. **Read Documentation**: This guide
3. **Try Examples**: Use provided code samples
4. **Test Integration**: Start with sandbox environment

### Support Channels
- **Documentation**: https://docs.voicetranslation.com
- **Technical Support**: support@voicetranslation.com
- **Status Page**: https://status.voicetranslation.com
- **Community Forum**: https://community.voicetranslation.com

### SDKs & Libraries
- **JavaScript/Node.js**: `npm install voice-translation-sdk`
- **Python**: `pip install voice-translation`
- **PHP**: Composer package available
- **Java**: Maven/Gradle dependency
- **React**: `npm install react-voice-translation`

---

**API Version**: 1.0.0  
**Last Updated**: December 2024  
**Base URL**: `https://api.voicetranslation.com/v1`  
**Status**: Production Ready 🟢
