// ROTA MÁGICA: Transforma HTTP em HTTPS para o navegador não bloquear
app.get('/stream', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL ausente.");

    try {
        // O Render busca o vídeo via HTTP (ele não tem as travas do navegador)
        const response = await axios({
            method: 'get',
            url: decodeURIComponent(url),
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        // Repassa o vídeo para o seu site como se fosse dele (HTTPS garantido)
        res.set(response.headers);
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send("Erro na retransmissão.");
    }
});
