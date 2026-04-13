const fs = require('fs');
const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventOrderPanelForm.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Ajustar Chance Meter para aparecer no mobile e ficar mais bonito
content = content.replace(
    /\{cn\('mb-6', isMobile \? 'hidden' : 'block'\)\}/g,
    "{cn('mb-6 px-1', 'block')}"
);

// Mudar títulos
content = content.replace(
    /\{displayYesPrice\}\s*%\s*<\/span>\s*<span className="font-mono text-xl font-black text-white">\s*\{displayNoPrice\}\s*%\s*<\/span>/g,
    `{displayYesPrice}%</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('Chances')}</span>
                    <span className="font-mono text-xl font-black text-white">{displayNoPrice}%</span>`
);

fs.writeFileSync(filePath, content);
console.log('Visual patch applied');
