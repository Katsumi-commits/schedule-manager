const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('app.js', 'utf8');
const result = babel.transformSync(code, {
  presets: ['@babel/preset-react']
});

fs.writeFileSync('app.compiled.js', result.code);
console.log('Compiled app.js to app.compiled.js');