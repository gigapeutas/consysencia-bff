const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');

const app = express();

// Otimiza a velocidade e libera o acesso do seu site
app.use(compression());
app.use(cors({ origin: '*' }));

// =========================================================
// 1. SINAL DE VIDA PARA O RENDER (Obrigatório para ficar Live)
// =========================================================
app.get('/health', (req, res) => {
    res.sendStatus(200);
});

// =========================================================
// 2. CONVERSOR MÁGICO (HTTP -> HTTPS)
// Engana o navegador para ele não bloquear o vídeo
// =========================================================
app.get('/stream', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("URL ausente.");
    }

    try {
        const response = await axios({
            method: 'get',
            url: decodeURIComponent(url),
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });

        // Repassa as informações do vídeo originais para o seu player
        res.set(response.headers);
        response.data.pipe(res);
    } catch (e) {
        console.error("[ERRO STREAM]", e.message);
        res.status(500).send("Erro na retransmissão do vídeo.");
    }
});

// =========================================================
// 3. BUSCADOR DO CATÁLOGO (FILMES, SÉRIES E CANAIS)
// =========================================================
app.get('/catalog', async (req, res) => {
    const { action, series_id } = req.query;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: "Acesso Negado." });
    }

    // Descriptografa o usuário e senha
    const b64auth = (authHeader || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');

    // Monta a URL para bater no servidor Wolverine
    let targetUrl = `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;
    if (series_id) {
        targetUrl += `&series_id=${series_id}`;
    }

    try {
        const response = await axios.get(targetUrl, { timeout: 20000 });
        res.json(response.data);
    } catch (error) {
        console.error("[ERRO CATALOGO]", error.message);
        res.status(500).json({ error: "Falha ao buscar dados no servidor principal." });
    }
});

// =========================================================
// LIGA O MOTOR NA PORTA CERTA DO RENDER
// =========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor Consysencia rodando firme na porta ${PORT}`);
});
