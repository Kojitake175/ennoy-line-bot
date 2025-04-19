const { google } = require('googleapis');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const auth = new google.auth.GoogleAuth({
  keyFile: './voltaic-mode-428705-s2-f2f0dcddfa23.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const spreadsheetId = '14jilGL8Lgz0EeXP6q210frdbK-2ijoT4ZTFMFk-4k3Q';
const sheetName = 'ennoy';

(async () => {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await axios.get('https://www.ennoy.pro/load_items/', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.ennoy.pro'
    }
  });

  const $ = cheerio.load(res.data);
  const items = [];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();

  const updateDate = `${year}-${month}-${day} ${hour}:${minute}:${second}`;

  if ($('.items-grid_itemListLI_5c97110f').length === 0) {
    items.push(['商品なし', '', '', updateDate]);
  } else {
    $('.items-grid_itemListLI_5c97110f').each((i, el) => {
      const title = $(el).find('.items-grid_itemTitleText_5c97110f').text().trim();
      const price = $(el).find('.items-grid_price_5c97110f').text().trim();
      const url = $(el).find('a').attr('href');
      items.push([title, price, `https://www.ennoy.pro${url}`, updateDate]);
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: items,
    },
  });

  console.log('✅ スプレッドシートに書き込み完了');
})();
