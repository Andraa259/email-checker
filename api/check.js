export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { emails, mode } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Daftar email tidak boleh kosong' });
    }

    const apiKey = process.env.EMAIL_CHECKER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API Key belum dikonfigurasi di server' });
    }

    const endpoint = mode === 'deep' ? 'deepcheck' : 'fastcheck';
    const chunkSize = mode === 'deep' ? 500 : 1000;

    // Membagi email menjadi potongan (chunk) sesuai batas maksimal API
    const chunks = [];
    for (let i = 0; i < emails.length; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize));
    }

    // Proses request ke API netnit.net
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const response = await fetch(`https://apikey.netnit.net/${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mail: chunk })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const resData = await response.json();
          return resData.results || resData;
        } catch (err) {
          return chunk.map(email => ({
            email: email,
            status: 'failed',
            details: err.message
          }));
        }
      })
    );

    // Gabungkan seluruh hasil chunk menjadi 1 array flat
    const flatResults = results.flat();
    return res.status(200).json({ success: true, data: flatResults });

  } catch (error) {
    return res.status(500).json({ error: 'Terjadi kesalahan pada server proxy' });
  }
}