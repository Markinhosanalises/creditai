exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key não configurada.' }) };
  }

  try {
    const { prompt, anexo } = JSON.parse(event.body);

    // Monta o conteúdo da mensagem - com ou sem anexo
    let content;
    if (anexo && anexo.base64 && anexo.mediaType) {
      const blockType = anexo.mediaType === 'application/pdf' ? 'document' : 'image';
      content = [
        {
          type: blockType,
          source: {
            type: 'base64',
            media_type: anexo.mediaType,
            data: anexo.base64
          }
        },
        { type: 'text', text: prompt }
      ];
    } else {
      content = prompt;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || 'Erro na API.' }) };
    }

    const rawText = data.content.map(i => i.text || '').join('');
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      return { statusCode: 500, body: JSON.stringify({ error: 'JSON não encontrado na resposta.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ content: [{ type: 'text', text: match[0] }] })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
