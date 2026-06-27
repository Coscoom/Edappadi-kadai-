const fs = require('fs');
const vm = require('vm');

const htmlPath = 'src/main/assets/index.html';
if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(1);
}

const content = fs.readFileSync(htmlPath, 'utf8');
const lines = content.split('\n');

let jsLines = [];
let inScript = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<script>') || line.includes('<script ') || line.includes('<script type=')) {
    inScript = true;
    jsLines.push('');
  } else if (line.includes('</script>')) {
    inScript = false;
    jsLines.push('');
  } else {
    if (inScript) {
      jsLines.push(line);
    } else {
      jsLines.push('');
    }
  }
}

const jsCode = jsLines.join('\n');

try {
  new vm.Script(jsCode, { filename: 'index.html' });
  console.log('✅ JavaScript syntax is fully VALID!');
} catch (err) {
  console.error('❌ JavaScript Syntax Error found:');
  console.error(err.message);
  console.error(err.stack);
}
