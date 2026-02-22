const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 5501;
const INDEX_PATH = path.join(__dirname, 'index.html');
const MAX_BODY_BYTES = 10 * 1024 * 1024;

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(payload));
}

function sendNoContent(res) {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
}

function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        let size = 0;

        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body too large.'));
                req.destroy();
                return;
            }
            raw += chunk.toString('utf8');
        });

        req.on('end', () => {
            try {
                const parsed = JSON.parse(raw || '{}');
                resolve(parsed);
            } catch (error) {
                reject(new Error('Invalid JSON body.'));
            }
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
}

async function writeIndexHtml(html) {
    const tempPath = `${INDEX_PATH}.tmp`;
    await fs.writeFile(tempPath, html, 'utf8');
    await fs.rename(tempPath, INDEX_PATH);
}

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        sendNoContent(res);
        return;
    }

    if (req.method === 'POST' && req.url === '/save-index') {
        try {
            const body = await parseRequestBody(req);
            const html = body && typeof body.html === 'string' ? body.html : '';

            if (!html || !html.includes('<html')) {
                sendJson(res, 400, { error: 'Invalid html payload.' });
                return;
            }

            await writeIndexHtml(html);
            sendJson(res, 200, { ok: true, message: 'index.html saved.' });
        } catch (error) {
            sendJson(res, 500, { error: error.message || 'Failed to save index.html.' });
        }
        return;
    }

    sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, HOST, () => {
    console.log(`Save server running at http://${HOST}:${PORT}`);
});
