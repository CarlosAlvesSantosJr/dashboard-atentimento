// Servidor estático mínimo para desenvolvimento e testes (sem dependências)
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 8080;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const arquivo = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!arquivo.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, (err, conteudo) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    res.end(conteudo);
  });
}).listen(PORT, () => console.log(`Painel SAMU em http://localhost:${PORT}`));
