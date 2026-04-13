const fs = require('fs');

const files = [
  'src/app/[locale]/(platform)/settings/two-factor/page.tsx',
  'src/app/[locale]/(platform)/settings/trading/page.tsx',
  'src/app/[locale]/(platform)/settings/notifications/page.tsx',
  'src/app/[locale]/(platform)/settings/affiliate/page.tsx',
  'src/app/[locale]/(platform)/settings/page.tsx',
  'src/app/[locale]/(platform)/[slug]/page.tsx',
  'src/app/[locale]/(platform)/[slug]/[subcategory]/page.tsx',
  'src/app/api/debug-markets/route.ts',
  'src/app/api/debug/route.ts',
  'src/app/[locale]/(platform)/sports/[sport]/games/week/[week]/page.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');
  let newC = c.replace(/export const dynamic = ['"]force-dynamic['"];?\r?\n?/g, '');
  if (c !== newC) {
    fs.writeFileSync(f, newC);
    console.log('Cleaned ' + f);
  }
});
