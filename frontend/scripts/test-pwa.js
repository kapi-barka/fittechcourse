#!/usr/bin/env node

/**
 * Скрипт для проверки PWA конфигурации
 * Использование: node scripts/test-pwa.js [url]
 * Пример: node scripts/test-pwa.js http://localhost:3000
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3000';
const results = {
  manifest: false,
  serviceWorker: false,
  icons: [],
  https: url.startsWith('https'),
};

console.log('🔍 Проверка PWA конфигурации...\n');
console.log(`URL: ${url}\n`);

// Проверка manifest.json
function checkManifest() {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const manifestUrl = new URL('/manifest.json', url).href;
    
    client.get(manifestUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const manifest = JSON.parse(data);
            results.manifest = true;
            console.log('✅ Manifest.json найден');
            console.log(`   Название: ${manifest.name || manifest.short_name || 'N/A'}`);
            console.log(`   Краткое название: ${manifest.short_name || 'N/A'}`);
            console.log(`   Тема: ${manifest.theme_color || 'N/A'}`);
            console.log(`   Фон: ${manifest.background_color || 'N/A'}`);
            
            if (manifest.icons && manifest.icons.length > 0) {
              console.log(`   Иконки: ${manifest.icons.length} шт.`);
              results.icons = manifest.icons;
            } else {
              console.log('   ⚠️  Иконки не найдены в manifest');
            }
            resolve(true);
          } catch (e) {
            console.log('❌ Manifest.json содержит ошибки:', e.message);
            resolve(false);
          }
        } else {
          console.log('❌ Manifest.json не найден (статус:', res.statusCode, ')');
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log('❌ Ошибка при проверке manifest:', err.message);
      resolve(false);
    });
  });
}

// Проверка service worker
function checkServiceWorker() {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const swUrls = ['/sw.js', '/service-worker.js', '/worker.js'];
    let checked = 0;
    
    swUrls.forEach(swPath => {
      const swUrl = new URL(swPath, url).href;
      client.get(swUrl, (res) => {
        checked++;
        if (res.statusCode === 200) {
          results.serviceWorker = true;
          console.log(`✅ Service Worker найден: ${swPath}`);
          resolve(true);
        } else if (checked === swUrls.length) {
          console.log('⚠️  Service Worker не найден (проверьте регистрацию в коде)');
          resolve(false);
        }
      }).on('error', () => {
        checked++;
        if (checked === swUrls.length && !results.serviceWorker) {
          console.log('⚠️  Service Worker не найден (проверьте регистрацию в коде)');
          resolve(false);
        }
      });
    });
  });
}

// Проверка локальных файлов
function checkLocalFiles() {
  const publicDir = path.join(__dirname, '..', 'public');
  const manifestPath = path.join(publicDir, 'manifest.json');
  
  console.log('\n📁 Проверка локальных файлов:');
  
  if (fs.existsSync(manifestPath)) {
    console.log('✅ manifest.json найден в public/');
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.icons) {
        manifest.icons.forEach(icon => {
          const iconPath = path.join(publicDir, icon.src);
          if (fs.existsSync(iconPath)) {
            console.log(`   ✅ Иконка: ${icon.src} (${icon.sizes || 'N/A'})`);
          } else {
            console.log(`   ❌ Иконка не найдена: ${icon.src}`);
          }
        });
      }
    } catch (e) {
      console.log('   ⚠️  Ошибка чтения manifest.json:', e.message);
    }
  } else {
    console.log('❌ manifest.json не найден в public/');
  }
}

// Итоговый отчет
function printReport() {
  console.log('\n' + '='.repeat(50));
  console.log('📊 ИТОГОВЫЙ ОТЧЕТ');
  console.log('='.repeat(50));
  
  console.log(`Manifest.json: ${results.manifest ? '✅' : '❌'}`);
  console.log(`Service Worker: ${results.serviceWorker ? '✅' : '⚠️ '}`);
  console.log(`HTTPS: ${results.https ? '✅' : '⚠️  (требуется для production)'}`);
  console.log(`Иконки: ${results.icons.length > 0 ? `✅ (${results.icons.length})` : '❌'}`);
  
  const score = [
    results.manifest,
    results.serviceWorker,
    results.icons.length > 0,
    results.https || url.includes('localhost')
  ].filter(Boolean).length;
  
  console.log(`\nОценка PWA: ${score}/4`);
  
  if (score === 4) {
    console.log('🎉 PWA полностью настроен!');
  } else if (score >= 2) {
    console.log('⚠️  PWA частично настроен, требуется доработка');
  } else {
    console.log('❌ PWA не настроен, требуется настройка');
  }
  
  console.log('\n💡 Рекомендации:');
  if (!results.manifest) {
    console.log('   - Создайте manifest.json в папке public/');
  }
  if (!results.serviceWorker) {
    console.log('   - Настройте service worker для кеширования');
  }
  if (results.icons.length === 0) {
    console.log('   - Добавьте иконки различных размеров');
  }
  if (!results.https && !url.includes('localhost')) {
    console.log('   - Настройте HTTPS для production');
  }
}

// Запуск проверок
async function runChecks() {
  await checkManifest();
  await checkServiceWorker();
  checkLocalFiles();
  printReport();
}

runChecks().catch(console.error);

