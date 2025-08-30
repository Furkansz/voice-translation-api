import React from 'react';
import styled from 'styled-components';

const MonitorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 15px;
  border: 1px solid #dee2e6;
`;

const LatencyItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
`;

const LatencyLabel = styled.span`
  font-size: 0.8em;
  color: #6c757d;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const LatencyValue = styled.span`
  font-size: 1.2em;
  font-weight: bold;
  color: ${props => {
    if (props.value <= 500) return '#27ae60';  // Good (green)
    if (props.value <= 1000) return '#f39c12'; // Warning (orange)
    return '#e74c3c';                          // Poor (red)
  }};
`;

const QualityIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 600;
  
  ${props => {
    if (props.$quality === 'good') {
      return `
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
      `;
    }
    if (props.$quality === 'warning') {
      return `
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
      `;
    }
    return `
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    `;
  }}
`;

const QualityDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => {
    if (props.$quality === 'good') return '#27ae60';
    if (props.$quality === 'warning') return '#f39c12';
    return '#e74c3c';
  }};
`;

const LatencyMonitor = ({ latencyStats }) => {
  const { current = 0, average = 0 } = latencyStats;

  // Determine quality based on average latency
  const getQuality = (latency) => {
    if (latency <= 500) return 'good';
    if (latency <= 1000) return 'warning';
    return 'poor';
  };

  const getQualityText = (quality) => {
    switch (quality) {
      case 'good':
        return 'Excellent Connection';
      case 'warning':
        return 'Good Connection';
      default:
        return 'Poor Connection';
    }
  };

  const overallQuality = getQuality(Math.max(current, average));

  return (
    <MonitorContainer>
      <LatencyItem>
        <LatencyLabel>Current</LatencyLabel>
        <LatencyValue value={current}>
          {current > 0 ? `${current}ms` : '--'}
        </LatencyValue>
      </LatencyItem>

      <LatencyItem>
        <LatencyLabel>Average</LatencyLabel>
        <LatencyValue value={average}>
          {average > 0 ? `${average}ms` : '--'}
        </LatencyValue>
      </LatencyItem>

      <QualityIndicator $quality={overallQuality}>
        <QualityDot $quality={overallQuality} />
        {getQualityText(overallQuality)}
      </QualityIndicator>
    </MonitorContainer>
  );
};

export default LatencyMonitor;
