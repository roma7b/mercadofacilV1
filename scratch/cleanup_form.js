const fs = require('fs');
const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventOrderPanelForm.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Localizar e remover o bloco do Chance Meter que foi adicionado anteriormente
// Ele começa com {/* Chance Meter e termina no fechamento da div
const meterRegex = /\{\/\* Chance Meter [\s\S]*?\n\s+<\/div>\s+<\/div>/;
content = content.replace(meterRegex, '');

fs.writeFileSync(filePath, content);
console.log('Form cleaned up from local chance meter');
