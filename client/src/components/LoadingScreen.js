import React from 'react';
import styled, { keyframes } from 'styled-components';

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  text-align: center;
`;

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const LoadingIcon = styled.div`
  font-size: 4em;
  margin-bottom: 20px;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const LoadingText = styled.h3`
  color: #2c3e50;
  margin: 0 0 15px 0;
  font-size: 1.4em;
  font-weight: 300;
`;

const LoadingSubtext = styled.p`
  color: #7f8c8d;
  margin: 0 0 30px 0;
  font-size: 1em;
  line-height: 1.5;
`;

const SpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 20px;
`;

const Spinner = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  animation: ${spin} 1s ease-in-out infinite;
  animation-delay: ${props => props.delay || '0s'};
`;

const ProgressContainer = styled.div`
  width: 100%;
  max-width: 300px;
  margin-top: 20px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: #ecf0f1;
  border-radius: 3px;
  overflow: hidden;
`;

const progressAnimation = keyframes`
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const ProgressFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
  animation: ${progressAnimation} 2s ease-in-out infinite;
`;

const StatusList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 20px 0 0 0;
  text-align: left;
`;

const StatusItem = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 0;
  color: #7f8c8d;
  font-size: 0.9em;
`;

const StatusIcon = styled.span`
  color: #27ae60;
  font-weight: bold;
`;

const LoadingScreen = ({ 
  message = "Loading...", 
  subtext = null, 
  showProgress = true,
  statusItems = null 
}) => {
  const getLoadingIcon = () => {
    if (message.toLowerCase().includes('connect')) return '🔗';
    if (message.toLowerCase().includes('voice')) return '🎤';
    if (message.toLowerCase().includes('wait')) return '⏳';
    if (message.toLowerCase().includes('session')) return '💬';
    return '⚡';
  };

  const defaultStatusItems = [
    'Initializing voice processing',
    'Connecting to translation services',
    'Setting up real-time communication',
    'Preparing session environment'
  ];

  return (
    <LoadingContainer>
      <LoadingIcon>
        {getLoadingIcon()}
      </LoadingIcon>

      <LoadingText>{message}</LoadingText>

      {subtext && (
        <LoadingSubtext>{subtext}</LoadingSubtext>
      )}

      <SpinnerContainer>
        <Spinner delay="0s" />
        <Spinner delay="0.2s" />
        <Spinner delay="0.4s" />
      </SpinnerContainer>

      {showProgress && (
        <ProgressContainer>
          <ProgressBar>
            <ProgressFill />
          </ProgressBar>
        </ProgressContainer>
      )}

      {statusItems && (
        <StatusList>
          {statusItems.map((item, index) => (
            <StatusItem key={index}>
              <StatusIcon>✓</StatusIcon>
              {item}
            </StatusItem>
          ))}
        </StatusList>
      )}

      {!statusItems && message.toLowerCase().includes('connect') && (
        <StatusList>
          {defaultStatusItems.map((item, index) => (
            <StatusItem key={index}>
              <StatusIcon>✓</StatusIcon>
              {item}
            </StatusItem>
          ))}
        </StatusList>
      )}
    </LoadingContainer>
  );
};

export default LoadingScreen;
