import fs from 'fs';

const report = JSON.parse(fs.readFileSync('./lighthouse-report.json', 'utf8'));

console.log('--- Accessibility Issues ---');
report.categories.accessibility.auditRefs.forEach(ref => {
  const audit = report.audits[ref.id];
  if (audit.score !== null && audit.score < 1) {
    if (Object.keys(audit).length > 0) {
      console.log(`- ${audit.title} (Score: ${audit.score})`);
      console.log(`  ${audit.description}`);
      if (audit.details && audit.details.items) {
        audit.details.items.forEach(item => {
          if (item.node && item.node.snippet) {
             console.log(`    * Node: ${item.node.snippet}`);
          }
        });
      }
    }
  }
});

console.log('\n--- Performance Issues ---');
report.categories.performance.auditRefs.forEach(ref => {
  const audit = report.audits[ref.id];
  if (audit.score !== null && audit.score < 1) {
    console.log(`- ${audit.title} (Score: ${audit.score})`);
  }
});
