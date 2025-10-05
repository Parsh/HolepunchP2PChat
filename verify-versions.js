const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const requiredVersions = {
  'react': '18.2.0',
  'react-native': '0.74.1'
};

console.log('🔍 Verifying React Native version requirements...\n');

let allCorrect = true;

Object.entries(requiredVersions).forEach(([pkg, required]) => {
  const installed = packageJson.dependencies[pkg];
  const isCorrect = installed === required;
  
  console.log(`${isCorrect ? '✅' : '❌'} ${pkg}: ${installed} ${isCorrect ? '(correct)' : `(required: ${required})`}`);
  
  if (!isCorrect) allCorrect = false;
});

if (allCorrect) {
  console.log('\n🎉 All versions are correct! Ready to proceed with Stage 1.');
} else {
  console.log('\n⚠️  Version mismatch detected. Please fix versions before continuing.');
  process.exit(1);
}
