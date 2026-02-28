const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));

// Sinal de vida para o Render (evita o In Progress infinito)
app.get('/health', (req, res) => res.sendStatus(200));

// =========================================================
// O ESPELHO HTTPS ABSOLUTO
// Qualquer pedido para /proxy/live/... vai bater no Wolverine em http://...
// =========================================================
app.use('/proxy', createProxyMiddleware({
    target: 'http://playtvstreaming.shop',
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': '', // Remove a palavra /proxy e repassa o resto do link
    },
    onProxyRes: function (proxyRes) {
        // Engana o navegador para ele não bloquear o vídeo
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));

// =========================================================
// BUSCADOR DE CATÁLOGO
// =========================================================
app.get('/catalog', async (req, res) => {
    const { action, series_id } = req.query;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Negado." });

    const b64auth = (authHeader || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');

    let targetUrl = `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;
    if (series_id) targetUrl += `&series_id=${series_id}`;

    try {
        const response = await axios.get(targetUrl, { timeout: 20000 });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Falha na API." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Motor V5 Espelho online na porta ${PORT}`));
