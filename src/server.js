const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));

// Sinal de vida para o Render não desligar o motor
app.get('/health', (req, res) => res.sendStatus(200));

// =========================================================
// O TÚNEL DE VÍDEO DEFINITIVO (PROXY REVERSO DE ALTA PERFORMANCE)
// Lida com .m3u8, .ts, .mp4 e headers de Range (para avançar o vídeo)
// =========================================================
const streamProxyConfig = {
    target: 'http://playtvstreaming.shop', // O servidor raiz do fornecedor
    changeOrigin: true,
    ws: true, // Suporte a WebSockets se necessário
    followRedirects: true,
    onProxyRes: function (proxyRes, req, res) {
        // Oculta a origem insegura e engana o navegador do cliente
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Range';
    }
};

// Se o frontend pedir /stream_tunnel/live/..., o Render busca em http://playtvstreaming.shop/live/...
app.use('/stream_tunnel', createProxyMiddleware({
    ...streamProxyConfig,
    pathRewrite: { '^/stream_tunnel': '' } // Limpa o prefixo antes de enviar pro Wolverine
}));

// =========================================================
// O BUSCADOR DE CATÁLOGO (Metadados, Capas e Sinopses)
// =========================================================
app.get('/catalog', async (req, res) => {
    const { action, series_id } = req.query;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Acesso Negado." });

    const b64auth = (authHeader || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');

    let targetUrl = `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;
    if (series_id) targetUrl += `&series_id=${series_id}`;

    try {
        const response = await axios.get(targetUrl, { timeout: 25000 });
        res.json(response.data);
    } catch (error) {
        console.error(`[ERRO API] ${action}:`, error.message);
        res.status(500).json({ error: "Falha de comunicação com o cluster principal." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Motor Consysencia rodando firme na porta ${PORT}`));
