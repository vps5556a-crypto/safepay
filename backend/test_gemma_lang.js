const { Ollama } = require('ollama');
const ollama = new Ollama({ host: 'http://localhost:11434' });

async function testHindi() {
  const system = `You are SafePay's AI Banking Assistant.
Target Language: HINDI (हिन्दी).
MANDATORY INSTRUCTION: You MUST write the JSON values for "reply", "voiceScript", and each element in "steps" in HINDI (हिन्दी - Devanagari script). NEVER return English text for reply or voiceScript.

Output JSON format:
{
  "intent": "upi_explanation",
  "reply": "हिन्दी में सीधा और सरल उत्तर",
  "voiceScript": "बोलने के लिए छोटा हिन्दी वाक्य",
  "steps": ["पहला चरण", "दूसरा चरण"]
}`;

  const prompt = `User asked: "What is UPI?"
Grounded Knowledge in Hindi:
UPI भारतीय रिज़र्व बैंक (RBI) द्वारा स्वीकृत एक सुरक्षित प्रणाली है जिससे आपके बैंक से दूसरे व्यक्ति के बैंक में तुरंत सीधे पैसे चले जाते हैं। डिजिटल नकद की तरह 5 सेकंड में काम करता है।`;

  const res = await ollama.generate({
    model: 'gemma2:2b',
    system,
    prompt,
    format: 'json',
    stream: false,
    options: { temperature: 0.1 }
  });

  console.log('Hindi Test Output:\n', res.response);
}

async function testTamil() {
  const system = `You are SafePay's AI Banking Assistant.
Target Language: TAMIL (தமிழ்).
MANDATORY INSTRUCTION: You MUST write the JSON values for "reply", "voiceScript", and each element in "steps" in TAMIL (தமிழ் script). NEVER return English text for reply or voiceScript.

Output JSON format:
{
  "intent": "upi_explanation",
  "reply": "தமிழில் நேரடி எளிய விளக்கம்",
  "voiceScript": "பேசுவதற்கு சிறிய தமிழ் வாக்கியம்",
  "steps": ["படி 1", "படி 2"]
}`;

  const prompt = `User asked: "What is UPI?"
Grounded Knowledge in Tamil:
UPI என்பது இந்திய ரிசர்வ் வங்கியின் (RBI) மேற்பார்வையில் இயங்கும் உடனடி வங்கி பரிவர்த்தனை அமைப்பாகும். இதன் மூலம் 5 வினாடிகளில் உங்கள் வங்கியிலிருந்து மற்றொரு வங்கிக்கு பணம் அனுப்பலாம்.`;

  const res = await ollama.generate({
    model: 'gemma2:2b',
    system,
    prompt,
    format: 'json',
    stream: false,
    options: { temperature: 0.1 }
  });

  console.log('Tamil Test Output:\n', res.response);
}

async function main() {
  await testHindi();
  await testTamil();
}

main();
