const fs = require('fs');
const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventContent.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Importar BigChanceMeter
if (!content.includes('import BigChanceMeter')) {
    content = 'import BigChanceMeter from \'@/app/[locale]/(platform)/event/[slug]/_components/BigChanceMeter\'\n' + content;
}

// 2. Inserir entre o Visual Component e o Markets List
const insertionPoint = '{/* Markets List';
if (content.includes(insertionPoint)) {
    const meterCode = `
            {selectedMarket && (
               <BigChanceMeter 
                 marketSlug={selectedMarket.slug} 
                 className="mb-2" 
               />
            )}
`;
    content = content.replace(insertionPoint, meterCode + '\n            ' + insertionPoint);
}

fs.writeFileSync(filePath, content);
console.log('EventContent patched with BigChanceMeter');
