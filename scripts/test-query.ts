async function test() {
  const bigText = "A".repeat(25000);
  console.log("Testing Ollama with strict CPU-only execution to bypass VRAM crash...");
  try {
    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      body: JSON.stringify({ 
        model: "llama3.2", 
        prompt: bigText, 
        stream: false,
        options: { 
          num_ctx: 4096,
          num_gpu: 0 
        }
      })
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (e: any) {
    console.log("Fetch Error:", e.message);
  }
}
test();
