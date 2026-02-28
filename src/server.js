const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));

// Sinal de vida para o Render não desligar
app.get('/health', (req, res) => res.sendStatus(200));

// =========================================================
// ROTA VIP - SERVIDOR SECUNDÁRIO (ANTI-BLOQUEIO)
// =========================================================
const VIP_SERVER = 'http://ph1233.uk';

// O Túnel de Vídeo: Converte HTTP para HTTPS e entrega para o celular
app.use('/proxy', createProxyMiddleware({
    target: VIP_SERVER,
    changeOrigin: true,
    pathRewrite: { '^/proxy': '' },
    onProxyRes: function (proxyRes) {
        // Escudo Anti-CORS (Garante que a TV não seja bloqueada)
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Headers'] = '*';
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

    let targetUrl = `${VIP_SERVER}/player_api.php?username=${user}&password=${pass}&action=${action}`;
    if (series_id) targetUrl += `&series_id=${series_id}`;

    try {
        const response = await axios.get(targetUrl, { timeout: 25000 });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: "Falha na API VIP." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Motor V15 VIP online na porta ${PORT}`));
