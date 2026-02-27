'use strict';

const http = require('http');
const https = require('https');
const url = require('url');

// Variáveis de Ambiente Injetadas pelo Render (Segurança nível Produção)
const UPSTREAM_URL = process.env.PROVIDER_URL || 'http://aguardando_configuracao';
const UPSTREAM_USER = process.env.PROVIDER_USER || 'usuario';
const UPSTREAM_PASS = process.env.PROVIDER_PASS || 'senha';
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    // 1. Definição estrita de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const clientHost = req.headers.host;

    // 2. Healthcheck para manter o Render acordado
    if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: "Consysencia Online", engine: "BFF Pro v2.0" }));
    }

    // 3. Proxy de Catálogo (JSON) - Oculta API do fornecedor
    if (path === '/catalog') {
        const action = parsedUrl.query.action || 'get_live_categories';
        const targetUrl = `${UPSTREAM_URL}/player_api.php?username=${UPSTREAM_USER}&password=${UPSTREAM_PASS}&action=${action}`;
        return executeProxy(targetUrl, req, res, false, clientHost);
    }

    // 4. Proxy de Streaming e Reescrita de M3U8 (Anti-Vazamento)
    // O Frontend pede: /stream/live/1234.m3u8
    if (path.startsWith('/stream/')) {
        const pathParts = path.replace('/stream/', '').split('/'); 
        const type = pathParts[0]; // 'live', 'movie', ou 'series'
        const file = pathParts[1]; // '1234.m3u8' ou '1234.ts'

        if (!type || !file) {
            res.writeHead(400).end(JSON.stringify({ error: "Formato de stream inválido" }));
            return;
        }

        // Reconstrói a URL do fornecedor injetando as credenciais no meio
        const targetUrl = `${UPSTREAM_URL}/${type}/${UPSTREAM_USER}/${UPSTREAM_PASS}/${file}`;
        
        // Verifica se precisa reescrever o arquivo (apenas se for m3u8)
        const isM3U8 = file.endsWith('.m3u8');
        return executeProxy(targetUrl, req, res, isM3U8, clientHost, type);
    }

    res.writeHead(404).end(JSON.stringify({ error: "Rota não implementada no BFF" }));
});

function executeProxy(targetUrl, clientReq, clientRes, rewriteM3u8, clientHost, streamType = '') {
    const protocol = targetUrl.startsWith('https') ? https : http;
    
    protocol.get(targetUrl, {
        headers: {
            'User-Agent': 'ConsysenciaPlay_Engine/2.0',
            'Accept': '*/*'
        }
    }, (upstreamRes) => {
        const headers = { ...upstreamRes.headers };
        headers['Access-Control-Allow-Origin'] = '*';
        delete headers['set-cookie']; // Impede vazamento de sessão do upstream

        if (!rewriteM3u8) {
            clientRes.writeHead(upstreamRes.statusCode, headers);
            return upstreamRes.pipe(clientRes);
        }

        // Lógica de Reescrita de Playlist (M3U8)
        let body = '';
        upstreamRes.on('data', chunk => body += chunk);
        upstreamRes.on('end', () => {
            if (upstreamRes.statusCode !== 200) {
                clientRes.writeHead(upstreamRes.statusCode, headers);
                return clientRes.end(body);
            }

            // Expressão regular para encontrar e apagar a URL real do fornecedor, 
            // substituindo pelo proxy da Consysencia.
            const regexAbsoluteUrl = new RegExp(`${UPSTREAM_URL}/${streamType}/${UPSTREAM_USER}/${UPSTREAM_PASS}/`, 'g');
            const rewrittenBody = body.replace(regexAbsoluteUrl, `https://${clientHost}/stream/${streamType}/`);
            
            headers['Content-Length'] = Buffer.byteLength(rewrittenBody);
            clientRes.writeHead(200, headers);
            clientRes.end(rewrittenBody);
        });
    }).on('error', (err) => {
        clientRes.writeHead(502).end(JSON.stringify({ error: "Falha de comunicação com o Upstream" }));
    });
}

server.listen(PORT, () => {
    console.log(`BFF Consysencia Pro ativo na porta ${PORT}`);
});
