const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const JSON_FILE = path.join(__dirname, 'artigos.json');
const SELECTORS = [
  'div.post-content',
  'div.article-body',
  'article',
  'div.entry-content',
  'div#content'
];

const RSS_FEEDS = [
  'https://br.cointelegraph.com/rss',
  'https://www.geekwire.com/feed/',
  'https://g1.globo.com/rss/g1/'
];

const MAX_ARTICLES = 200;
const ARTICLE_DELAY = 1000; // 1 segundo

async function fetchFeed(rssUrl, page, existingArticles) {
  const parser = new RSSParser();
  const feed = await parser.parseURL(rssUrl);
  const newArticles = [];

  for (const item of feed.items) {
    const { title, link, guid } = item;

    // Evita duplicatas pelo guid
    if (existingArticles.some(a => a.guid === guid)) continue;

    console.log('Capturando:', title);

    try {
      await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });

      const content = await page.evaluate((SELECTORS) => {
        for (let selector of SELECTORS) {
          const el = document.querySelector(selector);
          if (el && el.innerText.trim().length > 50) return el.innerText.trim();
        }
        return Array.from(document.body.querySelectorAll('*'))
          .filter(el => el.offsetParent !== null)
          .map(el => el.innerText)
          .join('\n')
          .trim();
      }, SELECTORS);

      if (!content) continue;

      newArticles.push({ title, link, guid, content });

      // Delay compatível com todas as versões do Puppeteer
      await new Promise(resolve => setTimeout(resolve, ARTICLE_DELAY));

    } catch (err) {
      console.error('Erro ao acessar', link, err.message);
    }
  }

  return newArticles;
}

async function fetchAllFeeds() {
  let existingArticles = [];
  if (fs.existsSync(JSON_FILE)) {
    existingArticles = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  }

  const browser = await puppeteer.launch({
    headless: true, // sem abrir janela
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let allNewArticles = [];

  for (const feed of RSS_FEEDS) {
    const articlesFromFeed = await fetchFeed(feed, page, existingArticles.concat(allNewArticles));
    allNewArticles = allNewArticles.concat(articlesFromFeed);
  }

  await browser.close();

  let allArticles = [...existingArticles, ...allNewArticles];
  if (allArticles.length > MAX_ARTICLES) {
    allArticles = allArticles.slice(-MAX_ARTICLES);
  }

  fs.writeFileSync(JSON_FILE, JSON.stringify(allArticles, null, 2), 'utf-8');
  console.log(`✅ Artigos atualizados! Total: ${allArticles.length}`);
}

fetchAllFeeds();
