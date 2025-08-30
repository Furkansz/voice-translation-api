/**
 * Voice Translation SDK
 * Easy-to-use library for integrating with the Voice Translation API
 */

const axios = require('axios');
const WebSocket = require('ws');

class VoiceTranslationSDK {
  constructor(apiKey, baseURL = 'https://your-voice-api.herokuapp.com') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create a translation session
   */
  async createSession(participants, options = {}) {
    try {
      const response = await this.axios.post('/api/sessions', {
        participants,
        metadata: options.metadata || {},
        options: options.sessionOptions || {}
      });
      
      return new TranslationSession(response.data, this);
    } catch (error) {
      throw new Error(`Failed to create session: ${error.response?.data?.error}`);
    }
  }

  /**
   * Get available voices for a language
   */
  async getVoices(language) {
    const response = await this.axios.get('/api/voices', {
      params: { language }
    });
    return response.data.voices;
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await this.axios.get('/health');
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

class TranslationSession {
  constructor(sessionData, sdk) {
    this.sessionId = sessionData.sessionId;
    this.participants = sessionData.participants;
    this.websocketUrl = sessionData.websocketUrl;
    this.sdk = sdk;
    this.connections = new Map();
  }

  /**
   * Connect a participant to real-time translation
   */
  connectParticipant(participantId, callbacks = {}) {
    const wsUrl = `${this.websocketUrl}&participantId=${participantId}&apiKey=${this.sdk.apiKey}`;
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log(`🔌 ${participantId} connected to translation`);
      callbacks.onConnect?.();
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data);
      
      switch(message.type) {
        case 'transcription':
          callbacks.onTranscription?.(message);
          break;
        case 'translation':
          callbacks.onTranslation?.(message);
          break;
        case 'audio':
          callbacks.onAudio?.(message);
          break;
        case 'error':
          callbacks.onError?.(message);
          break;
      }
    });

    ws.on('close', () => {
      console.log(`🔌 ${participantId} disconnected`);
      callbacks.onDisconnect?.();
    });

    this.connections.set(participantId, ws);
    return ws;
  }

  /**
   * Send audio data for translation
   */
  sendAudio(participantId, audioData, format = 'webm') {
    const ws = this.connections.get(participantId);
    if (ws) {
      ws.send(JSON.stringify({
        type: 'audio',
        audioData,
        format
      }));
    }
  }

  /**
   * End the session
   */
  async end() {
    // Close all WebSocket connections
    for (const ws of this.connections.values()) {
      ws.close();
    }
    
    // End session via API
    await this.sdk.axios.delete(`/api/sessions/${this.sessionId}`);
  }
}

module.exports = VoiceTranslationSDK;

// Usage Example:
/*
const VoiceTranslation = require('voice-translation-sdk');

const translator = new VoiceTranslation('vt_live_sk_your_key_here');

// Create session
const session = await translator.createSession([
  { id: 'customer', language: 'es', voiceId: 'spanish_voice', role: 'customer' },
  { id: 'agent', language: 'en', voiceId: 'english_voice', role: 'agent' }
]);

// Connect participants
session.connectParticipant('customer', {
  onTranslation: (msg) => console.log('Translation:', msg.translatedText),
  onAudio: (msg) => playAudio(msg.audioData)
});
*/
