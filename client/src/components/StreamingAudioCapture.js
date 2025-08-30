import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import styled from 'styled-components';

const CaptureContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  padding: 20px;
`;

const StreamButton = styled.button`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: none;
  font-size: 2.5em;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
  
  ${props => {
    if (!props.$enabled) {
      return `
        background: #bdc3c7;
        color: white;
        cursor: not-allowed;
      `;
    }
    
    if (props.$streaming) {
      return `
        background: linear-gradient(135deg, #27ae60, #2ecc71);
        color: white;
        animation: streamingPulse 1s infinite;
      `;
    }
    
    return `
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
      
      &:hover {
        transform: scale(1.05);
        box-shadow: 0 8px 16px rgba(52, 152, 219, 0.3);
      }
    `;
  }}

  @keyframes streamingPulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.7);
    }
    70% {
      transform: scale(1);
      box-shadow: 0 0 0 10px rgba(39, 174, 96, 0);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(39, 174, 96, 0);
    }
  }
`;

const StatusText = styled.div`
  font-size: 1em;
  font-weight: bold;
  color: #2c3e50;
  text-align: center;
`;

const VolumeIndicator = styled.div`
  width: 200px;
  height: 4px;
  background: #ecf0f1;
  border-radius: 2px;
  overflow: hidden;
`;

const VolumeLevel = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #2ecc71, #f39c12, #e74c3c);
  width: ${props => props.$level || 0}%;
  transition: width 0.1s ease;
`;

const StreamingAudioCapture = ({ onAudioData, onStreamingChange, enabled = true }) => {
  console.log('🎤 StreamingAudioCapture render, enabled:', enabled);
  
  // State
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const streamIntervalRef = useRef(null);

  // Real-time audio configuration (memoized to prevent dependency changes)
  const audioConfig = useMemo(() => ({
    sampleRate: 16000, // Optimized for transcription
    channelCount: 1,
    bufferSize: 2048, // Smaller buffer for lower latency
    vadThreshold: 0.008, // More sensitive voice detection
    streamInterval: 50, // Send audio every 50ms for ultra-real-time
    maxSilence: 800, // 800ms of silence before stopping
    minChunkSize: 1600, // Minimum samples (100ms at 16kHz)
  }), []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up streaming audio...');
    
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsStreaming(false);
    setAudioLevel(0);
  }, []);

  // Check microphone permission
  const checkMicrophonePermission = useCallback(async () => {
    try {
      console.log('🎤 Checking microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0.01
        } 
      });
      
      console.log('✅ Microphone permission granted');
      setHasPermission(true);
      setError('');
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setHasPermission(false);
      setError('Microphone access required for real-time translation');
    }
  }, [audioConfig.sampleRate, audioConfig.channelCount]);

  // Initialize component
  useEffect(() => {
    checkMicrophonePermission();
    return cleanup;
  }, [checkMicrophonePermission, cleanup]);

  // Start real-time audio streaming
  const startStreaming = useCallback(async () => {
    try {
      console.log('🎙️ Starting real-time audio streaming...');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: audioConfig.sampleRate,
          channelCount: audioConfig.channelCount,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          latency: 0.01
        }
      });
      
      streamRef.current = stream;
      
      // Create audio context
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: audioConfig.sampleRate
      });
      
      // Create analyser for volume detection
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.3;
      
      // Create source from microphone
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      
      // Create script processor for real-time audio data
      scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(
        audioConfig.bufferSize, 
        audioConfig.channelCount, 
        audioConfig.channelCount
      );
      
      let audioBuffer = [];
      let lastVoiceTime = Date.now();
      
      scriptProcessorRef.current.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const volume = Math.min(100, rms * 1000);
        setAudioLevel(volume);
        
        // Voice activity detection
        // If speaker is currently playing TTS on this device, we can optionally suppress mic streaming to avoid echo
        const isVoiceActive = rms > audioConfig.vadThreshold;
        
        if (isVoiceActive) {
          lastVoiceTime = Date.now();
        }
        
        // Always add to buffer to keep connection alive (voice or silence)
        audioBuffer.push(...inputData);
        
        // Send audio data in real-time chunks
        if (audioBuffer.length >= audioConfig.minChunkSize) {
          if (onAudioData) {
            // Convert to proper format for Deepgram (16-bit PCM)
            const audioArray = new Float32Array(audioBuffer);
            const pcmBuffer = new Int16Array(audioArray.length);
            
            // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
            for (let i = 0; i < audioArray.length; i++) {
              const sample = Math.max(-1, Math.min(1, audioArray[i]));
              pcmBuffer[i] = sample * 32767;
            }
            
            // Convert to base64 for transmission (raw PCM data)
            const uint8Array = new Uint8Array(pcmBuffer.buffer);
            // Avoid stack overflow for large buffers: chunk the conversion
            let base64 = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
              base64 += btoa(String.fromCharCode.apply(null, chunk));
            }
            
            const timeSinceVoice = Date.now() - lastVoiceTime;
            console.log('📡 Sending real-time PCM audio:', {
              samples: audioArray.length,
              duration: (audioArray.length / audioConfig.sampleRate * 1000).toFixed(1) + 'ms',
              volume: volume.toFixed(2),
              voiceActive: isVoiceActive ? '🎤' : '🔇',
              timeSinceVoice: timeSinceVoice + 'ms'
            });
            
            onAudioData(base64, volume);
          }
          
          audioBuffer = [];
        }
      };
      
      // Connect script processor
      sourceRef.current.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(audioContextRef.current.destination);
      
      setIsStreaming(true);
      if (onStreamingChange) onStreamingChange(true);
      setError('');
      
      console.log('✅ Real-time audio streaming started');
      
    } catch (error) {
      console.error('❌ Failed to start streaming:', error);
      setError(`Failed to start audio streaming: ${error.message}`);
      cleanup();
    }
  }, [audioConfig, onAudioData, onStreamingChange, cleanup]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    console.log('⏹️ Stopping audio streaming...');
    cleanup();
    if (onStreamingChange) onStreamingChange(false);
  }, [cleanup, onStreamingChange]);

  // Handle button click
  const handleButtonClick = useCallback(async () => {
    if (!enabled || hasPermission === false) {
      await checkMicrophonePermission();
      return;
    }
    
    if (isStreaming) {
      stopStreaming();
    } else {
      await startStreaming();
    }
  }, [enabled, hasPermission, isStreaming, checkMicrophonePermission, stopStreaming, startStreaming]);

  // Get status text
  const getStatusText = () => {
    if (!enabled) return 'Audio capture disabled';
    if (hasPermission === false) return 'Click to enable microphone';
    if (hasPermission === null) return 'Checking microphone...';
    if (isStreaming) return '🔴 LIVE - Speaking in real-time';
    return 'Click to start real-time translation';
  };

  // Get button icon
  const getButtonIcon = () => {
    if (!enabled) return '🚫';
    if (hasPermission === false) return '🎤';
    if (hasPermission === null) return '⏳';
    if (isStreaming) return '⏹️';
    return '▶️';
  };

  return (
    <CaptureContainer>
      <StreamButton
        $streaming={isStreaming}
        $enabled={enabled && hasPermission}
        onClick={handleButtonClick}
        disabled={!enabled}
      >
        {getButtonIcon()}
      </StreamButton>

      <StatusText>{getStatusText()}</StatusText>

      {isStreaming && (
        <VolumeIndicator>
          <VolumeLevel $level={audioLevel} />
        </VolumeIndicator>
      )}

      {error && (
        <div style={{
          background: '#ffe6e6',
          border: '1px solid #ff6b6b',
          color: '#d63031',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '0.9em',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
    </CaptureContainer>
  );
};

export default StreamingAudioCapture;
