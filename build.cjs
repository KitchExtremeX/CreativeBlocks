'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>' + fs.readFileSync(path.join(root, 'style.css'), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, file) => {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + source + '\n</script>';
});
fs.writeFileSync(path.join(root, 'CreativeBlocks.html'), html);
console.log('Built CreativeBlocks.html (' + Math.round(Buffer.byteLength(html) / 1024) + ' KB)');
