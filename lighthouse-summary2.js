import fs from 'fs';

const report = JSON.parse(fs.readFileSync('./lighthouse-report.json', 'utf8'));

console.log('Categories:', Object.keys(report.categories));
if (report.categories.accessibility) {
  console.log('Accessibility audits config:', report.categories.accessibility.auditRefs.length);
  const accIssues = report.categories.accessibility.auditRefs.map(ref => report.audits[ref.id]).filter(a => a.score !== 1 && a.score !== null);
  console.log('Acc Issues:', accIssues.map(a => `${a.id}: ${a.score} - ${a.title}`));
}

if (report.categories.performance) {
  console.log('Performance audits config:', report.categories.performance.auditRefs.length);
  const perfIssues = report.categories.performance.auditRefs.map(ref => report.audits[ref.id]).filter(a => a.score !== 1 && a.score !== null);
  console.log('Perf Issues:', perfIssues.map(a => `${a.id}: ${a.score} - ${a.title}`));
}
