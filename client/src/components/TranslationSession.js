import React, { useState, useEffect, useRef, useCallback } from 'react';
import styled from 'styled-components';
import StreamingAudioCapture from './StreamingAudioCapture';
import TranscriptDisplay from './TranscriptDisplay';
import LatencyMonitor from './LatencyMonitor';

const SessionContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 30px;
  max-width: 1200px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  min-height: 600px;
  display: flex;
  flex-direction: column;
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #ecf0f1;
`;

const SessionTitle = styled.h2`
  color: #2c3e50;
  margin: 0;
  font-size: 1.8em;
  font-weight: 300;
`;

const SessionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  color: #7f8c8d;
  font-size: 0.9em;
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 15px;
`;

const PartnerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #e8f5e8;
  padding: 10px 15px;
  border-radius: 15px;
`;

const MainContent = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 20px;
  }
`;

const AudioSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
`;

const TranscriptSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding-top: 20px;
  border-top: 2px solid #ecf0f1;
`;

const EndSessionButton = styled.button`
  background: #e74c3c;
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #c0392b;
    transform: translateY(-2px);
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  border-radius: 15px;
  font-weight: bold;
  font-size: 0.9em;
  
  ${props => {
    switch (props.$status) {
      case 'connected':
        return `
          background: #d5f4e6;
          color: #27ae60;
        `;
      case 'speaking':
        return `
          background: #ffeaa7;
          color: #e17055;
        `;
      case 'listening':
        return `
          background: #ddd6fe;
          color: #6c5ce7;
        `;
      default:
        return `
          background: #f1f2f6;
          color: #57606f;
        `;
    }
  }}
`;

const VolumeIndicator = styled.div`
  width: 100px;
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin: 0 10px;
`;

const VolumeLevel = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #f1c40f, #e74c3c);
  border-radius: 4px;
  transition: width 0.1s ease;
  width: ${props => props.$level}%;
`;

const TranslationSession = ({ socket, userProfile, sessionData, onSessionEnd }) => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentTranslation, setCurrentTranslation] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sessionStatus, setSessionStatus] = useState('connected');
  const [latencyStats, setLatencyStats] = useState({ current: 0, average: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs
  const audioPlayerRef = useRef(null);

  // Audio playback function
  const playAudio = useCallback(async (audioBase64) => {
    try {
      setIsPlaying(true);
      // Temporarily indicate listening to reduce mic echo loops
      setSessionStatus('listening');
      
      // Convert base64 to audio blob
      const audioData = atob(audioBase64);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play audio
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioUrl;
        await audioPlayerRef.current.play();
      }
      
      // Clean up URL after playback
      setTimeout(() => {
        URL.revokeObjectURL(audioUrl);
      }, 10000);
      
    } catch (error) {
      console.error('Audio playback error:', error);
    } finally {
      setIsPlaying(false);
      // Restore status to connected after playback
      setSessionStatus('connected');
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleLiveTranscription = (data) => {
      setCurrentTranscript(data.text);
      
      // Add to history if it's a final transcript
      if (data.confidence > 0.7) {
        setTranscriptHistory(prev => [...prev, {
          type: 'transcript',
          text: data.text,
          language: data.language,
          timestamp: new Date(),
          speaker: 'you'
        }]);
      }
    };

    const handleLiveTranslation = (data) => {
      console.log(`🌍 CLIENT: Received translation:`, {
        original: data.originalText,
        translated: data.translatedText,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        speaker: data.speaker,
        confidence: data.confidence
      });
      
      setCurrentTranslation(data.translatedText);
      
      // Add translation to history
      setTranscriptHistory(prev => [...prev, {
        type: 'translation',
        originalText: data.originalText,
        translatedText: data.translatedText,
        sourceLanguage: data.sourceLanguage,
        targetLanguage: data.targetLanguage,
        timestamp: new Date(),
        speaker: data.sourceLanguage === userProfile.language ? 'you' : 'partner'
      }]);
    };

    const handleSynthesizedAudio = (data) => {
      console.log(`🔊 CLIENT: Received synthesized audio:`, {
        audioSize: data.audioData?.length || 0,
        text: data.text,
        isFinal: data.isFinal,
        speakerLanguage: data.speakerLanguage,
        partnerLanguage: data.partnerLanguage
      });
      playAudio(data.audioData);
    };

    const handleLatencyStats = (data) => {
      setLatencyStats(prev => ({
        current: data.latency,
        average: Math.round((prev.average + data.latency) / 2)
      }));
    };

    const handlePartnerDisconnected = () => {
      setSessionStatus('disconnected');
    };

    // Register event listeners
    socket.on('live-transcription', handleLiveTranscription);
    socket.on('live-translation', handleLiveTranslation);
    socket.on('synthesized-audio', handleSynthesizedAudio);
    socket.on('latency-stats', handleLatencyStats);
    socket.on('partner-disconnected', handlePartnerDisconnected);

    return () => {
      socket.off('live-transcription', handleLiveTranscription);
      socket.off('live-translation', handleLiveTranslation);
      socket.off('synthesized-audio', handleSynthesizedAudio);
      socket.off('latency-stats', handleLatencyStats);
      socket.off('partner-disconnected', handlePartnerDisconnected);
    };
  }, [socket, userProfile, playAudio]);

  // Handle streaming audio data from microphone
  const handleAudioData = useCallback((audioData, volume) => {
    setAudioLevel(volume * 100);
    
    if (socket && audioData && sessionData) {
      console.log(`🎙️ CLIENT: Sending streaming audio:`, {
        audioSize: audioData?.length || 0,
        sessionId: sessionData.sessionId,
        userRole: userProfile?.role,
        userLanguage: userProfile?.language,
        socketId: socket.id
      });
      
      // Send real-time audio to streaming pipeline
      socket.emit('streaming-audio', {
        audioData: audioData,
        sessionId: sessionData.sessionId
      });
    } else {
      console.warn(`⚠️ CLIENT: Cannot send streaming audio - missing requirements:`, {
        hasSocket: !!socket,
        hasAudioData: !!audioData,
        hasSessionData: !!sessionData,
        sessionId: sessionData?.sessionId
      });
    }
  }, [socket, sessionData, userProfile]);

  // Handle streaming state changes
  const handleStreamingChange = useCallback((streaming) => {
    setIsRecording(streaming);
    setSessionStatus(streaming ? 'speaking' : 'listening');
    
    if (!streaming) {
      setCurrentTranscript('');
      setCurrentTranslation('');
    }
  }, []);

  // Format language display
  const formatLanguage = (langCode) => {
    const languages = { en: 'English', tr: 'Türkçe' };
    return languages[langCode] || langCode;
  };

  // Get role emoji
  const getRoleEmoji = (role) => {
    return role === 'doctor' ? '👨‍⚕️' : '🤒';
  };

  return (
    <SessionContainer>
      {/* Session Header */}
      <SessionHeader>
        <SessionTitle>Active Translation Session</SessionTitle>
        <SessionInfo>
          <UserProfile>
            <span>{getRoleEmoji(userProfile.role)}</span>
            <span>You ({formatLanguage(userProfile.language)})</span>
          </UserProfile>
          <span>↔</span>
          <PartnerInfo>
            <span>{getRoleEmoji(sessionData.partnerRole)}</span>
            <span>{sessionData.partnerRole} ({formatLanguage(sessionData.partnerLanguage)})</span>
          </PartnerInfo>
        </SessionInfo>
      </SessionHeader>

      {/* Main Content */}
      <MainContent>
        {/* Audio Controls Section */}
        <AudioSection>
          <StatusIndicator $status={sessionStatus}>
            <span>●</span>
            {sessionStatus === 'connected' && 'Ready to Translate'}
            {sessionStatus === 'speaking' && 'Speaking...'}
            {sessionStatus === 'listening' && 'Listening...'}
            {sessionStatus === 'disconnected' && 'Partner Disconnected'}
          </StatusIndicator>

          <StreamingAudioCapture
            onAudioData={handleAudioData}
            onStreamingChange={handleStreamingChange}
            enabled={sessionStatus !== 'disconnected'}
          />

          {/* Volume Level Indicator */}
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.9em', color: '#7f8c8d' }}>Volume:</span>
              <VolumeIndicator>
                <VolumeLevel $level={audioLevel} />
              </VolumeIndicator>
            </div>
          )}

          {/* Audio Player */}
          <audio
            ref={audioPlayerRef}
            style={{ display: 'none' }}
            onEnded={() => setIsPlaying(false)}
          />

          {isPlaying && (
            <StatusIndicator status="listening">
              <span>🔊</span>
              Playing Translation
            </StatusIndicator>
          )}
        </AudioSection>

        {/* Transcript Section */}
        <TranscriptSection>
          <TranscriptDisplay
            currentTranscript={currentTranscript}
            currentTranslation={currentTranslation}
            transcriptHistory={transcriptHistory}
            userLanguage={userProfile.language}
            partnerLanguage={sessionData.partnerLanguage}
          />
        </TranscriptSection>
      </MainContent>

      {/* Controls and Monitoring */}
      <ControlsContainer>
        <LatencyMonitor latencyStats={latencyStats} />
        
        <EndSessionButton onClick={onSessionEnd}>
          End Session
        </EndSessionButton>
      </ControlsContainer>
    </SessionContainer>
  );
};

export default TranslationSession;
