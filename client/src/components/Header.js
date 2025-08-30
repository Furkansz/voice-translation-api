import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoIcon = styled.div`
  font-size: 2em;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const LogoText = styled.h1`
  font-size: 1.5em;
  font-weight: 300;
  color: #2c3e50;
  margin: 0;
  
  @media (max-width: 768px) {
    font-size: 1.2em;
  }
`;

const SubTitle = styled.div`
  font-size: 0.8em;
  color: #7f8c8d;
  font-weight: 400;
  margin-top: -2px;
`;

const InfoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 15px;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(52, 152, 219, 0.2);
`;

const InfoLabel = styled.span`
  font-size: 0.7em;
  color: #7f8c8d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const InfoValue = styled.span`
  font-size: 0.9em;
  color: #2c3e50;
  font-weight: bold;
  margin-top: 2px;
`;

const LanguageIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 20px;
  font-size: 0.85em;
  font-weight: 600;
`;

const Header = () => {
  return (
    <HeaderContainer>
      <Logo>
        <LogoIcon>🏥</LogoIcon>
        <div>
          <LogoText>Hospital Voice Translator</LogoText>
          <SubTitle>Real-time Medical Translation System</SubTitle>
        </div>
      </Logo>

      <InfoSection>
        <InfoItem>
          <InfoLabel>Latency Target</InfoLabel>
          <InfoValue>&lt; 1 second</InfoValue>
        </InfoItem>

        <InfoItem>
          <InfoLabel>Languages</InfoLabel>
          <InfoValue>TR ↔ EN</InfoValue>
        </InfoItem>

        <LanguageIndicator>
          <span>🔊</span>
          <span>Voice Cloning Active</span>
        </LanguageIndicator>
      </InfoSection>
    </HeaderContainer>
  );
};

export default Header;
