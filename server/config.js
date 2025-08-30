// Universal Voice Translation System Configuration
const config = {
  // Main Application Server
  PORT: process.env.PORT || 3001,
  
  // API Server (for external integrations)
  API_PORT: process.env.API_PORT || 3002,
  API_HOST: process.env.API_HOST || '0.0.0.0',
  
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // API Keys
  DEEPGRAM_API_KEY: 'ac7348411e473e250a47cad34103b64b78b1cf63',
  ASSEMBLYAI_API_KEY: '41e5bcc1809346649136fc5adae89ec8',
  ELEVENLABS_API_KEY: 'sk_82bd7211c3e282771b2535b9d8442f7fc0cc1fe9eae9821f',
  DEEPL_API_KEY: 'efefaee3-fbc9-4f0f-a045-21338791cf15:fx',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '', // Add your OpenAI API key for Whisper
  
  // Google Cloud Configuration
  GOOGLE_CLOUD_PROJECT_ID: 'looksz-455319',
  GOOGLE_CLOUD_KEY_FILE: './server/google-cloud-credentials.json',
  
  // API Endpoints
  DEEPGRAM_URL: 'https://api.deepgram.com/v1/listen',
  ASSEMBLYAI_URL: 'https://api.assemblyai.com/v2',
  ELEVENLABS_URL: 'https://api.elevenlabs.io/v1',
  DEEPL_URL: 'https://api-free.deepl.com/v2',
  GOOGLE_CLOUD_URL: 'https://speech.googleapis.com/v1',
  
  // Voice IDs - Extensible for Universal Platform
  VOICES: {
    // Current Implementation (Medical Use Case)
    ENGLISH_VOICE: 'j9VKhOt1XPLj283lSboj',
    TURKISH_VOICE: 'DiP1Rqe7XnBlriQqUvQK',
    
    // Extended Voice Library (for API clients)
    EN_MALE_PROFESSIONAL: 'j9VKhOt1XPLj283lSboj',
    EN_FEMALE_PROFESSIONAL: 'en_female_professional',
    EN_BRITISH_MALE: 'en_british_male',
    TR_MALE_PROFESSIONAL: 'DiP1Rqe7XnBlriQqUvQK',
    ES_FEMALE_PROFESSIONAL: 'es_female_professional',
    ES_MX_MALE: 'es_mx_male',
    FR_FEMALE_PARISIAN: 'fr_female_parisian',
    DE_MALE_BERLIN: 'de_male_berlin',
    IT_FEMALE_ROMAN: 'it_female_roman',
    PT_BR_MALE: 'pt_br_male',
    ZH_CN_FEMALE: 'zh_cn_female',
    JA_FEMALE_TOKYO: 'ja_female_tokyo',
    KO_FEMALE_SEOUL: 'ko_female_seoul',
    AR_MALE_MSA: 'ar_male_msa'
  },
  
  // Audio Configuration
  AUDIO_CHUNK_SIZE: 1024, // bytes
  AUDIO_SAMPLE_RATE: 16000, // Hz
  AUDIO_CHANNELS: 1, // mono
  
  // Universal Language Support
  SUPPORTED_LANGUAGES: {
    'en': { name: 'English', region: 'US', voice: 'j9VKhOt1XPLj283lSboj' },
    'tr': { name: 'Turkish', region: 'TR', voice: 'DiP1Rqe7XnBlriQqUvQK' },
    'es': { name: 'Spanish', region: 'ES', voice: 'es_female_professional' },
    'fr': { name: 'French', region: 'FR', voice: 'fr_female_parisian' },
    'de': { name: 'German', region: 'DE', voice: 'de_male_berlin' },
    'it': { name: 'Italian', region: 'IT', voice: 'it_female_roman' },
    'pt': { name: 'Portuguese', region: 'BR', voice: 'pt_br_male' },
    'zh': { name: 'Chinese (Mandarin)', region: 'CN', voice: 'zh_cn_female' },
    'ja': { name: 'Japanese', region: 'JP', voice: 'ja_female_tokyo' },
    'ko': { name: 'Korean', region: 'KR', voice: 'ko_female_seoul' },
    'ar': { name: 'Arabic', region: 'SA', voice: 'ar_male_msa' }
  },
  
  DEFAULT_SOURCE_LANG: 'auto',
  
  // API Configuration
  API_CONFIG: {
    // Rate limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: 1000,
    RATE_LIMIT_TRANSLATIONS_PER_MINUTE: 100,
    
    // Session limits
    MAX_SESSION_DURATION: 7200000, // 2 hours
    MAX_CONCURRENT_SESSIONS: 100,
    
    // Audio limits
    MAX_AUDIO_CHUNK_SIZE: 4 * 1024 * 1024, // 4MB
    MAX_TEXT_LENGTH: 5000,
    MAX_BATCH_REQUESTS: 10,
    
    // Webhook settings
    WEBHOOK_TIMEOUT: 10000, // 10 seconds
    WEBHOOK_MAX_RETRIES: 3,
    
    // Security
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'your-encryption-key-change-in-production'
  },
  
  // Performance Configuration
  MAX_LATENCY_MS: 1000,
  CHUNK_DURATION_MS: 500,
  BUFFER_SIZE_MS: 100
};

module.exports = config;
