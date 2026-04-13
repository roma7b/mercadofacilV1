const fs = require('fs');
const files = [
  'src/app/[locale]/(platform)/settings/two-factor/page.tsx',
  'src/app/[locale]/(platform)/settings/trading/page.tsx',
  'src/app/[locale]/(platform)/settings/page.tsx',
  'src/app/[locale]/(platform)/[slug]/page.tsx',
  'src/app/api/debug-markets/route.ts',
  'src/app/api/debug/route.ts',
  'src/app/[locale]/(platform)/sports/[sport]/games/week/[week]/page.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('export const dynamic')) {
    if (f.includes('route.ts')) {
      c = c.replace('export async function', 'export const dynamic = "force-dynamic";\n\nexport async function');
    } else if (f.includes('generateStaticParams')) {
      c = c.replace('export const generateStaticParams', 'export const dynamic = "force-dynamic";\nexport const generateStaticParams');
    } else if (f.includes('export async function generateMetadata')) {
      c = c.replace('export async function generateMetadata', 'export const dynamic = "force-dynamic";\n\nexport async function generateMetadata');
    } else if (f.includes('export const metadata')) {
      c = c.replace('export const metadata', 'export const dynamic = "force-dynamic";\n\nexport const metadata');
    }
    fs.writeFileSync(f, c);
    console.log('Updated ' + f);
  }
});
