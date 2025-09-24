const puppeteer = require('puppeteer');
const RSSParser = require('rss-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JSON_FILE = path.join(__dirname, 'artigos.json');

async function fetchArticles() {
  const parser = new RSSParser();
  const rssUrl = 'https://br.cointelegraph.com/rss';
  const feed = await parser.parseURL(rssUrl);

  // Puppeteer configurado para headless + args para servidor Render
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  const artigos = [];

  for (const item of feed.items) {
    const { title, link } = item;
    console.log('Capturando:', title);

    try {
      await page.goto(link, { waitUntil: 'networkidle2' });

      const content = await page.evaluate(() => {
        const articleDiv = document.querySelector('div.post-content');
        return articleDiv ? articleDiv.innerText.trim() : '';
      });

      if (!content) continue;

      artigos.push({ title, link, content });

    } catch (err) {
      console.error('Erro ao acessar', link, err);
    }
  }

  await browser.close();

  fs.writeFileSync(JSON_FILE, JSON.stringify(artigos, null, 2), 'utf-8');
  console.log('✅ Artigos salvos em artigos.json');
}

// Rota para disponibilizar JSON
app.get('/artigos', (req, res) => {
  if (fs.existsSync(JSON_FILE)) {
    const data = fs.readFileSync(JSON_FILE, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } else {
    res.json([]);
  }
});

// Inicia servidor Express
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  // Captura os artigos na inicialização
  fetchArticles();
});
