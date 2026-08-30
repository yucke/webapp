#!/usr/bin/env node

/**
 * ビルドスクリプト: HTML を Worker に埋め込む
 * Cloudflare API から Worker URL を取得して HTML に埋め込む
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
    console.log('⚠️  CLOUDFLARE_API_TOKEN not set - using placeholder');
    return 'https://wos-rally-tracker.example.workers.dev';
  }

  try {
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
  } catch (error) {
    console.warn(`⚠️  Failed to get Worker URL: ${error.message}`);
    return 'https://wos-rally-tracker.example.workers.dev';
  }
}

async function embedHtmlInWorker(workerUrl) {
  const htmlPath = path.join(__dirname, '..', 'WOS_rally_tracker.html');
  const workerPath = path.join(__dirname, '..', 'worker.js');
  
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML file not found: ${htmlPath}`);
  }

  if (!fs.existsSync(workerPath)) {
    throw new Error(`Worker file not found: ${workerPath}`);
  }

  console.log(`📝 HTML を取得中...`);
  let htmlContent = fs.readFileSync(htmlPath, 'utf-8');

  // Update the placeholder in HTML
  const workerUrlPattern = /const defaultEndpoint = 'WORKER_URL_PLACEHOLDER'/;
  htmlContent = htmlContent.replace(
    workerUrlPattern,
    `const defaultEndpoint = '${workerUrl}'`
  );

  fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
  console.log(`✅ HTML を更新しました (Worker URL: ${workerUrl})`);

  // Now embed HTML in worker.js
  console.log(`📝 Worker に HTML を埋め込み中...`);
  let workerContent = fs.readFileSync(workerPath, 'utf-8');

  // Escape HTML for JavaScript
  const escapedHtml = htmlContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  // Replace the placeholder
  const oldPlaceholder = 'const HTML_CONTENT = `{{HTML_PLACEHOLDER}}`;';
  const newPlaceholder = `const HTML_CONTENT = \`${escapedHtml}\`;`;

  if (workerContent.includes(oldPlaceholder)) {
    workerContent = workerContent.replace(oldPlaceholder, newPlaceholder);
    console.log('✅ Worker を更新しました');
  } else {
    throw new Error('Worker placeholder not found');
  }

  fs.writeFileSync(workerPath, workerContent, 'utf-8');
  console.log(`✅ ${workerPath} に保存しました`);
}

async function main() {
  try {
    const workerUrl = await getWorkerUrl();
    await embedHtmlInWorker(workerUrl);
    console.log('\n✨ ビルド完了！');
    process.exit(0);
  } catch (error) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

main();
