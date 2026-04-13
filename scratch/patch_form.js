const fs = require('fs');
const path = require('path');

const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventOrderPanelForm.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// O bloco que queremos substituir
const oldBlock = `              <EventOrderPanelBuySellTabs
                side={state.side}
                type={state.type}
                availableMergeShares={availableMergeShares}
                availableSplitBalance={availableSplitBalance}
                eventId={event.id}
                eventSlug={event.slug}
                isNegRiskMarket={isNegRiskMarket}
                conditionId={activeMarket?.condition_id}
                marketSlug={activeMarket?.slug}
                eventPath={resolveEventPagePath(event)}
                marketTitle={activeMarket?.title || activeMarket?.short_title}
                marketIconUrl={activeMarket?.icon_url}
                onSideChange={state.setSide}
                onTypeChange={handleTypeChange}
                onAmountReset={() => state.setAmount('')}
                onFocusInput={focusInput}
              />`;

const newBlock = `              <EventOrderPanelBuySellTabs
                side={state.side}
                onSideChange={state.setSide}
                onTypeChange={handleTypeChange}
                onAmountReset={() => state.setAmount('')}
                onFocusInput={focusInput}
              />`;

// Vamos tentar uma substituição mais flexível se a exata falhar
if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
} else {
    // Busca por partes se a exata falhar (devido a espaços ou newlines)
    console.log('Exata falhou, tentando regex...');
    const regex = /<EventOrderPanelBuySellTabs[\s\S]*?\/>/;
    content = content.replace(regex, newBlock);
}

fs.writeFileSync(filePath, content);
console.log('File updated successfully');
