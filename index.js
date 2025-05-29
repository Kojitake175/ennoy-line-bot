if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { google } = require('googleapis');
const axios = require('axios');
const cheerio = require('cheerio');

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const spreadsheetId = '14jilGL8Lgz0EeXP6q210frdbK-2ijoT4ZTFMFk-4k3Q';
const sheetName = 'ennoy';

async function safeAppend(sheets, items) {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: items },
      });
      console.log('スプレッドシートに書き込み完了');
      return;
    } catch (error) {
      if (error.code === 503) {
        console.warn(`⚠️ 503エラー発生。リトライ (${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.error('その他エラー:', error.message);
        throw error;
      }
    }
  }
  throw new Error('スプレッドシート書き込みリトライ上限に達しました');
}

(async () => {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!C2:D`,
  });

  const existingEntries = new Set(
    (readRes.data.values || []).map(([url, stock]) => `${url}|${stock}`)
  );

  const res = await axios.get('https://www.ennoy.pro/load_items/', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.ennoy.pro',
    },
  });

  const $ = cheerio.load(res.data);
  const now = new Date();
  const updateDate = now.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });

  const allItems = [];
  const notifyItems = [];
  let lineMessage = `ENNOY更新チェック：${updateDate}\n`;

  $('a.js-anchor').each((i, el) => {
    const title = $(el).find('p[class*="itemTitleText"]').text().trim();
    const price = $(el).find('p[class*="price"]').text().trim();
    const relativeUrl = $(el).attr('href');
    const fullUrl = `https://www.ennoy.pro${relativeUrl}`;
    const stockStatus = $(el).find('p[class*="soldOut"]').text().trim() || 'IN STOCK';

    const uniqueKey = `${fullUrl}|${stockStatus}`;

    const row = [title, price, fullUrl, stockStatus, updateDate];
    allItems.push(row);

    if (!existingEntries.has(uniqueKey)) {
      notifyItems.push(row);
      lineMessage += `\n${title} - ${price} - ${stockStatus}\n${fullUrl}`;
    }
  });

  // スプレッドシート常に更新する
  await safeAppend(sheets, allItems);

  // 新着商品や在庫変化がある場合のみLINE通知する
  if (notifyItems.length > 0) {
    const { LINE_USER_ID, LINE_ACCESS_TOKEN } = process.env;
    if (!LINE_USER_ID || !LINE_ACCESS_TOKEN) {
      console.error('LINE_USER_ID または LINE_ACCESS_TOKEN が未設定です。');
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
  } else {
    console.log('新着・在庫復活はありません。');
  }
})();
