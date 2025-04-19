if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { google } = require('googleapis');
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
      'Referer': 'https://www.ennoy.pro',
    },
  });

  const $ = cheerio.load(res.data);
  const items = [];

  const now = new Date();
  const updateDate = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });

  let lineMessage = `ENNOY更新チェック：${updateDate}\n`;

  if ($('.items-grid_itemListLI_5c97110f').length === 0) {
    items.push(['商品なし', '', '', updateDate]);
    lineMessage += '現在出品中の商品はありません。';
  } else {
    $('.items-grid_itemListLI_5c97110f').each((i, el) => {
      const title = $(el).find('.items-grid_itemTitleText_5c97110f').text().trim();
      const price = $(el).find('.items-grid_price_5c97110f').text().trim();
      const url = $(el).find('a').attr('href');
      items.push([title, price, url, updateDate]);
      lineMessage += `\n${title} - ${price}\n${url}`;
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

  const { LINE_USER_ID, LINE_ACCESS_TOKEN } = process.env;

  if (!LINE_USER_ID || !LINE_ACCESS_TOKEN) {
    console.error('❌ LINE_USER_ID または LINE_ACCESS_TOKEN が未設定です。');
    return;
  }

  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    {
      to: LINE_USER_ID,
      messages: [
        {
          type: 'text',
          text: lineMessage,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${LINE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log('LINE通知送信完了');
})();
