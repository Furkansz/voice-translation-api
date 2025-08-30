const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

class VoiceCloneService {
  constructor(config) {
    this.config = config;
    this.apiKey = config.ELEVENLABS_API_KEY;
    this.baseUrl = config.ELEVENLABS_URL;
  }

  async cloneVoice(audioFilePath, voiceName) {
    try {
      console.log(`🎤 Starting voice clone for: ${voiceName}`);
      console.log(`📁 Audio file path: ${audioFilePath}`);
      
      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`Audio file not found: ${audioFilePath}`);
      }
      
      // Check file size
      const stats = fs.statSync(audioFilePath);
      console.log(`📊 File size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Audio file too large (max 10MB)');
      }
      
      // First, create a new voice using the uploaded audio
      const voiceId = await this.addVoice(audioFilePath, voiceName);
      
      if (!voiceId) {
        throw new Error('Failed to create voice - no voice ID returned');
      }
      
      console.log(`✅ Voice cloned successfully with ID: ${voiceId}`);
      return voiceId;
      
    } catch (error) {
      console.error('❌ Voice cloning error:', error);
      throw error;
    }
  }

  async addVoice(audioFilePath, voiceName) {
    try {
      console.log(`🌐 Making API call to ElevenLabs for voice: ${voiceName}`);
      console.log(`🔑 API Key exists: ${!!this.apiKey}`);
      console.log(`🌍 Base URL: ${this.baseUrl}`);
      
      const formData = new FormData();
      
      // Add the audio file
      const audioStream = fs.createReadStream(audioFilePath);
      formData.append('files', audioStream);
      
      // Add voice metadata
      formData.append('name', voiceName);
      formData.append('description', `Cloned voice for ${voiceName} - Hospital Translation System`);
      
      // Optional: Add labels for better organization
      formData.append('labels', JSON.stringify({
        'use_case': 'hospital_translation',
        'created_at': new Date().toISOString()
      }));

      console.log(`📤 Sending request to: ${this.baseUrl}/voices/add`);
      
      const response = await fetch(`${this.baseUrl}/voices/add`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          ...formData.getHeaders()
        },
        body: formData,
        timeout: 30000 // 30 second timeout
      });

      console.log(`📥 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ElevenLabs API error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        // Provide more specific error messages
        if (response.status === 401) {
          throw new Error('Invalid ElevenLabs API key - please check your configuration');
        } else if (response.status === 400) {
          throw new Error(`Invalid request to ElevenLabs: ${errorText}`);
        } else if (response.status === 429) {
          throw new Error('ElevenLabs API rate limit exceeded - please try again later');
        } else {
          throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
        }
      }

      const result = await response.json();
      console.log(`📋 ElevenLabs response:`, result);
      
      if (!result.voice_id) {
        console.error('❌ No voice_id in response:', result);
        throw new Error('No voice_id returned from ElevenLabs');
      }

      console.log(`🎉 Voice created successfully with ID: ${result.voice_id}`);
      return result.voice_id;

    } catch (error) {
      console.error('❌ Add voice error:', error);
      
      // Check if it's a network error
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to ElevenLabs API - please check your internet connection');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('ElevenLabs API endpoint not found - please check your configuration');
      }
      
      throw error;
    }
  }

  async getVoices() {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const result = await response.json();
      return result.voices || [];

    } catch (error) {
      console.error('Get voices error:', error);
      throw error;
    }
  }

  async deleteVoice(voiceId) {
    try {
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete voice: ${response.status}`);
      }

      return true;

    } catch (error) {
      console.error('Delete voice error:', error);
      throw error;
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
      // Return default settings if API call fails
      return {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      };
    }
  }

  async optimizeVoiceSettings(voiceId, audioSample = null) {
    try {
      // Get current settings
      const currentSettings = await this.getVoiceSettings(voiceId);
      
      // Optimize settings for real-time medical translation
      const optimizedSettings = {
        stability: 0.8, // Higher stability for medical accuracy
        similarity_boost: 0.85, // High similarity to original voice
        style: 0.1, // Low style variation for consistency
        use_speaker_boost: true // Enable speaker boost for clarity
      };

      // Update voice settings
      const response = await fetch(`${this.baseUrl}/voices/${voiceId}/settings/edit`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(optimizedSettings)
      });

      if (!response.ok) {
        console.warn('Failed to update voice settings, using defaults');
        return currentSettings;
      }

      console.log(`Voice settings optimized for voice ID: ${voiceId}`);
      return optimizedSettings;

    } catch (error) {
      console.error('Optimize voice settings error:', error);
      // Return default settings if optimization fails
      return {
        stability: 0.75,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      };
    }
  }

  // Validate that a voice ID exists and is accessible
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

module.exports = VoiceCloneService;
