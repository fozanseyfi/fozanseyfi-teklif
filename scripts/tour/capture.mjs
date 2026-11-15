/**
 * Tanıtım sayfası ekran görüntülerini çeker ve lib/tanitim/manifest.json üretir.
 *
 *   npm run dev                                         (ayrı terminalde, port 4000)
 *   node --env-file=.env scripts/tour/seed-demo.mjs     (demo paneli sıfırla)
 *   node --env-file=.env scripts/tour/capture.mjs [modül-id ...]
 *
 * Her adım: bir işlem (tıkla / doldur / kaydet) + o anın ekran görüntüsü. `mark()` ile işaretlenen
 * eleman tanıtım sayfasında çerçeve + imleçle gösterilir (koordinatlar görüntüye göre %).
 * Bir adım hata verirse atlanır ve raporlanır; diğerleri devam eder.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { launch, login, go, settle, sleep, byText, clickText, clickOption, fill, field, setValue, waitPath, OUT } from "./lib.mjs";

const VW = 1440;
const VH = 900;
const MANIFEST = path.resolve("lib/tanitim/manifest.json");

// ---------------------------------------------------------------- demo kayıt kimlikleri
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const me = await prisma.profile.findFirst({ where: { email: process.env.TOUR_DEMO_EMAIL } });
const ORG = me.organizationId;
const pid = async (name) => (await prisma.project.findFirst({ where: { organizationId: ORG, name, isTemplate: false } }))?.id;
const ID = {
  polatli: await pid("Polatlı 10 MWp Arazi GES"),
  karapinar: await pid("Karapınar 5 MWp Arazi GES"),
  eskisehir: await pid("Eskişehir Fabrika Çatı — Malzeme Teklifi"),
  costKarapinar: (await prisma.costProject.findFirst({ where: { organizationId: ORG, name: "Karapınar 5 MWp Arazi GES" } }))?.id,
  shareToken: (await prisma.shareLink.findFirst({ where: { organizationId: ORG, customerLabel: "Yatırımcı" } }))?.token,
};
await prisma.$disconnect();
for (const [k, v] of Object.entries(ID)) if (!v) throw new Error(`Demo kayıt yok: ${k} — önce seed-demo.mjs çalıştırın`);
const P = `/projects/${ID.polatli}/detail`;
const M = `/projects/${ID.eskisehir}/detail`;

// ---------------------------------------------------------------- adım altyapısı
let marks = [];
let cursor = null;
/** Elemanı işaretle (çerçeve). `click: true` → imleç de bu elemanın üstünde gösterilir. */
async function mark(page, target, { click = false, label } = {}) {
  const el = typeof target === "string" ? await byText(page, target) : target;
  await el.evaluate((n) => n.scrollIntoView({ block: "center", inline: "nearest" }));
  await sleep(250);
  marks.push({ el, label });
  if (click) cursor = el;
  return el;
}
async function rectOf(el) {
  const r = await el.evaluate((n) => {
    const b = n.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });
  const pad = 4;
  const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad);
  const w = Math.min(VW - x, r.w + pad * 2), h = Math.min(VH - y, r.h + pad * 2);
  if (w <= 0 || h <= 0 || y >= VH) return null;
  const pct = (v, t) => Math.round((v / t) * 10000) / 100;
  return { x: pct(x, VW), y: pct(y, VH), w: pct(w, VW), h: pct(h, VH) };
}
/** İşaretli elemana tıkla (önce görüntü alınmışsa sonraki adımda). */
async function press(page, target, wait = 600) {
  const el = typeof target === "string" ? await byText(page, target) : target;
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
  await settle(page, wait);
}
async function scrollTo(page, target, block = "start") {
  const el = typeof target === "string" ? await byText(page, target, "h1, h2, h3, h4, p, span, div, button, a, th") : target;
  await el.evaluate((n, b) => n.scrollIntoView({ block: b }), block);
  await page.evaluate(() => window.scrollBy(0, -70));
  await sleep(350);
}
const top = (page) => page.evaluate(() => window.scrollTo(0, 0));

// ---------------------------------------------------------------- senaryo
/** @type {{id:string,title:string,group:string,intro:string,steps:{title:string,text:string,run:(page:any)=>Promise<void>,toast?:boolean}[]}[]} */
const MODULES = [
  {
    id: "giris",
    group: "Başlarken",
    title: "Giriş ve Genel Görünüm",
    intro: "Platforma e-posta ve şifreyle girilir. Üst barda hesap ve panel menüsü, arama, bildirimler, dil ve gece modu; solda tüm modüllere giden menü bulunur.",
    steps: [
      {
        title: "Giriş ekranı",
        text: "E-posta adresinizi ve şifrenizi yazıp “Giriş Yap”a basın. Şifrenizi unuttuysanız aynı ekrandaki bağlantıyla sıfırlama e-postası isteyebilirsiniz.",
        guest: true,
        run: async (page) => {
          await go(page, "/login");
          await fill(page, 'input[name="email"]', "deniz.aydin@demoenerji.com.tr");
          await fill(page, 'input[name="password"]', "demo-sifre-123");
          await mark(page, await page.$('button[type="submit"]'), { click: true });
        },
      },
      {
        title: "Dashboard",
        text: "Girişten sonra Dashboard açılır. Üstte toplam teklif, devam eden, kazanılan teklif sayısı ve teklif verilen toplam güç; altında son projeler tablosu ve projelerin il bazında dağılımı yer alır.",
        run: async (page) => {
          await go(page, "/dashboard", 900);
        },
      },
      {
        title: "Son projeler tablosu",
        text: "Tabloda her teklifin gücü, tutarı, satış aşaması ve tarihi görünür. Göz simgesi teklifi salt okunur açar, yanındaki düğme teklifi kopyalayıp yeni bir proje olarak başlatır.",
        run: async (page) => {
          await mark(page, await page.$("table"));
        },
      },
      {
        title: "Hesap ve panel menüsü",
        text: "Sol üstteki adınıza tıklayınca hesap menüsü açılır. Burada üye olduğunuz paneller (şirketler) listelenir; birine tıklayarak o şirketin verileriyle çalışmaya geçersiniz.",
        run: async (page) => {
          const btn = await page.$('button[aria-label="Hesap ve panel menüsü"]');
          await btn.click();
          await sleep(400);
          await mark(page, btn, { click: true });
          await mark(page, await byText(page, "Çalışılan panel", "p"));
        },
      },
      {
        title: "Hızlı arama (Ctrl+K)",
        text: "Herhangi bir sayfada Ctrl+K’ya basın ya da üstteki “Ara” kutusuna tıklayın. Proje adı, müşteri, lokasyon veya kalem adıyla arama yapılır; sonuçlarda fiyat ve güç bilgisi de görünür.",
        run: async (page) => {
          await page.keyboard.press("Escape");
          await sleep(200);
          await page.keyboard.down("Control");
          await page.keyboard.press("k");
          await page.keyboard.up("Control");
          await sleep(500);
          await page.keyboard.type("Polatlı", { delay: 40 });
          await settle(page, 1200);
          await mark(page, await page.$('input[placeholder*="Proje adı, müşteri"]'));
        },
      },
      {
        title: "Bildirimler",
        text: "Zil simgesindeki sayı okunmamış bildirimleri gösterir. Müşterinin paylaşım linkini açması, revizyon istemesi ve takvim hatırlatmaları buraya düşer.",
        run: async (page) => {
          await page.keyboard.press("Escape");
          await go(page, "/notifications", 700);
          await mark(page, await page.$('a[aria-label="Bildirimler"]'));
        },
      },
      {
        title: "Gece modu",
        text: "Sağ üstteki ay simgesi arayüzü koyu temaya alır. Seçim tarayıcınızda saklanır; yazdırırken çıktı her zaman açık renkli olur.",
        run: async (page) => {
          await go(page, "/dashboard", 700);
          const t = await page.$('button[aria-label="Karanlık temaya geç"]');
          await t.click();
          await sleep(500);
          await mark(page, await page.$('button[aria-label="Aydınlık temaya geç"]'), { click: true });
        },
        after: async (page) => {
          const t = await page.$('button[aria-label="Aydınlık temaya geç"]');
          if (t) await t.click();
          await sleep(300);
        },
      },
      {
        title: "İngilizce arayüz",
        text: "TR / EN düğmesiyle arayüz dili değişir. Proje ve müşteri adları gibi sizin girdiğiniz bilgiler çevrilmez.",
        run: async (page) => {
          await press(page, await page.$('button[title="English"]'), 1500);
          await settle(page, 1500);
          await mark(page, await page.$('button[title="English"]'), { click: true });
        },
        after: async (page) => {
          await press(page, await page.$('button[title="Türkçe"]'), 1500);
        },
      },
    ],
  },

  {
    id: "anahtar-teslim",
    group: "Teklif Hazırlama",
    title: "Yeni Anahtar Teslim Teklif",
    intro: "Anahtar teslim GES teklifi altı adımda hazırlanır: Proje bilgileri → Teknik → Keşif-A → Keşif-B → Timeline → Analiz. Her adım “Kaydet & İlerle” ile kaydedilir ve bir sonraki sekmenin kilidi açılır.",
    steps: [
      {
        title: "Teklif tipini seçin",
        text: "Sol menüden Teklifler → “Yeni Proje”ye tıklayın. Tam GES EPC teklifi için “Anahtar Teslim”, sade malzeme veya hizmet teklifi için “Malzeme & Hizmet” seçilir.",
        run: async (page) => {
          await go(page, "/projects/new", 700);
          await mark(page, "Anahtar Teslim Başlat", { click: true });
        },
      },
      {
        title: "Proje bilgilerini doldurun",
        text: "Proje adı, il / ilçe, kurulum tipi (çatı veya arazi) ve müşteri girilir. Müşteri kutusuna yazdıkça kayıtlı müşteriler listelenir; listede yoksa yeni müşteri olarak eklenir.",
        run: async (page) => {
          await press(page, "Anahtar Teslim Başlat", 1500);
          await fill(page, "#name", "Çumra 3 MWp Arazi GES");
          await fill(page, 'input[placeholder="Örn: Ankara"]', "Konya");
          await fill(page, 'input[placeholder="Örn: Polatlı"]', "Çumra");
          await clickText(page, "AraziZemin / tarla sistemi", "button");
          const c = await page.$('input[placeholder="Müşteri adı ara veya yaz…"]');
          await c.click();
          await c.type("Anadolu", { delay: 30 });
          await sleep(700);
          await mark(page, c);
        },
      },
      {
        title: "Müşteriyi listeden seçin",
        text: "Açılan listeden müşteriyi seçince iletişim bilgileri otomatik dolar. Notlar ve riskler alanlarına yazdıklarınız teklif PDF’ine yansır.",
        run: async (page) => {
          await clickOption(page, "Anadolu Tarım Ürünleri A.Ş.");
          await fill(page, 'input[placeholder*="Detay mühendislik"]', "Metrajlar detay proje aşamasında kesinleşecektir.");
          await mark(page, await page.$('input[placeholder="Müşteri adı ara veya yaz…"]'));
          await mark(page, "Kaydet & İlerle", { click: true });
        },
      },
      {
        title: "Teknik parametreler",
        text: "DC/AC güç, panel ve inverter gücü ile inverter adedi girilir. Panel adedi DC güç ve panel gücünden otomatik hesaplanır; yıldızlı alanlar doldurulmadan bir sonraki adıma geçilemez.",
        run: async (page) => {
          await press(page, "Kaydet & İlerle", 1000);
          await waitPath(page, /\/teknik$/);
          await fill(page, await field(page, "DC Güç (kW)"), "3000");
          await fill(page, await field(page, "AC Güç (kW)"), "2750");
          await fill(page, await field(page, "Panel Gücü (Wp)"), "625");
          await fill(page, await field(page, "İnverter Gücü (kW)"), "250");
          await fill(page, await field(page, "İnverter Adedi"), "11");
          await fill(page, await field(page, "Çevre Telçit (m)"), "1450");
          await page.keyboard.press("Tab");
          await mark(page, await field(page, "DC Güç (kW)"));
          await mark(page, await field(page, "Panel Adedi"));
        },
      },
      {
        title: "Kurlar ve inşaat takvimi",
        text: "“Güncel kuru çek” USD ve EUR kurunu otomatik getirir. Başlangıç tarihi ve inşaat süresi Cash Flow ve Timeline ekranlarının ay sayısını belirler.",
        run: async (page) => {
          await press(page, await byText(page, "Güncel kuru çek", "button"), 2500);
          const d = await field(page, "Başlangıç Tarihi");
          await setValue(d, "2027-02-01");
          await fill(page, await field(page, "İnşaat Süresi (gün)"), "150");
          await page.keyboard.press("Tab");
          await mark(page, await byText(page, "Güncel kuru çek", "button"));
          await mark(page, d);
        },
      },
      {
        title: "Kaydedip ilerleyin",
        text: "Zorunlu alanlar dolunca “Kaydet & İlerle” etkinleşir. Kaydedildiğinde Keşif-A kalemlerinin miktarları bu teknik değerlere göre yeniden hesaplanır.",
        run: async (page) => {
          await top(page);
          await mark(page, "Kaydet & İlerle", { click: true });
        },
      },
      {
        title: "Keşif-A: doğrudan maliyetler",
        text: "Panel, inverter, konstrüksiyon, kablo ve işçilik kalemleri 18 grup altında hazır gelir. Teknik sayfada girdiğiniz güce göre miktarlar otomatik hesaplanmıştır; birim fiyat ve para birimi değiştirilebilir.",
        run: async (page) => {
          await press(page, "Kaydet & İlerle", 1000);
          await waitPath(page, /\/kesif-a$/);
          // İlk grubu (A.1 Panel) aç: kalem satırları görünsün
          const badge = await byText(page, "A.1", "span, div, code");
          const row = await badge.evaluateHandle((n) => n.closest("button, [role=button], summary") || n.parentElement);
          await row.asElement().click();
          await settle(page, 600);
          await row.asElement().evaluate((n) => n.scrollIntoView({ block: "start" }));
          await page.evaluate(() => window.scrollBy(0, -80));
          await sleep(300);
          await mark(page, row.asElement(), { click: true });
        },
      },
      {
        title: "Keşif-B: dolaylı maliyetler",
        text: "Personel, işletme-bakım, risk, teminat ve sigorta giderleri girilir. B.6 Finans Maliyeti Cash Flow sayfasındaki kredi faizinden otomatik hesaplanır; elle yazılmaz.",
        run: async (page) => {
          await top(page);
          await press(page, "Kaydet & İlerle", 1000);
          await waitPath(page, /\/kesif-b$/);
          await page.evaluate(() => window.scrollTo(0, 260));
          await mark(page, await byText(page, "Cash Flow Otomatik", "span, div, p, button").catch(() => byText(page, "Kalem ekle", "button")));
        },
      },
      {
        title: "Timeline: tahsilat ve ödeme takvimi",
        text: "Avans, hakediş ve iş sonu tahsilatları ile her maliyet grubunun aylara dağılımı yüzde olarak girilir. “Eşit dağıt” seçilen grubu aylara eşit böler; her satırın toplamı %100 olmalıdır.",
        run: async (page) => {
          await top(page);
          await press(page, "Kaydet & İlerle", 1000);
          await waitPath(page, /\/timeline$/);
          await settle(page, 1200);
          const eq = await byText(page, "Eşit dağıt", "button", 2000).catch(() => null);
          if (eq) await mark(page, eq);
          else {
            const t = await page.$("table");
            if (t) await mark(page, t);
            await top(page);
          }
        },
      },
      {
        title: "Analiz ekranı açıldı",
        text: "Timeline kaydedildiğinde Analiz sekmesi açılır: toplam EPC satış fiyatı, $/kWp, brüt kâr marjı ve maliyet dağılımı tek ekranda görünür.",
        run: async (page) => {
          await top(page);
          await press(page, "Kaydet & İlerle", 1000);
          await waitPath(page, /\/analiz$/);
          await settle(page, 1500);
          await top(page);
        },
      },
    ],
  },

  {
    id: "proje-detay",
    group: "Teklif Hazırlama",
    title: "Teklif Detayı ve Analiz",
    intro: "Kaydedilmiş bir anahtar teslim teklifin tüm sekmeleri: maliyet kalemleri, marj ayarları, nakit akışı ve müşteriye gidecek belgeler. Örnek: Polatlı 10 MWp Arazi GES.",
    steps: [
      {
        title: "Proje sekmeleri",
        text: "Teklif açıldığında üstte sekmeler sıralanır. Veri girişi (Proje, Teknik, Keşif-A/B, Timeline), karar (Analiz, Cash Flow) ve çıktı (BoQ, P-BoQ, DoR) sekmeleri renkleriyle ayrılır.",
        run: async (page) => {
          await go(page, P, 900);
          await mark(page, await page.$(`a[href="${P}/analiz"]`));
        },
      },
      {
        title: "Keşif-A kalemleri",
        text: "Her grubun toplamı ve $/Wp birim maliyeti grup başlığında görünür. Bir kalemin miktarını veya fiyatını değiştirdiğinizde toplamlar anında güncellenir.",
        run: async (page) => {
          await go(page, `${P}/kesif-a`, 900);
          await page.evaluate(() => window.scrollTo(0, 260));
          await sleep(300);
        },
      },
      {
        title: "Analiz: satış fiyatı ve marjlar",
        text: "Üstte toplam EPC satış fiyatı, USD/kWp ve brüt kâr marjı yer alır. Contingency, genel gider ve net kâr oranları ±0,5 düğmeleriyle değiştirilir; fiyat canlı güncellenir.",
        run: async (page) => {
          await go(page, `${P}/analiz`, 1200);
          await mark(page, "+0.5", { click: true });
        },
      },
      {
        title: "Kritik malzeme seçimi",
        text: "Panel, konstrüksiyon ve inverter için tanımlı alternatifler yan yana listelenir. Bir alternatife tıklayınca toplam fiyata etkisi (+/−) gösterilir ve teklif o malzemeyle yeniden hesaplanır.",
        run: async (page) => {
          await scrollTo(page, "Kritik Malzeme Seçimi");
          await mark(page, await byText(page, "Schmid Pekintaş", "button"), { click: true });
        },
      },
      {
        title: "Tüm kalemler özeti",
        text: "Grup bazında maliyet, payı ve satıştaki yüzdesi listelenir. Bir gruba tıklayarak miktar ve fiyatları buradan düzenleyebilirsiniz; değişiklik Keşif sayfalarına da yansır.",
        run: async (page) => {
          await scrollTo(page, "Tüm Kalemler Özet");
        },
      },
      {
        title: "Maliyet dağılımı ve halka grafik",
        text: "“Diğer Detaylar” bölümünde maliyet dağılımı, halka grafik, nakit akışı, kur duyarlılığı ve kârlılık analizi yer alır. Halkadaki bir dilime tıklayınca o grubun kalemleri açılır.",
        run: async (page) => {
          try { await clickText(page, "Diğer Detaylar", "button, summary, div"); } catch {}
          await sleep(600);
          await scrollTo(page, "Maliyet Dağılımı");
        },
      },
      {
        title: "Cash Flow",
        text: "Aylık giriş ve çıkışlar, kümülatif nakit pozisyonu ve kredi ihtiyacı gösterilir. Negatife düşen aylar için faiz hesaplanır ve toplam finans maliyeti Keşif-B’deki B.6 kalemine yazılır.",
        run: async (page) => {
          await go(page, `${P}/cashflow`, 1200);
        },
      },
      {
        title: "BoQ: fiyatsız kapsam listesi",
        text: "Müşteriye gönderilebilecek temiz kalem listesidir. Fiyat sütunu tek tıkla açılıp kapanır; boş kalemler otomatik gizlenir. PDF veya Excel olarak indirilir.",
        run: async (page) => {
          await go(page, `${P}/boq`, 900);
          await mark(page, await byText(page, "Fiyatlar kapalı", "button"), { click: true });
        },
      },
      {
        title: "P-BoQ: birim fiyat cetveli",
        text: "Müşteriye gidecek fiyatlı belgedir. Bir kalemi “Karsız” yaparsanız üzerine kâr eklenmez; “Gizle” ile PDF’ten çıkarırsanız payı diğer kalemlere dağıtılır. Toplam satış fiyatı değişmez.",
        run: async (page) => {
          await go(page, `${P}/priced-boq`, 900);
          await page.evaluate(() => window.scrollTo(0, 200));
          await mark(page, await byText(page, "👁 Görünür", "button"), { click: true });
        },
      },
      {
        title: "DoR: sorumluluk tablosu",
        text: "Tedarik, montaj ve devreye alma işlerinin yüklenici, işveren veya ortak sorumlulukta olduğu madde madde belirlenir. Grup ve madde eklenip çıkarılabilir.",
        run: async (page) => {
          await go(page, `${P}/dor`, 900);
          await press(page, "Tümünü Aç", 500);
        },
      },
      {
        title: "Pipeline: satış süreci",
        text: "Teklifin satış aşaması (taslak, gönderildi, revizyon, kazanıldı, kaybedildi) buradan yönetilir. Müşterinin linki açması ve revizyon talepleri aktivite akışına otomatik düşer.",
        run: async (page) => {
          await go(page, `${P}/pipeline`, 900);
          await mark(page, await byText(page, "Revizyon İstendi", "button"));
        },
      },
      {
        title: "Aktivite ve not ekleme",
        text: "Telefon görüşmesi, gönderilen e-posta veya iç not kaydedilir. Kayıtlar tarih sırasıyla akışta listelenir; ekip arkadaşlarınız da görür.",
        run: async (page) => {
          const ta = await page.$("textarea");
          await ta.click();
          await ta.type("Revize teklif Huawei inverter ile hazırlandı, Perşembe sunulacak.", { delay: 8 });
          await mark(page, ta);
          await mark(page, await byText(page, "Ekle", "button"), { click: true });
        },
      },
      {
        title: "Not kaydedildi",
        text: "“Ekle”ye basınca not, yazan kişi ve saatle birlikte akışın en üstüne eklenir.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Ekle", "button"), 1200);
          await scrollTo(page, "Aktivite Akışı", "start");
        },
      },
    ],
  },

  {
    id: "malzeme-hizmet",
    group: "Teklif Hazırlama",
    title: "Malzeme & Hizmet Teklifi",
    intro: "Proje gerektirmeyen sade malzeme veya hizmet teklifleri için kullanılır: müşteri bilgisi, katalogdan kalem listesi, kâr ve KDV ayarı, 1–2 sayfalık teklif PDF’i.",
    steps: [
      {
        title: "Müşteri ve teklif bilgileri",
        text: "Teklif başlığı, müşteri ve iletişim bilgileri girilir. Örnek: Eskişehir’deki bir fabrika çatısı için malzeme teklifi.",
        run: async (page) => {
          await go(page, M, 900);
        },
      },
      {
        title: "Kalemler",
        text: "Kalemler malzeme kataloğundan kod veya adla aranarak eklenir. Her satırda miktar, maliyet, para birimi ve kâr oranı girilir; “Opsiyon” işaretli kalemler ana toplama girmez.",
        run: async (page) => {
          await go(page, `${M}/items`, 1000);
          await mark(page, await page.$('input[placeholder*="Kalem ekle"]'));
        },
      },
      {
        title: "Katalogdan kalem ekleme",
        text: "Arama kutusuna kod ya da ad yazın; eşleşen kalemler listelenir. Tıklayınca kalem tabloya eklenir. Listede yoksa yeni malzeme/hizmet olarak kataloğa kaydedebilirsiniz.",
        run: async (page) => {
          const i = await page.$('input[placeholder*="Kalem ekle"]');
          await i.click();
          await i.type("HZM", { delay: 40 });
          await sleep(900);
          await mark(page, i);
        },
      },
      {
        title: "Analiz: kâr ve toplamlar",
        text: "Tüm kalemlere tek seferde kâr oranı uygulanabilir ya da hedef toplam fiyat girilerek kâr otomatik dağıtılır. İç özet maliyet, kâr ve satış tutarlarını üç para biriminde gösterir; müşteriye gösterilmez.",
        run: async (page) => {
          await page.keyboard.press("Escape");
          await go(page, `${M}/quote-analiz`, 1000);
          await mark(page, await byText(page, "Uygula", "button"));
        },
      },
      {
        title: "Ödeme şekli",
        text: "Avans, bakiye gibi ödeme satırları yüzdesiyle girilir; tutar KDV dahil otomatik hesaplanır. PDF’te yalnızca işaretli satırlar görünür.",
        run: async (page) => {
          await scrollTo(page, "Ödeme Şekli");
        },
      },
      {
        title: "Teklif PDF önizleme",
        text: "Müşteriye gidecek teklif belgesi burada görünür: satış fiyatı ve KDV yer alır, maliyet ve kâr görünmez. “PDF İndir” ile kaydedilir veya paylaşım linkiyle gönderilir.",
        run: async (page) => {
          await go(page, `${M}/quote-pdf`, 1500);
          await mark(page, await byText(page, "PDF İndir", "button"));
        },
      },
      {
        title: "Revizeler",
        text: "Müşteri revizyon istediğinde “Yeni Revize Oluştur” mevcut teklifin kopyasını açar. Revizeler kalem bazında fiyat karşılaştırmasıyla listelenir; PDF’te istediğiniz revizeyi seçebilirsiniz.",
        run: async (page) => {
          await go(page, `${M}/revizeler`, 900);
          await mark(page, await byText(page, "Yeni Revize Oluştur", "button"));
        },
      },
    ],
  },

  {
    id: "teklifler",
    group: "Teklif Hazırlama",
    title: "Teklif Listesi ve Şablonlar",
    intro: "Tüm teklifler tek listede, satış aşamasına göre filtrelenir. Hazır boyut şablonları yeni teklife hızlı başlangıç sağlar.",
    steps: [
      {
        title: "Teklifler",
        text: "Her satırda müşteri, güç, fiyat ($/kWp ile), aşama ve tarih yer alır. Görüntüle salt okunur açar, Düzenle teklifi açar; kopyala ve sil düğmeleri satır sonundadır.",
        run: async (page) => {
          await go(page, "/projects", 900);
        },
      },
      {
        title: "Aşamaya göre filtre",
        text: "Üstteki sekmelerle yalnızca taslakları, müşteriye gönderilenleri, revizyon bekleyenleri ya da kazanılan / kaybedilen teklifleri listeleyebilirsiniz.",
        run: async (page) => {
          await press(page, await byText(page, "Müşteriye Gönderildi", "a"), 900);
          await mark(page, await byText(page, "Müşteriye Gönderildi", "a"), { click: true });
        },
      },
      {
        title: "Şablonlar",
        text: "10 kWp’den 100 MWp’ye dokuz hazır şablon vardır; kalemler, fiyatlar, timeline ve DoR önceden doludur. “İncele / Düzenle” şablonun kendisini açar.",
        run: async (page) => {
          await go(page, "/templates", 900);
          await mark(page, await byText(page, "Bu şablonu kullan", "button"), { click: true });
        },
      },
      {
        title: "Şablondan yeni proje",
        text: "“Bu şablonu kullan” şablonun kopyasıyla yeni bir proje açar; şablon değişmez. Proje bilgilerini girip diğer sekmelerde yalnızca farkları düzeltmeniz yeterlidir.",
        run: async (page) => {
          await press(page, "Bu şablonu kullan", 3000);
        },
      },
    ],
  },

  {
    id: "paylasim",
    group: "Müşteriyle Paylaşım",
    title: "Paylaşım Linki ve Müşteri Ekranı",
    intro: "Teklif, müşteriye veya yatırımcıya giriş gerektirmeyen salt okunur bir linkle gönderilir. Hangi bölümlerin görüneceğini ve linkin süresini siz belirlersiniz; görüntülenme sayısı izlenir.",
    steps: [
      {
        title: "Paylaşım linkleri sayfası",
        text: "Yönetim → Paylaşım Linkleri. Üstte yeni link formu, altta aktif linkler ve kaç kez görüntülendikleri yer alır.",
        run: async (page) => {
          await go(page, "/admin/share-links", 900);
        },
      },
      {
        title: "Proje ve bölümleri seçin",
        text: "Paylaşılacak teklifi seçin, ardından müşterinin göreceği bölümleri işaretleyin: firma tanıtımı, referanslar, fiyatsız BoQ, özet teklif, DoR. Maliyet/kâr içeren bölümler sarı uyarıyla işaretlidir.",
        run: async (page) => {
          await press(page, await byText(page, "Proje seç...", "button"), 500);
          await clickText(page, "Manisa OSB Fabrika Çatı GES", "button, li, [role=option], div");
          await sleep(500);
          for (const t of ["Firma Tanıtımı", "Referanslar", "Özet Teklif (P-BoQ)", "DoR"]) {
            try { await clickText(page, t, "label"); } catch {}
          }
          await fill(page, "#customerLabel", "Satınalma Müdürlüğü");
          await mark(page, await byText(page, "Paylaşılacak Bölümler", "p, span, div, label, h3"));
        },
      },
      {
        title: "Süre ve link oluşturma",
        text: "Linkin geçerlilik süresi (1 gün – süresiz) seçilir. Müşteri e-postası yazarsanız link e-postayla gönderilir; boş bırakırsanız yalnızca oluşturulur ve kopyalanır.",
        run: async (page) => {
          await mark(page, await byText(page, "Link Oluştur", "button"), { click: true });
        },
      },
      {
        title: "Link oluşturuldu",
        text: "Link aktif linkler tablosuna eklenir. Paylaş düğmesi karekod, WhatsApp, e-posta ve kopyalama seçeneklerini açar.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Link Oluştur", "button"), 1500);
          await scrollTo(page, "Aktif linkler");
        },
      },
      {
        title: "Karekod ve WhatsApp ile paylaşım",
        text: "Müşteri karekodu telefon kamerasıyla okutup teklifi açabilir. WhatsApp ve e-posta düğmeleri hazır mesaj metniyle açılır.",
        run: async (page) => {
          const b = await byText(page, "Paylaş", "button");
          await b.click();
          await settle(page, 900);
        },
      },
      {
        title: "Müşteri ekranı: genel bakış",
        text: "Müşteri linki açtığında giriş yapmadan firmanızın logosu ve seçtiğiniz bölümlerle karşılanır. Maliyet, kâr ve editör uyarıları görünmez.",
        guest: true,
        run: async (page) => {
          await go(page, `/share/${ID.shareToken}`, 1500);
        },
      },
      {
        title: "Müşteri ekranı: özet teklif",
        text: "Her bölüm ayrı sekmede açılır ve PDF olarak indirilebilir. Link süresi dolunca otomatik kapanır.",
        guest: true,
        run: async (page) => {
          await go(page, `/share/${ID.shareToken}/priced-boq-summary`, 1500);
        },
      },
      {
        title: "Müşteri onayı ve revizyon talebi",
        text: "Sayfanın altında müşteri teklifi onaylayabilir, revizyon isteyebilir veya soru sorabilir. Yanıt size bildirim olarak gelir ve teklifin pipeline akışına kaydedilir.",
        guest: true,
        run: async (page) => {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(600);
          await mark(page, await byText(page, "Revizyon İste", "button"));
        },
      },
    ],
  },

  {
    id: "sozlesme",
    group: "Müşteriyle Paylaşım",
    title: "Sözleşmeler",
    intro: "Kazanılan (Closed Won) teklifler için çatı veya arazi EPC sözleşmesi hazırlanır, Word olarak indirilir; imzalı nüsha PDF olarak yüklenip arşivlenir.",
    steps: [
      {
        title: "Sözleşme listesi",
        text: "Yalnızca kazanılan teklifler listelenir. Bir teklife tıklayarak sözleşme türünü seçip formu açarsınız.",
        run: async (page) => {
          await go(page, "/sozlesmeler", 900);
          await mark(page, await byText(page, "Karapınar 5 MWp Arazi GES", "button"), { click: true });
        },
      },
      {
        title: "Sözleşme türü",
        text: "Teklife göre önerilen tür işaretlidir: çatı üstü EPC, arazi tipi EPC, malzeme tedarik, hizmet veya işçilik sözleşmesi.",
        run: async (page) => {
          await press(page, await byText(page, "Karapınar 5 MWp Arazi GES", "button"), 1200);
        },
      },
      {
        title: "Sözleşme formu ve önizleme",
        text: "Taraflar, bedel ve ödeme planı gibi alanlar tekliften otomatik dolar. Boş zorunlu alanlar kırmızıyla işaretlenir; sağda Word belgesinin birebir önizlemesi görünür.",
        run: async (page) => {
          try { await press(page, await byText(page, "Sözleşme oluştur", "button"), 2500); } catch {}
          try { await press(page, await byText(page, "Arazi tipi santral (EPC)", "button, label, div"), 2500); } catch {}
          await settle(page, 1500);
        },
      },
    ],
  },

  {
    id: "maliyet",
    group: "Proje Sonrası",
    title: "Maliyet Kontrol",
    intro: "Kazanılan projenin satışı, gerçekleşen maliyeti, kârı, müşteriden tahsilatı ve tedarikçi ödemeleri tek yerde izlenir.",
    steps: [
      {
        title: "Maliyet projeleri",
        text: "Üstte tüm projelerin toplam satış, maliyet, vergi öncesi kâr ve kalan alacak/borç tutarları; altta her proje için tahsilat yüzdesiyle birlikte kart yer alır.",
        run: async (page) => {
          await go(page, "/cost-control", 900);
          await mark(page, await byText(page, "Tekliften Oluştur", "button"));
        },
      },
      {
        title: "Proje maliyet detayı",
        text: "Satış, gerçekleşen maliyet, tedarikçilere ödenen ve kalan tutar, anlık ve iş sonu kâr özetlenir. Altta harcama kalemleri tedarikçi ve ödeme durumuyla listelenir.",
        run: async (page) => {
          await go(page, `/cost-control/${ID.costKarapinar}`, 1200);
        },
      },
      {
        title: "Kalem ekleme",
        text: "“Kalem Ekle” ile kategori, tanım, miktar, birim fiyat, para birimi, KDV ve tedarikçi girilir. Ödenen tutar varsa aynı formda kaydedilir.",
        run: async (page) => {
          await press(page, await byText(page, "Kalem Ekle", "button"), 800);
          try { await fill(page, 'input[placeholder="Örn. Solar Panel"]', "OG Hücre ve Trafo Köşkü"); } catch {}
          await mark(page, await page.$('input[placeholder="Örn. Solar Panel"]'));
        },
        after: async (page) => {
          await page.keyboard.press("Escape");
          await sleep(300);
        },
      },
      {
        title: "Tahsilat",
        text: "Müşteriden yapılan tahsilatlar ve planlanan tahsilatlar tarihleriyle girilir. Müşteriye ödeme ekstresi linki gönderilebilir; ekstre güncel bakiyeyi gösterir.",
        run: async (page) => {
          await go(page, `/cost-control/${ID.costKarapinar}`, 900);
          await press(page, await byText(page, "Tahsilat", "button"), 700);
          await mark(page, await byText(page, "Tahsilat", "button"), { click: true });
        },
      },
      {
        title: "Ödeme yapılacak kişiler",
        text: "Tedarikçi bazında toplam borç, ödenen ve kalan tutar listelenir. “Öde” ile girilen tutar o tedarikçinin kalemlerine otomatik dağıtılır; IBAN tek tıkla kopyalanır.",
        run: async (page) => {
          await press(page, await byText(page, "Ödeme Yapılacak Kişiler", "button"), 700);
        },
      },
      {
        title: "KDV ve vergi özeti",
        text: "Faturalı ve faturasız satış ayrılarak ödenecek KDV, kurumlar vergisi ve şirkete kalan net kâr adım adım hesaplanır.",
        run: async (page) => {
          await press(page, await byText(page, "KDV / İş Özeti", "button"), 700);
        },
      },
      {
        title: "Tedarikçiler",
        text: "Tedarikçilerin vergi numarası, IBAN ve ödeme hesabı bilgileri burada tutulur; kalem eklerken listeden seçilir.",
        run: async (page) => {
          await go(page, "/suppliers", 900);
          await mark(page, await byText(page, "Yeni Tedarikçi", "button"));
        },
      },
    ],
  },

  {
    id: "kayitlar",
    group: "Kayıtlar",
    title: "Müşteriler ve Malzeme Kataloğu",
    intro: "Müşteriler tekliflerden otomatik oluşur. Malzeme kataloğu, Malzeme & Hizmet tekliflerinde seçilen fiyatsız kalem tanımlarını tutar.",
    steps: [
      {
        title: "Müşteriler",
        text: "Her müşterinin teklif sayısı ve toplam gücü listelenir. Yeni müşteri, teklif oluştururken eklenir.",
        run: async (page) => {
          await go(page, "/customers", 900);
        },
      },
      {
        title: "Müşteri detayı",
        text: "Müşterinin tüm teklifleri, iletişim bilgileri ve tekliflerde girilen notlar tek sayfada toplanır.",
        run: async (page) => {
          await go(page, `/customers/${encodeURIComponent("Bozkır Enerji Yatırım A.Ş.")}`, 900);
        },
      },
      {
        title: "Malzeme kataloğu",
        text: "Malzemeler MLZ, hizmetler HZM koduyla tutulur. Fiyat kataloğa değil teklife girilir; her kalemin hangi teklifte hangi fiyatla verildiği görülebilir.",
        run: async (page) => {
          await go(page, "/materials", 900);
          await mark(page, await byText(page, "Yeni Kalem", "button"), { click: true });
        },
      },
      {
        title: "Yeni katalog kalemi",
        text: "Tür (malzeme / hizmet), ad ve birim girilir; kod otomatik verilir.",
        run: async (page) => {
          await press(page, await byText(page, "Yeni Kalem", "button"), 700);
          try { await fill(page, 'input[placeholder*="550W"]', "Bifacial PV Panel 700 Wp"); } catch {}
        },
        after: async (page) => {
          await page.keyboard.press("Escape");
        },
      },
    ],
  },

  {
    id: "takvim",
    group: "Çalışma Araçları",
    title: "Takvim",
    intro: "Ekip toplantıları, saha ziyaretleri, görevler ve hatırlatmalar tek takvimde tutulur. Etkinlikler bir teklife bağlanabilir; hatırlatmalar bildirim olarak gelir.",
    steps: [
      {
        title: "Aylık görünüm",
        text: "Etkinlikler türüne göre renkli işaretlenir. Üstteki filtrelerle yalnızca toplantı, görev veya ziyaretleri gösterebilirsiniz; Not Defteri’ndeki takip tarihleri de takvime düşer.",
        run: async (page) => {
          await go(page, "/takvim", 900);
        },
      },
      {
        title: "Yeni etkinlik",
        text: "“+ Etkinlik” ile başlık, tür, tarih-saat, konum, katılımcılar, görünürlük ve hatırlatma süresi girilir.",
        run: async (page) => {
          await press(page, await byText(page, "Etkinlik", "button"), 700);
          try { await fill(page, 'input[placeholder*="Örn. Çimsa"]', "Ege Tekstil — revize sunum"); } catch {}
          try { await fill(page, 'input[placeholder*="Ofis / Online"]', "Manisa OSB"); } catch {}
          await mark(page, await byText(page, "Oluştur", "button"), { click: true });
        },
      },
      {
        title: "Etkinlik eklendi",
        text: "Kaydedilen etkinlik takvimde görünür; tıklayınca düzenlenebilir, sürükleyerek başka güne taşınabilir.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Oluştur", "button"), 1200);
        },
      },
      {
        title: "Haftalık görünüm",
        text: "Hafta ve gün görünümünde etkinlikler saat ızgarasında gösterilir. Bir etkinliği sürükleyerek saatini, alt kenarından çekerek süresini değiştirirsiniz.",
        run: async (page) => {
          await press(page, await byText(page, "Hafta", "button"), 900);
        },
      },
      {
        title: "Ajanda",
        text: "Önümüzdeki 30 günün etkinlikleri liste halinde, gün gün sıralanır.",
        run: async (page) => {
          await press(page, await byText(page, "Ajanda", "button"), 900);
        },
      },
    ],
  },

  {
    id: "not-defteri",
    group: "Çalışma Araçları",
    title: "Not Defteri",
    intro: "Toplantı notları, kararlar, aksiyon planı, kişiler ve şirketler kişisel bir defterde tutulur. Notlar PDF olarak yazdırılabilir veya metin olarak kopyalanabilir.",
    steps: [
      {
        title: "Notlar ve yapılacaklar",
        text: "Solda notlar listesi, sağda açık aksiyonlar (Yapılacaklar) yer alır. Firma, kişi, etiket veya metinle arama yapılır.",
        run: async (page) => {
          await go(page, "/not-defteri", 900);
        },
      },
      {
        title: "Toplantı notu",
        text: "Her not konu başlıkları, alınan kararlar ve sorumlu-termin bilgisiyle aksiyon planından oluşur. Takip tarihi takvime düşer.",
        run: async (page) => {
          await clickText(page, "Polatlı 10 MWp — teknik değerlendirme", "button, a, div, h3, p");
          await settle(page, 800);
        },
      },
      {
        title: "Yeni not",
        text: "“Yeni Not” ile başlık, tarih, tür, firma ve katılımcılar girilir; konu ve karar satırları ile aksiyonlar eklenir.",
        run: async (page) => {
          await go(page, "/not-defteri", 700);
          await press(page, await byText(page, "Yeni Not", "button"), 800);
          try { await fill(page, 'input[placeholder*="5 MWp arazi"]', "Niğde Kooperatif — ön görüşme"); } catch {}
        },
      },
      {
        title: "Görevler",
        text: "Hızlı görevler tarihleriyle tutulur; toplantı aksiyonları da burada listelenir.",
        run: async (page) => {
          await go(page, "/not-defteri", 700);
          await press(page, await byText(page, "Görevler", "button"), 700);
        },
      },
    ],
  },

  {
    id: "tasarim",
    group: "Çalışma Araçları",
    title: "3D Tasarım",
    intro: "Haritadan bina bulunur, çatı çizilir, paneller yerleştirilir ve yaklaşık üretim hesaplanır.",
    steps: [
      {
        title: "Tasarımlar",
        text: "Yeni tasarım için ad ve konum girilip “Oluştur & Aç”a basılır. Açılan editörde sırasıyla görüntü ve ölçek, bina ve çatı, panel yerleşimi adımları izlenir.",
        run: async (page) => {
          await go(page, "/tasarim", 900);
          await mark(page, await byText(page, "Oluştur & Aç", "button"));
        },
      },
    ],
  },

  {
    id: "yonetim",
    group: "Yönetim",
    title: "Ekip, Kayıtlar ve Firma Ayarları",
    intro: "Panel yöneticisi ekip arkadaşlarını davet eder, rollerini ve proje erişimlerini belirler; kim ne yaptı kayıtlarını ve firma performansını izler; PDF çıktılarındaki firma kimliğini ayarlar.",
    steps: [
      {
        title: "Kullanıcılar",
        text: "Paneldeki kişiler rolleriyle (Yönetici, Kullanıcı, Görüntüleyici) listelenir. Kalkan simgesinden kişi bazında proje gizleme veya salt okunur yapma ayarlanır.",
        run: async (page) => {
          await go(page, "/admin/users", 900);
          await mark(page, await byText(page, "Kişi davet et", "button"), { click: true });
        },
      },
      {
        title: "Kişi davet etme",
        text: "E-posta ve rol seçilip davet oluşturulur. Davet edilen kişiye e-posta gider; linke tıklayıp şifresini belirleyince doğrudan panele katılır.",
        run: async (page) => {
          await press(page, await byText(page, "Kişi davet et", "button"), 700);
          try { await fill(page, 'input[type="email"]', "kerem.sahin@demoenerji.com.tr"); } catch {}
        },
        after: async (page) => {
          await page.keyboard.press("Escape");
        },
      },
      {
        title: "Aktivite kayıtları",
        text: "Panelde kimin ne zaman hangi kaydı değiştirdiği listelenir. Kayıtlar silinemez; kullanıcı, işlem ve kaynak türüne göre filtrelenir. Satıra tıklayınca değişiklik detayı açılır.",
        run: async (page) => {
          await go(page, "/admin/audit", 900);
        },
      },
      {
        title: "Firma performansı",
        text: "Aylık teklif sayısı ve gücü, kazanma oranı, ortalama $/Wp, bekleyen ve tamamlanan ciro, 12 aylık trend ve satışçı sıralaması. “Yıllık Rapor” PDF olarak indirilir.",
        run: async (page) => {
          await go(page, "/admin/insights", 1200);
        },
      },
      {
        title: "Profilim",
        text: "Ad, şirket adı ve şifre değiştirilir; üye olduğunuz paneller ve aralarında geçiş burada listelenir.",
        run: async (page) => {
          await go(page, "/firm-settings", 900);
        },
      },
      {
        title: "Marka ayarları",
        text: "Logo, kaşe, marka rengi, slogan, filigran ve banka bilgileri PDF ve Excel çıktılarına uygulanır. “Önizle” çıktının nasıl görüneceğini gösterir.",
        run: async (page) => {
          await scrollTo(page, "Marka Ayarları");
          await mark(page, await byText(page, "Marka Ayarlarını Kaydet", "button"));
        },
      },
      {
        title: "Firma profili ve referanslar",
        text: "Firma tanıtım PDF’i, referans listesi ve sertifika gibi ek belgeler yüklenir; paylaşım linkinde müşteri bunları “Firma” ve “Referanslar” sekmelerinde görür.",
        run: async (page) => {
          await scrollTo(page, "Firma Profili & Referanslar");
        },
      },
    ],
  },

  {
    id: "destek",
    group: "Destek",
    title: "Nasıl Çalışır, İletişim ve Diğer Platformlar",
    intro: "Platform içi yardım sayfası, geliştiriciyle iletişim formu ve aynı hesapla kullanılabilen diğer platformlar.",
    steps: [
      {
        title: "Nasıl Çalışır",
        text: "Şablonla başlayıp müşteriyle paylaşıma kadar 13 adımlık akış, her adımda otomatik hesaplanan değerler ve pratik ipuçlarıyla anlatılır.",
        run: async (page) => {
          await go(page, "/help", 900);
        },
      },
      {
        title: "İletişime Geç",
        text: "Hata bildirimi, özellik önerisi veya soru için form doldurulur; mesaj e-posta uygulamanızda hazır taslak olarak açılır.",
        run: async (page) => {
          await go(page, "/contact", 900);
        },
      },
      {
        title: "Diğer Platformlar",
        text: "Fizibilite, proje yönetimi, satınalma karar destek ve konstrüksiyon BoM platformlarına buradan geçilir.",
        run: async (page) => {
          await go(page, "/platforms", 900);
        },
      },
    ],
  },
];

// ---------------------------------------------------------------- çalıştır
const only = process.argv.slice(2);
const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { modules: [] };
const result = { generatedAt: new Date().toISOString(), viewport: { w: VW, h: VH }, modules: [] };
const failures = [];

/** Manifesti yaz: bu çalıştırmada çekilen bölümler + önceki çalıştırmadan kalanlar, senaryo sırasıyla. */
function writeManifest() {
  const byId = new Map([...prev.modules, ...result.modules].map((m) => [m.id, m]));
  const modules = MODULES.map((m) => byId.get(m.id)).filter(Boolean);
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify({ ...result, modules }, null, 1));
  return modules;
}

const { browser, page } = await launch({ width: VW, height: VH });
const guestCtx = await browser.createBrowserContext();
const guest = await guestCtx.newPage();
await guest.setViewport({ width: VW, height: VH });
guest.setDefaultTimeout(45_000);

try {
  await login(page);
  for (const mod of MODULES) {
    if (only.length && !only.includes(mod.id)) {
      const old = prev.modules.find((m) => m.id === mod.id);
      if (old) result.modules.push(old);
      continue;
    }
    console.log(`\n=== ${mod.title}`);
    const steps = [];
    for (const [i, st] of mod.steps.entries()) {
      const pg = st.guest ? guest : page;
      marks = [];
      cursor = null;
      const name = `${mod.id}-${String(i + 1).padStart(2, "0")}`;
      try {
        await st.run(pg);
        await settle(pg, 300);
        const rects = [];
        for (const m of marks) {
          const r = await rectOf(m.el).catch(() => null);
          if (r) rects.push(r);
        }
        const cur = cursor ? await rectOf(cursor).catch(() => null) : null;
        await pg.evaluate((keep) => {
          document.querySelectorAll("nextjs-portal").forEach((n) => (n.style.display = "none"));
          document.querySelectorAll("[data-sonner-toaster]").forEach((n) => (n.style.visibility = keep ? "" : "hidden"));
        }, !!st.toast);
        fs.mkdirSync(OUT, { recursive: true });
        await pg.screenshot({ path: path.join(OUT, `${name}.webp`), type: "webp", quality: 78 });
        steps.push({
          img: `/tanitim/${name}.webp`,
          title: st.title,
          text: st.text,
          marks: rects,
          cursor: cur ? { x: Math.round((cur.x + cur.w / 2) * 100) / 100, y: Math.round((cur.y + cur.h / 2) * 100) / 100 } : null,
        });
        console.log("✓", name, st.title);
      } catch (e) {
        failures.push(`${name} ${st.title}: ${String(e.message || e).split("\n")[0]}`);
        console.log("✗", name, st.title, "—", String(e.message || e).split("\n")[0]);
      }
      if (st.after) await st.after(pg).catch(() => {});
    }
    result.modules.push({ id: mod.id, group: mod.group, title: mod.title, intro: mod.intro, steps });
    writeManifest();
    console.log(`--- bölüm bitti: ${mod.id} (${steps.length}/${mod.steps.length})`);
  }
} finally {
  await browser.close();
}

const all = writeManifest();
const total = all.reduce((s, m) => s + m.steps.length, 0);
console.log(`\nManifest: ${total} adım, ${all.length} modül → ${path.relative(process.cwd(), MANIFEST)}`);
if (failures.length) console.log(`\nAtlanan ${failures.length} adım:\n` + failures.join("\n"));
