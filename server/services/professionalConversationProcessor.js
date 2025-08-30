const EventEmitter = require('events');

class ProfessionalConversationProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Professional conversation settings
    this.config = {
      // Natural conversation timing
      conversationalPauseThreshold: 750,    // Natural conversation pause
      sentenceCompletionThreshold: 1200,    // Complete sentence pause  
      thoughtCompletionThreshold: 2000,     // Complete thought pause
      emergencyTimeout: 4000,               // Max wait time
      shortMessageTimeout: 3000,            // Timeout for short messages (1-2 words) - increased to avoid fragments
      
      // Professional quality thresholds
      minConfidenceThreshold: 0.8,          // Higher confidence for professional use
      minWordsForProcessing: 3,             // Minimum words for immediate processing (prevent fragments)
      minCharactersForProcessing: 15,       // Minimum characters
      
      // Natural language processing
      enableContextAwareness: true,         // Understand conversation context
      enableSentenceCompletion: true,       // Wait for complete sentences
      enableSmartCombining: true,           // Combine related fragments
      preventDuplicates: true,              // Prevent duplicate processing
      
      // Professional features
      enableProfessionalTiming: true,       // Optimize for professional conversations
      enableMedicalContext: true,           // Medical conversation awareness
      adaptToSpeechPatterns: true,          // Learn individual speech patterns
      
      ...options
    };
    
    // Professional conversation state
    this.userConversations = new Map();
    this.activeProcessing = new Map();
    this.recentlyProcessed = new Map();
    this.conversationContext = new Map();
  }

  /**
   * Initialize professional conversation for a user
   */
  initializeProfessionalConversation(userId, language, role) {
    console.log(`👨‍⚕️ Initializing professional conversation for ${userId} (${role} - ${language})`);
    
    const conversation = {
      userId,
      language,
      role, // 'doctor' or 'patient'
      
      // Professional timing patterns
      avgSentenceLength: role === 'doctor' ? 12 : 8,
      avgPauseLength: role === 'doctor' ? 1000 : 800,
      speechRate: role === 'doctor' ? 130 : 150, // words per minute
      
      // Conversation state
      currentSentence: '',
      sentenceStartTime: Date.now(),
      lastProcessedText: '',
      lastProcessingTime: 0,
      conversationHistory: [],
      
      // Professional quality tracking
      confidenceHistory: [],
      sentencePatterns: [],
      totalSentences: 0,
      
      // Adaptive learning
      personalTiming: {
        shortPause: this.config.conversationalPauseThreshold,
        mediumPause: this.config.sentenceCompletionThreshold,
        longPause: this.config.thoughtCompletionThreshold
      },
      
      // Professional context
      medicalTermsUsed: [],
      conversationTopic: 'general',
      urgencyLevel: 'normal' // 'low', 'normal', 'high', 'emergency'
    };
    
    this.userConversations.set(userId, conversation);
    this.conversationContext.set(userId, {
      recentTopics: [],
      keyPhrases: [],
      conversationFlow: 'starting' // 'starting', 'ongoing', 'concluding'
    });
  }

  /**
   * Process transcription with professional conversation flow
   */
  async processProfessionalTranscription(userId, transcriptionData) {
    const { text, confidence, isFinal, timestamp } = transcriptionData;
    
    if (!text || text.trim().length === 0) return;
    
    const conversation = this.userConversations.get(userId);
    if (!conversation) {
      console.warn(`⚠️ No professional conversation found for user ${userId}`);
      return;
    }

    try {
      // Update conversation timing
      this.updateConversationTiming(userId, timestamp);
      
      // Professional analysis
      const analysis = this.analyzeProfessionalSpeech(text, confidence, conversation);
      
      console.log(`🎯 Professional analysis for ${userId}:`, {
        text: text.substring(0, 60) + (text.length > 60 ? '...' : ''),
        confidence: confidence.toFixed(2),
        isFinal,
        role: conversation.role,
        ...analysis.summary
      });
      
      // Determine professional processing strategy
      const shouldProcess = this.shouldProcessProfessionally(userId, text, analysis, isFinal);
      
      if (shouldProcess.immediate) {
        await this.processImmediatelyProfessional(userId, shouldProcess.text, confidence, analysis);
      } else if (shouldProcess.queue) {
        const options = shouldProcess.useShortTimeout ? { useShortTimeout: true } : {};
        this.queueForProfessionalProcessing(userId, shouldProcess.text, confidence, analysis, options);
      } else {
        // Continue building sentence
        this.updateCurrentSentence(userId, text);
      }
      
    } catch (error) {
      console.error(`❌ Error in professional conversation processing for ${userId}:`, error);
    }
  }

  /**
   * Analyze speech with professional conversation awareness
   */
  analyzeProfessionalSpeech(text, confidence, conversation) {
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;
    
    // Basic completion indicators
    const hasEndPunctuation = /[.!?]$/.test(text.trim());
    const isQuestion = text.includes('?') || /^(what|how|when|where|why|who|can|could|would|should|do|does|did|is|are|was|were)/i.test(text);
    const isStatement = hasEndPunctuation && !isQuestion;
    const isExclamation = text.includes('!');
    
    // Professional context analysis
    const medicalTerms = this.detectMedicalTerms(text);
    const urgencyIndicators = this.detectUrgency(text);
    const conversationMarkers = this.detectConversationMarkers(text);
    
    // Grammar and structure analysis
    const hasSubject = wordCount >= 2;
    const hasVerb = this.hasVerb(text, conversation.language);
    const hasCompleteStructure = hasSubject && hasVerb;
    const isCompleteThought = this.isCompleteThought(text, conversation);
    
    // Professional quality indicators
    const isSubstantialLength = wordCount >= this.config.minWordsForProcessing;
    const isHighConfidence = confidence >= this.config.minConfidenceThreshold;
    const isTypicalLength = wordCount >= conversation.avgSentenceLength * 0.6;
    
    // Context awareness
    const buildsOnPrevious = this.buildsOnPreviousSentence(text, conversation);
    const startsNewTopic = this.startsNewTopic(text, conversation);
    
    // Professional completion score
    const completionScore = this.calculateProfessionalCompletionScore({
      hasEndPunctuation, isQuestion, isStatement, isExclamation,
      hasCompleteStructure, isCompleteThought, isSubstantialLength,
      isHighConfidence, isTypicalLength, medicalTerms, urgencyIndicators,
      conversationMarkers, buildsOnPrevious, startsNewTopic,
      wordCount, avgLength: conversation.avgSentenceLength
    });
    
    return {
      wordCount, hasEndPunctuation, isQuestion, isStatement, isExclamation,
      hasCompleteStructure, isCompleteThought, isSubstantialLength,
      isHighConfidence, isTypicalLength, completionScore,
      medicalTerms, urgencyIndicators, conversationMarkers,
      buildsOnPrevious, startsNewTopic,
      summary: {
        completionScore: completionScore.toFixed(2),
        isComplete: completionScore >= 0.85 && wordCount >= 3, // Require minimum 3 words AND high score
        confidence: confidence.toFixed(2),
        wordCount,
        hasStructure: hasCompleteStructure
      }
    };
  }

  /**
   * Calculate professional completion score
   */
  calculateProfessionalCompletionScore(signals) {
    let score = 0;
    
    // Strong completion signals (professional context)
    if (signals.hasEndPunctuation) score += 0.35;
    
    // Be more conservative with questions - require minimum length
    if (signals.isQuestion) {
      if (signals.wordCount >= 3) {
        score += 0.4; // Complete questions need at least 3 words
      } else if (signals.wordCount >= 2) {
        score += 0.2; // Very short questions get lower score
      } else {
        score += 0.1; // Single word "questions" are likely incomplete
      }
    }
    
    if (signals.isStatement) score += 0.3;
    if (signals.isExclamation) score += 0.25;
    
    // Grammar and structure (professional requirement)
    if (signals.hasCompleteStructure) score += 0.25;
    if (signals.isCompleteThought) score += 0.3;
    
    // Length and confidence (professional quality)
    if (signals.isSubstantialLength) score += 0.15;
    if (signals.isHighConfidence) score += 0.1;
    const lengthRatio = signals.wordCount / signals.avgLength;
    if (lengthRatio >= 0.8) score += 0.1;
    if (lengthRatio >= 1.2) score += 0.05;
    
    // Professional context bonuses
    if (signals.medicalTerms.length > 0) score += 0.1;
    if (signals.urgencyIndicators.length > 0) score += 0.15;
    if (signals.conversationMarkers.length > 0) score += 0.05;
    
    // Conversation flow
    if (signals.startsNewTopic) score += 0.1;
    if (signals.buildsOnPrevious) score -= 0.1; // Might continue
    
    return Math.min(score, 1.0);
  }

  /**
   * Determine professional processing strategy
   */
  shouldProcessProfessionally(userId, text, analysis, isFinal) {
    const conversation = this.userConversations.get(userId);
    
    // Prevent duplicate processing
    if (this.isDuplicate(userId, text)) {
      return { immediate: false, queue: false, text };
    }
    
    // Emergency situations - process immediately
    if (analysis.urgencyIndicators.length > 0) {
      console.log(`🚨 Urgency detected, processing immediately`);
      return { immediate: true, text, reason: 'urgency' };
    }
    
    // High-confidence complete thoughts - process immediately
    if (analysis.completionScore >= 0.8 && analysis.isHighConfidence) {
      console.log(`⚡ High completion score (${analysis.completionScore.toFixed(2)}), processing immediately`);
      return { immediate: true, text, reason: 'high_completion' };
    }
    
    // Complete questions - process immediately
    if (analysis.isQuestion && analysis.completionScore >= 0.6) {
      console.log(`❓ Complete question detected, processing immediately`);
      return { immediate: true, text, reason: 'question' };
    }
    
    // Short messages (1-2 words) - set up short timeout for user experience
    if (analysis.wordCount <= 2 && analysis.wordCount >= 1 && !this.isDuplicate(userId, text)) {
      console.log(`📝 Short message detected (${analysis.wordCount} words), setting up timeout`);
      return { queue: true, text, reason: 'short_message_timeout', useShortTimeout: true };
    }
    
    // Final results with good quality - process immediately
    if (isFinal && analysis.isSubstantialLength && analysis.isHighConfidence) {
      console.log(`✅ Final result with good quality, processing immediately`);
      return { immediate: true, text, reason: 'final_quality' };
    }
    
    // Medical statements - higher priority
    if (analysis.medicalTerms.length > 0 && analysis.completionScore >= 0.6) {
      console.log(`🏥 Medical context detected, processing with priority`);
      return { immediate: true, text, reason: 'medical' };
    }
    
    // Substantial text with decent completion - queue for intelligent timing
    if (analysis.isSubstantialLength && analysis.completionScore >= 0.4) {
      return { queue: true, text, reason: 'queue_timing' };
    }
    
    // Build sentence for better context
    return { immediate: false, queue: false, text, reason: 'build_sentence' };
  }

  /**
   * Process immediately with professional quality
   */
  async processImmediatelyProfessional(userId, text, confidence, analysis) {
    const conversation = this.userConversations.get(userId);
    
    // Combine with current sentence if building
    const finalText = this.combineSentenceContext(userId, text);
    
    // Prevent duplicate processing
    if (this.isDuplicate(userId, finalText)) {
      console.log(`🔄 Duplicate professional text detected for ${userId}, skipping`);
      return;
    }
    
    // Mark as processed
    this.markAsProcessed(userId, finalText);
    
    // Update professional learning
    this.updateProfessionalLearning(userId, finalText, confidence, analysis);
    
    // Clear current sentence
    conversation.currentSentence = '';
    conversation.sentenceStartTime = Date.now();
    
    console.log(`🎯 Processing professionally for ${userId}: "${finalText}"`);
    this.emit('professional_speech_ready', {
      userId,
      text: finalText,
      confidence,
      analysis,
      timestamp: Date.now()
    });
    
    // Clear any pending processing
    this.clearPendingProcessing(userId);
  }

  /**
   * Queue for professional timing-based processing
   */
  queueForProfessionalProcessing(userId, text, confidence, analysis, options = {}) {
    const conversation = this.userConversations.get(userId);
    
    // Clear existing timeout
    this.clearPendingProcessing(userId);
    
    // Determine professional wait time
    let waitTime;
    if (options.useShortTimeout) {
      waitTime = this.config.shortMessageTimeout;
      console.log(`⏳ Queuing short message for ${waitTime}ms (${analysis.wordCount} words: "${text}")`);
    } else {
      waitTime = this.determineProfessionalWaitTime(analysis, conversation);
      console.log(`⏳ Queuing professionally for ${waitTime}ms (score: ${analysis.completionScore.toFixed(2)})`);
    }
    
    const timeout = setTimeout(async () => {
      const currentProcessing = this.activeProcessing.get(userId);
      if (currentProcessing && currentProcessing.text === text) {
        if (options.useShortTimeout) {
          console.log(`🔔 Processing short message after timeout (${waitTime}ms): "${text}"`);
        } else {
          console.log(`🔔 Processing after professional wait (${waitTime}ms)`);
        }
        const finalText = this.combineSentenceContext(userId, text);
        await this.processImmediatelyProfessional(userId, finalText, confidence, analysis);
      }
    }, waitTime);
    
    this.activeProcessing.set(userId, {
      text,
      confidence,
      analysis,
      timeout,
      timestamp: Date.now(),
      isShortMessage: options.useShortTimeout || false
    });
  }

  /**
   * Determine professional wait time
   */
  determineProfessionalWaitTime(analysis, conversation) {
    let baseWaitTime = conversation.personalTiming.mediumPause;
    
    // Adjust based on completion signals
    if (analysis.completionScore >= 0.6) {
      baseWaitTime *= 0.6; // Shorter wait for likely complete
    } else if (analysis.completionScore <= 0.3) {
      baseWaitTime *= 1.4; // Longer wait for incomplete
    }
    
    // Professional role adjustments
    if (conversation.role === 'doctor') {
      baseWaitTime *= 1.1; // Doctors often speak more deliberately
    }
    
    // Medical context needs precision
    if (analysis.medicalTerms.length > 0) {
      baseWaitTime *= 1.2; // Wait longer for medical accuracy
    }
    
    // Ensure professional bounds
    return Math.max(
      500, // Minimum 500ms for professional quality
      Math.min(baseWaitTime, this.config.emergencyTimeout)
    );
  }

  /**
   * Update current sentence building
   */
  updateCurrentSentence(userId, text) {
    const conversation = this.userConversations.get(userId);
    if (!conversation) return;
    
    // Smart sentence building
    if (conversation.currentSentence === '' || 
        text.length > conversation.currentSentence.length) {
      conversation.currentSentence = text;
    }
  }

  /**
   * Combine sentence context for better quality
   */
  combineSentenceContext(userId, text) {
    const conversation = this.userConversations.get(userId);
    if (!conversation) return text;
    
    // Use the longer, more complete text
    if (conversation.currentSentence.length > text.length && 
        conversation.currentSentence.includes(text.trim())) {
      return conversation.currentSentence;
    }
    
    return text;
  }

  /**
   * Professional learning and adaptation
   */
  updateProfessionalLearning(userId, text, confidence, analysis) {
    const conversation = this.userConversations.get(userId);
    if (!conversation) return;
    
    const words = text.trim().split(/\s+/);
    
    // Update professional patterns
    conversation.avgSentenceLength = (conversation.avgSentenceLength * 0.85) + (words.length * 0.15);
    conversation.totalSentences++;
    
    // Track professional context
    if (analysis.medicalTerms.length > 0) {
      conversation.medicalTermsUsed.push(...analysis.medicalTerms);
    }
    
    // Update timing patterns
    const processingTime = Date.now() - conversation.sentenceStartTime;
    conversation.personalTiming.mediumPause = (conversation.personalTiming.mediumPause * 0.8) + (processingTime * 0.2);
    
    // Professional quality tracking
    conversation.confidenceHistory.push(confidence);
    if (conversation.confidenceHistory.length > 10) {
      conversation.confidenceHistory.shift();
    }
    
    conversation.sentencePatterns.push({
      length: words.length,
      confidence,
      completionScore: analysis.completionScore,
      timestamp: Date.now()
    });
    
    if (conversation.sentencePatterns.length > 20) {
      conversation.sentencePatterns.shift();
    }
    
    console.log(`📊 Professional learning updated for ${userId}:`, {
      avgSentenceLength: conversation.avgSentenceLength.toFixed(1),
      personalTiming: Math.round(conversation.personalTiming.mediumPause) + 'ms',
      totalSentences: conversation.totalSentences,
      avgConfidence: (conversation.confidenceHistory.reduce((a, b) => a + b, 0) / conversation.confidenceHistory.length).toFixed(2)
    });
  }

  /**
   * Helper methods
   */
  detectMedicalTerms(text) {
    const medicalKeywords = [
      'pain', 'ache', 'hurt', 'symptom', 'medicine', 'medication', 'prescription',
      'doctor', 'nurse', 'hospital', 'clinic', 'appointment', 'diagnosis',
      'blood', 'pressure', 'heart', 'temperature', 'fever', 'nausea',
      'headache', 'stomach', 'chest', 'breathing', 'dizzy', 'tired',
      'ağrı', 'acı', 'belirti', 'ilaç', 'reçete', 'doktor', 'hemşire',
      'hastane', 'klinik', 'randevu', 'teşhis', 'kan', 'basınç', 'kalp',
      'ateş', 'mide', 'göğüs', 'nefes', 'baş ağrısı', 'yorgun'
    ];
    
    return medicalKeywords.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
  }

  detectUrgency(text) {
    const urgencyKeywords = [
      'urgent', 'emergency', 'help', 'pain', 'severe', 'serious', 'immediately',
      'acil', 'yardım', 'ağrı', 'ciddi', 'hemen', 'şiddetli'
    ];
    
    return urgencyKeywords.filter(term => 
      text.toLowerCase().includes(term.toLowerCase())
    );
  }

  detectConversationMarkers(text) {
    const markers = [
      'so', 'well', 'now', 'then', 'okay', 'alright', 'actually',
      'şey', 'yani', 'şimdi', 'tamam', 'peki', 'aslında'
    ];
    
    return markers.filter(term => 
      text.toLowerCase().startsWith(term.toLowerCase())
    );
  }

  hasVerb(text, language) {
    if (language === 'en') {
      const verbPatterns = /\b(am|is|are|was|were|have|has|had|do|does|did|will|would|could|should|can|may|might|must)\b/i;
      const actionVerbs = /\b\w+ing\b|\b\w+ed\b/i;
      return verbPatterns.test(text) || actionVerbs.test(text);
    } else if (language === 'tr') {
      const verbPatterns = /\b\w+(yor|du|di|muş|miş|mış|acak|ecek|ir|er|ar|ur)\b/i;
      return verbPatterns.test(text);
    }
    return true; // Default assumption
  }

  isCompleteThought(text, conversation) {
    const words = text.trim().split(/\s+/);
    return words.length >= 3 && 
           (text.includes('.') || text.includes('?') || text.includes('!') ||
            words.length >= conversation.avgSentenceLength * 0.8);
  }

  buildsOnPreviousSentence(text, conversation) {
    if (conversation.conversationHistory.length === 0) return false;
    const lastSentence = conversation.conversationHistory[conversation.conversationHistory.length - 1];
    return text.toLowerCase().includes(lastSentence.toLowerCase().split(' ')[0]);
  }

  startsNewTopic(text, conversation) {
    const topicStarters = ['so', 'now', 'well', 'actually', 'by the way', 'şey', 'şimdi', 'aslında'];
    return topicStarters.some(starter => 
      text.toLowerCase().startsWith(starter.toLowerCase())
    );
  }

  isDuplicate(userId, text) {
    const recent = this.recentlyProcessed.get(userId);
    if (!recent) return false;
    
    const timeDiff = Date.now() - recent.timestamp;
    return recent.text === text && timeDiff < 3000; // 3 second window
  }

  markAsProcessed(userId, text) {
    this.recentlyProcessed.set(userId, {
      text,
      timestamp: Date.now()
    });
  }

  clearPendingProcessing(userId) {
    const pending = this.activeProcessing.get(userId);
    if (pending && pending.timeout) {
      if (pending.isShortMessage) {
        console.log(`🚫 Cancelling short message timeout for ${userId} (longer message received)`);
      }
      clearTimeout(pending.timeout);
      this.activeProcessing.delete(userId);
    }
  }

  updateConversationTiming(userId, timestamp) {
    const conversation = this.userConversations.get(userId);
    if (!conversation) return;
    
    conversation.lastProcessingTime = timestamp;
  }

  /**
   * Remove user from professional conversation
   */
  removeProfessionalConversation(userId) {
    this.clearPendingProcessing(userId);
    this.userConversations.delete(userId);
    this.conversationContext.delete(userId);
    this.recentlyProcessed.delete(userId);
    
    console.log(`🧹 Removed professional conversation for ${userId}`);
  }

  /**
   * Get professional conversation statistics
   */
  getProfessionalStats() {
    return {
      activeConversations: this.userConversations.size,
      pendingProcessing: this.activeProcessing.size,
      totalProcessed: Array.from(this.userConversations.values())
        .reduce((sum, conv) => sum + conv.totalSentences, 0)
    };
  }
}

module.exports = ProfessionalConversationProcessor;
