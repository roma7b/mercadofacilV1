const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach( f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    // Replace old useAppKit paths with the mocked version
    content = content.replace(/'@\/hooks\/useAppKit'/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/"@\/hooks\/useAppKit"/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/'@reown\/appkit\/react'/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/"@reown\/appkit\/react"/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/'@reown\/appkit-controllers\/react'/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/"@reown\/appkit-controllers\/react"/g, "'@/hooks/useAppKitMock'");
    
    // Also, handle the one error that appeared: Can't resolve '@/hooks/useAppKitAccountMock'
    // I made a typo in an earlier fix. The mock is called useAppKitMock
    content = content.replace(/'@\/hooks\/useAppKitAccountMock'/g, "'@/hooks/useAppKitMock'");
    content = content.replace(/"@\/hooks\/useAppKitAccountMock"/g, "'@/hooks/useAppKitMock'");

    if(content !== original) {
       fs.writeFileSync(filePath, content);
       console.log('Fixed:', filePath);
    }
  }
});
