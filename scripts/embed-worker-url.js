#!/usr/bin/env node

/**
 * ビルドスクリプト: Cloudflare API から Worker URL を取得して HTML に埋め込む
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function getWorkerUrl() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN is not set');
  }

  console.log('🔍 Cloudflare API から Account ID を取得中...');
  
  // Get accounts
  const accountsOptions = {
    hostname: 'api.cloudflare.com',
    path: '/client/v4/accounts',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const accountsData = await makeRequest(accountsOptions);
  
  if (!accountsData.result || accountsData.result.length === 0) {
    throw new Error('No Cloudflare accounts found');
  }

  const accountId = accountsData.result[0].id;
  console.log(`✅ Account ID: ${accountId}`);

  // Get worker details
  const workerName = 'wos-rally-tracker';
  console.log(`🔍 Worker URL を取得中 (${workerName})...`);

  const workerOptions = {
    hostname: 'api.cloudflare.com',
    path: `/client/v4/accounts/${accountId}/workers/services/${workerName}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  const workerData = await makeRequest(workerOptions);

  if (!workerData.result || !workerData.result.default_environment) {
    throw new Error('Worker not found or not deployed');
  }

  const env = workerData.result.default_environment;
  const workerUrl = `https://${env.subdomain}.${env.domain}`;

  console.log(`✅ Worker URL: ${workerUrl}`);
  return workerUrl;
}

async function embedWorkerUrlInHtml(workerUrl) {
  const htmlPath = path.join(__dirname, '..', 'WOS_rally_tracker.html');
  
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  console.log(`📝 HTML に Worker URL を埋め込み中...`);
  
  let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // Replace the WORKER_URL_PLACEHOLDER in loadRoomSettings function
  // Before: const defaultEndpoint = 'WORKER_URL_PLACEHOLDER';
  // After: const defaultEndpoint = 'https://...workers.dev';
  
  const placeholder = 'WORKER_URL_PLACEHOLDER';
  
  if (htmlContent.includes(placeholder)) {
    htmlContent = htmlContent.replace(placeholder, workerUrl);
    console.log('✅ HTML を更新しました');
  } else {
    console.warn('⚠️ 置換対象が見つかりませんでした。手動で確認してください。');
  }

  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`✅ ${htmlPath} に保存しました`);
}

async function main() {
  try {
    const workerUrl = await getWorkerUrl();
    await embedWorkerUrlInHtml(workerUrl);
    console.log('\n✨ ビルド完了！');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main();
