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
    
    if (parsedUrl.pathname === '/health') {
        return res.end(JSON.stringify({ status: "online" }));
    }

    if (parsedUrl.pathname === '/catalog') {
        const authHeader = req.headers.authorization || '';
        const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');
        
        // Agora o site pode pedir qualquer ação (categorias, canais, séries)
        const action = parsedUrl.query.action || 'get_live_categories';
        const catId = parsedUrl.query.category_id ? `&category_id=${parsedUrl.query.category_id}` : '';
        
        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${user}&password=${pass}&action=${action}${catId}`;
        
        const protocol = targetUrl.startsWith('https') ? https : http;
        protocol.get(targetUrl, { headers: { 'User-Agent': 'IPTVSmarters/1.0.3' } }, (upstreamRes) => {
            let body = '';
            upstreamRes.on('data', chunk => body += chunk);
            upstreamRes.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(body);
            });
        });
        return;
    }
    res.writeHead(404).end();
});

server.listen(PORT);
