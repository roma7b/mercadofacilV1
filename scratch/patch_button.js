const fs = require('fs');
const filePath = 'c:\\Users\\gabri\\.gemini\\antigravity\\scratch\\kuest\\prediction-market-main\\src\\app\\[locale]\\(platform)\\event\\[slug]\\_components\\EventOrderPanelSubmitButton.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const newButtonCode = `  return (
    <div className="relative w-full group">
      <Button
        type={type}
        size="outcomeLg"
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={onClick}
        className={cn(
          "w-full h-[60px] rounded-2xl text-[14px] font-black uppercase tracking-[0.2em] transition-all duration-300",
          "bg-white text-zinc-900 border-0",
          "hover:bg-zinc-100 hover:scale-[1.02] active:scale-[0.98]",
          "shadow-[0_10px_30px_rgba(255,255,255,0.15)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.25)]",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:scale-100"
        )}
      >
        {isLoading
          ? (
              <div className="flex items-center justify-center gap-3">
                <div className="size-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
                <span className="animate-pulse">{t('Processando...')}</span>
              </div>
            )
          : (
              <div className="flex items-center justify-center gap-2 w-full">
                <span className="truncate flex-1 text-center">{label ?? t('Confirmar')}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 group-hover:translate-x-1 transition-transform">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
      </Button>
    </div>
  )
};`;

// Regex para capturar do return até o final antes da última chave (ou fim da função)
content = content.replace(/return \([\s\S]*?\n\s+\)\n\}/, newButtonCode + '\n}');

fs.writeFileSync(filePath, content);
console.log('Submit button visual updated');
