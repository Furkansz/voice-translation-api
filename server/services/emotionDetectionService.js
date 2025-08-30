const axios = require('axios');

class EmotionDetectionService {
  constructor(config) {
    this.config = config;
    this.emotionCache = new Map();
    this.voiceAnalysisCache = new Map();
  }

  /**
   * Analyze audio for emotional content and voice characteristics
   */
  async analyzeEmotionalContent(audioData, text, language, userId) {
    try {
      // Validate inputs first
      if (!audioData || !text || text.trim().length < 3) {
        console.log(`⚠️ Insufficient data for emotion analysis (${userId}): audio=${!!audioData}, text="${text.substring(0, 20)}..."`);
        return this.getDefaultEmotionalProfile();
      }

      // Run analyses with error resilience
      const [
        audioEmotions,
        textSentiment,
        voiceCharacteristics
      ] = await Promise.allSettled([
        this.detectAudioEmotions(audioData, language),
        this.analyzeSentiment(text, language),
        this.analyzeVoiceCharacteristics(audioData, userId)
      ]);

      // Extract successful results, use defaults for failed ones
      const audioData_safe = audioEmotions.status === 'fulfilled' ? audioEmotions.value : this.getDefaultAudioEmotions();
      const textData_safe = textSentiment.status === 'fulfilled' ? textSentiment.value : { sentiment: 0, intensity: 0.5, emotionBoosts: {} };
      const voiceData_safe = voiceCharacteristics.status === 'fulfilled' ? voiceCharacteristics.value : { baselinePitch: 150, baselineEnergy: 50 };

      // Synthesize emotion analysis
      const emotionalProfile = this.synthesizeEmotionalProfile({
        audioEmotions: audioData_safe,
        textSentiment: textData_safe,
        voiceCharacteristics: voiceData_safe,
        text,
        language
      });

      console.log(`🎭 Emotion analysis for ${userId}:`, {
        primary: emotionalProfile.primaryEmotion,
        intensity: emotionalProfile.intensity,
        tone: emotionalProfile.tonality,
        confidence: emotionalProfile.confidence
      });

      return emotionalProfile;

    } catch (error) {
      console.error(`❌ Emotion detection error for ${userId}:`, error);
      return this.getDefaultEmotionalProfile();
    }
  }

  /**
   * Detect emotions from audio characteristics
   */
  async detectAudioEmotions(audioData, language) {
    try {
      // Audio signal analysis for emotion detection
      const audioFeatures = this.extractAudioFeatures(audioData);
      
      return {
        pitch: audioFeatures.averagePitch || 150,
        energy: audioFeatures.energy || 50,
        tempo: audioFeatures.speechRate || 120,
        intensity: audioFeatures.volume || 50,
        tremor: audioFeatures.voiceTremor || 2,
        clarity: audioFeatures.articulation || 70,
        
        // Derived emotional indicators
        excitement: this.calculateExcitementFromAudio(audioFeatures),
        stress: this.calculateStressFromAudio(audioFeatures),
        confidence: this.calculateConfidenceFromAudio(audioFeatures),
        sadness: this.calculateSadnessFromAudio(audioFeatures),
        anger: this.calculateAngerFromAudio(audioFeatures),
        sarcasm: this.detectSarcasmFromAudio(audioFeatures)
      };
    } catch (error) {
      console.warn(`⚠️ Audio emotion detection failed:`, error.message);
      return this.getDefaultAudioEmotions();
    }
  }

  /**
   * Analyze text sentiment and emotional markers
   */
  async analyzeSentiment(text, language) {
    try {
      // Emotional keyword detection
      const emotionalKeywords = this.detectEmotionalKeywords(text, language);
      const sentimentData = this.calculateSentimentScore(text, language);
      const punctuationEmotions = this.analyzePunctuation(text);
      
      return {
        sentiment: sentimentData.sentiment || 0, // -1 to 1 (negative to positive)
        emotionalKeywords,
        punctuationEmotions,
        intensity: Math.abs(sentimentData.sentiment || 0),
        emotionBoosts: sentimentData.emotionBoosts || {},
        
        // Specific emotion detection
        sarcasm: this.detectTextualSarcasm(text, language),
        excitement: emotionalKeywords.excitement || punctuationEmotions.exclamation || (sentimentData.emotionBoosts?.excited > 0),
        question: text.includes('?'),
        emphasis: punctuationEmotions.capitals || emotionalKeywords.emphasis
      };
    } catch (error) {
      console.warn(`⚠️ Text sentiment analysis failed:`, error.message);
      return { sentiment: 0, intensity: 0.5, emotionBoosts: {} };
    }
  }

  /**
   * Analyze individual voice characteristics for personality
   */
  async analyzeVoiceCharacteristics(audioData, userId) {
    const cacheKey = `${userId}-voice-profile`;
    let profile = this.voiceAnalysisCache.get(cacheKey);

    if (!profile) {
      profile = {
        baselinePitch: 0,
        baselineEnergy: 0,
        speechPattern: 'neutral',
        personality: 'balanced',
        culturalContext: 'universal'
      };
      this.voiceAnalysisCache.set(cacheKey, profile);
    }

    // Update with current audio sample
    const currentFeatures = this.extractAudioFeatures(audioData);
    this.updateVoiceProfile(profile, currentFeatures);

    return profile;
  }

  /**
   * Synthesize comprehensive emotional profile
   */
  synthesizeEmotionalProfile(data) {
    const { audioEmotions, textSentiment, voiceCharacteristics, text } = data;

    // Primary emotion detection with confidence scoring
    const emotions = {
      happy: this.calculateHappiness(audioEmotions, textSentiment),
      sad: this.calculateSadness(audioEmotions, textSentiment),
      angry: this.calculateAnger(audioEmotions, textSentiment),
      surprised: this.calculateSurprise(audioEmotions, textSentiment),
      sarcastic: this.calculateSarcasm(audioEmotions, textSentiment),
      excited: this.calculateExcitement(audioEmotions, textSentiment),
      calm: this.calculateCalmness(audioEmotions, textSentiment),
      urgent: this.calculateUrgency(audioEmotions, textSentiment),
      confident: this.calculateConfidence(audioEmotions, textSentiment),
      nervous: this.calculateNervousness(audioEmotions, textSentiment)
    };

    // Find primary emotion
    const primaryEmotion = Object.keys(emotions).reduce((a, b) => 
      emotions[a] > emotions[b] ? a : b
    );

    // Calculate overall intensity and confidence
    const intensity = Math.max(...Object.values(emotions));
    const confidence = this.calculateEmotionConfidence(emotions, audioEmotions, textSentiment);

    return {
      primaryEmotion,
      emotions,
      intensity: Math.min(intensity, 1.0),
      confidence: Math.min(confidence, 1.0),
      
      // Voice synthesis parameters
      tonality: this.mapEmotionToTonality(primaryEmotion, intensity),
      voiceSettings: this.generateEmotionalVoiceSettings(primaryEmotion, intensity, voiceCharacteristics),
      
      // Cultural adaptation
      culturalContext: this.determineCulturalContext(data.language),
      
      // Debug info
      debug: {
        audioFeatures: audioEmotions,
        textSentiment: textSentiment,
        rawText: text.substring(0, 50) + (text.length > 50 ? '...' : '')
      }
    };
  }

  /**
   * Generate ElevenLabs voice settings based on emotions
   */
  generateEmotionalVoiceSettings(emotion, intensity, voiceProfile) {
    const baseSettings = {
      stability: 0.75,
      similarity_boost: 0.8,
      style: 0.3,
      use_speaker_boost: true
    };

    // Emotion-specific adjustments
    const emotionMappings = {
      happy: {
        stability: 0.6,  // More variation
        similarity_boost: 0.9,
        style: 0.6,      // More expressive
        use_speaker_boost: true
      },
      sad: {
        stability: 0.9,  // Very stable, monotone
        similarity_boost: 0.7,
        style: 0.1,      // Less expressive
        use_speaker_boost: false
      },
      angry: {
        stability: 0.4,  // Very variable
        similarity_boost: 0.9,
        style: 0.8,      // Highly expressive
        use_speaker_boost: true
      },
      excited: {
        stability: 0.3,  // High variation
        similarity_boost: 0.95,
        style: 0.9,      // Maximum expression
        use_speaker_boost: true
      },
      sarcastic: {
        stability: 0.8,  // Controlled variation
        similarity_boost: 0.85,
        style: 0.7,      // Distinctive style
        use_speaker_boost: true
      },
      calm: {
        stability: 0.9,  // Very stable
        similarity_boost: 0.8,
        style: 0.2,      // Minimal expression
        use_speaker_boost: false
      },
      surprised: {
        stability: 0.5,  // Moderate variation
        similarity_boost: 0.9,
        style: 0.8,      // High expression
        use_speaker_boost: true
      },
      urgent: {
        stability: 0.6,  // Quick, varied
        similarity_boost: 0.95,
        style: 0.7,      // Expressive urgency
        use_speaker_boost: true
      }
    };

    const emotionSettings = emotionMappings[emotion] || baseSettings;
    
    // Apply intensity scaling
    const settings = {
      stability: this.scaleWithIntensity(emotionSettings.stability, baseSettings.stability, intensity),
      similarity_boost: emotionSettings.similarity_boost,
      style: this.scaleWithIntensity(emotionSettings.style, baseSettings.style, intensity),
      use_speaker_boost: emotionSettings.use_speaker_boost
    };

    return settings;
  }

  /**
   * Scale voice parameter based on emotion intensity
   */
  scaleWithIntensity(emotionValue, baseValue, intensity) {
    const safeIntensity = Math.max(0, Math.min(1, intensity || 0.5));
    const safeEmotionValue = emotionValue || baseValue;
    const safeBaseValue = baseValue || 0.5;
    
    return safeBaseValue + (safeEmotionValue - safeBaseValue) * safeIntensity;
  }

  /**
   * Extract audio features for emotion detection
   */
  extractAudioFeatures(audioData) {
    try {
      const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData, 'base64');
      
      // Simple but realistic audio feature extraction based on buffer characteristics
      const dataLength = buffer.length;
      const sampleRate = 16000; // Common sample rate
      const duration = dataLength / (sampleRate * 2); // Assuming 16-bit samples
      
      // Calculate basic audio characteristics from buffer data
      let sum = 0;
      let maxValue = 0;
      let zeroCrossings = 0;
      let energy = 0;
      
      for (let i = 0; i < Math.min(dataLength - 1, 1000); i += 2) {
        const sample = buffer.readInt16LE(i);
        const absSample = Math.abs(sample);
        
        sum += absSample;
        maxValue = Math.max(maxValue, absSample);
        energy += sample * sample;
        
        // Zero crossing detection for pitch estimation
        if (i > 0) {
          const prevSample = buffer.readInt16LE(i - 2);
          if ((sample >= 0) !== (prevSample >= 0)) {
            zeroCrossings++;
          }
        }
      }
      
      const numSamples = Math.min(dataLength / 2, 500);
      const averageAmplitude = sum / numSamples;
      const normalizedEnergy = Math.sqrt(energy / numSamples) / 32768;
      const pitchEstimate = (zeroCrossings / duration) * 2; // Rough pitch estimation
      
      return {
        averagePitch: Math.max(80, Math.min(400, pitchEstimate)), // Realistic human speech range
        energy: Math.max(0, Math.min(100, normalizedEnergy * 100)),
        speechRate: 120 + (normalizedEnergy * 50), // Energy affects perceived speech rate
        volume: Math.max(0, Math.min(100, (averageAmplitude / 32768) * 100)),
        voiceTremor: Math.max(0, Math.min(10, (zeroCrossings % 10))),
        articulation: Math.max(50, Math.min(100, 70 + (normalizedEnergy * 30)))
      };
    } catch (error) {
      console.warn(`⚠️ Audio feature extraction failed:`, error.message);
      return this.getDefaultAudioFeatures();
    }
  }

  /**
   * Get default audio features when extraction fails
   */
  getDefaultAudioFeatures() {
    return {
      averagePitch: 150,
      energy: 50,
      speechRate: 120,
      volume: 50,
      voiceTremor: 2,
      articulation: 70
    };
  }

  /**
   * Detect emotional keywords in text
   */
  detectEmotionalKeywords(text, language) {
    const emotionalWords = {
      en: {
        excitement: ['amazing', 'awesome', 'fantastic', 'incredible', 'wow'],
        anger: ['angry', 'furious', 'mad', 'hate', 'damn'],
        sadness: ['sad', 'terrible', 'awful', 'depressed', 'crying'],
        sarcasm: ['sure', 'right', 'obviously', 'clearly', 'definitely'],
        emphasis: ['really', 'very', 'extremely', 'absolutely', 'totally']
      },
      tr: {
        excitement: ['harika', 'muhteşem', 'süper', 'inanılmaz', 'vay'],
        anger: ['sinirli', 'öfkeli', 'kızgın', 'nefret', 'lanet'],
        sadness: ['üzgün', 'korkunç', 'berbat', 'depresif', 'ağlıyor'],
        sarcasm: ['tabii', 'elbette', 'açıkça', 'belli', 'kesinlikle'],
        emphasis: ['gerçekten', 'çok', 'son derece', 'kesinlikle', 'tamamen']
      }
    };

    const words = emotionalWords[language] || emotionalWords.en;
    const detectedEmotions = {};

    Object.keys(words).forEach(emotion => {
      detectedEmotions[emotion] = words[emotion].some(word => 
        text.toLowerCase().includes(word.toLowerCase())
      );
    });

    return detectedEmotions;
  }

  /**
   * Analyze punctuation for emotional cues
   */
  analyzePunctuation(text) {
    return {
      exclamation: (text.match(/!/g) || []).length > 0,
      question: text.includes('?'),
      capitals: /[A-Z]{2,}/.test(text),
      ellipsis: text.includes('...'),
      multiple: /[!?]{2,}/.test(text)
    };
  }

  /**
   * Calculate specific emotions
   */
  calculateHappiness(audio, text) {
    return Math.min(
      (audio.excitement || 0) * 0.3 +
      (text.emotionalKeywords?.excitement ? 0.2 : 0) +
      (text.punctuationEmotions?.exclamation ? 0.2 : 0) +
      (text.sentiment > 0.3 ? text.sentiment * 0.2 : 0) +
      (text.emotionBoosts?.happy || 0),
      1.0
    );
  }

  calculateSarcasm(audio, text) {
    return Math.min(
      (audio.sarcasm || 0) * 0.4 +
      (text.sarcasm || 0) * 0.3 +
      (text.emotionalKeywords?.sarcasm ? 0.3 : 0),
      1.0
    );
  }

  calculateAnger(audio, text) {
    return Math.min(
      (audio.anger || 0) * 0.3 +
      (text.emotionalKeywords?.anger ? 0.3 : 0) +
      (text.punctuationEmotions?.multiple ? 0.2 : 0) +
      (text.emotionBoosts?.angry || 0),
      1.0
    );
  }

  calculateSadness(audio, text) {
    return Math.min(
      (audio.sadness || 0) * 0.4 +
      (text.emotionalKeywords?.sadness ? 0.3 : 0) +
      (text.sentiment < -0.3 ? Math.abs(text.sentiment) * 0.3 : 0),
      1.0
    );
  }

  calculateSurprise(audio, text) {
    return Math.min(
      ((audio.pitch || 0) > 200 ? 0.3 : 0) +
      (text.punctuationEmotions?.question ? 0.2 : 0) +
      (text.punctuationEmotions?.exclamation ? 0.2 : 0) +
      ((audio.intensity || 0) > 70 ? 0.2 : 0) +
      (text.emotionBoosts?.surprised || 0),
      1.0
    );
  }

  calculateExcitement(audio, text) {
    return Math.min(
      (audio.excitement || 0) * 0.3 +
      ((audio.energy || 0) > 70 ? 0.2 : 0) +
      (text.emotionalKeywords?.excitement ? 0.2 : 0) +
      (text.emotionBoosts?.excited || 0),
      1.0
    );
  }

  calculateCalmness(audio, text) {
    const baseCalm = Math.min(
      ((audio.energy || 0) < 30 ? 0.5 : 0) +
      ((audio.pitch || 0) < 150 ? 0.2 : 0) +
      (Math.abs(text.sentiment || 0) < 0.2 ? 0.3 : 0),
      1.0
    );
    
    // Reduce calmness if there are strong emotions detected
    const emotionIntensity = Math.max(
      text.emotionBoosts?.excited || 0,
      text.emotionBoosts?.angry || 0,
      text.emotionBoosts?.surprised || 0
    );
    
    return Math.max(0, baseCalm - emotionIntensity);
  }

  calculateUrgency(audio, text) {
    return Math.min(
      ((audio.tempo || 0) > 150 ? 0.4 : 0) +
      ((audio.intensity || 0) > 80 ? 0.3 : 0) +
      (text.emotionalKeywords?.emphasis ? 0.3 : 0),
      1.0
    );
  }

  calculateConfidence(audio, text) {
    return Math.min(
      (audio.confidence || 0) * 0.4 +
      ((audio.clarity || 0) > 70 ? 0.3 : 0) +
      ((text.sentiment || 0) > 0.3 ? 0.3 : 0),
      1.0
    );
  }

  calculateNervousness(audio, text) {
    const baseNervous = Math.min(
      ((audio.tremor || 0) > 5 ? 0.3 : 0) +
      (audio.stress || 0) * 0.2 +
      (text.punctuationEmotions?.ellipsis ? 0.2 : 0),
      1.0
    );
    
    // Reduce nervousness if positive emotions are strong
    const positiveEmotions = Math.max(
      text.emotionBoosts?.happy || 0,
      text.emotionBoosts?.excited || 0
    );
    
    return Math.max(0.1, baseNervous - (positiveEmotions * 0.5)); // Minimum nervousness of 0.1
  }

  /**
   * Get default emotional profile for fallback
   */
  getDefaultEmotionalProfile() {
    return {
      primaryEmotion: 'calm',
      emotions: { calm: 0.7 },
      intensity: 0.5,
      confidence: 0.3,
      tonality: 'neutral',
      voiceSettings: {
        stability: 0.75,
        similarity_boost: 0.8,
        style: 0.3,
        use_speaker_boost: true
      },
      culturalContext: 'universal'
    };
  }

  /**
   * Map emotions to cultural contexts
   */
  determineCulturalContext(language) {
    const culturalMappings = {
      'en': 'western',
      'tr': 'mediterranean',
      'ja': 'east_asian',
      'ar': 'middle_eastern',
      'hi': 'south_asian'
    };
    return culturalMappings[language] || 'universal';
  }

  /**
   * Calculate overall emotion confidence
   */
  calculateEmotionConfidence(emotions, audioData, textData) {
    const maxEmotion = Math.max(...Object.values(emotions));
    const audioConfidence = (audioData.clarity || 50) / 100;
    const textConfidence = textData.intensity || 0.5;
    
    return (maxEmotion + audioConfidence + textConfidence) / 3;
  }

  /**
   * Audio-based emotion calculations
   */
  calculateExcitementFromAudio(audioFeatures) { 
    return Math.min((audioFeatures.energy / 100) + (audioFeatures.averagePitch / 300), 1); 
  }
  
  calculateStressFromAudio(audioFeatures) { 
    return Math.min(audioFeatures.voiceTremor / 10, 1); 
  }
  
  calculateConfidenceFromAudio(audioFeatures) { 
    return Math.min(audioFeatures.articulation / 100, 1); 
  }
  
  calculateSadnessFromAudio(audioFeatures) { 
    return Math.max(0, 1 - (audioFeatures.energy / 100)); 
  }
  
  calculateAngerFromAudio(audioFeatures) { 
    return Math.min((audioFeatures.volume / 100) + (audioFeatures.energy / 100), 1); 
  }
  
  detectSarcasmFromAudio(audioFeatures) { 
    return (audioFeatures.averagePitch > 200 && audioFeatures.energy < 50) ? 0.6 : 0.2; 
  }

  getDefaultAudioEmotions() {
    return {
      pitch: 150, energy: 50, tempo: 120, intensity: 50,
      tremor: 2, clarity: 70, excitement: 0.3, stress: 0.2,
      confidence: 0.6, sadness: 0.2, anger: 0.1, sarcasm: 0.1
    };
  }

  calculateSentimentScore(text, language) {
    const emotionWords = {
      en: {
        positive: ['good', 'great', 'amazing', 'love', 'happy', 'excellent', 'wonderful', 'fantastic', 'awesome', 'perfect', 'beautiful', 'brilliant'],
        negative: ['bad', 'terrible', 'hate', 'awful', 'sad', 'horrible', 'disgusting', 'annoying', 'frustrating', 'disappointing'],
        excited: ['wow', 'amazing', 'incredible', 'fantastic', 'awesome', 'unbelievable', 'extraordinary'],
        angry: ['angry', 'furious', 'mad', 'irritated', 'frustrated', 'outraged', 'annoyed'],
        happy: ['happy', 'joyful', 'cheerful', 'delighted', 'pleased', 'glad', 'thrilled'],
        surprised: ['wow', 'really', 'seriously', 'unbelievable', 'incredible', 'shocking']
      },
      tr: {
        positive: ['iyi', 'harika', 'muhteşem', 'seviyorum', 'mutlu', 'mükemmel', 'güzel', 'süper', 'fevkalade'],
        negative: ['kötü', 'korkunç', 'nefret', 'berbat', 'üzgün', 'rezalet', 'sinir bozucu'],
        excited: ['vay', 'muhteşem', 'inanılmaz', 'fantastik', 'süper', 'olağanüstü'],
        angry: ['sinirli', 'öfkeli', 'kızgın', 'rahatsız', 'sinir', 'çileden çıktım'],
        happy: ['mutlu', 'neşeli', 'sevindim', 'memnun', 'keyifli', 'hoş'],
        surprised: ['vay', 'gerçekten', 'cidden', 'inanılmaz', 'şaşırtıcı']
      }
    };
    
    const words = emotionWords[language] || emotionWords.en;
    const lowerText = text.toLowerCase();
    
    let score = 0;
    let emotionBoosts = { excited: 0, angry: 0, happy: 0, surprised: 0 };
    
    // Calculate basic sentiment
    words.positive.forEach(word => { if (lowerText.includes(word)) score += 0.3; });
    words.negative.forEach(word => { if (lowerText.includes(word)) score -= 0.3; });
    
    // Calculate specific emotion indicators
    words.excited.forEach(word => { if (lowerText.includes(word)) emotionBoosts.excited += 0.4; });
    words.angry.forEach(word => { if (lowerText.includes(word)) emotionBoosts.angry += 0.4; });
    words.happy.forEach(word => { if (lowerText.includes(word)) emotionBoosts.happy += 0.4; });
    words.surprised.forEach(word => { if (lowerText.includes(word)) emotionBoosts.surprised += 0.4; });
    
    return {
      sentiment: Math.max(-1, Math.min(1, score)),
      emotionBoosts
    };
  }

  detectTextualSarcasm(text, language) {
    const sarcasticPatterns = [
      /sure\s*\.{3,}/, /right\s*\.{3,}/, /obviously/, /clearly/,
      /oh\s+really/, /wow\s+so/, /great\s+job/
    ];
    return sarcasticPatterns.some(pattern => pattern.test(text.toLowerCase())) ? 0.7 : 0.1;
  }

  mapEmotionToTonality(emotion, intensity) {
    const tonalityMappings = {
      happy: intensity > 0.7 ? 'joyful' : 'cheerful',
      sad: intensity > 0.7 ? 'melancholic' : 'subdued',
      angry: intensity > 0.7 ? 'furious' : 'stern',
      excited: intensity > 0.7 ? 'exuberant' : 'enthusiastic',
      sarcastic: 'ironic',
      calm: 'serene',
      surprised: 'astonished',
      urgent: 'pressing',
      confident: 'assured',
      nervous: 'anxious'
    };
    return tonalityMappings[emotion] || 'neutral';
  }

  updateVoiceProfile(profile, currentFeatures) {
    // Simple running average update
    profile.baselinePitch = (profile.baselinePitch + currentFeatures.averagePitch) / 2;
    profile.baselineEnergy = (profile.baselineEnergy + currentFeatures.energy) / 2;
  }
}

module.exports = EmotionDetectionService;
