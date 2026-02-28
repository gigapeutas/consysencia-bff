const express = require('express');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression'); // O Compressor Milenar

const app = express();

// 1. ATIVA A COMPRESSÃO GZIP (Deixa a transferência 10x mais leve)
app.use(compression()); 

// Permite que o seu site converse com esta API
app.use(cors({ origin: '*' })); 

// 2. O ESCUDO DE MEMÓRIA (Cache)
const cache = new Map();
const CACHE_TIME = 10 * 60 * 1000; // 10 minutos (em milissegundos)

app.get('/catalog', async (req, res) => {
    const { action } = req.query;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Acesso negado." });
    }

    // Decodifica a senha criptografada que o seu site envia
    const b64auth = (authHeader || '').split(' ')[1] || '';
    const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (!user || !pass) {
        return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // 3. A LÓGICA DO ESCUDO
    // Cria uma chave única. Exemplo: "551541775_get_vod_streams"
    const cacheKey = `${user}_${action}`;
    const cachedData = cache.get(cacheKey);

    // Se já temos a resposta na memória e ela tem menos de 10 minutos:
    if (cachedData && (Date.now() - cachedData.timestamp < CACHE_TIME)) {
        console.log(`[⚡ ESCUDO ATIVADO] Entregando ${action} direto da memória RAM do Render!`);
        return res.json(cachedData.data);
    }

    // Se não tem na memória (ou passou 10 minutos), vamos no fornecedor
    try {
        console.log(`[🌍 REDE] Buscando ${action} no fornecedor principal...`);
        
        // A sua URL Primária (Oculta do cliente)
        const targetUrl = `http://playtvstreaming.shop/player_api.php?username=${user}&password=${pass}&action=${action}`;
        
        const response = await axios.get(targetUrl, { timeout: 20000 }); // 20s limite

        // 4. GUARDA NO COFRE PARA OS PRÓXIMOS CLIENTES
        if (response.data) {
            cache.set(cacheKey, {
                timestamp: Date.now(),
                data: response.data
            });
        }

        res.json(response.data);

    } catch (error) {
        console.error(`[❌ ERRO] Falha ao buscar ${action}:`, error.message);
        res.status(500).json({ error: "Falha na comunicação com o servidor-mãe." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor Milenar V2 rodando na porta ${PORT}`);
});
