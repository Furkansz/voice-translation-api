#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏥 Hospital Voice Translator - Installation Script');
console.log('================================================\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('❌ Error: Node.js 16 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('   Please upgrade Node.js and try again');
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Function to run commands
function runCommand(command, description) {
  console.log(`\n📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ Error during ${description.toLowerCase()}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Check if npm is available
try {
  execSync('npm --version', { stdio: 'pipe' });
  console.log('✅ npm is available');
} catch (error) {
  console.error('❌ npm is not available. Please install Node.js with npm');
  process.exit(1);
}

// Install server dependencies
runCommand('npm install', 'Installing server dependencies');

// Check if client directory exists
if (!fs.existsSync('client')) {
  console.error('❌ Error: client directory not found');
  process.exit(1);
}

// Install client dependencies
runCommand('cd client && npm install', 'Installing client dependencies');

// Check if all required files exist
const requiredFiles = [
  'server/index.js',
  'server/config.js',
  'client/src/App.js',
  'client/package.json',
  'package.json'
];

console.log('\n🔍 Checking required files...');
for (const file of requiredFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.error(`❌ Missing: ${file}`);
    process.exit(1);
  }
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

console.log('\n🎉 Installation completed successfully!');
console.log('\n📋 Next Steps:');
console.log('   1. Run "npm run dev" to start development server');
console.log('   2. Open http://localhost:3000 in your browser');
console.log('   3. Allow microphone permissions when prompted');
console.log('   4. Upload a voice sample to begin translation');
console.log('\n💡 Tips:');
console.log('   - Use a clear, 30-60 second voice recording for best results');
console.log('   - Ensure stable internet connection for real-time translation');
console.log('   - Both doctor and patient need to complete voice setup');
console.log('\n🚀 Ready to start? Run: npm run dev');
