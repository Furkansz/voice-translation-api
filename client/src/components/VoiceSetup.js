import React, { useState, useRef, useMemo } from 'react';
import styled from 'styled-components';
import axios from 'axios';

const SetupContainer = styled.div`
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const Title = styled.h1`
  color: #2c3e50;
  margin-bottom: 10px;
  font-size: 2.5em;
  font-weight: 300;
`;

const Subtitle = styled.p`
  color: #7f8c8d;
  margin-bottom: 40px;
  font-size: 1.2em;
  line-height: 1.5;
`;

const StepContainer = styled.div`
  margin-bottom: 30px;
`;

const StepTitle = styled.h3`
  color: #34495e;
  margin-bottom: 15px;
  font-size: 1.3em;
`;

const RoleButtonGroup = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;
`;

const RoleButton = styled.button`
  padding: 15px 30px;
  border: 2px solid ${props => props.selected ? '#3498db' : '#bdc3c7'};
  background: ${props => props.selected ? '#3498db' : 'white'};
  color: ${props => props.selected ? 'white' : '#34495e'};
  border-radius: 10px;
  font-size: 1.1em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`;

const LanguageSelect = styled.select`
  padding: 15px 20px;
  border: 2px solid #bdc3c7;
  border-radius: 10px;
  font-size: 1.1em;
  width: 200px;
  margin: 0 auto;
  background: white;
  color: #34495e;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #3498db;
  }
`;

const FileUploadArea = styled.div`
  border: 3px dashed ${props => props.$dragOver ? '#3498db' : '#bdc3c7'};
  border-radius: 15px;
  padding: 40px 20px;
  margin: 20px 0;
  background: ${props => props.$dragOver ? '#f8f9fa' : '#fafafa'};
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    border-color: #3498db;
    background: #f8f9fa;
  }
`;

const FileInput = styled.input`
  display: none;
`;

const UploadIcon = styled.div`
  font-size: 3em;
  color: #3498db;
  margin-bottom: 15px;
`;

const UploadText = styled.p`
  color: #7f8c8d;
  font-size: 1.1em;
  margin: 0;
`;

const SelectedFile = styled.div`
  background: #e8f5e8;
  border: 1px solid #27ae60;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  color: #27ae60;
  font-weight: bold;
`;

const ProcessButton = styled.button`
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 25px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 20px;
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(52, 152, 219, 0.3);
  }

  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s ease-in-out infinite;
  margin-right: 10px;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  background: #ffe6e6;
  border: 1px solid #ff6b6b;
  color: #d63031;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
  font-weight: bold;
`;

const SuccessMessage = styled.div`
  background: #e8f5e8;
  border: 1px solid #27ae60;
  color: #27ae60;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
  font-weight: bold;
`;

const TestingModeToggle = styled.div`
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
  text-align: left;
`;

const ToggleButton = styled.button`
  background: ${props => props.active ? '#28a745' : '#6c757d'};
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  font-weight: bold;
  cursor: pointer;
  margin-top: 10px;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-1px);
  }
`;

const TestingInfo = styled.div`
  background: #e7f3ff;
  border: 1px solid #007bff;
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
  color: #0056b3;
  font-size: 0.9em;
`;

const VoiceSetup = ({ onComplete }) => {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testingMode, setTestingMode] = useState(true); // Default to testing mode
  
  const fileInputRef = useRef(null);

  // Pre-configured voice IDs for testing (to avoid ElevenLabs clone limits)
  const testingVoiceIds = {
    doctor: {
      voiceId: 'DiP1Rqe7XnBlriQqUvQK',
      language: 'tr',
      name: 'Doctor Voice (Turkish)'
    },
    patient: {
      voiceId: 'j9VKhOt1XPLj283lSboj', 
      language: 'en',
      name: 'Patient Voice (English)'
    }
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'tr', name: 'Türkçe (Turkish)' }
  ];

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setError('');
    
    // In testing mode, automatically set language based on role
    if (testingMode) {
      setSelectedLanguage(testingVoiceIds[role]?.language || '');
    }
  };

  const handleLanguageSelect = (e) => {
    setSelectedLanguage(e.target.value);
    setError('');
  };

  const handleFileSelect = (file) => {
    // Validate file type
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (MP3, WAV, M4A, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');
    setSuccess('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Memoized validation result
  const isFormValid = useMemo(() => {
    if (testingMode) {
      // In testing mode, only need role selection (language is auto-set)
      return selectedRole && selectedLanguage;
    } else {
      // In normal mode, need all fields including file
      return selectedRole && selectedLanguage && selectedFile;
    }
  }, [selectedRole, selectedLanguage, selectedFile, testingMode]);

  const handleSubmit = async () => {
    if (!isFormValid) {
      if (!selectedRole) {
        setError('Please select your role (Doctor or Patient)');
        return;
      }
      
      if (!selectedLanguage) {
        setError('Please select your language');
        return;
      }
      
      if (!testingMode && !selectedFile) {
        setError('Please upload a voice sample');
        return;
      }
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      if (testingMode) {
        // Use predefined voice IDs for testing
        const voiceConfig = testingVoiceIds[selectedRole];
        
        if (!voiceConfig) {
          setError('Invalid role selected for testing mode');
          return;
        }

        setSuccess('Using pre-configured voice for testing! Connecting to session...');
        
        // Complete setup immediately with predefined voice ID
        setTimeout(() => {
          onComplete({
            role: selectedRole,
            language: selectedLanguage,
            voiceId: voiceConfig.voiceId,
            fileName: voiceConfig.name,
            testingMode: true
          });
        }, 1000);
        
      } else {
        // Normal mode: upload file and clone voice
        const formData = new FormData();
        formData.append('voiceFile', selectedFile);
        formData.append('language', selectedLanguage);
        formData.append('role', selectedRole);

        const response = await axios.post('/api/upload-voice', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 second timeout for voice processing
        });

        if (response.data.success) {
          setSuccess('Voice cloned successfully! Connecting to session...');
          
          // Complete setup and pass data to parent
          setTimeout(() => {
            onComplete({
              role: selectedRole,
              language: selectedLanguage,
              voiceId: response.data.voiceId,
              fileName: selectedFile.name,
              testingMode: false
            });
          }, 1500);
        } else {
          setError(response.data.error || 'Voice cloning failed');
        }
      }
    } catch (error) {
      console.error('Voice setup error:', error);
      
      if (error.code === 'ECONNABORTED') {
        setError('Voice processing timeout. Please try with a shorter audio file.');
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Failed to process voice. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SetupContainer>
      <Title>Hospital Voice Translator</Title>
      <Subtitle>
        Set up your voice profile to begin real-time translation sessions.
        Your voice will be cloned to preserve natural communication.
      </Subtitle>

      {/* Testing Mode Toggle */}
      <TestingModeToggle>
        <strong>🧪 Voice Cloning Mode</strong>
        <p style={{ margin: '10px 0', fontSize: '0.9em' }}>
          Due to ElevenLabs API limits, use Testing Mode with pre-configured voices for development.
        </p>
        <ToggleButton 
          active={testingMode}
          onClick={() => {
            setTestingMode(!testingMode);
            setSelectedRole('');
            setSelectedLanguage('');
            setSelectedFile(null);
            setError('');
          }}
        >
          {testingMode ? '✅ Testing Mode (Use Pre-configured Voices)' : '🎤 Production Mode (Clone New Voice)'}
        </ToggleButton>
      </TestingModeToggle>

      {testingMode && (
        <TestingInfo>
          <strong>🎯 Testing Mode Active</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px', fontSize: '0.9em' }}>
            <li>Doctor role → Turkish voice (DiP1Rqe7XnBlriQqUvQK)</li>
            <li>Patient role → English voice (j9VKhOt1XPLj283lSboj)</li>
            <li>No file upload required - instant setup!</li>
          </ul>
        </TestingInfo>
      )}

      {/* Step 1: Role Selection */}
      <StepContainer>
        <StepTitle>1. Select Your Role</StepTitle>
        <RoleButtonGroup>
          <RoleButton
            selected={selectedRole === 'doctor'}
            onClick={() => handleRoleSelect('doctor')}
          >
            👨‍⚕️ Doctor
          </RoleButton>
          <RoleButton
            selected={selectedRole === 'patient'}
            onClick={() => handleRoleSelect('patient')}
          >
            🤒 Patient
          </RoleButton>
        </RoleButtonGroup>
      </StepContainer>

      {/* Step 2: Language Selection */}
      <StepContainer>
        <StepTitle>2. {testingMode ? 'Language (Auto-selected)' : 'Select Your Language'}</StepTitle>
        {testingMode ? (
          <div style={{ 
            padding: '15px', 
            background: '#f8f9fa', 
            border: '2px solid #28a745', 
            borderRadius: '10px',
            color: '#155724',
            fontWeight: 'bold'
          }}>
            {selectedRole && selectedLanguage ? (
              `✅ ${selectedRole === 'doctor' ? 'Turkish (Türkçe)' : 'English'} - Auto-selected for ${selectedRole}`
            ) : (
              'Select a role first to auto-assign language'
            )}
          </div>
        ) : (
          <LanguageSelect
            value={selectedLanguage}
            onChange={handleLanguageSelect}
          >
            <option value="">Choose Language</option>
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </LanguageSelect>
        )}
      </StepContainer>

      {/* Step 3: Voice Upload (Only in Production Mode) */}
      {!testingMode && (
        <StepContainer>
          <StepTitle>3. Upload Voice Sample</StepTitle>
          <p style={{ color: '#7f8c8d', marginBottom: '15px' }}>
            Upload a clear audio recording of your voice (30-60 seconds recommended)
          </p>
          
          <FileUploadArea
            $dragOver={dragOver}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadClick}
          >
            <UploadIcon>🎤</UploadIcon>
            <UploadText>
              {selectedFile ? 'Click to change file' : 'Drag & drop an audio file or click to browse'}
            </UploadText>
            <UploadText style={{ fontSize: '0.9em', marginTop: '5px' }}>
              Supported: MP3, WAV, M4A (Max 10MB)
            </UploadText>
          </FileUploadArea>

          <FileInput
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
          />

          {selectedFile && (
            <SelectedFile>
              ✅ Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </SelectedFile>
          )}
        </StepContainer>
      )}

      {/* Voice Configuration Summary (Testing Mode) */}
      {testingMode && selectedRole && (
        <StepContainer>
          <StepTitle>3. Voice Configuration ✅</StepTitle>
          <div style={{ 
            background: '#e8f5e8', 
            border: '2px solid #27ae60', 
            borderRadius: '10px', 
            padding: '20px',
            textAlign: 'left'
          }}>
            <strong>🎯 Ready to use pre-configured voice:</strong>
            <div style={{ marginTop: '10px', fontSize: '0.95em' }}>
              <div>👤 <strong>Role:</strong> {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}</div>
              <div>🌍 <strong>Language:</strong> {selectedRole === 'doctor' ? 'Turkish (Türkçe)' : 'English'}</div>
              <div>🎤 <strong>Voice ID:</strong> {testingVoiceIds[selectedRole]?.voiceId}</div>
              <div style={{ marginTop: '10px', color: '#155724', fontSize: '0.9em' }}>
                ℹ️ This uses an existing ElevenLabs voice clone to avoid API limits during testing.
              </div>
            </div>
          </div>
        </StepContainer>
      )}

      {/* Error/Success Messages */}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {/* Submit Button */}
      <ProcessButton
        onClick={handleSubmit}
        disabled={processing || !isFormValid}
      >
        {processing && <LoadingSpinner />}
        {processing ? 
          (testingMode ? 'Setting up session...' : 'Processing Voice...') : 
          (testingMode ? '🚀 Start Testing Session' : 'Start Translation Session')
        }
      </ProcessButton>

      {processing && !testingMode && (
        <p style={{ color: '#7f8c8d', marginTop: '15px', fontSize: '0.9em' }}>
          This may take 30-60 seconds to clone your voice...
        </p>
      )}

      {processing && testingMode && (
        <p style={{ color: '#7f8c8d', marginTop: '15px', fontSize: '0.9em' }}>
          Setting up testing session with pre-configured voice...
        </p>
      )}
    </SetupContainer>
  );
};

export default VoiceSetup;
