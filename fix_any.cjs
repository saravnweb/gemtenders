const fs = require('fs');
const glob = require('glob');
const cp = require('child_process');

function processFile(file) {
    if (!file || file.includes('node_modules')) return;
    file = file.trim();
    if (!fs.existsSync(file)) return;
    
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix catch(e: any) clauses to catch(e: unknown)
    content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)/g, 'catch ($1)');

    // Fix useState<any> and useState<any[]>
    content = content.replace(/useState<any>\(null\)/g, 'useState<Record<string, unknown> | null>(null)');
    content = content.replace(/useState<any\[\]>\(\[\]\)/g, 'useState<Record<string, unknown>[]>([])');
    
    // Fix simple declarations with any
    content = content.replace(/const ([a-zA-Z0-9_]+)\s*:\s*any\s*=\s*/g, 'const $1: unknown = ');
    content = content.replace(/let ([a-zA-Z0-9_]+)\s*:\s*any\s*=\s*/g, 'let $1: unknown = ');
    
    // Fix function arguments array
    content = content.replace(/:\s*any\[\]/g, ': unknown[]');
    
    // Fix function arguments obj
    content = content.replace(/:\s*any\b/g, ': Record<string, unknown>');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    }
}

// Find all ts/tsx files
try {
  // we can use a recursive readdir
  const getFiles = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      file = dir + '/' + file;
      const stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
         if(!file.includes('node_modules') && !file.includes('.next') && !file.includes('scripts')) {
             results = results.concat(getFiles(file));
         }
      } else {
         if (file.endsWith('.ts') || file.endsWith('.tsx')) {
             results.push(file);
         }
      }
    });
    return results;
  };
  
  const files = getFiles('.');
  files.forEach(processFile);
} catch (e) {
  console.error(e);
}
