const html = require('fs').readFileSync('tmp.html', 'utf8');
const metas = html.match(/<meta[^>]*>/g);
if(metas) {
  metas.forEach(m => {
    if(m.includes('og:') || m.includes('twitter:') || m.includes('name="description"')) console.log(m);
  });
}
