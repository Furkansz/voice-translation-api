const EventEmitter = require('events');

class IntelligentSpeechProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Smart timing configuration
    this.config = {
      // Pause detection (milliseconds)
      shortPauseThreshold: 400,     // 400ms - normal breath pause
      mediumPauseThreshold: 800,    // 800ms - sentence completion pause
      longPauseThreshold: 1500,     // 1.5s - thought completion pause
      
      // Confidence thresholds
      minConfidenceThreshold: 0.7,  // Minimum confidence to process
      highConfidenceThreshold: 0.85, // High confidence = immediate processing
      
      // Text analysis
      minWordsForProcessing: 3,     // Minimum words before considering
      sentenceEndPatterns: /[.!?]/, // Sentence ending punctuation
      
      // Adaptive timing
      adaptiveTimeouts: true,       // Learn from user speech patterns
      maxProcessingDelay: 3000,     // Emergency timeout (3s max)
      
      // Quality control
      duplicateDetection: true,     // Prevent duplicate processing
      contextAwareness: true,       // Consider conversation context
      
      ...options
    };
    
    // User-specific speech patterns
    this.userProfiles = new Map();
    this.processingQueue = new Map();
    this.lastProcessedText = new Map();
  }

  /**
   * Initialize speech pattern learning for a user
   */
  initializeUser(userId, language) {
    console.log(`🧠 Initializing intelligent speech processing for ${userId} (${language})`);
    
    this.userProfiles.set(userId, {
      language,
      avgPauseLength: this.config.mediumPauseThreshold,
      avgSentenceLength: 8, // words
      speechRate: 150, // words per minute
      confidenceHistory: [],
      sentencePatterns: [],
      lastSpeechTime: Date.now(),
      totalSentences: 0,
      adaptation: {
        pausePreference: 'medium', // 'short', 'medium', 'long'
        processingSpeed: 'balanced' // 'fast', 'balanced', 'careful'
      }
    });
  }

  /**
   * Process transcription with intelligent timing
   */
  async processTranscription(userId, transcriptionData) {
    const { text, confidence, isFinal, timestamp } = transcriptionData;
    
    if (!text || text.trim().length === 0) return;
    
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      console.warn(`⚠️ No profile found for user ${userId}`);
      return;
    }

    try {
      // Update speech timing
      this.updateSpeechTiming(userId, timestamp);
      
      // Analyze text for completion signals
      const analysis = this.analyzeText(text, confidence, profile);
      
      console.log(`🔍 Speech analysis for ${userId}:`, {
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        confidence: confidence.toFixed(2),
        isFinal,
        ...analysis
      });
      
      // Determine if we should process now
      const shouldProcess = this.shouldProcessNow(userId, text, analysis, isFinal);
      
      if (shouldProcess) {
        await this.processImmediately(userId, text, confidence);
      } else {
        // Queue for intelligent timing
        this.queueForProcessing(userId, text, confidence, analysis);
      }
      
    } catch (error) {
      console.error(`❌ Error in intelligent speech processing for ${userId}:`, error);
    }
  }

  /**
   * Analyze text for completion signals
   */
  analyzeText(text, confidence, profile) {
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    
    // Sentence completion indicators
    const hasEndPunctuation = this.config.sentenceEndPatterns.test(text);
    const isQuestion = text.includes('?');
    const isExclamation = text.includes('!');
    
    // Grammar-based completion detection
    const endsWithVerb = this.endsWithActionWord(text, profile.language);
    const hasCompleteStructure = this.hasCompleteGrammarStructure(text, profile.language);
    
    // Length-based signals
    const isSubstantialLength = wordCount >= this.config.minWordsForProcessing;
    const isTypicalSentenceLength = wordCount >= profile.avgSentenceLength * 0.7;
    
    // Confidence signals
    const isHighConfidence = confidence >= this.config.highConfidenceThreshold;
    const isAcceptableConfidence = confidence >= this.config.minConfidenceThreshold;
    
    return {
      wordCount,
      hasEndPunctuation,
      isQuestion,
      isExclamation,
      endsWithVerb,
      hasCompleteStructure,
      isSubstantialLength,
      isTypicalSentenceLength,
      isHighConfidence,
      isAcceptableConfidence,
      completionScore: this.calculateCompletionScore({
        hasEndPunctuation, isQuestion, isExclamation,
        endsWithVerb, hasCompleteStructure, isHighConfidence,
        wordCount, avgSentenceLength: profile.avgSentenceLength
      })
    };
  }

  /**
   * Calculate completion probability score (0-1)
   */
  calculateCompletionScore(signals) {
    let score = 0;
    
    // Strong completion signals
    if (signals.hasEndPunctuation) score += 0.4;
    if (signals.isQuestion) score += 0.3;
    if (signals.isExclamation) score += 0.3;
    
    // Grammar completion signals
    if (signals.hasCompleteStructure) score += 0.2;
    if (signals.endsWithVerb) score += 0.1;
    
    // Length-based signals
    const lengthRatio = signals.wordCount / signals.avgSentenceLength;
    if (lengthRatio >= 0.8) score += 0.2;
    if (lengthRatio >= 1.2) score += 0.1;
    
    // Confidence boost
    if (signals.isHighConfidence) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Determine if we should process immediately
   */
  shouldProcessNow(userId, text, analysis, isFinal) {
    const profile = this.userProfiles.get(userId);
    
    // Always process final results if they're substantial
    if (isFinal && analysis.isSubstantialLength && analysis.isAcceptableConfidence) {
      return true;
    }
    
    // Process immediately if completion score is very high
    if (analysis.completionScore >= 0.7) {
      console.log(`⚡ High completion score (${analysis.completionScore.toFixed(2)}), processing immediately`);
      return true;
    }
    
    // Process questions immediately (they're usually complete)
    if (analysis.isQuestion && analysis.isAcceptableConfidence) {
      console.log(`❓ Question detected, processing immediately`);
      return true;
    }
    
    // Process exclamations immediately
    if (analysis.isExclamation && analysis.isAcceptableConfidence) {
      console.log(`❗ Exclamation detected, processing immediately`);
      return true;
    }
    
    // Process if user prefers fast responses and we have decent signals
    if (profile.adaptation.processingSpeed === 'fast' && 
        analysis.completionScore >= 0.5 && 
        analysis.isAcceptableConfidence) {
      console.log(`🏃 Fast processing mode, decent completion signals`);
      return true;
    }
    
    return false;
  }

  /**
   * Queue text for intelligent timing-based processing
   */
  queueForProcessing(userId, text, confidence, analysis) {
    const profile = this.userProfiles.get(userId);
    
    // Clear existing timeout for this user
    if (this.processingQueue.has(userId)) {
      clearTimeout(this.processingQueue.get(userId).timeout);
    }
    
    // Determine intelligent wait time
    let waitTime = this.determineWaitTime(analysis, profile);
    
    console.log(`⏳ Queuing for processing in ${waitTime}ms (completion score: ${analysis.completionScore.toFixed(2)})`);
    
    const timeout = setTimeout(async () => {
      // Check if text hasn't been updated (indicating silence)
      const currentQueue = this.processingQueue.get(userId);
      if (currentQueue && currentQueue.text === text) {
        console.log(`🔔 Processing after intelligent wait (${waitTime}ms)`);
        await this.processImmediately(userId, text, confidence);
        this.processingQueue.delete(userId);
      }
    }, waitTime);
    
    this.processingQueue.set(userId, {
      text,
      confidence,
      analysis,
      timeout,
      timestamp: Date.now()
    });
  }

  /**
   * Determine intelligent wait time based on completion signals
   */
  determineWaitTime(analysis, profile) {
    let baseWaitTime = profile.avgPauseLength;
    
    // Adjust based on completion score
    if (analysis.completionScore >= 0.5) {
      baseWaitTime *= 0.7; // Shorter wait for likely complete sentences
    } else if (analysis.completionScore <= 0.3) {
      baseWaitTime *= 1.3; // Longer wait for likely incomplete sentences
    }
    
    // Adjust based on user preference
    if (profile.adaptation.pausePreference === 'short') {
      baseWaitTime *= 0.8;
    } else if (profile.adaptation.pausePreference === 'long') {
      baseWaitTime *= 1.2;
    }
    
    // Ensure reasonable bounds
    return Math.max(
      this.config.shortPauseThreshold,
      Math.min(baseWaitTime, this.config.maxProcessingDelay)
    );
  }

  /**
   * Process text immediately
   */
  async processImmediately(userId, text, confidence) {
    // Duplicate detection
    const lastText = this.lastProcessedText.get(userId);
    if (this.config.duplicateDetection && lastText === text) {
      console.log(`🔄 Duplicate text detected for ${userId}, skipping`);
      return;
    }
    
    this.lastProcessedText.set(userId, text);
    
    // Update user learning
    this.updateUserLearning(userId, text, confidence);
    
    // Emit for processing
    console.log(`✅ Processing speech for ${userId}: "${text}"`);
    this.emit('speech_ready', {
      userId,
      text,
      confidence,
      timestamp: Date.now()
    });
    
    // Clear any pending processing
    if (this.processingQueue.has(userId)) {
      clearTimeout(this.processingQueue.get(userId).timeout);
      this.processingQueue.delete(userId);
    }
  }

  /**
   * Update speech timing patterns
   */
  updateSpeechTiming(userId, timestamp) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    const timeSinceLastSpeech = timestamp - profile.lastSpeechTime;
    
    // Update average pause length (adaptive learning)
    if (timeSinceLastSpeech < this.config.maxProcessingDelay) {
      profile.avgPauseLength = (profile.avgPauseLength * 0.8) + (timeSinceLastSpeech * 0.2);
    }
    
    profile.lastSpeechTime = timestamp;
  }

  /**
   * Update user learning from successful processing
   */
  updateUserLearning(userId, text, confidence) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    const words = text.trim().split(/\s+/);
    
    // Update average sentence length
    profile.avgSentenceLength = (profile.avgSentenceLength * 0.9) + (words.length * 0.1);
    
    // Track confidence patterns
    profile.confidenceHistory.push(confidence);
    if (profile.confidenceHistory.length > 20) {
      profile.confidenceHistory.shift();
    }
    
    // Update sentence patterns
    profile.sentencePatterns.push({
      length: words.length,
      confidence,
      hasEndPunctuation: this.config.sentenceEndPatterns.test(text),
      timestamp: Date.now()
    });
    
    if (profile.sentencePatterns.length > 50) {
      profile.sentencePatterns.shift();
    }
    
    profile.totalSentences++;
    
    console.log(`📊 Updated learning for ${userId}:`, {
      avgSentenceLength: profile.avgSentenceLength.toFixed(1),
      avgPauseLength: profile.avgPauseLength.toFixed(0) + 'ms',
      totalSentences: profile.totalSentences
    });
  }

  /**
   * Check if text ends with action word (language-specific)
   */
  endsWithActionWord(text, language) {
    const words = text.trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase();
    
    if (language === 'en') {
      // English verb patterns
      const verbPatterns = /ing$|ed$|s$|will|can|should|would|could|am|is|are|was|were|do|does|did|have|has|had/;
      return verbPatterns.test(lastWord);
    } else if (language === 'tr') {
      // Turkish verb patterns (common endings)
      const verbPatterns = /yor$|di$|miş$|acak$|ecek$|ir$|er$|ur$|ar$/;
      return verbPatterns.test(lastWord);
    }
    
    return false;
  }

  /**
   * Check for complete grammar structure (simplified)
   */
  hasCompleteGrammarStructure(text, language) {
    const words = text.trim().split(/\s+/);
    
    // Must have minimum length
    if (words.length < 3) return false;
    
    // Check for basic subject-verb structure
    const hasSubject = words.length >= 1;
    const hasVerb = this.endsWithActionWord(text, language) || 
                   words.some(word => this.isLikelyVerb(word, language));
    
    return hasSubject && hasVerb;
  }

  /**
   * Simple verb detection (language-specific)
   */
  isLikelyVerb(word, language) {
    const lowerWord = word.toLowerCase();
    
    if (language === 'en') {
      const commonVerbs = ['am', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'can', 'should', 'would', 'could', 'say', 'said', 'get', 'got', 'go', 'went', 'come', 'came', 'see', 'saw', 'know', 'think', 'take', 'took', 'want', 'need', 'feel', 'make', 'made'];
      return commonVerbs.includes(lowerWord) || /ing$|ed$/.test(lowerWord);
    } else if (language === 'tr') {
      const commonVerbs = ['var', 'yok', 'ol', 'et', 'yap', 'git', 'gel', 'gör', 'bil', 'al', 'ver', 'de', 'söyle', 'iste', 'düşün'];
      return commonVerbs.includes(lowerWord) || /yor$|di$|miş$|acak$|ecek$|ir$|er$|ur$|ar$/.test(lowerWord);
    }
    
    return false;
  }

  /**
   * Remove user from processing
   */
  removeUser(userId) {
    if (this.processingQueue.has(userId)) {
      clearTimeout(this.processingQueue.get(userId).timeout);
      this.processingQueue.delete(userId);
    }
    
    this.userProfiles.delete(userId);
    this.lastProcessedText.delete(userId);
    
    console.log(`🧹 Removed user ${userId} from intelligent speech processor`);
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      activeUsers: this.userProfiles.size,
      queuedProcessing: this.processingQueue.size,
      totalProcessed: Array.from(this.userProfiles.values())
        .reduce((sum, profile) => sum + profile.totalSentences, 0)
    };
  }
}

module.exports = IntelligentSpeechProcessor;
