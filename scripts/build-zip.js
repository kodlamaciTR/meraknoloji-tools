import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const distDir = path.resolve('dist');
const zipPath = path.resolve('netlify-dist.zip');
const publicDir = path.resolve('public');

console.log('=== Netlify Dağıtım Paketi (.zip) Oluşturuluyor ===');

if (!fs.existsSync(distDir)) {
  console.error('Hata: dist/ klasörü bulunamadı. Lütfen önce vite build komutunu çalıştırın.');
  process.exit(1);
}

try {
  const zip = new AdmZip();

  // dist klasöründeki dosyaları zip kök dizinine ekleyelim
  const items = fs.readdirSync(distDir);
  for (const item of items) {
    if (item === 'netlify-dist.zip') continue; // Kendi kendisini eklemesini önle
    
    const fullPath = path.join(distDir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      zip.addLocalFolder(fullPath, item);
      console.log(`  Klasör eklendi: ${item}/`);
    } else {
      zip.addLocalFile(fullPath);
      console.log(`  Dosya eklendi: ${item}`);
    }
  }

  // Geçici zip dosyasını yazalım
  zip.writeZip(zipPath);

  // Klasörlerin varlığından emin olalım
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Dağıtılacak yerlere kopyalayalım
  fs.copyFileSync(zipPath, path.join(publicDir, 'netlify-dist.zip'));
  fs.copyFileSync(zipPath, path.join(distDir, 'netlify-dist.zip'));

  // Geçici dosyayı silelim
  fs.unlinkSync(zipPath);

  console.log('✔ Başarıyla netlify-dist.zip dosyası public/ ve dist/ klasörlerine kaydedildi!');
} catch (error) {
  console.error('Zip paketleme sırasında bir hata oluştu:', error);
  process.exit(1);
}
