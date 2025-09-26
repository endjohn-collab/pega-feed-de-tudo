const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const express = require('express');

// =====================
// Configurações
// =====================
const JSON_FILE = path.join(__dirname, 'artigos.json');
const LOG_FILE = path.join(__dirname, 'roda-feed.log');
const INTERVAL = 1000 * 60 * 60; // 1 hora
const MAX_ARTICLES = 1000;

// Geradores
const noticias = require('./geradores/noticias');
const geek = require('./geradores/geek');
const tech = require('./geradores/tech');

// =====================
// Funções auxiliares
// =====================
function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`, 'utf-8');
    console.log(msg);
}

// =====================
// Captura todos feeds e gera JSON
// =====================
async function gerarTodosFeeds() {
    log('🔄 Iniciando captura de feeds...');

    let artigos = [];

    // Executa cada gerador e adiciona categoria
    const feedsNoticias = await noticias();
    feedsNoticias.forEach(a => {
        a.categoria = 'NOTICIAS';
        log(`📰 Capturado: ${a.title}`);
    });

    const feedsGeek = await geek();
    feedsGeek.forEach(a => {
        a.categoria = 'GEEK';
        log(`🤓 Capturado: ${a.title}`);
    });

    const feedsTech = await tech();
    feedsTech.forEach(a => {
        a.categoria = 'TECH';
        log(`💻 Capturado: ${a.title}`);
    });

    // Junta tudo e remove duplicados pelo guid
    artigos = [...feedsNoticias, ...feedsGeek, ...feedsTech];
    artigos = artigos.filter((a, i, arr) => i === arr.findIndex(b => b.guid === a.guid));
    
    // Limita total de artigos
    artigos.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    artigos = artigos.slice(0, MAX_ARTICLES);

    // Salva JSON localmente
    fs.writeFileSync(JSON_FILE, JSON.stringify(artigos, null, 2), 'utf-8');
    log(`✅ Feed atualizado. Total de artigos: ${artigos.length}`);

    // Envia para FTP
    await uploadToHostGator();
}

// =====================
// Upload FTP
// =====================
async function uploadToHostGator() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "ftp.johnporto.com.br",
            user: "rss@johnporto.com.br",
            password: "+2{3-OZ.OMpS",
            secure: false
        });
        log("🔄 Conectado ao FTP. Enviando artigos.json...");
        await client.uploadFrom(JSON_FILE, "artigos.json");
        log("✅ Upload concluído!");
    } catch (err) {
        log(`⚠️ Erro no FTP: ${err.message}`);
    }
    client.close();
}

// =====================
// Inicialização
// =====================
async function runFeeds() {
    try {
        await gerarTodosFeeds();
    } catch (err) {
        log(`❌ Erro inesperado: ${err.message}`);
    }
}

// Rodar na inicialização
runFeeds();

// Rodar periodicamente
setInterval(runFeeds, INTERVAL);

// =====================
// Express para manter processo vivo
// =====================
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Estamos VIVOS e rodando JSON a cada 1 hora!'));
app.listen(PORT, () => log(`Servidor rodando na porta ${PORT}`));
