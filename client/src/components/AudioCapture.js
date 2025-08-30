import React, { useState, useRef, useCallback, useEffect } from 'react';
import styled from 'styled-components';

const CaptureContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px;
`;

const RecordButton = styled.button`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  font-size: 3em;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  
  ${props => {
    if (!props.$enabled) {
      return `
        background: #bdc3c7;
        color: white;
        cursor: not-allowed;
      `;
    }
    
    if (props.$recording) {
      return `
        background: linear-gradient(135deg, #e74c3c, #c0392b);
        color: white;
        transform: scale(1.1);
        animation: recordingPulse 1s infinite;
      `;
    }
    
    if (props.$voiceActivity) {
      return `
        background: linear-gradient(135deg, #f39c12, #e67e22);
        color: white;
        transform: scale(1.05);
        animation: voicePulse 0.5s infinite;
      `;
    }
    
    if (props.$listening) {
      return `
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        color: white;
        animation: listeningPulse 3s infinite;
        
        &:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 24px rgba(39, 174, 96, 0.3);
        }
      `;
    }
    
    return `
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
      
      &:hover {
        transform: scale(1.05);
        box-shadow: 0 12px 24px rgba(52, 152, 219, 0.3);
      }
    `;
  }}

  @keyframes recordingPulse {
    0% {
      transform: scale(1.1);
      box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.9);
    }
    70% {
      transform: scale(1.1);
      box-shadow: 0 0 0 15px rgba(231, 76, 60, 0);
    }
    100% {
      transform: scale(1.1);
      box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
    }
  }
  
  @keyframes voicePulse {
    0% {
      transform: scale(1.05);
      box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.7);
    }
    70% {
      transform: scale(1.05);
      box-shadow: 0 0 0 10px rgba(243, 156, 18, 0);
    }
    100% {
      transform: scale(1.05);
      box-shadow: 0 0 0 0 rgba(243, 156, 18, 0);
    }
  }
  
  @keyframes listeningPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(39, 174, 96, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(39, 174, 96, 0);
    }
  }
`;

const StatusText = styled.p`
  color: #7f8c8d;
  font-size: 1.1em;
  text-align: center;
  margin: 0;
  font-weight: 500;
`;

const PermissionWarning = styled.div`
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  max-width: 300px;
`;

const ErrorMessage = styled.div`
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  max-width: 300px;
`;

const TechnicalInfo = styled.div`
  background: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.8em;
  color: #6c757d;
  text-align: center;
  max-width: 300px;
`;

const AudioCapture = ({ onAudioData, onRecordingChange, enabled = true }) => {
  // Component lifecycle debugging
  console.log('🎨 AudioCapture component rendered/re-rendered', { enabled });
  
  // State
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceActivity, setVoiceActivity] = useState(false);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const maxRecordingTimerRef = useRef(null);


  // Optimized audio configuration for instant voice calling
  const audioConfig = {
    sampleRate: 24000, // Higher quality audio for better voice cloning
    channelCount: 1,
    bitsPerSample: 16,
    maxRecordingDuration: 5000, // Shorter chunks for instant transmission (5s max)
    silenceThreshold: 0.006, // More sensitive voice detection
    silenceDuration: 300, // Ultra-fast response (300ms silence)
    minRecordingDuration: 200, // Minimum 200ms for instant processing
    bufferSize: 2048, // Smaller buffer for lower latency
    vadFrequency: 50, // Check voice activity every 50ms for instant response
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up AudioCapture resources');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (maxRecordingTimerRef.current) {
      clearTimeout(maxRecordingTimerRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  }, []);

  // Request microphone access
  const requestMicrophoneAccess = useCallback(async () => {
    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
          echoCancellation: true,
          noiseSuppression: false, // Disable for emotion preservation
          autoGainControl: false,  // Disable for natural voice dynamics
          latency: 0.01, // Ultra-low latency for instant phone response
          advanced: [{ googLowLatency: true }]
        }
      });

      setHasPermission(true);
      setError('');
      
      // Get device info
      const track = stream.getAudioTracks()[0];
      const settings = track.getSettings();
      setDeviceInfo(`${settings.sampleRate}Hz, ${settings.channelCount}ch`);
      console.log('✅ Microphone access granted:', track.label || 'Default');
      console.log('📊 Audio settings:', settings);
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.error('Microphone access error:', error);
      setHasPermission(false);
      
      if (error.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access and refresh.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.');
      } else {
        setError('Failed to access microphone: ' + error.message);
      }
    }
  }, [audioConfig.sampleRate, audioConfig.channelCount]);

  // Check microphone permission
  const checkMicrophonePermission = useCallback(async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      setHasPermission(permission.state === 'granted');
      
      permission.onchange = () => {
        setHasPermission(permission.state === 'granted');
      };
    } catch (error) {
      console.warn('Permission API not supported:', error);
      // Try to request permission directly
      requestMicrophoneAccess();
    }
  }, [requestMicrophoneAccess]);

  // Initialize audio capture
  useEffect(() => {
    console.log('🔧 AudioCapture useEffect mounting/updating');
    checkMicrophonePermission();
    return () => {
      console.log('🧹 AudioCapture useEffect cleanup - component unmounting or deps changed');
      cleanup();
    };
  }, [checkMicrophonePermission, cleanup]);

  // Setup audio processing
  const setupAudioProcessing = async (stream) => {
    try {
      console.log('🔧 Setting up audio processing...');
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: audioConfig.sampleRate
      });

      // Create ultra-low-latency analyser for instant voice detection
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = audioConfig.bufferSize; // Use optimized buffer size (2048)
      analyserRef.current.smoothingTimeConstant = 0.1; // Ultra-low smoothing for instant response

      // Create source from stream
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      console.log('✅ Audio context setup successful:', {
        fftSize: analyserRef.current.fftSize,
        frequencyBinCount: analyserRef.current.frequencyBinCount,
        sampleRate: audioContextRef.current.sampleRate,
        state: audioContextRef.current.state,
        streamActive: stream.active,
        audioTracks: stream.getAudioTracks().length
      });

      // Setup MediaRecorder for audio chunks with better format
      let mediaRecorder;
      try {
        // Try to use WAV format first (better compatibility)
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/wav',
          audioBitsPerSecond: 128000
        });
      } catch (e) {
        try {
          // Fallback to WebM
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
          });
        } catch (e2) {
          // Default MediaRecorder
          mediaRecorder = new MediaRecorder(stream);
        }
      }

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('🎬 MediaRecorder started');
      };

      mediaRecorder.onstop = () => {
        console.log('🎬 MediaRecorder stopped - processing chunk');
        
        // Clear timers
        if (maxRecordingTimerRef.current) {
          clearTimeout(maxRecordingTimerRef.current);
          maxRecordingTimerRef.current = null;
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        
        // Reset recording state immediately for next voice detection
        setIsRecording(false);
        if (onRecordingChange) onRecordingChange(false);
        
        if (chunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          
          console.log('📦 Audio chunk ready for transmission:', {
            size: audioBlob.size,
            duration: recordingStartTimeRef.current ? Date.now() - recordingStartTimeRef.current : 'unknown',
            type: audioBlob.type
          });
          
          // Process immediately for real-time transmission
          if (audioBlob.size > 500) { // Lower threshold for real-time
            console.log('📡 Transmitting audio chunk to server...');
            processAudioBlob(audioBlob);
          } else {
            console.log('⚠️ Audio chunk too small, skipping');
          }
          chunksRef.current = [];
        }
        
        // Reset recording start time
        recordingStartTimeRef.current = null;
        
        console.log('🔄 Ready for next voice input...');
      };

      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;

      return true;
    } catch (error) {
      console.error('Audio processing setup error:', error);
      setError('Failed to setup audio processing: ' + error.message);
      return false;
    }
  };

  // Process audio blob to send to server
  const processAudioBlob = async (blob) => {
    try {
      console.log('🔄 Converting audio blob to base64...');
      const arrayBuffer = await blob.arrayBuffer();
      
      // Convert to base64 efficiently for large audio files
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192; // Process in chunks to avoid call stack overflow
      
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      
      const base64Audio = btoa(binary);
      console.log('🎶 Audio converted to base64:', {
        originalSize: blob.size,
        base64Length: base64Audio.length,
        hasOnAudioData: !!onAudioData
      });
      
      if (onAudioData) {
        // Get volume separately to avoid potential circular calls
        const volume = analyserRef.current ? getCurrentVolume() : 0;
        console.log('📤 Sending audio to server with volume:', volume);
        onAudioData(base64Audio, volume);
      } else {
        console.log('❌ No onAudioData callback available!');
      }
    } catch (error) {
      console.error('❌ Audio processing error:', error);
    }
  };

  // Get current volume level for visualization and VAD
  const getCurrentVolume = useCallback(() => {
    if (!analyserRef.current) {
      return 0;
    }

    // Use time domain data for better voice detection
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for better volume detection
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128; // Convert to -1 to 1 range
      sum += sample * sample;
    }
    
    const rms = Math.sqrt(sum / bufferLength);
    
    // Log volume readings for debugging (reduced frequency)
    if (Math.random() < 0.05) { // 5% of the time
      console.log(`🔊 Volume: ${rms.toFixed(4)} (threshold: ${audioConfig.silenceThreshold})`);
    }
    
    return rms;
  }, [audioConfig.silenceThreshold]);

  // Real-time Voice Activity Detection for phone call mode
  const detectVoiceActivity = useCallback(() => {
    const volume = getCurrentVolume();
    const isVoiceDetected = volume > audioConfig.silenceThreshold;
    
    setVoiceActivity(isVoiceDetected);
    
    if (isVoiceDetected) {
      // Voice detected - start recording immediately
      if (!isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        console.log('🎙️ Voice detected - starting real-time recording');
        setIsRecording(true);
        if (onRecordingChange) onRecordingChange(true);
        
        // Record start time for minimum duration check
        recordingStartTimeRef.current = Date.now();
        
        // Start recording
        chunksRef.current = [];
        mediaRecorderRef.current.start();
        
        // Set maximum recording duration timer (prevent chunks from being too long)
        maxRecordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('⏱️ Maximum recording duration reached - processing chunk');
            mediaRecorderRef.current.stop();
          }
        }, audioConfig.maxRecordingDuration);
      }
      
      // Clear silence timer (voice is active)
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // No voice detected - check if we should stop recording
      if (isRecording && !silenceTimerRef.current) {
        const recordingDuration = Date.now() - recordingStartTimeRef.current;
        
        // Only start silence timer if minimum recording duration has passed
        if (recordingDuration >= audioConfig.minRecordingDuration) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('🔇 Silence detected - processing and sending audio chunk');
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            // Recording will automatically restart when voice is detected again
          }, audioConfig.silenceDuration);
        }
      }
    }
    
    return volume;
  }, [isRecording, onRecordingChange, audioConfig.silenceThreshold, audioConfig.silenceDuration, audioConfig.minRecordingDuration, audioConfig.maxRecordingDuration, getCurrentVolume]);

  // Start ultra-responsive continuous listening with high-frequency VAD
  const startContinuousListening = () => {
    console.log('📞 Starting instant phone call mode with ultra-responsive voice detection');
    
    // Test volume detection immediately (faster)
    setTimeout(() => {
      const testVolume = getCurrentVolume();
      console.log('🧪 Initial volume test:', testVolume);
    }, 200);
    
    // Ultra-high frequency VAD for instant phone-like response
    vadIntervalRef.current = setInterval(() => {
      detectVoiceActivity();
    }, audioConfig.vadFrequency); // Check every 50ms for instant response
    
    console.log(`⚡ Instant voice calling active - ${audioConfig.vadFrequency}ms precision for real phone experience`);
  };

  // Stop continuous listening
  const stopContinuousListening = () => {
    console.log('🛑 Stopping continuous listening');
    
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    setVoiceActivity(false);
  };

  // Start continuous listening
  const startListening = async () => {
    if (!hasPermission) {
      await requestMicrophoneAccess();
      return;
    }

    try {
      console.log('🎧 Starting voice call mode...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
          echoCancellation: true,
          noiseSuppression: false, // Disable for emotion preservation
          autoGainControl: false,  // Disable for natural voice dynamics
          latency: 0.01, // Ultra-low latency for instant phone response
          advanced: [{ googLowLatency: true }]
        }
      });

      console.log('🎤 Got audio stream:', {
        active: stream.active,
        audioTracks: stream.getAudioTracks().length,
        trackLabel: stream.getAudioTracks()[0]?.label
      });

      const setupSuccess = await setupAudioProcessing(stream);
      if (!setupSuccess) return;

      setIsListening(true);
      setError('');
      
      // Resume audio context if suspended (required in modern browsers)
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        console.log('📢 Resuming audio context...');
        await audioContextRef.current.resume();
      }
      
      // Start continuous voice activity detection
      startContinuousListening();

      console.log('✅ Voice call mode activated - speak now!');

    } catch (error) {
      console.error('Start listening error:', error);
      setError('Failed to start listening: ' + error.message);
    }
  };

  // Stop listening
  const stopListening = () => {
    try {
      console.log('🛑 stopListening called - stopping entire listening session');
      stopContinuousListening();
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      setIsListening(false);
      setIsRecording(false);
      setVoiceActivity(false);
      
      if (onRecordingChange) {
        onRecordingChange(false);
      }

      console.log('✅ Entire listening session stopped');

    } catch (error) {
      console.error('Stop listening error:', error);
      setError('Failed to stop listening: ' + error.message);
    }
  };

  // Toggle listening
  const toggleListening = () => {
    if (!enabled) return;

    if (isListening) {
      console.log('🛑 User manually stopped listening');
      stopListening();
    } else {
      console.log('🎧 User starting listening mode');
      startListening();
    }
  };

  // Handle button click
  const handleButtonClick = () => {
    if (!hasPermission) {
      requestMicrophoneAccess();
    } else {
      toggleListening();
    }
  };

  // Get status text for real-time voice call
  const getStatusText = () => {
    if (!enabled) return 'Translation disabled';
    if (hasPermission === false) return 'Click to enable microphone';
    if (hasPermission === null) return 'Checking microphone...';
    if (!isListening) return 'Click to start LIVE voice call';
    if (isRecording) return '🔴 Transmitting your voice in real-time...';
    if (voiceActivity) return '🟡 Voice detected - processing...';
    return '🟢 LIVE CALL ACTIVE - speak naturally';
  };

  // Get button icon
  const getButtonIcon = () => {
    if (!enabled) return '🚫';
    if (hasPermission === false) return '🎤';
    if (hasPermission === null) return '⏳';
    if (!isListening) return '📞'; // Phone icon for call mode
    if (isRecording) return '🔴'; // Red dot when actively recording
    if (voiceActivity) return '🟡'; // Yellow when voice detected
    return '🟢'; // Green when listening
  };

  return (
    <CaptureContainer>
      <RecordButton
        $recording={isRecording}
        $listening={isListening}
        $voiceActivity={voiceActivity}
        $enabled={enabled && hasPermission}
        onClick={handleButtonClick}
        disabled={!enabled}
      >
        {getButtonIcon()}
      </RecordButton>

      <StatusText>{getStatusText()}</StatusText>

      {hasPermission === false && (
        <PermissionWarning>
          Microphone access is required for voice translation.
          Please click the button above and allow microphone access.
        </PermissionWarning>
      )}

      {error && (
        <ErrorMessage>
          {error}
        </ErrorMessage>
      )}

      {deviceInfo && hasPermission && (
        <TechnicalInfo>
          Audio: {deviceInfo}
        </TechnicalInfo>
      )}
    </CaptureContainer>
  );
};

export default AudioCapture;
