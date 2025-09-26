const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');

const JSON_FILE = path.join(__dirname, 'artigos.json');
const LOG_FILE = path.join(__dirname, 'roda-feed.log');
const RSS_FEEDS = [
  'https://br.cointelegraph.com/rss',
  'https://www.geekwire.com/feed/',
  'https://g1.globo.com/rss/g1/',
  'https://boingboing.net/feed',
  'https://www.careergeekblog.com/feed/',
  'https://www.wired.com/feed/category/gear/latest/rss',
  'https://www.wired.com/feed/category/ideas/latest/rss',
  'https://www.wired.com/feed/category/security/latest/rss',
  'https://www.wired.com/feed/category/science/latest/rss',
  'https://www.wired.com/feed/category/culture/latest/rss',
  'https://www.wired.com/feed/tag/ai/latest/rss',
  'https://www.wired.com/feed/category/backchannel/latest/rss'
];

const MAX_ARTICLES = 1000;

// Função de log
function log(msg) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`, 'utf-8');
  console.log(msg);
}

// Função para filtrar URLs de imagens
function filterImages(urls) {
  return urls.filter(url => /\.(jpe?g|png|gif|webp)$/i.test(url));
}

// Captura conteúdo HTML e imagens
async function fetchPageContent(url) {
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(data);

    let text = '';
    const selectors = ['div.post-content', 'div.article-body', 'article', 'div.entry-content', 'div#content'];
    for (let sel of selectors) {
      if ($(sel).text().trim().length > 50) {
        text = $(sel).text().trim();
        break;
      }
    }
    if (!text) text = $('body').text().trim();

    // Pega imagens
    const imgEls = $('img').map((i, el) => $(el).attr('src')).get();
    const images = filterImages(imgEls);

    return { text, images };
  } catch (err) {
    log(`⚠️ Erro ao acessar ${url}: ${err.message}`);
    return { text: '', images: [] };
  }
}

// Captura artigos de um feed RSS
async function fetchFeed(rssUrl, existingArticles) {
  const parser = new RSSParser();
  let feed;
  try {
    feed = await parser.parseURL(rssUrl);
    log(`✅ Feed carregado: ${rssUrl}`);
  } catch (err) {
    log(`⚠️ Erro ao carregar feed ${rssUrl}: ${err.message}`);
    return [];
  }

  const newArticles = [];
  for (const item of feed.items) {
    const { title, link, guid, pubDate, contentSnippet, enclosure, 'media:content': mediaContent, ...rest } = item;
    const normalizedLink = link && link.startsWith('http') ? link : null;
    if (!normalizedLink) continue;

    if (existingArticles.some(a => a.guid === guid || a.link === normalizedLink)) continue;

    log(`Capturando artigo: ${title}`);

    let pageContent = contentSnippet || '';
    let pageImages = [];

    const pageData = await fetchPageContent(normalizedLink);
    if (pageData.text) pageContent = pageData.text;
    pageImages = pageData.images;

    const rssImages = [];
    if (mediaContent) {
      if (Array.isArray(mediaContent)) mediaContent.forEach(m => m.url && rssImages.push(m.url));
      else if (mediaContent.url) rssImages.push(mediaContent.url);
    }
    if (enclosure) {
      if (Array.isArray(enclosure)) enclosure.forEach(e => e.url && rssImages.push(e.url));
      else if (enclosure.url) rssImages.push(enclosure.url);
    }

    const allImages = filterImages([...rssImages, ...pageImages]);

    if (allImages.length === 0) log(`⚠️ Nenhuma imagem encontrada para: ${title}`);
    else log(`✅ ${allImages.length} imagem(ns) encontradas para: ${title}`);

    newArticles.push({
      title,
      link: normalizedLink,
      guid: guid || normalizedLink,
      pubDate: pubDate || new Date().toISOString(),
      content: pageContent,
      images: allImages,
      rssFields: rest
    });
  }

  return newArticles;
}

// Loop principal
async function fetchAllFeeds() {
  let existingArticles = [];
  if (fs.existsSync(JSON_FILE)) {
    existingArticles = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  }

  const allNewArticlesArrays = await Promise.all(
    RSS_FEEDS.map(feed => fetchFeed(feed, existingArticles))
  );

  let allNewArticles = allNewArticlesArrays.flat();
  let allArticles = [...existingArticles, ...allNewArticles];

  // Remove duplicados
  allArticles = allArticles.filter((a, index, self) => index === self.findIndex(b => b.guid === a.guid));
  allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  allArticles = allArticles.slice(0, MAX_ARTICLES);

  fs.writeFileSync(JSON_FILE, JSON.stringify(allArticles, null, 2), 'utf-8');
  log(`✅ Artigos atualizados! Total: ${allArticles.length}`);
}

// Upload FTP
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
    log("Conectado ao FTP. Enviando artigos.json...");
    await client.uploadFrom(JSON_FILE, "artigos.json");
    log("✅ Upload concluído!");
  } catch (err) {
    log(`⚠️ Erro no FTP: ${err.message}`);
  }
  client.close();
}

// Executa
fetchAllFeeds().then(() => uploadToHostGator());
