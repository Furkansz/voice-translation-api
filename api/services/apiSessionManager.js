/**
 * API Session Manager
 * Manages translation sessions created through the API
 */

class ApiSessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 60000); // Every minute
  }

  /**
   * Create a new translation session
   */
  async createSession(sessionData) {
    const { sessionId, participants, metadata, options } = sessionData;

    const session = {
      sessionId,
      participants: participants.map(p => ({
        ...p,
        connected: false,
        lastActivity: null
      })),
      metadata: {
        ...metadata,
        createdAt: metadata.createdAt || new Date().toISOString()
      },
      options: {
        enableEmotionDetection: true,
        enableRecording: false,
        autoTranscript: true,
        maxDuration: 3600000, // 1 hour
        ...options
      },
      status: 'created',
      stats: {
        totalMessages: 0,
        totalTranslations: 0,
        totalAudioMinutes: 0
      }
    };

    this.sessions.set(sessionId, session);
    console.log(`📋 API session created: ${sessionId}`);
    
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Validate session access for WebSocket connections
   */
  async validateSessionAccess(sessionId, participantId, apiKey) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.warn(`⚠️ Session not found: ${sessionId}`);
      return null;
    }

    if (session.metadata.apiKey !== apiKey) {
      console.warn(`⚠️ API key mismatch for session: ${sessionId}`);
      return null;
    }

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) {
      console.warn(`⚠️ Participant not found: ${participantId} in session ${sessionId}`);
      return null;
    }

    return session;
  }

  /**
   * Update participant status (connected/disconnected)
   */
  async updateParticipantStatus(sessionId, participantId, status) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const participant = session.participants.find(p => p.id === participantId);
    if (!participant) return false;

    participant.connected = status === 'connected';
    participant.lastActivity = new Date().toISOString();

    // Update session status based on participant connections
    const connectedCount = session.participants.filter(p => p.connected).length;
    
    if (connectedCount === 0) {
      session.status = 'idle';
    } else if (connectedCount === session.participants.length) {
      session.status = 'active';
    } else {
      session.status = 'partial';
    }

    console.log(`👤 Participant ${participantId} ${status} in session ${sessionId}`);
    return true;
  }

  /**
   * Connect a participant to a session
   */
  async connectParticipant(sessionId, participantId, apiKey) {
    const session = await this.validateSessionAccess(sessionId, participantId, apiKey);
    if (!session) return false;

    return await this.updateParticipantStatus(sessionId, participantId, 'connected');
  }

  /**
   * List sessions for a specific API key
   */
  async listSessions({ apiKey, status, limit = 50, offset = 0 }) {
    const allSessions = Array.from(this.sessions.values())
      .filter(session => session.metadata.apiKey === apiKey);

    let filteredSessions = allSessions;
    
    if (status) {
      filteredSessions = allSessions.filter(session => session.status === status);
    }

    return filteredSessions
      .sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt))
      .slice(offset, offset + limit);
  }

  /**
   * Update session configuration
   */
  async updateSession(sessionId, updates, apiKey) {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.metadata.apiKey !== apiKey) {
      return null;
    }

    // Update allowed fields
    if (updates.options) {
      session.options = { ...session.options, ...updates.options };
    }

    if (updates.metadata) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    session.metadata.updatedAt = new Date().toISOString();
    
    console.log(`📋 Session updated: ${sessionId}`);
    return session;
  }

  /**
   * End a session
   */
  async endSession(sessionId, apiKey) {
    const session = this.sessions.get(sessionId);
    
    if (!session || session.metadata.apiKey !== apiKey) {
      return false;
    }

    session.status = 'ended';
    session.metadata.endedAt = new Date().toISOString();
    
    // Mark all participants as disconnected
    session.participants.forEach(p => {
      p.connected = false;
      p.lastActivity = session.metadata.endedAt;
    });

    console.log(`🔚 Session ended: ${sessionId}`);
    
    // Remove session after a delay to allow for final cleanup
    setTimeout(() => {
      this.sessions.delete(sessionId);
      console.log(`🗑️ Session removed from memory: ${sessionId}`);
    }, 30000); // 30 seconds

    return true;
  }

  /**
   * Update session statistics
   */
  async updateSessionStats(sessionId, stats) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (stats.messageCount) {
      session.stats.totalMessages += stats.messageCount;
    }
    
    if (stats.translationCount) {
      session.stats.totalTranslations += stats.translationCount;
    }
    
    if (stats.audioMinutes) {
      session.stats.totalAudioMinutes += stats.audioMinutes;
    }

    return true;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const duration = Date.now() - new Date(session.metadata.createdAt).getTime();
    
    return {
      sessionId,
      status: session.status,
      duration,
      participants: session.participants.length,
      connectedParticipants: session.participants.filter(p => p.connected).length,
      stats: session.stats,
      createdAt: session.metadata.createdAt,
      lastActivity: Math.max(...session.participants.map(p => 
        p.lastActivity ? new Date(p.lastActivity).getTime() : 0
      ))
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = now - new Date(session.metadata.createdAt).getTime();
      const maxAge = session.options.maxDuration || 3600000; // 1 hour default

      // Remove sessions that are expired or have been idle too long
      const shouldCleanup = sessionAge > maxAge || 
        (session.status === 'ended' && sessionAge > 300000) || // 5 minutes after ending
        (session.status === 'idle' && sessionAge > 1800000); // 30 minutes idle

      if (shouldCleanup) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        console.log(`🗑️ Cleaned up expired session: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  /**
   * Get overall API statistics
   */
  getOverallStats() {
    const sessions = Array.from(this.sessions.values());
    
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      idleSessions: sessions.filter(s => s.status === 'idle').length,
      endedSessions: sessions.filter(s => s.status === 'ended').length,
      totalParticipants: sessions.reduce((acc, s) => acc + s.participants.length, 0),
      connectedParticipants: sessions.reduce((acc, s) => 
        acc + s.participants.filter(p => p.connected).length, 0),
      totalMessages: sessions.reduce((acc, s) => acc + s.stats.totalMessages, 0),
      totalTranslations: sessions.reduce((acc, s) => acc + s.stats.totalTranslations, 0),
      totalAudioMinutes: sessions.reduce((acc, s) => acc + s.stats.totalAudioMinutes, 0)
    };
  }

  /**
   * Cleanup on shutdown
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // End all active sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'active' || session.status === 'partial') {
        session.status = 'ended';
        session.metadata.endedAt = new Date().toISOString();
      }
    }
    
    console.log('🔚 API Session Manager shutdown complete');
  }
}

module.exports = ApiSessionManager;
