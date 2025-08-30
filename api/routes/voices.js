/**
 * Voice Management API Routes
 * Handles voice listing and voice-related operations
 */

const express = require('express');
const router = express.Router();

// Voice database - In production, this would be in a database
const AVAILABLE_VOICES = {
  'en': [
    {
      voiceId: 'j9VKhOt1XPLj283lSboj',
      name: 'Professional Male',
      gender: 'male',
      accent: 'american',
      description: 'Clear, professional voice suitable for business',
      emotionSupport: true,
      premium: false
    },
    {
      voiceId: 'en_female_professional',
      name: 'Professional Female',
      gender: 'female', 
      accent: 'american',
      description: 'Warm, professional female voice',
      emotionSupport: true,
      premium: false
    },
    {
      voiceId: 'en_british_male',
      name: 'British Male',
      gender: 'male',
      accent: 'british',
      description: 'Sophisticated British accent',
      emotionSupport: true,
      premium: true
    }
  ],
  'tr': [
    {
      voiceId: 'DiP1Rqe7XnBlriQqUvQK',
      name: 'Turkish Professional',
      gender: 'male',
      accent: 'istanbul',
      description: 'Native Turkish speaker, clear pronunciation',
      emotionSupport: true,
      premium: false
    }
  ],
  'es': [
    {
      voiceId: 'es_female_professional',
      name: 'Spanish Professional Female',
      gender: 'female',
      accent: 'iberian',
      description: 'Clear Spanish pronunciation from Spain',
      emotionSupport: true,
      premium: false
    },
    {
      voiceId: 'es_mx_male',
      name: 'Mexican Male',
      gender: 'male',
      accent: 'mexican',
      description: 'Mexican Spanish accent',
      emotionSupport: true,
      premium: false
    }
  ],
  'fr': [
    {
      voiceId: 'fr_female_parisian',
      name: 'Parisian Female',
      gender: 'female',
      accent: 'parisian',
      description: 'Elegant French pronunciation',
      emotionSupport: true,
      premium: false
    }
  ],
  'de': [
    {
      voiceId: 'de_male_berlin',
      name: 'German Professional',
      gender: 'male',
      accent: 'berlin',
      description: 'Standard German pronunciation',
      emotionSupport: true,
      premium: false
    }
  ],
  'it': [
    {
      voiceId: 'it_female_roman',
      name: 'Italian Female',
      gender: 'female',
      accent: 'roman',
      description: 'Classical Italian pronunciation',
      emotionSupport: true,
      premium: false
    }
  ],
  'pt': [
    {
      voiceId: 'pt_br_male',
      name: 'Brazilian Portuguese Male',
      gender: 'male',
      accent: 'brazilian',
      description: 'Brazilian Portuguese accent',
      emotionSupport: true,
      premium: false
    }
  ],
  'zh': [
    {
      voiceId: 'zh_cn_female',
      name: 'Mandarin Female',
      gender: 'female',
      accent: 'beijing',
      description: 'Standard Mandarin pronunciation',
      emotionSupport: false,
      premium: false
    }
  ],
  'ja': [
    {
      voiceId: 'ja_female_tokyo',
      name: 'Japanese Female',
      gender: 'female',
      accent: 'tokyo',
      description: 'Standard Japanese pronunciation',
      emotionSupport: false,
      premium: false
    }
  ],
  'ko': [
    {
      voiceId: 'ko_female_seoul',
      name: 'Korean Female',
      gender: 'female',
      accent: 'seoul',
      description: 'Standard Korean pronunciation',
      emotionSupport: false,
      premium: false
    }
  ],
  'ar': [
    {
      voiceId: 'ar_male_msa',
      name: 'Modern Standard Arabic',
      gender: 'male',
      accent: 'msa',
      description: 'Modern Standard Arabic pronunciation',
      emotionSupport: false,
      premium: false
    }
  ]
};

/**
 * GET /api/voices
 * List all available voices, optionally filtered by language
 */
router.get('/', (req, res) => {
  try {
    const { language, gender, premium, emotion } = req.query;
    
    let voices = [];
    
    if (language) {
      // Get voices for specific language
      voices = AVAILABLE_VOICES[language] || [];
    } else {
      // Get all voices
      voices = Object.entries(AVAILABLE_VOICES).flatMap(([lang, voiceList]) =>
        voiceList.map(voice => ({ ...voice, language: lang }))
      );
    }

    // Apply filters
    if (gender) {
      voices = voices.filter(voice => voice.gender === gender);
    }

    if (premium !== undefined) {
      const isPremium = premium === 'true';
      voices = voices.filter(voice => voice.premium === isPremium);
    }

    if (emotion !== undefined) {
      const supportsEmotion = emotion === 'true';
      voices = voices.filter(voice => voice.emotionSupport === supportsEmotion);
    }

    res.json({
      voices: voices.map(voice => ({
        voiceId: voice.voiceId,
        name: voice.name,
        language: voice.language || language,
        gender: voice.gender,
        accent: voice.accent,
        description: voice.description,
        features: {
          emotionSupport: voice.emotionSupport,
          premium: voice.premium
        }
      })),
      total: voices.length,
      filters: {
        language,
        gender,
        premium,
        emotion
      }
    });

  } catch (error) {
    console.error('❌ Voice listing error:', error);
    res.status(500).json({
      error: 'Failed to list voices',
      code: 'VOICE_LISTING_FAILED'
    });
  }
});

/**
 * GET /api/voices/:voiceId
 * Get detailed information about a specific voice
 */
router.get('/:voiceId', (req, res) => {
  try {
    const { voiceId } = req.params;
    
    // Find voice across all languages
    let foundVoice = null;
    let voiceLanguage = null;
    
    for (const [language, voices] of Object.entries(AVAILABLE_VOICES)) {
      const voice = voices.find(v => v.voiceId === voiceId);
      if (voice) {
        foundVoice = voice;
        voiceLanguage = language;
        break;
      }
    }

    if (!foundVoice) {
      return res.status(404).json({
        error: 'Voice not found',
        code: 'VOICE_NOT_FOUND'
      });
    }

    res.json({
      voiceId: foundVoice.voiceId,
      name: foundVoice.name,
      language: voiceLanguage,
      gender: foundVoice.gender,
      accent: foundVoice.accent,
      description: foundVoice.description,
      features: {
        emotionSupport: foundVoice.emotionSupport,
        premium: foundVoice.premium
      },
      // Sample audio URL (in production, this would be actual samples)
      sampleUrl: `https://samples.voicetranslation.com/${foundVoice.voiceId}/sample.mp3`,
      compatibleLanguages: [voiceLanguage], // Could support multiple languages
      pricing: foundVoice.premium ? 'premium' : 'standard'
    });

  } catch (error) {
    console.error('❌ Voice details error:', error);
    res.status(500).json({
      error: 'Failed to get voice details',
      code: 'VOICE_DETAILS_FAILED'
    });
  }
});

/**
 * GET /api/voices/languages
 * Get list of supported languages with voice counts
 */
router.get('/languages', (req, res) => {
  try {
    const languages = Object.entries(AVAILABLE_VOICES).map(([code, voices]) => ({
      code,
      name: getLanguageName(code),
      voiceCount: voices.length,
      hasEmotionSupport: voices.some(v => v.emotionSupport),
      hasPremiumVoices: voices.some(v => v.premium),
      genders: [...new Set(voices.map(v => v.gender))],
      accents: [...new Set(voices.map(v => v.accent))]
    }));

    res.json({
      languages,
      totalLanguages: languages.length,
      totalVoices: languages.reduce((sum, lang) => sum + lang.voiceCount, 0)
    });

  } catch (error) {
    console.error('❌ Language listing error:', error);
    res.status(500).json({
      error: 'Failed to list languages',
      code: 'LANGUAGE_LISTING_FAILED'
    });
  }
});

/**
 * POST /api/voices/:voiceId/sample
 * Generate a sample audio with the specified voice
 */
router.post('/:voiceId/sample', async (req, res) => {
  try {
    const { voiceId } = req.params;
    const { text = 'Hello, this is a voice sample.', language } = req.body;

    // Find voice
    let foundVoice = null;
    let voiceLanguage = language;
    
    if (!voiceLanguage) {
      for (const [lang, voices] of Object.entries(AVAILABLE_VOICES)) {
        if (voices.find(v => v.voiceId === voiceId)) {
          voiceLanguage = lang;
          foundVoice = voices.find(v => v.voiceId === voiceId);
          break;
        }
      }
    } else {
      foundVoice = AVAILABLE_VOICES[language]?.find(v => v.voiceId === voiceId);
    }

    if (!foundVoice) {
      return res.status(404).json({
        error: 'Voice not found',
        code: 'VOICE_NOT_FOUND'
      });
    }

    // In production, this would generate actual audio using ElevenLabs
    // For now, return a mock response
    res.json({
      voiceId,
      text,
      language: voiceLanguage,
      audioUrl: `https://samples.voicetranslation.com/${voiceId}/generated_${Date.now()}.mp3`,
      duration: Math.ceil(text.length / 10), // Rough estimate
      generated: true,
      message: 'Sample audio generated successfully'
    });

  } catch (error) {
    console.error('❌ Voice sample error:', error);
    res.status(500).json({
      error: 'Failed to generate voice sample',
      code: 'VOICE_SAMPLE_FAILED'
    });
  }
});

/**
 * Helper function to get language name from code
 */
function getLanguageName(code) {
  const names = {
    'en': 'English',
    'tr': 'Turkish',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'zh': 'Chinese (Mandarin)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'ru': 'Russian',
    'hi': 'Hindi'
  };
  
  return names[code] || code.toUpperCase();
}

module.exports = router;
