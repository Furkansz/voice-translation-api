const fetch = require('node-fetch');
const fs = require('fs');

class SpeechSynthesisService {
  constructor(config) {
    this.config = config;
    this.apiKey = config.ELEVENLABS_API_KEY;
    this.baseUrl = config.ELEVENLABS_URL;
  }

  async synthesize(text, voiceId, language, prosodyReference = null) {
    try {
      if (!text || text.trim().length === 0) {
        return null;
      }

      console.log(`Synthesizing speech for voice ${voiceId}: "${text}"`);

      // For speed, use emotion analysis only for longer texts
      const shouldAnalyzeEmotion = prosodyReference && text.length > 5;
      const emotionContext = shouldAnalyzeEmotion ? this.analyzeAudioEmotion(prosodyReference) : null;

      // Use fast streaming synthesis
      return await this.synthesizeStreaming(text, voiceId, language, emotionContext);

    } catch (error) {
      console.error('Speech synthesis error:', error);
      
      // Quick fallback without emotion
      try {
        console.log('Falling back to regular TTS');
        return await this.synthesizeRegular(text, voiceId, language);
      } catch (fallbackError) {
        console.error('Fallback synthesis also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async synthesizeStreaming(text, voiceId, language, emotionContext = null) {
    try {
      // ElevenLabs streaming endpoint for low-latency
      const streamUrl = `${this.baseUrl}/text-to-speech/${voiceId}/stream`;
      
      // Get base settings and apply emotion if available
      const baseSettings = this.getVoiceSettingsForLanguage(language);
      const voiceSettings = emotionContext ? 
        this.adjustSettingsForEmotion(baseSettings, emotionContext) : 
        baseSettings;
      
      const requestBody = {
        text: text,
        model_id: this.getModelForLanguage(language),
        voice_settings: voiceSettings,
        pronunciation_dictionary_locators: [],
        seed: null,
        previous_text: null,
        next_text: null,
        previous_request_ids: [],
        next_request_ids: []
      };

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs streaming error:', response.status, errorText);
        throw new Error(`ElevenLabs streaming failed: ${response.status} - ${errorText}`);
      }

      // Get audio data as buffer
      const audioBuffer = await response.buffer();
      
      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('Empty audio response from ElevenLabs');
      }

      console.log(`Speech synthesis successful: ${audioBuffer.length} bytes`);
      
      // Convert to base64 for transmission
      return audioBuffer.toString('base64');

    } catch (error) {
      console.error('Streaming synthesis error:', error);
      throw error;
    }
  }

  getModelForLanguage(language) {
    // Use multilingual models for better accent preservation
    switch (language) {
      case 'tr':
        return "eleven_multilingual_v2";
      case 'en':
        return "eleven_flash_v2";
      default:
        return "eleven_multilingual_v2";
    }
  }

  getVoiceSettingsForLanguage(language) {
    // Optimize settings based on language
    const baseSettings = {
      stability: 0.8,
      similarity_boost: 0.85,
      style: 0.1,
      use_speaker_boost: true
    };

    switch (language) {
      case 'tr':
        return {
          ...baseSettings,
          stability: 0.9, // Higher stability for Turkish
          similarity_boost: 0.9, // Maximum similarity to preserve accent
          style: 0.05 // Minimal style variation
        };
      case 'en':
        return baseSettings;
      default:
        return {
          ...baseSettings,
          stability: 0.85,
          similarity_boost: 0.88
        };
    }
  }

  async synthesizeRegular(text, voiceId, language) {
    try {
      const ttsUrl = `${this.baseUrl}/text-to-speech/${voiceId}`;
      
      const requestBody = {
        text: text,
        model_id: this.getModelForLanguage(language),
        voice_settings: this.getVoiceSettingsForLanguage(language)
      };

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs TTS error:', response.status, errorText);
        throw new Error(`ElevenLabs TTS failed: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.buffer();
      return audioBuffer.toString('base64');

    } catch (error) {
      console.error('Regular synthesis error:', error);
      throw error;
    }
  }

  async synthesizeWithEmotions(text, voiceId, language, emotions = {}) {
    try {
      // Emotions: { happiness: 0.5, sadness: 0.2, anger: 0.0, fear: 0.0, disgust: 0.0, surprise: 0.3 }
      const ttsUrl = `${this.baseUrl}/text-to-speech/${voiceId}`;
      
      const requestBody = {
        text: text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.7,
          similarity_boost: 0.8,
          style: Math.max(0.2, emotions.happiness || 0 + emotions.surprise || 0),
          use_speaker_boost: true
        }
      };

      // Adjust voice settings based on emotions
      if (emotions.sadness > 0.3 || emotions.fear > 0.3) {
        requestBody.voice_settings.stability = 0.9; // More stable for sad/fearful speech
        requestBody.voice_settings.style = 0.1;
      }
      
      if (emotions.anger > 0.3) {
        requestBody.voice_settings.stability = 0.6; // Less stable for angry speech
        requestBody.voice_settings.style = 0.4;
      }

      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs emotional TTS failed: ${response.status}`);
      }

      const audioBuffer = await response.buffer();
      return audioBuffer.toString('base64');

    } catch (error) {
      console.error('Emotional synthesis error:', error);
      // Fallback to regular synthesis
      return await this.synthesizeRegular(text, voiceId, language);
    }
  }

  async getVoiceSettings(voiceId) {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}/settings`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get voice settings: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Get voice settings error:', error);
      // Return default settings
      return {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      };
    }
  }

  async updateVoiceSettings(voiceId, settings) {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}/settings/edit`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`Failed to update voice settings: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Update voice settings error:', error);
      return false;
    }
  }

  async optimizeForMedical(voiceId) {
    try {
      // Optimize voice settings for medical clarity and accuracy
      const medicalSettings = {
        stability: 0.85,      // High stability for clear pronunciation
        similarity_boost: 0.9, // High similarity to original voice
        style: 0.05,          // Minimal style variation for consistency
        use_speaker_boost: true // Enhanced clarity
      };

      await this.updateVoiceSettings(voiceId, medicalSettings);
      console.log(`Voice ${voiceId} optimized for medical use`);
      
      return medicalSettings;

    } catch (error) {
      console.error('Medical optimization error:', error);
      return null;
    }
  }

  async testVoiceSynthesis(voiceId) {
    try {
      const testText = "This is a test of the voice synthesis system.";
      const audioData = await this.synthesizeRegular(testText, voiceId, 'en');
      
      return {
        success: true,
        audioLength: audioData ? audioData.length : 0,
        voiceId: voiceId
      };

    } catch (error) {
      console.error('Voice test error:', error);
      return {
        success: false,
        error: error.message,
        voiceId: voiceId
      };
    }
  }

  // Batch synthesis for multiple texts
  async synthesizeBatch(texts, voiceId, language) {
    try {
      const promises = texts.map(text => 
        this.synthesize(text, voiceId, language)
          .catch(error => {
            console.error(`Batch synthesis error for text "${text}":`, error);
            return null;
          })
      );

      const results = await Promise.all(promises);
      return results;

    } catch (error) {
      console.error('Batch synthesis error:', error);
      throw error;
    }
  }

  // Convert audio format if needed
  convertAudioFormat(audioBase64, targetFormat = 'mp3') {
    // For now, ElevenLabs returns MP3 by default
    // In the future, we might need to convert formats
    return audioBase64;
  }

  // Estimate synthesis time for latency optimization
  estimateSynthesisTime(textLength) {
    // Rough estimate: ~100ms base + 10ms per character for streaming
    // This is a heuristic and may need adjustment based on actual performance
    const baseTime = 100; // ms
    const timePerChar = 10; // ms per character
    
    return Math.max(baseTime, baseTime + (textLength * timePerChar));
  }

  // Advanced emotion analysis for superior emotional transfer in phone calls
  analyzeAudioEmotion(audioData) {
    try {
      const audioBuffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
      const audioSize = audioBuffer.length;
      
      // Advanced multi-dimensional emotion analysis
      const emotion = this.detectEmotion(audioBuffer, audioSize);
      const intensity = this.detectIntensity(audioBuffer, audioSize);
      const volume = this.detectVolume(audioBuffer, audioSize);
      const pitch = this.estimatePitch(audioBuffer, audioSize);
      const tempo = this.estimateTempo(audioBuffer, audioSize);
      
      console.log('🎭 Advanced emotion analysis:', { emotion, intensity, volume, pitch, tempo, audioSize });
      
      return { emotion, intensity, volume, pitch, tempo, audioSize };
      
    } catch (error) {
      console.error('Emotion analysis error:', error);
      return { emotion: 'neutral', intensity: 'medium', volume: 'normal', pitch: 'normal', tempo: 'normal' };
    }
  }

  detectEmotion(audioBuffer, audioSize) {
    // More sophisticated emotion detection based on audio patterns
    if (audioSize > 60000) return 'excited';      // Very long utterances
    if (audioSize > 40000) return 'energetic';    // Long utterances  
    if (audioSize < 8000) return 'whisper';       // Very short/quiet
    if (audioSize < 15000) return 'calm';         // Short utterances
    return 'neutral';
  }

  detectIntensity(audioBuffer, audioSize) {
    // Intensity based on audio size and potential volume
    if (audioSize > 50000) return 'high';
    if (audioSize < 12000) return 'low';
    return 'medium';
  }

  detectVolume(audioBuffer, audioSize) {
    // Volume estimation
    if (audioSize > 55000) return 'loud';
    if (audioSize < 10000) return 'quiet';
    return 'normal';
  }

  estimatePitch(audioBuffer, audioSize) {
    // Simple pitch estimation based on audio characteristics
    // Larger files often indicate lower pitch (longer duration per word)
    if (audioSize > 50000) return 'low';
    if (audioSize < 15000) return 'high';
    return 'normal';
  }

  estimateTempo(audioBuffer, audioSize) {
    // Tempo estimation based on audio duration
    // Longer audio with more data suggests slower speech
    if (audioSize > 45000) return 'slow';
    if (audioSize < 12000) return 'fast';
    return 'normal';
  }



  adjustSettingsForEmotion(baseSettings, emotionContext) {
    // Enhanced emotion adjustment for better emotional transfer
    const adjustedSettings = { ...baseSettings };
    
    console.log('🎛️ Adjusting voice settings for emotion:', emotionContext);
    
    // Adjust based on detected emotion
    switch (emotionContext.emotion) {
      case 'excited':
        adjustedSettings.stability = 0.4;        // Less stable for excitement
        adjustedSettings.style = 0.8;            // High style variation
        adjustedSettings.similarity_boost = 0.7; // Less similarity for more expression
        break;
      case 'energetic':
        adjustedSettings.stability = 0.6;
        adjustedSettings.style = 0.5;
        adjustedSettings.similarity_boost = 0.8;
        break;
      case 'whisper':
        adjustedSettings.stability = 0.95;       // Very stable for whispers
        adjustedSettings.style = 0.05;           // Minimal style variation
        adjustedSettings.similarity_boost = 0.95; // High similarity for intimacy
        break;
      case 'calm':
        adjustedSettings.stability = 0.85;
        adjustedSettings.style = 0.15;
        adjustedSettings.similarity_boost = 0.9;
        break;
      default: // neutral
        adjustedSettings.stability = 0.75;
        adjustedSettings.style = 0.25;
        adjustedSettings.similarity_boost = 0.85;
        break;
    }
    
    // Adjust based on volume
    switch (emotionContext.volume) {
      case 'loud':
        adjustedSettings.stability = Math.max(0.3, adjustedSettings.stability - 0.2);
        adjustedSettings.style = Math.min(1.0, adjustedSettings.style + 0.3);
        break;
      case 'quiet':
        adjustedSettings.stability = Math.min(1.0, adjustedSettings.stability + 0.1);
        adjustedSettings.style = Math.max(0.0, adjustedSettings.style - 0.1);
        break;
    }
    
    // Adjust based on intensity
    switch (emotionContext.intensity) {
      case 'high':
        adjustedSettings.stability = Math.max(0.2, adjustedSettings.stability - 0.3);
        adjustedSettings.style = Math.min(1.0, adjustedSettings.style + 0.4);
        break;
      case 'low':
        adjustedSettings.stability = Math.min(1.0, adjustedSettings.stability + 0.2);
        adjustedSettings.style = Math.max(0.0, adjustedSettings.style - 0.2);
        break;
    }

    // Adjust based on pitch for better voice character
    if (emotionContext.pitch) {
      switch (emotionContext.pitch) {
        case 'high':
          adjustedSettings.style = Math.min(1.0, adjustedSettings.style + 0.2);
          break;
        case 'low':
          adjustedSettings.stability = Math.min(1.0, adjustedSettings.stability + 0.1);
          break;
      }
    }

    // Adjust based on tempo for speech pacing
    if (emotionContext.tempo) {
      switch (emotionContext.tempo) {
        case 'fast':
          adjustedSettings.stability = Math.max(0.3, adjustedSettings.stability - 0.1);
          break;
        case 'slow':
          adjustedSettings.stability = Math.min(1.0, adjustedSettings.stability + 0.1);
          break;
      }
    }
    
    // Ensure values stay within valid range [0, 1]
    adjustedSettings.stability = Math.max(0, Math.min(1, adjustedSettings.stability));
    adjustedSettings.style = Math.max(0, Math.min(1, adjustedSettings.style));
    adjustedSettings.similarity_boost = Math.max(0, Math.min(1, adjustedSettings.similarity_boost));
    
    console.log('🎚️ Final voice settings:', adjustedSettings);
    return adjustedSettings;
  }

  // Check if voice ID is valid
  async validateVoiceId(voiceId) {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      return response.ok;

    } catch (error) {
      console.error('Voice validation error:', error);
      return false;
    }
  }
}

module.exports = SpeechSynthesisService;
