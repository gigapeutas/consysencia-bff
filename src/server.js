import http from 'http';
import https from 'https';
import url from 'url';

const UPSTREAM_URL = process.env.PROVIDER_URL || 'http://playtvstreaming.shop';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // Libera o acesso para o seu site no Cloudflare Pages
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const parsedUrl = url.parse(req.url, true);
    
    // Rota que valida o cliente e busca as categorias
    if (parsedUrl.pathname === '/catalog') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Basic ')) {
            res.writeHead(401).end(JSON.stringify({ error: "Acesso negado" }));
            return;
        }

        const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');

        // URL exata que o seu fornecedor usa para login
        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${user}&password=${pass}`;
        
        return fetchFromProvider(targetUrl, res);
    }

    res.writeHead(404).end();
});

function fetchFromProvider(targetUrl, clientRes) {
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    protocol.get(targetUrl, (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk);
        upstreamRes.on('end', () => {
            try {
                const data = JSON.parse(body);
                // Se o fornecedor autenticou o seu cliente, retornamos sucesso
                if (data.user_info && data.user_info.auth === 1) {
                    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
                    clientRes.end(JSON.stringify({ success: true, user: data.user_info }));
                } else {
                    clientRes.writeHead(401).end(JSON.stringify({ error: "Dados inválidos" }));
                }
            } catch (e) {
                clientRes.writeHead(500).end(JSON.stringify({ error: "Falha no fornecedor" }));
            }
        });
    }).on('error', () => {
        clientRes.writeHead(502).end();
    });
}

server.listen(PORT, () => console.log("Motor Play Consysencia Rodando!"));
