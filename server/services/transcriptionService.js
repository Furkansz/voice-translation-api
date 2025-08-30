const fetch = require('node-fetch');
const WebSocket = require('ws');

class TranscriptionService {
  constructor(config) {
    this.config = config;
    this.deepgramApiKey = config.DEEPGRAM_API_KEY;
    this.assemblyAiApiKey = config.ASSEMBLYAI_API_KEY;
    this.currentProvider = 'deepgram'; // Primary provider
    this.deepgramWs = null;
    this.assemblyWs = null;
  }

  async transcribe(audioData, language = 'en') {
    try {
      // Try primary provider first
      if (this.currentProvider === 'deepgram') {
        try {
          return await this.transcribeWithDeepgram(audioData, language);
        } catch (error) {
          console.warn('Deepgram failed, falling back to AssemblyAI:', error.message);
          this.currentProvider = 'assemblyai';
          return await this.transcribeWithAssemblyAI(audioData, language);
        }
      } else {
        try {
          return await this.transcribeWithAssemblyAI(audioData, language);
        } catch (error) {
          console.warn('AssemblyAI failed, falling back to Deepgram:', error.message);
          this.currentProvider = 'deepgram';
          return await this.transcribeWithDeepgram(audioData, language);
        }
      }
    } catch (error) {
      console.error('All transcription providers failed:', error);
      throw new Error('Transcription service unavailable');
    }
  }

  async transcribeWithDeepgram(audioData, language) {
    try {
      // Map language codes for Deepgram
      const deepgramLang = this.mapLanguageForDeepgram(language);
      
      // Convert WebRTC audio to proper format for Deepgram
      const audioBuffer = this.convertAudioForDeepgram(audioData);
      
      if (!audioBuffer || audioBuffer.length < 1000) {
        throw new Error('Audio too short for transcription');
      }

      // Use optimized REST API for instant phone call transcription
      const queryParams = new URLSearchParams({
        model: 'nova-2', // Latest model for best accuracy
        language: deepgramLang,
        smart_format: 'true',
        punctuate: 'true',
        diarize: 'false',
        interim_results: 'false',
        utterances: 'true', // Better utterance detection
        utt_split: '0.8', // Fast utterance splitting
        vad_events: 'true', // Voice activity detection
        tier: 'enhanced' // Enhanced quality for medical accuracy
      });
      
      console.log(`🔤 Transcribing with Deepgram in language: ${deepgramLang} (from: ${language})`);
      
      const response = await fetch(`https://api.deepgram.com/v1/listen?${queryParams}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.deepgramApiKey}`,
          'Content-Type': 'audio/webm'
        },
        body: audioBuffer,
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.results && result.results.channels && result.results.channels[0]) {
        const channel = result.results.channels[0];
        if (channel.alternatives && channel.alternatives[0]) {
          const alternative = channel.alternatives[0];
          return {
            text: alternative.transcript || '',
            confidence: alternative.confidence || 0,
            provider: 'deepgram'
          };
        }
      }

      return {
        text: '',
        confidence: 0,
        provider: 'deepgram'
      };

    } catch (error) {
      console.error('Deepgram transcription error:', error);
      throw error;
    }
  }

  async transcribeWithAssemblyAI(audioData, language) {
    try {
      // AssemblyAI requires uploading audio first, then requesting transcription
      const audioUrl = await this.uploadAudioToAssemblyAI(audioData);
      
      // Create transcription job
      const transcriptResponse = await fetch(`${this.config.ASSEMBLYAI_URL}/transcript`, {
        method: 'POST',
        headers: {
          'authorization': this.assemblyAiApiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          language_code: this.mapLanguageForAssemblyAI(language),
          punctuate: true,
          format_text: true,
          dual_channel: false,
          speech_model: 'best'
        })
      });

      if (!transcriptResponse.ok) {
        throw new Error(`AssemblyAI transcript request failed: ${transcriptResponse.status}`);
      }

      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;

      // Poll for completion
      return await this.pollAssemblyAITranscription(transcriptId);

    } catch (error) {
      console.error('AssemblyAI transcription error:', error);
      throw error;
    }
  }

  convertAudioForDeepgram(audioData) {
    try {
      if (Buffer.isBuffer(audioData)) {
        return audioData;
      } else if (typeof audioData === 'string') {
        return Buffer.from(audioData, 'base64');
      } else {
        return Buffer.from(audioData);
      }
    } catch (error) {
      console.error('Audio conversion error:', error);
      return null;
    }
  }

  async uploadAudioToAssemblyAI(audioData) {
    try {
      // Convert audio to proper format for AssemblyAI
      const buffer = this.convertAudioForAssemblyAI(audioData);
      
      if (!buffer || buffer.length < 1000) {
        throw new Error('Audio too short for AssemblyAI');
      }

      const response = await fetch(`${this.config.ASSEMBLYAI_URL}/upload`, {
        method: 'POST',
        headers: {
          'authorization': this.assemblyAiApiKey,
          'content-type': 'audio/wav'
        },
        body: buffer
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AssemblyAI upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.upload_url;

    } catch (error) {
      console.error('AssemblyAI upload error:', error);
      throw error;
    }
  }

  convertAudioForAssemblyAI(audioData) {
    try {
      if (Buffer.isBuffer(audioData)) {
        return audioData;
      } else if (typeof audioData === 'string') {
        return Buffer.from(audioData, 'base64');
      } else {
        return Buffer.from(audioData);
      }
    } catch (error) {
      console.error('Audio conversion error:', error);
      return null;
    }
  }

  async pollAssemblyAITranscription(transcriptId) {
    const maxAttempts = 30; // 30 seconds max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.config.ASSEMBLYAI_URL}/transcript/${transcriptId}`, {
          headers: {
            'authorization': this.assemblyAiApiKey
          }
        });

        if (!response.ok) {
          throw new Error(`AssemblyAI status check failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'completed') {
          return {
            text: data.text || '',
            confidence: data.confidence || 0,
            provider: 'assemblyai'
          };
        } else if (data.status === 'error') {
          throw new Error(`AssemblyAI transcription failed: ${data.error}`);
        }

        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

      } catch (error) {
        console.error('AssemblyAI polling error:', error);
        throw error;
      }
    }

    throw new Error('AssemblyAI transcription timeout');
  }

  mapLanguageForDeepgram(language) {
    const languageMap = {
      'en': 'en-US',
      'tr': 'tr',
      'auto': 'en-US' // Default fallback
    };
    return languageMap[language] || 'en-US';
  }

  mapLanguageForAssemblyAI(language) {
    const languageMap = {
      'en': 'en',
      'tr': 'tr',
      'auto': 'en' // Default fallback
    };
    return languageMap[language] || 'en';
  }

  // Initialize streaming transcription for real-time processing
  async initializeStreaming(language, onTranscript, onError) {
    try {
      if (this.currentProvider === 'deepgram') {
        return await this.initializeDeepgramStreaming(language, onTranscript, onError);
      } else {
        // AssemblyAI doesn't support real-time streaming in the same way
        // We'll use chunked processing instead
        return await this.initializeChunkedTranscription(language, onTranscript, onError);
      }
    } catch (error) {
      console.error('Failed to initialize streaming:', error);
      if (onError) onError(error);
    }
  }

  async initializeDeepgramStreaming(language, onTranscript, onError) {
    try {
      const deepgramLang = this.mapLanguageForDeepgram(language);
      const wsUrl = `wss://api.deepgram.com/v1/listen?language=${deepgramLang}&model=nova-2&smart_format=true&interim_results=true&endpointing=150`;
      
      this.deepgramWs = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Token ${this.deepgramApiKey}`
        }
      });

      this.deepgramWs.on('open', () => {
        console.log('Deepgram streaming initialized');
      });

      this.deepgramWs.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.channel && response.channel.alternatives && response.channel.alternatives.length > 0) {
            const alternative = response.channel.alternatives[0];
            
            if (alternative.transcript && onTranscript) {
              onTranscript({
                text: alternative.transcript,
                confidence: alternative.confidence || 0,
                isFinal: response.is_final,
                provider: 'deepgram'
              });
            }
          }
        } catch (parseError) {
          console.error('Deepgram streaming parse error:', parseError);
          if (onError) onError(parseError);
        }
      });

      this.deepgramWs.on('error', (error) => {
        console.error('Deepgram streaming error:', error);
        if (onError) onError(error);
      });

      return {
        sendAudio: (audioData) => {
          if (this.deepgramWs && this.deepgramWs.readyState === WebSocket.OPEN) {
            this.deepgramWs.send(audioData);
          }
        },
        close: () => {
          if (this.deepgramWs) {
            this.deepgramWs.close();
            this.deepgramWs = null;
          }
        }
      };

    } catch (error) {
      console.error('Deepgram streaming initialization error:', error);
      throw error;
    }
  }

  async initializeChunkedTranscription(language, onTranscript, onError) {
    // For providers that don't support real-time streaming,
    // we'll process chunks as they come in
    return {
      sendAudio: async (audioData) => {
        try {
          const result = await this.transcribe(audioData, language);
          if (onTranscript && result.text) {
            onTranscript({
              text: result.text,
              confidence: result.confidence,
              isFinal: true,
              provider: result.provider
            });
          }
        } catch (error) {
          if (onError) onError(error);
        }
      },
      close: () => {
        // Nothing to close for chunked processing
      }
    };
  }

  close() {
    if (this.deepgramWs) {
      this.deepgramWs.close();
      this.deepgramWs = null;
    }
    if (this.assemblyWs) {
      this.assemblyWs.close();
      this.assemblyWs = null;
    }
  }
}

module.exports = TranscriptionService;
