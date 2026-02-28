import http from 'http';
import https from 'https';
import url from 'url';

const UPSTREAM_URL = process.env.PROVIDER_URL || 'http://playtvstreaming.shop';
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'https://play.consysencia.com';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', FRONT_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const parsedUrl = url.parse(req.url, true);
    
    // Rota de saúde para o Render
    if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: "online" }));
    }

    if (parsedUrl.pathname === '/catalog') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Basic ')) {
            return res.writeHead(401).end(JSON.stringify({ error: "Sem autorização" }));
        }

        const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');
        
        const action = parsedUrl.query.action || 'get_live_categories';
        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${user}&password=${pass}&action=${action}`;

        console.log(`[LOG] Tentando login para: ${user} na URL: ${UPSTREAM_URL}`);

        const protocol = targetUrl.startsWith('https') ? https : http;
        protocol.get(targetUrl, { headers: { 'User-Agent': 'IPTVSmarters/1.0.3' } }, (upstreamRes) => {
            let body = '';
            upstreamRes.on('data', chunk => body += chunk);
            upstreamRes.on('end', () => {
                console.log(`[LOG] Resposta do Fornecedor (Status ${upstreamRes.statusCode}): ${body.substring(0, 100)}...`);
                
                try {
                    const data = JSON.parse(body);
                    if ((data.user_info && data.user_info.auth === 1) || Array.isArray(data)) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(body);
                    } else {
                        res.writeHead(401).end(JSON.stringify({ error: "Dados inválidos no fornecedor" }));
                    }
                } catch (e) {
                    res.writeHead(500).end(JSON.stringify({ error: "Erro ao ler resposta do servidor" }));
                }
            });
        }).on('error', (err) => {
            console.log(`[LOG] Erro de conexão: ${err.message}`);
            res.writeHead(502).end();
        });
        return;
    }
    res.writeHead(404).end();
});

server.listen(PORT, () => console.log(`Motor ativo na porta ${PORT}`));
