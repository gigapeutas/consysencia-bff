const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');

const app = express();
app.use(compression());
app.use(cors({ origin: '*' }));

// O CONVERSOR DE VÍDEO (TÚNEL HTTPS)
app.get('/stream', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL ausente.");
    try {
        const response = await axios({
            method: 'get',
            url: decodeURIComponent(url),
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        res.set(response.headers);
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send("Erro na retransmissão.");
    }
});

// O BUSCADOR DO CATÁLOGO (FILMES E SÉRIES)
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
app.listen(PORT, () => {
    console.log(`🚀 Motor Consysencia rodando na porta ${PORT}`);
});
