const OPENAI_URL_CHAT = 'https://api.openai.com/v1/chat/completions';

const callOpenAI = async ({ messages, model='gpt-4o-mini', temperature=0 }) => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  const resp = await fetch(OPENAI_URL_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature })
  });
  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || '';
};

const policy = `Classify the following text for safety policy. Return strict JSON with { unsafe: boolean, reasons: string[], categories: string[] }.
Categories to consider: harassment, hate, sexual, self-harm, violence, extremism, spam, malware, pii, other.`;

export const moderate = async (req, res) => {
  try {
    const { content = '', type = 'text' } = req.body || {};
    if (!content || typeof content !== 'string') return res.status(400).json({ error: 'content required' });
    const out = await callOpenAI({ messages: [
      { role: 'system', content: policy },
      { role: 'user', content: `Type: ${type}.\nText: ${content.slice(0, 6000)}` }
    ]});
    let json; try { json = JSON.parse(out); } catch { json = { unsafe: false, reasons: [out], categories: [] } }
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: 'Moderation failed' });
  }
};

export default { moderate };
