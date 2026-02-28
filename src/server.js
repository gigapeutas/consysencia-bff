const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Responder preflight corretamente
app.options('*', cors());

// Health check
app.get('/health', (req, res) => res.sendStatus(200));

/* =========================================================
   PROXY DE STREAM
========================================================= */

const streamProxyConfig = {
    target: 'http://playtvstreaming.shop',
    changeOrigin: true,
    ws: true,
    followRedirects: true,
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] =
            'Origin, X-Requested-With, Content-Type, Accept, Range';
    }
};

app.use('/stream_tunnel',
    createProxyMiddleware({
        ...streamProxyConfig,
        pathRewrite: { '^/stream_tunnel': '' }
    })
);

/* =========================================================
   CATÁLOGO
========================================================= */

app.get('/catalog', async (req, res) => {
    try {
        const { action, series_id } = req.query;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: "Acesso Negado." });
        }

        const b64auth = authHeader.split(' ')[1] || '';
        const [user, pass] = Buffer.from(b64auth, 'base64')
            .toString()
            .split(':');

        let targetUrl = `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;

        if (series_id) {
            targetUrl += `&series_id=${series_id}`;
        }

        const response = await axios.get(targetUrl, { timeout: 25000 });

        res.json(response.data);

    } catch (error) {
        console.error(`[ERRO API]`, error.message);
        res.status(500).json({
            error: "Falha de comunicação com o cluster principal."
        });
    }
});

/* =========================================================
   ERROR HANDLER GLOBAL
========================================================= */

app.use((err, req, res, next) => {
    console.error("Erro global:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
    console.log(`🚀 Motor Consysencia rodando na porta ${PORT}`)
);