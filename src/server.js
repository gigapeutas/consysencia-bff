import http from 'http';
import https from 'https';
import url from 'url';

// Puxa as configurações das variáveis que você já salvou no Render
const UPSTREAM_URL = process.env.PROVIDER_URL || 'http://playtvstreaming.shop';
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'https://play.consysencia.com';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // 1. Configuração de Segurança (CORS) - Agora aceita o domínio Active
    res.setHeader('Access-Control-Allow-Origin', FRONT_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const parsedUrl = url.parse(req.url, true);
    
    // 2. Rota de Vida (Health Check) - Isso mata o erro de Timeout no Render
    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: "Motor Play Consysencia Ativo" }));
    }

    // 3. Rota de Login e Catálogo
    if (parsedUrl.pathname === '/catalog') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Basic ')) {
            res.writeHead(401).end(JSON.stringify({ error: "Acesso Negado" }));
            return;
        }

        const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');

        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`;
        
        return proxyRequest(targetUrl, res);
    }

    res.writeHead(404).end();
});

function proxyRequest(targetUrl, clientRes) {
    const protocol = targetUrl.startsWith('https') ? https : http;
    const options = { headers: { 'User-Agent': 'IPTVSmarters/1.0.3' } };

    protocol.get(targetUrl, options, (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk);
        upstreamRes.on('end', () => {
            try {
                const data = JSON.parse(body);
                if ((data.user_info && data.user_info.auth === 1) || Array.isArray(data)) {
                    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
                    clientRes.end(JSON.stringify({ success: true, user: data.user_info || {} }));
                } else {
                    clientRes.writeHead(401).end(JSON.stringify({ error: "Dados inválidos" }));
                }
            } catch (e) {
                clientRes.writeHead(upstreamRes.statusCode === 200 ? 200 : 401).end(body);
            }
        });
    }).on('error', () => {
        clientRes.writeHead(502).end();
    });
}

server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
