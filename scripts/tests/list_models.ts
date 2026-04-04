import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: '.env' });
}

async function list() {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const res = await fetch(url);
  const data = await res.json();
  data.models.forEach((m: any) => console.log(m.name, m.supportedGenerationMethods));
}
list().catch(console.error);
