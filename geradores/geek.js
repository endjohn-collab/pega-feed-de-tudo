const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');

const RSS_FEEDS = [
    'https://www.diversetechgeek.com/feed/',
    'https://www.wired.com/feed/category/gear/latest/rss',
    'https://www.wired.com/feed/category/ideas/latest/rss',
    'https://www.wired.com/feed/category/security/latest/rss',
    'https://www.wired.com/feed/category/science/latest/rss',
    'https://www.wired.com/feed/category/culture/latest/rss',
    'https://www.wired.com/feed/tag/ai/latest/rss',
    'https://www.wired.com/feed/category/backchannel/latest/rss',
    'https://www.geekwire.com/feed/'
];

function filterImages(urls) {
    return urls.filter(url => /\.(jpe?g|png|gif|webp)$/i.test(url));
}

async function fetchPageContent(url) {
    try {
        const { data } = await axios.get(url, { timeout: 15000 });
        const $ = cheerio.load(data);
        let text = $('article').text().trim() || $('body').text().trim();
        const images = filterImages($('img').map((i, el) => $(el).attr('src')).get());
        return { text, images };
    } catch (err) {
        console.log(`⚠️ Erro ao acessar ${url}: ${err.message}`);
        return { text: '', images: [] };
    }
}

module.exports = async function() {
    const parser = new RSSParser();
    let artigos = [];

    for (const feedUrl of RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(feedUrl);
            for (const item of feed.items) {
                const { title, link, guid, pubDate, contentSnippet } = item;
                const pageData = await fetchPageContent(link);
                artigos.push({
                    title,
                    link,
                    guid: guid || link,
                    pubDate: pubDate || new Date().toISOString(),
                    content: pageData.text || contentSnippet,
                    images: pageData.images || []
                });
            }
        } catch (err) {
            console.log(`⚠️ Erro no feed ${feedUrl}: ${err.message}`);
        }
    }

    return artigos;
};
