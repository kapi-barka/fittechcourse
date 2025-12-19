#!/usr/bin/env node

/**
 * Скрипт для настройки иконок PWA
 * Копирует иконки из app/ в public/ и создает необходимые размеры
 */

const fs = require('fs');
const path = require('path');

const appIconPath = path.join(__dirname, '..', 'app', 'icon.png');
const publicDir = path.join(__dirname, '..', 'public');

console.log('🔧 Настройка иконок для PWA...\n');

// Проверка существования app/icon.png
if (fs.existsSync(appIconPath)) {
  console.log('✅ Найдена иконка в app/icon.png');
  
  // Копируем основную иконку
  const icon512Path = path.join(publicDir, 'icon.png');
  const icon512Path2 = path.join(publicDir, 'icon-512.png');
  
  try {
    fs.copyFileSync(appIconPath, icon512Path);
    fs.copyFileSync(appIconPath, icon512Path2);
    console.log('✅ Скопировано: icon.png и icon-512.png');
    
    // Для icon-192.png можно использовать ту же иконку
    // или создать уменьшенную версию (требует ImageMagick или другой инструмент)
    const icon192Path = path.join(publicDir, 'icon-192.png');
    
    // Пробуем скопировать ту же иконку (браузер сам уменьшит)
    fs.copyFileSync(appIconPath, icon192Path);
    console.log('✅ Скопировано: icon-192.png (временная версия)');
    
    console.log('\n✅ Иконки настроены!');
    console.log('\n⚠️  Примечание:');
    console.log('   Для лучшего качества рекомендуется создать icon-192.png размером 192x192px');
    console.log('   Используйте онлайн-генератор: https://www.pwabuilder.com/imageGenerator');
    console.log('   Или см. инструкции в public/ICONS_GUIDE.md');
    
  } catch (error) {
    console.error('❌ Ошибка при копировании иконок:', error.message);
    process.exit(1);
  }
} else {
  console.log('⚠️  Иконка app/icon.png не найдена');
  console.log('\n📝 Что нужно сделать:');
  console.log('   1. Создайте иконку 512x512px');
  console.log('   2. Сохраните её как app/icon.png');
  console.log('   3. Запустите этот скрипт снова: npm run setup:icons');
  console.log('\n   Или создайте иконки вручную в папке public/:');
  console.log('   - icon.png (512x512px)');
  console.log('   - icon-192.png (192x192px)');
  console.log('   - icon-512.png (512x512px)');
  console.log('\n   См. инструкции: public/ICONS_GUIDE.md');
  process.exit(1);
}

