const fs = require('fs');
const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventOrderPanelForm.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Adicionar import do Countdown (se não existir)
if (!content.includes('import EventMarketCountdown')) {
    content = 'import EventMarketCountdown from \'@/app/[locale]/(platform)/event/[slug]/_components/EventMarketCountdown\'\n' + content;
}

// 2. Localizar o ponto de inserção do Countdown (acima do Submit Button ou abaixo dos outcomes)
// Vamos colocar acima do Botão de Submit
const submitButtonSearch = '<EventOrderPanelSubmitButton';
if (content.includes(submitButtonSearch)) {
    const countdownInsertion = `<EventMarketCountdown endDate={event.end_date} className="mb-2" />\n              `;
    content = content.replace(submitButtonSearch, countdownInsertion + submitButtonSearch);
}

// 3. Tornar o label do botão dinâmico (ex: APOSTAR EM SIM)
const labelLogicSearch = 'const outcomeLabel = selectedShareLabel';
const labelLogicReplacement = `                  const outcomeLabel = selectedShareLabel
                  if (outcomeLabel) {
                    const verb = state.side === ORDER_SIDE.SELL ? t('Vender') : t('Apostar em')
                    return \`\${verb} \${outcomeLabel}\`.toUpperCase()
                  }`;

content = content.replace(labelLogicSearch, labelLogicReplacement);

fs.writeFileSync(filePath, content);
console.log('Form patched with countdown and dynamic label');
