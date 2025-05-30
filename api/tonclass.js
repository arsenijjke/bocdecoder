export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const apiKey = "4b3188a7c67ca35e532bc09763b9e6f1434a105f9e019ea8c9e7e74a4fafad68"
  
    const apiResponse = await fetch('https://testnet.tonapi.io/v2/smc/runGetMethod', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(req.body)
    });
  
    const data = await apiResponse.json();
    res.status(apiResponse.status).json(data);
  }