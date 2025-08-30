import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const TranscriptContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 500px;
`;

const LiveSection = styled.div`
  margin-bottom: 20px;
`;

const LiveBox = styled.div`
  background: ${props => props.type === 'transcript' ? '#f8f9fa' : '#e8f5e8'};
  border: 2px solid ${props => props.type === 'transcript' ? '#dee2e6' : '#27ae60'};
  border-radius: 12px;
  padding: 15px;
  min-height: 60px;
  margin-bottom: 10px;
  position: relative;
  overflow-wrap: break-word;
`;

const LiveLabel = styled.div`
  font-size: 0.8em;
  font-weight: bold;
  color: ${props => props.type === 'transcript' ? '#6c757d' : '#27ae60'};
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const LiveText = styled.div`
  font-size: 1.1em;
  line-height: 1.4;
  color: #2c3e50;
  min-height: 20px;
  
  ${props => props.$empty && `
    color: #adb5bd;
    font-style: italic;
  `}
`;

const HistorySection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const HistoryLabel = styled.h4`
  color: #495057;
  margin: 0 0 15px 0;
  font-size: 1.1em;
  font-weight: 600;
`;

const HistoryContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 15px;
  border: 1px solid #dee2e6;
  max-height: 300px;
`;

const HistoryItem = styled.div`
  margin-bottom: 15px;
  padding: 12px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-left: 4px solid ${props => props.speaker === 'you' ? '#3498db' : '#e67e22'};
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const SpeakerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85em;
  font-weight: 600;
  color: ${props => props.speaker === 'you' ? '#3498db' : '#e67e22'};
`;

const Timestamp = styled.div`
  font-size: 0.75em;
  color: #6c757d;
`;

const HistoryText = styled.div`
  margin-bottom: 8px;
  line-height: 1.4;
  color: #2c3e50;
`;

const TranslationText = styled.div`
  font-style: italic;
  color: #27ae60;
  background: #f8fff8;
  padding: 8px;
  border-radius: 6px;
  border-left: 3px solid #27ae60;
  margin-top: 8px;
`;

const LanguageTag = styled.span`
  background: ${props => props.language === 'en' ? '#3498db' : '#e67e22'};
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7em;
  font-weight: bold;
  text-transform: uppercase;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #adb5bd;
  font-style: italic;
  padding: 40px 20px;
`;

const ConfidenceIndicator = styled.div`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
  background: ${props => {
    if (props.confidence > 0.8) return '#27ae60';
    if (props.confidence > 0.6) return '#f39c12';
    return '#e74c3c';
  }};
`;

const TranscriptDisplay = ({ 
  currentTranscript, 
  currentTranslation, 
  transcriptHistory, 
  userLanguage, 
  partnerLanguage 
}) => {
  const historyEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptHistory]);

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Get language name
  const getLanguageName = (langCode) => {
    const languages = { en: 'English', tr: 'Türkçe' };
    return languages[langCode] || langCode;
  };

  // Get speaker emoji
  const getSpeakerEmoji = (speaker) => {
    return speaker === 'you' ? '🗣️' : '👥';
  };

  // Group history items by conversation flow
  const groupedHistory = transcriptHistory.reduce((groups, item, index) => {
    if (item.type === 'translation') {
      const prevItem = transcriptHistory[index - 1];
      if (prevItem && prevItem.type === 'transcript' && 
          prevItem.text === item.originalText) {
        // This translation belongs to the previous transcript
        const lastGroup = groups[groups.length - 1];
        if (lastGroup) {
          lastGroup.translation = item;
        }
      } else {
        // This is a standalone translation (from partner)
        groups.push({
          transcript: null,
          translation: item,
          timestamp: item.timestamp
        });
      }
    } else {
      // This is a transcript
      groups.push({
        transcript: item,
        translation: null,
        timestamp: item.timestamp
      });
    }
    return groups;
  }, []);

  return (
    <TranscriptContainer>
      {/* Live Transcription Section */}
      <LiveSection>
        <LiveBox type="transcript">
          <LiveLabel type="transcript">
            Live Transcription ({getLanguageName(userLanguage)})
          </LiveLabel>
          <LiveText $empty={!currentTranscript}>
            {currentTranscript || 'Start speaking to see transcription...'}
          </LiveText>
        </LiveBox>

        <LiveBox type="translation">
          <LiveLabel type="translation">
            Live Translation ({getLanguageName(partnerLanguage)})
          </LiveLabel>
          <LiveText $empty={!currentTranslation}>
            {currentTranslation || 'Translation will appear here...'}
          </LiveText>
        </LiveBox>
      </LiveSection>

      {/* History Section */}
      <HistorySection>
        <HistoryLabel>Conversation History</HistoryLabel>
        <HistoryContainer>
          {groupedHistory.length === 0 ? (
            <EmptyState>
              Conversation history will appear here as you speak
            </EmptyState>
          ) : (
            groupedHistory.map((group, index) => (
              <HistoryItem 
                key={index} 
                speaker={group.transcript?.speaker || group.translation?.speaker}
              >
                <HistoryHeader>
                  <SpeakerInfo speaker={group.transcript?.speaker || group.translation?.speaker}>
                    <span>{getSpeakerEmoji(group.transcript?.speaker || group.translation?.speaker)}</span>
                    <span>
                      {(group.transcript?.speaker || group.translation?.speaker) === 'you' ? 'You' : 'Partner'}
                    </span>
                    {group.transcript && (
                      <LanguageTag language={group.transcript.language}>
                        {group.transcript.language}
                      </LanguageTag>
                    )}
                    {group.transcript?.confidence && (
                      <ConfidenceIndicator confidence={group.transcript.confidence} />
                    )}
                  </SpeakerInfo>
                  <Timestamp>
                    {formatTimestamp(group.timestamp)}
                  </Timestamp>
                </HistoryHeader>

                {/* Original Text */}
                {group.transcript && (
                  <HistoryText>
                    {group.transcript.text}
                  </HistoryText>
                )}

                {/* Translation */}
                {group.translation && (
                  <TranslationText>
                    <strong>Translation:</strong> {group.translation.translatedText}
                    {group.translation.targetLanguage && (
                      <LanguageTag 
                        language={group.translation.targetLanguage}
                        style={{ marginLeft: '8px' }}
                      >
                        {group.translation.targetLanguage}
                      </LanguageTag>
                    )}
                  </TranslationText>
                )}

                {/* If we only have translation (partner speaking) */}
                {!group.transcript && group.translation && (
                  <>
                    <HistoryText>
                      <strong>Original:</strong> {group.translation.originalText}
                      <LanguageTag 
                        language={group.translation.sourceLanguage}
                        style={{ marginLeft: '8px' }}
                      >
                        {group.translation.sourceLanguage}
                      </LanguageTag>
                    </HistoryText>
                    <TranslationText>
                      <strong>Translation:</strong> {group.translation.translatedText}
                    </TranslationText>
                  </>
                )}
              </HistoryItem>
            ))
          )}
          <div ref={historyEndRef} />
        </HistoryContainer>
      </HistorySection>
    </TranscriptContainer>
  );
};

export default TranscriptDisplay;
