const fs = require('fs');
const path = require('path');

const dir = 'src/i18n/messages';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.json')) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      JSON.parse(content);
      console.log(`OK: ${file}`);
    } catch (err) {
      console.error(`FAIL: ${file} - ${err.message}`);
      // Log the content around the error if possible
      const pos = err.message.match(/position (\d+)/);
      if (pos) {
        const offset = parseInt(pos[1]);
        console.error('Context:', content.substring(Math.max(0, offset - 20), offset + 20));
      }
    }
  }
});
