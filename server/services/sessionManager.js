const { v4: uuidv4 } = require('uuid');

class SessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> session object
    this.users = new Map();    // socketId -> user object
    this.waitingDoctors = [];  // queue of doctors waiting for patients
    this.waitingPatients = []; // queue of patients waiting for doctors
  }

  async addUser(socketId, userData) {
    const { role, language, voiceId, socket } = userData;
    
    // Check if user is reconnecting to existing session
    const existingUser = Array.from(this.users.values()).find(u => 
      u.role === role && u.language === language && u.voiceId === voiceId
    );
    
    if (existingUser && existingUser.sessionId) {
      // User is reconnecting - update socket reference
      console.log(`🔄 User reconnecting: ${role} (${language}), updating socket from ${existingUser.socketId} to ${socketId}`);
      
      // Update socket reference in user object
      existingUser.socketId = socketId;
      existingUser.socket = socket;
      
      // Update user in map with new socket ID
      this.users.delete(existingUser.socketId);
      this.users.set(socketId, existingUser);
      
      // Update session with new socket reference
      const session = this.sessions.get(existingUser.sessionId);
      if (session) {
        if (session.doctor && session.doctor.socketId === existingUser.socketId) {
          session.doctor.socket = socket;
          session.doctor.socketId = socketId;
        }
        if (session.patient && session.patient.socketId === existingUser.socketId) {
          session.patient.socket = socket;
          session.patient.socketId = socketId;
        }
        console.log(`✅ Reconnected ${role} to existing session ${session.id}`);
        return session;
      }
    }
    
    // Create user object
    const user = {
      socketId,
      role,
      language,
      voiceId,
      socket,
      joinedAt: new Date(),
      sessionId: null
    };

    // Store user
    this.users.set(socketId, user);
    
    console.log(`📋 SessionManager: Adding new ${role} (${language}) with socket ${socketId}`);

    // Try to match with existing session or create new one
    let session = null;

    if (role === 'doctor') {
      // Look for waiting patients with different language
      const waitingPatientIndex = this.waitingPatients.findIndex(p => p.language !== language);
      
      if (waitingPatientIndex !== -1) {
        // Found a patient, create session
        const patient = this.waitingPatients.splice(waitingPatientIndex, 1)[0];
        session = this.createSession(user, patient);
        console.log(`Doctor (${language}) matched with Patient (${patient.language})`);
      } else {
        // No patient waiting, add doctor to waiting list
        this.waitingDoctors.push(user);
        session = this.createPendingSession(user);
        console.log(`Doctor (${language}) added to waiting list`);
      }
    } else if (role === 'patient') {
      // Look for waiting doctors with different language
      const waitingDoctorIndex = this.waitingDoctors.findIndex(d => d.language !== language);
      
      if (waitingDoctorIndex !== -1) {
        // Found a doctor, create session
        const doctor = this.waitingDoctors.splice(waitingDoctorIndex, 1)[0];
        session = this.createSession(doctor, user);
        console.log(`Patient (${language}) matched with Doctor (${doctor.language})`);
      } else {
        // No doctor waiting, add patient to waiting list
        this.waitingPatients.push(user);
        session = this.createPendingSession(user);
        console.log(`Patient (${language}) added to waiting list`);
      }
    } else {
      throw new Error('Invalid role. Must be "doctor" or "patient"');
    }

    // Update user with session ID
    user.sessionId = session.id;
    
    return session;
  }

  createSession(doctor, patient) {
    const sessionId = uuidv4();
    
    console.log(`🏥 ===== CREATING SESSION =====`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`👨‍⚕️ Doctor:`, {
      socketId: doctor.socketId,
      role: doctor.role,
      language: doctor.language,
      voiceId: doctor.voiceId,
      currentSocketId: doctor.socket?.id
    });
    console.log(`🤒 Patient:`, {
      socketId: patient.socketId,
      role: patient.role,
      language: patient.language,
      voiceId: patient.voiceId,
      currentSocketId: patient.socket?.id
    });
    
    const session = {
      id: sessionId,
      doctor: doctor,
      patient: patient,
      createdAt: new Date(),
      status: 'active',
      stats: {
        messagesExchanged: 0,
        totalLatency: 0,
        averageLatency: 0,
        errors: 0
      }
    };

    // Update users with session ID
    doctor.sessionId = sessionId;
    patient.sessionId = sessionId;

    // Store session
    this.sessions.set(sessionId, session);

    console.log(`✅ Session ${sessionId} created successfully`);
    console.log(`📊 Total active sessions: ${this.sessions.size}`);
    console.log(`=============================`);
    
    return session;
  }

  createPendingSession(user) {
    const sessionId = uuidv4();
    
    const session = {
      id: sessionId,
      doctor: user.role === 'doctor' ? user : null,
      patient: user.role === 'patient' ? user : null,
      createdAt: new Date(),
      status: 'pending',
      stats: {
        messagesExchanged: 0,
        totalLatency: 0,
        averageLatency: 0,
        errors: 0
      }
    };

    // Store session
    this.sessions.set(sessionId, session);

    console.log(`Pending session ${sessionId} created for ${user.role} (${user.language})`);
    
    return session;
  }

  removeUser(socketId) {
    const user = this.users.get(socketId);
    
    if (!user) {
      return null;
    }

    console.log(`Removing user: ${user.role} (${user.language})`);

    // Remove from waiting lists
    this.waitingDoctors = this.waitingDoctors.filter(d => d.socketId !== socketId);
    this.waitingPatients = this.waitingPatients.filter(p => p.socketId !== socketId);

    // Handle session cleanup
    if (user.sessionId) {
      const session = this.sessions.get(user.sessionId);
      
      if (session) {
        if (session.status === 'pending') {
          // Remove pending session
          this.sessions.delete(user.sessionId);
        } else if (session.status === 'active') {
          // Notify the other party that their partner disconnected
          const otherUser = user.role === 'doctor' ? session.patient : session.doctor;
          
          if (otherUser && otherUser.socket) {
            otherUser.socket.emit('partner-disconnected', {
              message: `The ${user.role} has disconnected`
            });
          }
          
          // Mark session as ended
          session.status = 'ended';
          session.endedAt = new Date();
          
          // Move the remaining user back to waiting list
          if (otherUser) {
            otherUser.sessionId = null;
            if (otherUser.role === 'doctor') {
              this.waitingDoctors.push(otherUser);
            } else {
              this.waitingPatients.push(otherUser);
            }
            
            // Notify them they're waiting again
            otherUser.socket.emit('waiting-for-partner', { 
              role: otherUser.role === 'doctor' ? 'patient' : 'doctor' 
            });
          }
        }
      }
    }

    // Remove user from storage
    this.users.delete(socketId);
    
    return user;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getSessionBySocketId(socketId) {
    const user = this.users.get(socketId);
    
    if (!user || !user.sessionId) {
      return null;
    }
    
    return this.sessions.get(user.sessionId);
  }

  updateSessionStats(sessionId, stats) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    // Update statistics
    if (stats.latency) {
      session.stats.messagesExchanged++;
      session.stats.totalLatency += stats.latency;
      session.stats.averageLatency = session.stats.totalLatency / session.stats.messagesExchanged;
    }

    if (stats.error) {
      session.stats.errors++;
    }

    return true;
  }

  getActiveSessionsCount() {
    let activeCount = 0;
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        activeCount++;
      }
    }
    return activeCount;
  }

  getWaitingUsersCount() {
    return {
      doctors: this.waitingDoctors.length,
      patients: this.waitingPatients.length
    };
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  getSessionStatistics() {
    const sessions = this.getAllSessions();
    const now = new Date();
    
    const stats = {
      total: sessions.length,
      active: 0,
      pending: 0,
      ended: 0,
      averageSessionDuration: 0,
      totalMessagesExchanged: 0,
      averageLatency: 0,
      totalErrors: 0
    };

    let totalDuration = 0;
    let totalLatencySum = 0;
    let totalLatencyCount = 0;

    sessions.forEach(session => {
      stats[session.status]++;
      
      // Calculate duration
      const endTime = session.endedAt || now;
      const duration = endTime - session.createdAt;
      totalDuration += duration;
      
      // Aggregate message stats
      stats.totalMessagesExchanged += session.stats.messagesExchanged;
      stats.totalErrors += session.stats.errors;
      
      // Aggregate latency stats
      if (session.stats.totalLatency > 0) {
        totalLatencySum += session.stats.totalLatency;
        totalLatencyCount += session.stats.messagesExchanged;
      }
    });

    if (sessions.length > 0) {
      stats.averageSessionDuration = totalDuration / sessions.length;
    }

    if (totalLatencyCount > 0) {
      stats.averageLatency = totalLatencySum / totalLatencyCount;
    }

    return stats;
  }

  // Clean up old ended sessions
  cleanupOldSessions(maxAgeHours = 24) {
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const now = new Date();
    
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'ended') {
        const sessionAge = now - (session.endedAt || session.createdAt);
        
        if (sessionAge > maxAge) {
          this.sessions.delete(sessionId);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} old sessions`);
    }

    return cleanedCount;
  }

  // Get session by user role and language (for debugging)
  findSessionsByUserCriteria(role, language) {
    const matchingSessions = [];
    
    for (const session of this.sessions.values()) {
      const user = session[role];
      if (user && user.language === language) {
        matchingSessions.push(session);
      }
    }

    return matchingSessions;
  }

  // Check if a user is in an active session
  isUserInActiveSession(socketId) {
    const user = this.users.get(socketId);
    
    if (!user || !user.sessionId) {
      return false;
    }

    const session = this.sessions.get(user.sessionId);
    return session && session.status === 'active';
  }

  // Get user by socket ID
  getUser(socketId) {
    return this.users.get(socketId);
  }

  // Get partner information for a user
  getPartnerInfo(socketId) {
    const user = this.users.get(socketId);
    
    if (!user || !user.sessionId) {
      return null;
    }

    const session = this.sessions.get(user.sessionId);
    
    if (!session || session.status !== 'active') {
      return null;
    }

    const partner = user.role === 'doctor' ? session.patient : session.doctor;
    
    if (!partner) {
      return null;
    }

    return {
      role: partner.role,
      language: partner.language,
      joinedAt: partner.joinedAt
    };
  }
}

module.exports = SessionManager;
