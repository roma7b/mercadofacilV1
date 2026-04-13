const fs = require('fs');
const _path = require('path');

const applySuspensePattern = (filePath, pageName, innerPropsType, renderPropsCode) => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if already using Suspense and Inner pattern
  if (content.includes('PageInner')) return;

  const exportMatch = content.match(/export default async function ([a-zA-Z0-9_]+)\(\s*\{\s*params[^\)]*\)\s*\{/);
  if (!exportMatch) return;
  
  const componentName = exportMatch[1];
  
  // Find the start of the component body
  const bodyStartIndex = content.indexOf('{', exportMatch.index) + 1;
  const bodyEndIndex = content.lastIndexOf('}');
  
  const componentBody = content.substring(bodyStartIndex, bodyEndIndex);
  
  let newBody = `
async function ${componentName}Inner({ locale }: { locale: string }) {
${componentBody}
}

export default async function ${componentName}({ params }: PageProps<'${innerPropsType}'>) {
  const { locale } = await params;
  return (
    <Suspense fallback={null}>
      <${componentName}Inner locale={locale} />
    </Suspense>
  )
}
`;

  // We need to make sure Suspense is imported
  if (!content.includes('import { Suspense }')) {
    content = `import { Suspense } from 'react'\n` + content;
  }
  
  // Replace the old component with the new one
  const newContent = content.substring(0, exportMatch.index) + newBody;
  
  // Also we need to fix the setRequestLocale missing or double applying if we want them inside Inner
  // Let the existing body apply setRequestLocale if it wants, our wrapper only extracts {locale}
  
  fs.writeFileSync(filePath, newContent);
  console.log(`Refactored ${filePath}`);
};

const targets = [
  { p: 'src/app/[locale]/(platform)/settings/page.tsx', t: '/[locale]/settings' },
  { p: 'src/app/[locale]/(platform)/settings/trading/page.tsx', t: '/[locale]/settings/trading' },
  { p: 'src/app/[locale]/(platform)/settings/notifications/page.tsx', t: '/[locale]/settings/notifications' },
  { p: 'src/app/[locale]/(platform)/[slug]/page.tsx', t: '/[locale]/[slug]' },
  { p: 'src/app/api/debug-markets/route.ts', isRoute: true },
  { p: 'src/app/api/debug/route.ts', isRoute: true },
];

targets.forEach(target => {
  if (target.isRoute) return; // Routes don't use Suspense
  applySuspensePattern(target.p, '', target.t, '');
});

