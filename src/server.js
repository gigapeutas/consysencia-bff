const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/* =============================
   MIDDLEWARES BASE
============================= */

app.use(compression());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.options('*', cors());

/* =============================
   HEALTH CHECK
============================= */

app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
});

/* =============================
   STREAM PROXY
============================= */

const streamProxyConfig = {
    target: 'http://playtvstreaming.shop',
    changeOrigin: true,
    ws: true,
    followRedirects: true,
    proxyTimeout: 30000,
    timeout: 30000,
    onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Connection', 'keep-alive');
    },
    onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] =
            'Origin, X-Requested-With, Content-Type, Accept, Range';
    },
    onError: (err, req, res) => {
        console.error('Proxy Error:', err.message);
        res.status(502).json({ error: 'Erro no túnel de stream.' });
    }
};

app.use('/stream_tunnel',
    createProxyMiddleware({
        ...streamProxyConfig,
        pathRewrite: { '^/stream_tunnel': '' }
    })
);

/* =============================
   CATÁLOGO
============================= */

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

        if (!user || !pass) {
            return res.status(400).json({ error: "Credenciais inválidas." });
        }

        let targetUrl =
            `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;

        if (series_id) {
            targetUrl += `&series_id=${series_id}`;
        }

        const response = await axios.get(targetUrl, {
            timeout: 25000
        });

        res.json(response.data);

    } catch (error) {
        console.error('Catalog Error:', error.message);
        res.status(500).json({
            error: "Falha de comunicação com o cluster principal."
        });
    }
});

/* =============================
   ERROR HANDLER GLOBAL
============================= */

app.use((err, req, res, next) => {
    console.error('Erro global:', err.stack);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

/* =============================
   PROTEÇÃO CONTRA CRASH
============================= */

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

/* =============================
   START SERVER
============================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Motor Consysencia rodando na porta ${PORT}`);
});