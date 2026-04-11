
import { detectCategory, CATEGORIES } from '../lib/categories';

const testCases = [
  { title: "Monthly Basis Cab & Taxi Hiring Services", expected: "transport" },
  { title: "Procurement And Installation Of 16 Gb Ram", expected: "it" },
  { title: "Plain Copier Paper (V3) ISI Marked", expected: "office" },
  { title: "Flucanazole 50mg captab", expected: "medical" },
  { title: "Security Manpower Service (Version 2.0)", expected: "security" }
];

testCases.forEach(tc => {
  const detected = detectCategory(tc.title);
  console.log(`Title: ${tc.title}`);
  console.log(`  Expected: ${tc.expected} | Detected: ${detected}`);
  if (detected !== tc.expected) {
    console.error(`  ERROR: Mismatch for "${tc.title}"`);
  }
});

console.log('---');
console.log('Checking if IDs exist in CATEGORIES:');
testCases.forEach(tc => {
  const found = CATEGORIES.find(c => c.id === tc.expected);
  console.log(`  ID: ${tc.expected} | Found: ${!!found}`);
});
