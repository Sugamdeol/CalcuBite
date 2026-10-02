// Provider credentials stay on the server; bound the complete fallback chain.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite'];
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'Method not allowed'}); }
  if (!process.env.GEMINI_KEY) return res.status(503).json({error:'AI is unavailable. Please try food database search instead.'});
  const body=req.body?.body;
  if (!body || !Array.isArray(body.contents) || !body.contents.length || body.contents.length>30 || JSON.stringify(body).length>12000000) return res.status(400).json({error:'Invalid analysis request.'});
  const deadline=Date.now()+42000;
  let busy=false;
  for (const model of MODELS) {
    const remaining=deadline-Date.now();
    if (remaining<1000) break;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),Math.min(18000,remaining));
    try {
      const upstream=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent?key='+process.env.GEMINI_KEY,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal
      });
      if (upstream.status===400) return res.status(400).json({error:'The image or description could not be processed. Try a smaller image or a clearer description.'});
      if (upstream.status===403) return res.status(503).json({error:'AI is temporarily unavailable. Please try database search.'});
      if (!upstream.ok) { busy=busy||upstream.status===429||upstream.status===503; continue; }
      const text=await upstream.text();
      res.setHeader('Content-Type','application/json');
      return res.status(200).send(text);
    } catch (_) { /* bounded fallback */ }
    finally { clearTimeout(timer); }
  }
  return res.status(busy?429:502).json({error:busy?'The AI service is busy. Please retry in a minute.':'AI could not finish this request. Please retry or use food database search.'});
};
