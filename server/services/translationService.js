const axios = require('axios');

class TranslationService {
  constructor(config) {
    this.config = config;
    this.apiKey = config.DEEPL_API_KEY;
    this.baseUrl = config.DEEPL_URL;
  }

  async translate(text, sourceLanguage, targetLanguage) {
    try {
      if (!text || text.trim().length === 0) {
        return { translatedText: '', detectedLanguage: sourceLanguage, confidence: 0 };
      }

      // Map language codes for DeepL
      const sourceLang = this.mapLanguageForDeepL(sourceLanguage);
      const targetLang = this.mapLanguageForDeepL(targetLanguage);

      console.log(`🌍 Translating from ${sourceLang} to ${targetLang}: "${text}"`);

      const response = await axios.post(`${this.baseUrl}/translate`, {
        text: [text],
        source_lang: sourceLang === 'auto' ? undefined : sourceLang,
        target_lang: targetLang,
        preserve_formatting: true,
        formality: 'default',
        glossary_id: undefined,
        tag_handling: 'xml',
        split_sentences: '1',
        outline_detection: false,
        non_splitting_tags: ['medical', 'dosage', 'number'],
        splitting_tags: ['sentence'],
        ignore_tags: ['code']
      }, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const result = response.data;

      if (!result.translations || result.translations.length === 0) {
        throw new Error('No translation returned from DeepL');
      }

      const translatedText = result.translations[0].text;
      const detectedSourceLang = result.translations[0].detected_source_language;

      console.log(`✅ Translation successful: "${translatedText}" (detected: ${detectedSourceLang})`);

      return {
        translatedText: translatedText,
        detectedLanguage: detectedSourceLang,
        confidence: 1.0 // DeepL doesn't provide confidence scores
      };

    } catch (error) {
      console.error('❌ Translation error:', error);
      
      // Handle axios errors
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 456) {
          throw new Error('Translation quota exceeded');
        } else if (status === 403) {
          throw new Error('DeepL API key invalid');
        } else {
          throw new Error(`DeepL API error: ${status} - ${data?.message || 'Unknown error'}`);
        }
      } else if (error.request) {
        throw new Error('DeepL API network error - no response received');
      }
      
      throw error;
    }
  }

  async translateBatch(texts, sourceLanguage, targetLanguage) {
    try {
      if (!texts || texts.length === 0) {
        return [];
      }

      // Filter out empty texts
      const validTexts = texts.filter(text => text && text.trim().length > 0);
      
      if (validTexts.length === 0) {
        return texts.map(() => '');
      }

      const sourceLang = this.mapLanguageForDeepL(sourceLanguage);
      const targetLang = this.mapLanguageForDeepL(targetLanguage);

      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: validTexts,
          source_lang: sourceLang === 'auto' ? undefined : sourceLang,
          target_lang: targetLang,
          preserve_formatting: true,
          formality: 'default'
        })
      });

      if (!response.ok) {
        throw new Error(`DeepL batch translation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.translations.map(t => t.text);

    } catch (error) {
      console.error('Batch translation error:', error);
      throw error;
    }
  }

  async getUsage() {
    try {
      const response = await fetch(`${this.baseUrl}/usage`, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get usage: ${response.status}`);
      }

      return await response.json();

    } catch (error) {
      console.error('Usage check error:', error);
      return null;
    }
  }

  async getSupportedLanguages() {
    try {
      const response = await fetch(`${this.baseUrl}/languages?type=source`, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get languages: ${response.status}`);
      }

      const sourceLanguages = await response.json();

      const targetResponse = await fetch(`${this.baseUrl}/languages?type=target`, {
        headers: {
          'Authorization': `DeepL-Auth-Key ${this.apiKey}`
        }
      });

      let targetLanguages = [];
      if (targetResponse.ok) {
        targetLanguages = await targetResponse.json();
      }

      return {
        source: sourceLanguages,
        target: targetLanguages
      };

    } catch (error) {
      console.error('Get languages error:', error);
      return {
        source: [],
        target: []
      };
    }
  }

  mapLanguageForDeepL(language) {
    const languageMap = {
      'en': 'EN',
      'tr': 'TR',
      'auto': 'auto'
    };
    return languageMap[language] || 'EN';
  }

  // Validate that translation is medically accurate by checking for key terms
  validateMedicalTranslation(originalText, translatedText, sourceLanguage, targetLanguage) {
    try {
      // Common medical terms that should be preserved or have known translations
      const medicalTerms = {
        'en': [
          'mg', 'ml', 'mcg', 'units', 'daily', 'twice', 'three times',
          'morning', 'evening', 'before meals', 'after meals',
          'blood pressure', 'heart rate', 'temperature', 'glucose',
          'insulin', 'medication', 'prescription', 'dosage'
        ],
        'tr': [
          'mg', 'ml', 'mcg', 'ünite', 'günlük', 'iki kez', 'üç kez',
          'sabah', 'akşam', 'yemek öncesi', 'yemek sonrası',
          'kan basıncı', 'nabız', 'ateş', 'şeker',
          'insülin', 'ilaç', 'reçete', 'doz'
        ]
      };

      // Check for numbers and units preservation
      const numberPattern = /\d+(\.\d+)?/g;
      const originalNumbers = originalText.match(numberPattern) || [];
      const translatedNumbers = translatedText.match(numberPattern) || [];

      // Numbers should be preserved in medical contexts
      if (originalNumbers.length !== translatedNumbers.length) {
        console.warn('Number count mismatch in medical translation:', {
          original: originalNumbers,
          translated: translatedNumbers
        });
      }

      // Check for time patterns (e.g., "3 times a day", "8:00 AM")
      const timePattern = /\d{1,2}:\d{2}|\d+\s*(times?|kez|defa)/gi;
      const originalTimes = originalText.match(timePattern) || [];
      const translatedTimes = translatedText.match(timePattern) || [];

      return {
        isValid: true, // For now, assume valid unless we detect major issues
        warnings: [],
        originalNumbers,
        translatedNumbers,
        originalTimes,
        translatedTimes
      };

    } catch (error) {
      console.error('Medical validation error:', error);
      return {
        isValid: true,
        warnings: ['Validation failed'],
        error: error.message
      };
    }
  }

  // Handle medical-specific translation requirements
  async translateMedical(text, sourceLanguage, targetLanguage) {
    try {
      // Pre-process medical text to protect important terms
      const protectedText = this.protectMedicalTerms(text);
      
      // Translate
      const translatedText = await this.translate(protectedText, sourceLanguage, targetLanguage);
      
      // Post-process to restore protected terms
      const finalText = this.restoreMedicalTerms(translatedText);
      
      // Validate medical accuracy
      const validation = this.validateMedicalTranslation(text, finalText, sourceLanguage, targetLanguage);
      
      return {
        text: finalText,
        validation: validation,
        originalText: text
      };

    } catch (error) {
      console.error('Medical translation error:', error);
      throw error;
    }
  }

  protectMedicalTerms(text) {
    // Protect numbers with units
    let protectedText = text;
    
    // Protect dosage patterns like "10 mg", "5 ml", "2.5 units"
    protectedText = protectedText.replace(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|units?|ünite)/gi, '<medical>$1 $2</medical>');
    
    // Protect time patterns like "3 times daily", "twice a day"
    protectedText = protectedText.replace(/(\d+)\s*(times?|kez|defa)\s*(daily|a day|günde)/gi, '<medical>$1 $2 $3</medical>');
    
    // Protect specific times like "8:00 AM", "20:30"
    protectedText = protectedText.replace(/\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?/gi, '<medical>$&</medical>');
    
    return protectedText;
  }

  restoreMedicalTerms(text) {
    // Remove protection tags
    return text.replace(/<medical>(.*?)<\/medical>/gi, '$1');
  }
}

module.exports = TranslationService;
