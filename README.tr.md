# Prompter for Everyone

Telefon veya bilgisayarda çalışan, kamera kaydı yapabilen açık kaynak bir web prompter uygulaması. Metnini yaz, akış hızını, yazı genişliğini ve rengini ayarla, videonu çekip cihazına kaydet.

React, TypeScript ve Vite ile hazırlanmıştır. Hesap, şifre, sunucu, veritabanı, API anahtarı veya AI aboneliği gerektirmez. Metinler ve okuma ayarları kendi tarayıcında saklanır. Video, indirene kadar tarayıcının belleğinde kalır.

[English README](README.md) · [Yayınlama](docs/DEPLOYMENT.md) · [Mimari](docs/ARCHITECTURE.md) · [Kodlama ajanları için rehber](AGENTS.md)

## Özellikler

- Metin ekleme, düzenleme, silme ve çekildi olarak işaretleme.
- Kamera görüntüsünün üstünde akan prompter metni ve kamera/mikrofon kaydı. Metin, kaydedilen videoya gömülmez.
- Akış hızı, **%20–%100** metin genişliği ve beyaz, krem veya mint yazı rengi.
- Çekim sonrası önizleme, yeniden çekim, indirme ve desteklenen mobil tarayıcılarda paylaşım ekranı.
- Aynı tarayıcı ve site adresinde sayfa yenilense de korunan kişisel metin listesi.

Metinler cihazlar arasında otomatik eşitlenmez. Telefon ve bilgisayardan aynı siteyi açsan da her tarayıcının metin listesi ayrıdır. Sitenin tarayıcı verilerini temizlemek, kaydedilmiş metinleri ve ayarları da siler.

## Bilgisayarda çalıştırma

**Node.js 24 LTS** kurduktan sonra:

```sh
git clone https://github.com/demirarif/prompter-for-everyone.git
cd prompter-for-everyone
npm ci
npm run dev
```

Vite'ın gösterdiği adresi aç; varsayılan adres `http://localhost:5173` olur. Kayıt yapmak istediğinde tarayıcıdan kamera ve mikrofon izni ver.

```sh
npm test
npm run build
npm run preview
```

Üretim çıktısı `dist/` klasörüne hazırlanır. `index.html` dosyasını doğrudan çift tıklayarak açmak yerine geliştirme sunucusunu veya bir statik web sunucusunu kullan.

## Telefondan kullanma

`dist/` klasörünü HTTPS sağlayan bir statik web hizmetinde yayınla ve bu adresi iPhone veya Android telefondan aç. GitHub Pages, Netlify ve Vercel adımları [yayınlama belgesinde](docs/DEPLOYMENT.md) bulunur.

Kamera için HTTPS veya tarayıcının `localhost` istisnası gerekir. Telefonun `http://192.168.x.x:5173` gibi bir bilgisayar adresini açması `localhost` sayılmaz. Yalnızca `--host` eklemek HTTPS sağlamaz. Telefonla geliştirme testi için HTTPS yayını veya HTTPS geliştirme tüneli kullan.

Kayıt biçimi tarayıcı desteğine göre MP4 veya WebM olabilir. Bilgisayarda doğrudan indirme kullanılır; desteklenen mobil tarayıcılarda paylaşım ekranı ve indirme alternatifi vardır. Uzun kayıtlar cihazın kullanılabilir belleğine bağlıdır. Videoyu kaydetmeden sayfayı kapatma.

## ChatGPT, Claude, Gemini veya başka bir AI kodlama aracıyla kullanma

Depo adresini kodlama aracına verip istediğin küçük değişikliği tarif edebilirsin. Metin kütüphanesi, kamera kaydı ve indirme altyapısı hazır olduğu için uygulamayı sıfırdan yazdırman gerekmez. Uygulamanın kendisi AI çağrısı yapmaz veya model tokenı harcamaz.

Örnek istek:

```text
https://github.com/demirarif/prompter-for-everyone deposunu temel al.
Önce AGENTS.md, README.md ve docs/ARCHITECTURE.md dosyalarını oku.
Şunu değiştirmek istiyorum: [istediğin değişiklik].
Metinler ve ayarlar her kullanıcının kendi tarayıcısında kalsın.
Kamera ve kayıt temizliğini koru; ben istemedikçe hesap, backend veya ücretli API ekleme.
npm test ve npm run build çalıştır; sonucu nasıl açacağımı veya yayınlayacağımı anlat.
```

Yalnızca yayınlamak istiyorsan aracından `docs/DEPLOYMENT.md` adımlarını izlemesini iste. Ortam değişkeni veya gizli anahtar tanımlamak gerekmez.

## Gizlilik ve lisans

Uygulama metinleri veya videoları sunucuya yüklemez; analiz kodu ya da ortak bir kullanıcı hesabı içermez. Her ziyaretçi kendi tarayıcısındaki metinlerle çalışır. Tarayıcıdaki yerel depolama, şifreli bir kasa veya yedekleme sistemi değildir.

Kod [MIT lisansı](LICENSE) ile kullanılabilir, değiştirilebilir ve dağıtılabilir. Deponun açık olması kaynakların bulunmasını kolaylaştırır; arama motorlarında veya AI aramalarında listelenme garantisi vermez.
