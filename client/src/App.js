import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import io from 'socket.io-client';

// Components
import VoiceSetup from './components/VoiceSetup';
import TranslationSession from './components/TranslationSession';
import Header from './components/Header';
import LoadingScreen from './components/LoadingScreen';

// Styled components
const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
`;

const ErrorContainer = styled.div`
  background: #ff6b6b;
  color: white;
  padding: 15px;
  border-radius: 8px;
  margin: 10px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const ConnectionStatus = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 15px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  z-index: 1000;
  
  ${props => props.$connected ? `
    background: #27ae60;
    color: white;
  ` : `
    background: #e74c3c;
    color: white;
  `}
`;

function App() {
  // State management
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize socket connection
  useEffect(() => {
    const initializeSocket = () => {
      try {
        const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
        const newSocket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          upgrade: true,
          rememberUpgrade: true,
          timeout: 20000,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
          maxReconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
          console.log('Connected to server');
          setConnected(true);
          setError(null);
          setLoading(false);
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Disconnected from server:', reason);
          setConnected(false);
          
          // Show different messages based on disconnect reason
          if (reason === 'io server disconnect') {
            setError('Server disconnected. Please refresh the page.');
          } else if (reason === 'transport close') {
            setError('Connection lost. Attempting to reconnect...');
          }
        });

        newSocket.on('reconnect', (attemptNumber) => {
          console.log('Reconnected to server on attempt', attemptNumber);
          setConnected(true);
          setError(null);
        });

        newSocket.on('reconnect_attempt', (attemptNumber) => {
          console.log('Attempting to reconnect...', attemptNumber);
          setError(`Reconnecting... (attempt ${attemptNumber})`);
        });

        newSocket.on('reconnect_error', (error) => {
          console.error('Reconnection failed:', error);
          setError('Failed to reconnect. Please refresh the page.');
        });

        newSocket.on('reconnect_failed', () => {
          console.error('All reconnection attempts failed');
          setError('Connection failed. Please check your internet and refresh the page.');
        });

        newSocket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          setError('Failed to connect to server. Please check your connection.');
          setConnected(false);
          setLoading(false);
        });

        newSocket.on('error', (error) => {
          console.error('Socket error:', error);
          // Handle different error types properly
          let errorMessage = 'An error occurred';
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error && error.message) {
            errorMessage = error.message;
          } else if (error && error.type) {
            errorMessage = `Connection error: ${error.type}`;
          } else if (error) {
            errorMessage = JSON.stringify(error);
          }
          setError(errorMessage);
        });

        newSocket.on('session-joined', (data) => {
          console.log('🎯 CLIENT: Session joined:', data);
          console.log(`📋 CLIENT: Setting sessionData with sessionId: ${data.sessionId}`);
          setSessionData(data);
        });

        newSocket.on('session-ready', (data) => {
          console.log('Session ready:', data);
          setSessionData(prev => ({
            ...prev,
            ready: true,
            partnerLanguage: data.partnerLanguage,
            partnerRole: data.partnerRole
          }));
        });

        newSocket.on('waiting-for-partner', (data) => {
          console.log('Waiting for partner:', data);
          setSessionData(prev => ({
            ...prev,
            waiting: true,
            waitingFor: data.role
          }));
        });

        newSocket.on('partner-disconnected', (data) => {
          console.log('Partner disconnected:', data);
          setError(data.message);
          setSessionData(null);
        });

        // Handle server heartbeat
        newSocket.on('heartbeat-ping', () => {
          newSocket.emit('heartbeat-pong');
        });

        setSocket(newSocket);

        return () => {
          newSocket.close();
        };
      } catch (error) {
        console.error('Socket initialization error:', error);
        setError('Failed to initialize connection');
        setLoading(false);
      }
    };

    const cleanup = initializeSocket();
    return cleanup;
  }, []);

  // Handle voice setup completion
  const handleVoiceSetupComplete = (profileData) => {
    console.log('Voice setup complete:', profileData);
    setUserProfile(profileData);
    
    if (socket && profileData.voiceId) {
      // Join session with the cloned voice
      socket.emit('join-session', {
        role: profileData.role,
        language: profileData.language,
        voiceId: profileData.voiceId
      });
    }
  };

  // Handle session end
  const handleSessionEnd = () => {
    setSessionData(null);
    setUserProfile(null);
    if (socket) {
      socket.disconnect();
      // Reconnect for a new session
      window.location.reload();
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Render loading screen
  if (loading) {
    return (
      <AppContainer>
        <LoadingScreen message="Connecting to server..." />
      </AppContainer>
    );
  }

  // Render error state
  if (error && !connected) {
    return (
      <AppContainer>
        <Header />
        <MainContent>
          <ErrorContainer>
            <h3>Connection Error</h3>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: 'white',
                color: '#e74c3c',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '10px'
              }}
            >
              Retry Connection
            </button>
          </ErrorContainer>
        </MainContent>
      </AppContainer>
    );
  }

  return (
    <Router>
      <AppContainer>
        <Header />
        
        {/* Connection status indicator */}
        <ConnectionStatus $connected={connected}>
          {connected ? 'Connected' : 'Disconnected'}
        </ConnectionStatus>

        {/* Error display */}
        {error && (
          <ErrorContainer>
            <strong>Error:</strong> {error}
            <button 
              onClick={clearError}
              style={{
                background: 'transparent',
                border: '1px solid white',
                color: 'white',
                padding: '5px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
            >
              Dismiss
            </button>
          </ErrorContainer>
        )}

        <MainContent>
          <Routes>
            <Route 
              path="/" 
              element={
                !userProfile ? (
                  <VoiceSetup onComplete={handleVoiceSetupComplete} />
                ) : sessionData && sessionData.ready ? (
                  <TranslationSession 
                    socket={socket}
                    userProfile={userProfile}
                    sessionData={sessionData}
                    onSessionEnd={handleSessionEnd}
                  />
                ) : (
                  <LoadingScreen 
                    message={
                      sessionData && sessionData.waiting 
                        ? `Waiting for ${sessionData.waitingFor}...`
                        : 'Setting up your session...'
                    }
                  />
                )
              } 
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </MainContent>
      </AppContainer>
    </Router>
  );
}

export default App;
