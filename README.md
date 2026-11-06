# OpenCode CodeLink

Browse your code. Bring context into your conversation.

OpenCode Desktop **2.2.5** için salt okunur kod çalışma alanı. Proje dosyalarını sekmelerde okuyun; farklı dosyalardan seçtiğiniz kodu notlarıyla birlikte mevcut sohbetin taslağına ekleyin. Dosyalarınızı düzenlemez ve mesaj göndermez.

## Kullanım

1. Yerel projenizde bir OpenCode sohbeti açın.
2. Yan panelde **+ → Kod referansları** seçin veya **Ctrl+Shift+E** tuşlarına basın.
3. Dosya ağacından dosyayı açın. Kodun bir bölümünü seçip **sağ tık → Sohbete referans ekle** seçin. Üstteki düğme veya **Ctrl+Shift+L** de aynı işi yapar.
4. Referans kartına “hata burada” gibi bir not ekleyin. Başka dosyalardan da seçim yapabilirsiniz.
5. İki kartın kutusunu işaretleyerek **Karşılaştır**, **Bağlantıyı açıkla** veya **Neden farklı?** sorularını taslağa ekleyin. Mesajı kendiniz gönderin.

Paneli açtıktan sonra **Ctrl+P** dosya bulur; **Projede ara** metin arar; editör içinde **Ctrl+F** açık dosyada arar. macOS'ta Ctrl yerine Cmd kullanılır.

## Dahil olan özellikler

- Klasörleri gerektiğinde yükleyen dosya ağacı ve sekmeli, satır numaralı kod görünümü.
- JavaScript/TypeScript, Python, JSON, HTML, CSS, Markdown, YAML ve kabuk kodu için renklendirme; diğer metin dosyaları düz metin olarak açılır.
- Çoklu referans sepeti, kart başına not, karşılaştırma ve ilişki soruları.
- Dosya değişikliklerini canlı izleme; değişen dosyalarda işaretler. Panel açıkken gözlenen son dosya değişikliğine gitme.
- Git/OpenCode değişiklik verisi mevcut olduğunda yan yana **önce/sonra** görünümü. Tam dosya yerine patch'in değişen bölümleri ve çevre satırları gösterilir.
- Seçim anındaki değişmez kod kopyası; dosya değiştiğinde işaretleme ve benzersiz eşleşmeyle satır konumunu yeniden bulma. Belirsiz eşleşmelerde sabit kopya gösterilir.
- Sohbete iliştirilen referansa tıklayarak koda dönüş; aynı sohbet/projede kalıcı referans geçmişi.
- **Çevresini ekle** ile seçimin önüne ve arkasına beşer satır ekleme.

Dosya ağacında ve kodda silme/yazma/kaydetme işlemleri yoktur. Sepetten çıkarmak yalnızca mevcut taslaktaki eki kaldırır; gönderilmiş mesajlar ve geçmişteki kod kopyaları değişmez. Geçmişteki bir referans **Yeniden ekle** ile yeni bir taslak eki olarak kullanılabilir.

## Kurulum

Node.js 22.18+ ile bu klasörde:

```sh
npm ci
npm run build
npm run install:local
```

Kurulum, global `~/.config/opencode/opencode.json` veya `opencode.jsonc` dosyasının `plugins` listesine **bu proje klasörünün mutlak yolunu** ekler. Diğer ayarları ve JSONC yorumlarını korur; değiştirmeden önce `.bak-<zaman>` yedeği alır. Aynı kurulumu tekrar çalıştırmak kopya oluşturmaz. `XDG_CONFIG_HOME` desteklenir.

Bu klasörü taşımayın; eklenti buradaki `dist/gui-experimental.cjs` dosyasından yüklenir. OpenCode yapılandırmayı otomatik algılamazsa uygulamayı kapatıp yeniden açın. **Settings → Extensions → Plugins** bölümünden eklentinin yüklenme durumunu kontrol edebilirsiniz. Devre dışı bırakmak için aynı bölümde anahtarını kapatın; kaldırmak için `plugins` listesindeki bu klasör yolunu silin.

Deneysel GUI API'si nedeniyle uyumluluk 2.2.5 ile doğrulanmıştır; ileriki sürümlerde tekrar kontrol edilmelidir. OpenCode'un kendi dosya, izleme, değişiklik ve sohbet API'leri kullanılır. Ayrı bir model anahtarı veya servis gerekmez.

## Sınırlar

- Kod görünümü: 2 milyon karakter. İkili dosyalar açılmaz.
- Referans: en fazla 48.000 karakter; sepette 30, geçmişle birlikte toplam 100 referans. Eski, sepette olmayan kayıtlar sınır dolduğunda temizlenir. Gönderilmiş mesajlardaki kod kopyaları kalır; geçmişten temizlenen referans bağlantıları eski satır aralığına döner.
- Proje metin araması: en fazla 2.000 dosya/dizin taraması, dosya başına 512 KB, 200 sonuç. Sınıra ulaşılırsa veya dosya okunamazsa arama altında belirtilir. `node_modules`, `.git`, `vendor`, `dist`, `build`, `.next` taranmaz.
- Eklenti aktif sohbetin proje kökünde çalışır. Multi-Root Workspace gibi başka eklentilerin eklediği harici kökleri kendiliğinden açmaz.
- Paneldeki sepet, gönderimden sonra yeniden kullanılabilir durumda kalır. Yeni soru için **Sepeti temizle** kullanın. Sohbet taslağındaki ekleri doğrudan değiştirirseniz sepetteki kartlar otomatik silinmez.

## Geliştirme ve doğrulama

```sh
npm run check
node test/live-smoke.mjs
```

Playwright tarayıcısı eksikse `npx playwright install chromium` çalıştırın. Etkileşim testleri gerçek CodeMirror ve Solid bileşenlerini, yerel bir OpenCode API fikstürüyle tarayıcıda çalıştırır. Canlı test ayrı, geçici ayar/veritabanıyla gerçek `/opt/OpenCode/resources/opencode-cli` sunucusunu açar; eklenti kaydını, GUI paketini ve dosya API'lerini doğrular. Kullanıcının sohbetlerine dokunmaz ve modele istek göndermez. Farklı binary için `OPENCODE_BIN` kullanılabilir.

Canlı test, gerçek masaüstü penceresinde yapılmış bir tıklama testi değildir; pencere içindeki son kullanım kontrolü ayrıca yapılmalıdır.
