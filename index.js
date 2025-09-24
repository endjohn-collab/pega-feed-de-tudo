const puppeteer = require('puppeteer');
const RSSParser = require('rss-parser');
const fs = require('fs');

(async () => {
  const parser = new RSSParser();
  const rssUrl = 'https://br.cointelegraph.com/rss';
  const feed = await parser.parseURL(rssUrl);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const artigos = [];

  for (const item of feed.items) {
    const { title, link } = item;

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

  // Salva JSON para o site consumir
  fs.writeFileSync('artigos.json', JSON.stringify(artigos, null, 2), 'utf-8');
})();
