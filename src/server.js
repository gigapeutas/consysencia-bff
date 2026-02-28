import http from 'http';
import https from 'https';
import url from 'url';

const UPSTREAM_URL = process.env.PROVIDER_URL || 'http://playtvstreaming.shop';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // Configurações de acesso (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/catalog') {
        const authHeader = req.headers.authorization || '';
        if (!authHeader.startsWith('Basic ')) {
            res.writeHead(401).end(JSON.stringify({ error: "Acesso negado" }));
            return;
        }

        const decoded = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
        const [user, pass] = decoded.split(':');

        // URL de login com o comando de catálogo completo
        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${user}&password=${pass}&action=get_live_categories`;
        
        return fetchFromProvider(targetUrl, res);
    }

    res.writeHead(404).end();
});

function fetchFromProvider(targetUrl, clientRes) {
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    // Simulamos um App Real para o fornecedor não barrar
    const options = {
        headers: {
            'User-Agent': 'IPTVSmarters/1.0.3',
            'Accept': '*/*'
        }
    };

    protocol.get(targetUrl, options, (upstreamRes) => {
        let body = '';
        upstreamRes.on('data', chunk => body += chunk);
        upstreamRes.on('end', () => {
            try {
                // Se o corpo vier vazio, o servidor barrou o User-Agent
                if (!body) throw new Error("Vazio");
                
                const data = JSON.parse(body);
                
                // Verifica se o fornecedor liberou (ele pode mandar array ou objeto)
                if ((data.user_info && data.user_info.auth === 1) || Array.isArray(data)) {
                    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
                    clientRes.end(JSON.stringify({ success: true, user: data.user_info || {} }));
                } else {
                    clientRes.writeHead(401).end(JSON.stringify({ error: "Dados inválidos" }));
                }
            } catch (e) {
                // Se der erro de JSON, tentamos mandar o sucesso se o código for 200
                if (upstreamRes.statusCode === 200) {
                    clientRes.writeHead(200).end(JSON.stringify({ success: true }));
                } else {
                    clientRes.writeHead(401).end(JSON.stringify({ error: "Usuário ou senha incorretos" }));
                }
            }
        });
    }).on('error', () => {
        clientRes.writeHead(502).end();
    });
}

server.listen(PORT, () => console.log("Play Consysencia Pro Ativa!"));
