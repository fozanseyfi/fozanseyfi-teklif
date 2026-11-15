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
import { launch, login, go, settle, sleep, byText, clickText, clickOption, ensureChecked, fill, field, setValue, waitPath, OUT } from "./lib.mjs";

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
  manisa: await pid("Manisa OSB Fabrika Çatı GES"),
  eskisehir: await pid("Eskişehir Fabrika Çatı — Malzeme Teklifi"),
  costKarapinar: (await prisma.costProject.findFirst({ where: { organizationId: ORG, name: "Karapınar 5 MWp Arazi GES" } }))?.id,
  shareToken: (await prisma.shareLink.findFirst({ where: { organizationId: ORG, customerLabel: "Satınalma" } }))?.token,
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
  const el = typeof target === "string" ? await byText(page, target, "h1, h2, h3, h4, p, span, div, label, button, a, th") : target;
  await el.evaluate((n, b) => n.scrollIntoView({ block: b }), block);
  await page.evaluate(() => window.scrollBy(0, -70));
  await sleep(350);
}
const top = (page) => page.evaluate(() => window.scrollTo(0, 0));

/** Açık penceredeki (en üstteki sabit katman) düğme. */
async function modalButton(page, text, timeout = 8000) {
  const end = Date.now() + timeout;
  for (;;) {
    const h = await page.evaluateHandle((t) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const layers = [...document.querySelectorAll("[role=dialog], .fixed")].filter((n) => {
        const r = n.getBoundingClientRect();
        return r.width > 200 && r.height > 150 && getComputedStyle(n).position === "fixed";
      });
      for (const layer of layers.reverse()) {
        const b = [...layer.querySelectorAll("button")].find((x) => norm(x.textContent) === t);
        if (b) return b;
      }
      return null;
    }, text);
    const el = h.asElement();
    if (el) return el;
    if (Date.now() > end) throw new Error(`Pencere düğmesi bulunamadı: "${text}"`);
    await sleep(300);
  }
}

/** Tabloda metni içeren satırdaki düğme. */
async function rowButton(page, rowText, buttonText) {
  const h = await page.evaluateHandle(
    (rt, bt) => {
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const row = [...document.querySelectorAll("tr, li, [role=row]")].find((r) => r.textContent.includes(rt));
      return row ? [...row.querySelectorAll("button, a")].find((b) => norm(b.textContent) === bt) || null : null;
    },
    rowText,
    buttonText,
  );
  const el = h.asElement();
  if (!el) throw new Error(`Satır düğmesi bulunamadı: ${rowText} / ${buttonText}`);
  return el;
}

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
        text: "Zil simgesindeki sayı okunmamış bildirimleri gösterir. Takvim hatırlatmaları, etkinlik davetleri ve etkinlik değişiklikleri buraya düşer; bildirime tıklayınca ilgili etkinlik açılır.",
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
          const plus = await page.waitForSelector('button[title="+0.5"], button[aria-label="+0.5"]', { visible: true });
          await mark(page, plus, { click: true });
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
          await mark(page, await byText(page, "Elektrik Proje Çizimi ve Onay", "button, li, div, span"), { click: true });
        },
      },
      {
        title: "Kalem tabloya eklendi",
        text: "Seçilen kalem tablonun sonuna eklenir. Miktar, para birimi ve birim maliyet girildikten sonra “Kaydet” ile teklif kaydedilir; satır toplamı TL karşılığıyla hesaplanır.",
        run: async (page) => {
          await clickOption(page, "Elektrik Proje Çizimi ve Onay");
          await settle(page, 600);
          const row = await page.evaluateHandle(() => [...document.querySelectorAll("tr")].filter((r) => r.textContent.includes("Elektrik Proje Çizimi ve Onay")).pop());
          await row.asElement().evaluate((n) => n.scrollIntoView({ block: "center" }));
          await sleep(300);
          await mark(page, row.asElement());
        },
      },
      {
        title: "Analiz: kâr ve toplamlar",
        text: "Tüm kalemlere tek seferde kâr oranı uygulanabilir ya da hedef toplam fiyat girilerek kâr otomatik dağıtılır. İç özet maliyet, kâr ve satış tutarlarını üç para biriminde gösterir; müşteriye gösterilmez.",
        run: async (page) => {
          await press(page, await byText(page, "Kaydet", "button"), 1500);
          await go(page, `${M}/quote-analiz`, 1000);
          await mark(page, await byText(page, "Uygula", "button"));
        },
      },
      {
        title: "Ödeme şekli",
        text: "Avans, bakiye gibi ödeme satırları yüzdesiyle girilir; tutar KDV dahil otomatik hesaplanır. PDF’te yalnızca işaretli satırlar görünür.",
        run: async (page) => {
          await sleep(800);
          await mark(page, await byText(page, "Ödeme Şekli", "label"));
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
          await mark(page, await byText(page, "Yeni Revize Oluştur", "button"), { click: true });
        },
      },
      {
        title: "Yeni revize oluşturuldu",
        text: "Yeni revize listeye eklenir ve aktif olur; Kalemler ve Analiz sekmelerinde yapılan değişiklikler bu revizeye yazılır. Karşılaştırma tablosu her kalemin revizeler arasındaki fiyat değişimini gösterir.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Yeni Revize Oluştur", "button"), 2500);
          await go(page, `${M}/revizeler`, 1000);
          const row = await page.evaluateHandle(() => [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Revize 1")));
          await mark(page, row.asElement());
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
          await clickOption(page, "Manisa OSB Fabrika Çatı GES");
          await sleep(500);
          for (const t of ["Firma Tanıtımı", "Referanslarımız", "Özet Fiyat Teklifi", "Sorumluluk Kapsam Tablosu"]) {
            try { await ensureChecked(page, t); } catch {}
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
        title: "Müşteri ekranı: detaylı teklif",
        text: "Her bölüm ayrı sekmede açılır ve PDF olarak indirilebilir. Fiyatlı teklifte kâr oranları ve gizlenen kalemler görünmez; link süresi dolunca otomatik kapanır.",
        guest: true,
        run: async (page) => {
          await go(page, `/share/${ID.shareToken}/priced-boq-detailed`, 1500);
        },
      },
      {
        title: "Teklifle ilgili karar çubuğu",
        text: "Sayfanın altında sabit duran çubukta müşteri teklifi onaylayabilir, revizyon isteyebilir veya soru sorabilir.",
        guest: true,
        run: async (page) => {
          await mark(page, await byText(page, "Revizyon İste", "button"), { click: true });
        },
      },
      {
        title: "Müşteri revizyon talebini yazar",
        text: "Açılan pencerede müşteri adını ve revize edilmesini istediği noktaları yazar; e-posta ve telefon isteğe bağlıdır.",
        guest: true,
        run: async (page) => {
          await press(page, await byText(page, "Revizyon İste", "button"), 600);
          await fill(page, 'input[placeholder="Ad Soyad"]', "Selin Ak");
          await fill(page, 'input[placeholder="ornek@firma.com"]', "selin@egetekstil.example");
          const ta = await page.$('textarea[placeholder*="revize edilmesini"]');
          await ta.click();
          await ta.type("Panel markasının alternatifli verilmesini ve teslim süresinin 6 haftaya çekilmesini rica ederiz.", { delay: 5 });
          await mark(page, ta);
          await mark(page, await byText(page, "Gönder", "button"), { click: true });
        },
      },
      {
        title: "Talep iletildi",
        text: "Talep teklifin aktivite akışına kaydedilir, aşaması otomatik “Revizyon İstendi” olur ve teklifi hazırlayan kişiye e-posta gider. Müşteri aynı linki tekrar açtığında yanıtının iletildiğini görür.",
        guest: true,
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Gönder", "button"), 2500);
          await settle(page, 1500);
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await sleep(500);
        },
      },
      {
        title: "Talep teklifin akışında",
        text: "Teklifin Pipeline sekmesinde aşama “Revizyon İstendi” olarak güncellenmiştir; müşterinin adı, e-postası ve mesajı aktivite akışının en üstündedir.",
        run: async (page) => {
          await go(page, `/projects/${ID.manisa}/detail/pipeline`, 1200);
          await scrollTo(page, "Aktivite Akışı", "start");
          await mark(page, await byText(page, "Panel markasının alternatifli verilmesini ve teslim süresinin 6 haftaya çekilmesini rica ederiz.", "p, div, span"));
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
        title: "Ana sözleşme metni",
        text: "Sözleşme ana metin ve eklerden (EK-0 … EK-14) oluşur; her biri üstteki sekmelerden açılır. Ana metin matbudur, projeye özgü bilgiler eklerden gelir. Altta Word belgesinin birebir önizlemesi görünür; “Tümünü indir (ZIP)” bütün belgeleri .docx olarak verir.",
        run: async (page) => {
          try { await press(page, await byText(page, "Arazi tipi santral (EPC)", "button, label, div"), 2500); } catch {}
          await settle(page, 1500);
          await mark(page, await byText(page, "Tümünü indir (ZIP)", "button"));
        },
      },
      {
        title: "EK-1 Proje Bilgi Formu",
        text: "Taraflar, sözleşme bedeli, adres ve yetkililer gibi bilgiler bu formda girilir; tekliften gelenler otomatik doludur. Boş kalan zorunlu alanlar kırmızıyla işaretlenir. “Kaydet” ile tüm eklere işlenir.",
        run: async (page) => {
          await press(page, await byText(page, "EK-1 · Proje Bilgi Formu", "button, a"), 1500);
          await mark(page, await byText(page, "EK-1 · Proje Bilgi Formu", "button, a"), { click: true });
        },
      },
      {
        title: "İmzalı sözleşmeyi arşivleme",
        text: "Islak veya e-imzalı sözleşmenin tamamı (ana metin + ekler) tek PDF olarak yüklenir ve burada sayfa sayfa görüntülenir.",
        run: async (page) => {
          await press(page, await byText(page, "İmzalı Sözleşme", "button, a"), 1200);
          await mark(page, await byText(page, "PDF seç", "button, label"));
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
        text: "“Kalem Ekle” ile tanım, kategori, miktar, birim fiyat, para birimi, KDV ve tedarikçi girilir. Faturasız kalemler ayrıca işaretlenir; ödenen tutar varsa aynı formda kaydedilir.",
        run: async (page) => {
          await press(page, await byText(page, "Kalem Ekle", "button"), 800);
          await fill(page, 'input[placeholder="Örn. Solar Panel"]', "OG Hücre ve Trafo Köşkü");
          await fill(page, await field(page, "Birim Fiyat (KDV hariç)"), "2850000");
          await page.keyboard.press("Tab");
          await mark(page, await page.$('input[placeholder="Örn. Solar Panel"]'));
          await mark(page, await field(page, "Birim Fiyat (KDV hariç)"));
        },
      },
      {
        title: "Kalemi kaydedin",
        text: "Formun altında TL toplam ve KDV dahil ödenecek tutar hesaplanır. “Ekle” ile kalem harcama listesine eklenir.",
        run: async (page) => {
          const add = await modalButton(page, "Ekle");
          await mark(page, add, { click: true });
        },
      },
      {
        title: "Kalem listeye eklendi",
        text: "Yeni kalem harcama kalemleri tablosunda görünür; gerçekleşen maliyet ve kâr kartları anında güncellenir. Ödeme durumu “Ödenmedi” olarak başlar.",
        toast: true,
        run: async (page) => {
          await press(page, await modalButton(page, "Ekle"), 1500);
          const row = await page.evaluateHandle(() => [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("OG Hücre ve Trafo Köşkü")));
          await mark(page, row.asElement());
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
          await mark(page, await rowButton(page, "Kablo Market Elektrik", "Öde"), { click: true });
        },
      },
      {
        title: "Tedarikçiye ödeme",
        text: "“Öde” penceresinde tutar yazılır ya da “Kalanı yaz” ile borcun tamamı doldurulur; tarih ve ödeme yöntemi seçilir. Tutar tedarikçinin kalemlerine kalan bakiyeye göre otomatik dağıtılır.",
        run: async (page) => {
          await press(page, await rowButton(page, "Kablo Market Elektrik", "Öde"), 700);
          await press(page, await modalButton(page, "Kalanı yaz"), 300);
          await mark(page, await modalButton(page, "Kalanı yaz"));
          await mark(page, await modalButton(page, "Ödeme Kaydet"), { click: true });
        },
      },
      {
        title: "Ödeme kaydedildi",
        text: "Ödeme kaydedilince tedarikçinin kalan borcu sıfırlanır, ilgili kalemin durumu “Ödendi” olur ve “Tedarikçilere Kalan” kartı güncellenir.",
        toast: true,
        run: async (page) => {
          await press(page, await modalButton(page, "Ödeme Kaydet"), 1500);
          await top(page);
          await mark(page, await byText(page, "TEDARİKÇİLERE KALAN", "p, span, div").catch(() => byText(page, "Tedarikçilere Kalan", "p, span, div")));
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
        text: "Müşteriler iletişim bilgisi, teklif sayısı ve öngörü notuyla listelenir. Yeni müşteri, teklif oluştururken müşteri kutusundan eklenir; “Git” müşteri sayfasını açar.",
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
        text: "Tür (malzeme / hizmet), ad ve birim girilir; kod türüne göre otomatik verilir (MLZ… / HZM…).",
        run: async (page) => {
          await press(page, await byText(page, "Yeni Kalem", "button"), 700);
          await fill(page, 'input[placeholder*="550W"]', "Bifacial PV Panel 700 Wp");
          await mark(page, await page.$('input[placeholder*="550W"]'));
          await mark(page, await modalButton(page, "Ekle"), { click: true });
        },
      },
      {
        title: "Kalem kataloğa eklendi",
        text: "Yeni kalem sıradaki kodla kataloğa eklenir ve hemen Malzeme & Hizmet tekliflerinde aranabilir hale gelir. Satırdaki düğmelerle düzenlenir veya silinir.",
        toast: true,
        run: async (page) => {
          await press(page, await modalButton(page, "Ekle"), 1500);
          const row = await page.evaluateHandle(() => [...document.querySelectorAll("tr")].find((r) => r.textContent.includes("Bifacial PV Panel 700 Wp")));
          await mark(page, row.asElement());
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
        text: "“+ Etkinlik” ile başlık, tür, tarih-saat, konum, katılımcılar, görünürlük ve hatırlatma süresi girilir. Sağdaki saat ızgarasında etkinlik bloğu sürüklenerek saati, uçlarından çekilerek süresi 10’ar dakikalık adımlarla ayarlanır.",
        run: async (page) => {
          await press(page, await byText(page, "Etkinlik", "button"), 700);
          try { await fill(page, 'input[placeholder*="Örn. Çimsa"]', "Ege Tekstil — revize sunum"); } catch {}
          try { await fill(page, 'input[placeholder*="Ofis / Online"]', "Manisa OSB"); } catch {}
          // Tarih: yarın, 14:00–15:00 (çekim saatine bağlı kalmasın)
          const d = new Date(Date.now() + 86_400_000);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          try { await setValue(await field(page, "Tarih *", { kind: "input" }), iso); } catch { try { await setValue(await field(page, "Tarih", { kind: "input" }), iso); } catch {} }
          try { await setValue(await field(page, "Başlangıç", { kind: "input" }), "14:00"); } catch {}
          try { await setValue(await field(page, "Bitiş", { kind: "input" }), "15:00"); } catch {}
          await sleep(400);
          await mark(page, await page.$('input[placeholder*="Örn. Çimsa"]'));
          await mark(page, await byText(page, "Oluştur", "button"), { click: true });
        },
      },
      {
        title: "Etkinlik eklendi",
        text: "Kaydedilen etkinlik takvimde görünür; üzerine tıklayınca düzenleme penceresi açılır. Seçilen hatırlatma zamanı gelince zil simgesine bildirim düşer.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Oluştur", "button"), 1200);
        },
      },
      {
        title: "Haftalık görünüm",
        text: "Hafta görünümü haftanın yedi gününü yan yana, her günün etkinlikleri saat sırasıyla gösterir. Oklarla önceki / sonraki haftaya geçilir.",
        run: async (page) => {
          await press(page, await byText(page, "Hafta", "button"), 900);
        },
      },
      {
        title: "Günlük görünüm",
        text: "Gün görünümü seçili günün etkinliklerini ve Not Defteri’ndeki aksiyonları saat sırasıyla listeler.",
        run: async (page) => {
          await press(page, await byText(page, "Gün", "button"), 900);
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
    intro: "Toplantı notları, kararlar, aksiyon planı, kişiler ve şirketler kişisel bir defterde tutulur. Notlar PDF olarak indirilebilir, WhatsApp veya e-postayla paylaşılabilir ya da metin olarak kopyalanabilir.",
    steps: [
      {
        title: "Notlar ve yapılacaklar",
        text: "Notlar kart olarak, aya göre gruplanarak listelenir; sabitlenen not en üstte durur. Üstteki “Yapılacaklar” çubuğu tüm notlardaki açık aksiyonları toplar. Firma, kişi, etiket veya metinle arama yapılır.",
        run: async (page) => {
          await go(page, "/not-defteri", 900);
          await mark(page, await byText(page, "Yapılacaklar", "button, div, span, p"));
        },
      },
      {
        title: "Toplantı notu",
        text: "Her not konu başlıkları, alınan kararlar ve sorumlu-termin bilgisiyle aksiyon planından oluşur; takip tarihi takvime düşer. Üstteki düğmelerle not PDF olarak indirilir, WhatsApp veya e-postayla paylaşılır.",
        run: async (page) => {
          await clickText(page, "Polatlı 10 MWp — teknik değerlendirme", "button, a, div, h3, p");
          await settle(page, 800);
          await mark(page, await byText(page, "PDF", "button"));
        },
      },
      {
        title: "Yeni not",
        text: "“Yeni Not” ile başlık, tarih, tür ve firma girilir. Firma deftere kayıtlı şirketlerden seçilir; listede yoksa yeni şirket olarak kaydedilir.",
        run: async (page) => {
          await go(page, "/not-defteri", 700);
          await press(page, await byText(page, "Yeni Not", "button"), 800);
          await fill(page, 'input[placeholder*="5 MWp arazi"]', "Niğde Kooperatif — ön görüşme");
          const firm = await page.$('input[placeholder="Deftere kayıtlı şirketlerden seç"]');
          await firm.click();
          await firm.type("Niğde", { delay: 30 });
          await sleep(600);
          await clickOption(page, "Niğde Tarım Kooperatifi · Niğde");
          await mark(page, await page.$('input[placeholder*="5 MWp arazi"]'));
          await mark(page, firm);
        },
      },
      {
        title: "Konular, kararlar ve aksiyonlar",
        text: "Sağ tarafta görüşülen her konu için özet ve kararlar yazılır; aksiyon planına yapılacak iş, sorumlu ve termin eklenir. “Kaydet” ile not deftere kaydedilir.",
        run: async (page) => {
          await fill(page, 'input[placeholder="Konu başlığı"]', "Sulama pompaları için GES");
          await fill(page, 'textarea[placeholder="Görüşme özeti"]', "Kooperatif 1,2 MW sulama yükü için arazi GES düşünüyor; kredi desteği araştırılıyor.");
          await fill(page, 'input[placeholder="Yapılacak iş"]', "Ön fizibilite ve bütçe teklifi hazırla");
          await fill(page, 'input[placeholder="Sorumlu"]', "Deniz Aydın");
          await mark(page, await page.$('input[placeholder="Konu başlığı"]'));
          await mark(page, await page.$('input[placeholder="Yapılacak iş"]'));
          await mark(page, await byText(page, "Kaydet", "button"), { click: true });
        },
      },
      {
        title: "Not kaydedildi",
        text: "Kaydedilen not, yazdırılabilir toplantı notu görünümünde açılır. Açık aksiyonu Notlar sekmesindeki Yapılacaklar çubuğuna eklenir; “Düzenle” ile değiştirilebilir.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Kaydet", "button"), 1500);
          await settle(page, 800);
          await top(page);
        },
      },
      {
        title: "Görevler",
        text: "Görevler sekmesinde hızlı görevler tarihleriyle tutulur ve açık, bugün, geciken, tamamlanan olarak süzülür. Yuvarlak işarete tıklayınca görev tamamlanır.",
        run: async (page) => {
          await go(page, "/not-defteri", 700);
          await press(page, await byText(page, "Görevler", "button"), 700);
          await mark(page, await page.$('input[placeholder*="Hızlı görev ekle"]'));
        },
      },
    ],
  },

  {
    id: "tasarim",
    group: "Çalışma Araçları",
    title: "3D Tasarım",
    intro: "Haritadan bina bulunur, uydu görüntüsü ölçekli altlık olarak alınır, bina kütlesi ve çatı oluşturulur, paneller yerleştirilir ve yaklaşık üretim hesaplanır. Tasarımlar tarayıcıda otomatik kaydedilir.",
    steps: [
      {
        title: "Yeni tasarım",
        text: "Tasarım adı ve konumu girilip “Oluştur & Aç”a basılır. Editörde dört adım vardır: Görüntü & Ölçek, Bina & Çatı, Panel Yerleşimi ve Analiz; her adım bir öncekini tamamlayınca açılır.",
        run: async (page) => {
          await go(page, "/tasarim", 900);
          await fill(page, 'input[placeholder="Örn. Villa Çatı GES"]', "Depo Çatı GES");
          await fill(page, 'input[placeholder="Mahalle / il"]', "Ümraniye / İstanbul");
          await mark(page, await page.$('input[placeholder="Örn. Villa Çatı GES"]'));
          await mark(page, await byText(page, "Oluştur & Aç", "button"), { click: true });
        },
      },
      {
        title: "Haritadan binayı bulun",
        text: "“Haritadan Al (uydu)” ile harita açılır; adres veya bina adı aranır, sonuç seçilince harita oraya gider. Bina ortalanıp yakınlaştırılır (zoom 20+) ve “Bu Görünümü Al”a basılır. Ölçek haritadan otomatik hesaplanır.",
        run: async (page) => {
          await press(page, await byText(page, "Oluştur & Aç", "button"), 2000);
          await press(page, await byText(page, "Haritadan Al (uydu)", "button"), 1500);
          const q = await page.$('input[placeholder="Adres / bina ara…"]');
          await fill(page, q, "IKEA Ümraniye");
          await press(page, await byText(page, "Ara", "button"), 3000);
          const res = await page.evaluateHandle(() =>
            [...document.querySelectorAll("button, li, div")].find(
              (n) => n.children.length === 0 && /Balkan Caddesi/.test(n.textContent) && !n.closest(".leaflet-container"),
            ),
          );
          await res.asElement().click();
          await settle(page, 3000);
          // Seçimde harita en yüksek yakınlaştırmaya gider (büyütülmüş, bulanık); iki kademe geri net görüntü verir
          for (let k = 0; k < 2; k++) {
            await (await page.$(".leaflet-control-zoom-out")).click();
            await sleep(2000);
          }
          await settle(page, 2500);
          // Tanıtımda firma adı görünmesin: arama kutusunda genel adres
          await setValue(q, "Balkan Caddesi, Ümraniye / İstanbul");
          await mark(page, q);
          await mark(page, await byText(page, "Bu Görünümü Al", "button"), { click: true });
        },
      },
      {
        title: "Görüntüyü kırpın",
        text: "Alınan görüntüde köşeler sürüklenerek binanın çevresi seçilir ve “Kırp & Kullan”a basılır. İstenirse bunun yerine drone veya ekran görüntüsü de yüklenebilir.",
        run: async (page) => {
          await press(page, await byText(page, "Bu Görünümü Al", "button"), 4500);
          await mark(page, await byText(page, "Kırp & Kullan", "button"), { click: true });
        },
      },
      {
        title: "Altlık ve ölçek hazır",
        text: "Kırpılan görüntü ölçekli altlık olur; sağdaki panelde ölçek (1 m = … px) görünür. “İlerle” ile bina adımına geçilir.",
        run: async (page) => {
          await press(page, await byText(page, "Kırp & Kullan", "button"), 3000);
          await mark(page, await byText(page, "Ölçek hazır", "p, span, div").catch(() => byText(page, "İlerle", "button")));
          await mark(page, await byText(page, "İlerle", "button"), { click: true });
        },
      },
      {
        title: "Bina dış hattını çizin",
        text: "“Boş Çiz” ile binanın dış hattı köşe köşe tıklanır; ilk köşeye dönülünce şekil kapanır. Hazır şekiller (dikdörtgen, L, T, U…) de eklenip “Taşı” ile binanın üzerine oturtulabilir. Çatı dış hattan otomatik üretilir.",
        run: async (page) => {
          await press(page, await byText(page, "İlerle", "button"), 2000);
          await press(page, await byText(page, "Boş Çiz", "button"), 800);
          // Altlık görüntünün ekrandaki yeri; çatı köşeleri görüntüye göre oransal
          const img = await page.evaluate(() => {
            const el = [...document.querySelectorAll("main image, main img, main canvas")]
              .map((n) => n.getBoundingClientRect())
              .filter((r) => r.width > 300 && r.height > 300)
              .sort((a, b) => b.width * b.height - a.width * a.height)[0];
            return el && { x: el.left, y: el.top, w: el.width, h: el.height };
          });
          if (!img) throw new Error("Altlık görüntü bulunamadı");
          const pts = [[0.36, 0.12], [0.73, 0.12], [0.73, 0.66], [0.36, 0.66]].map(([fx, fy]) => [img.x + fx * img.w, img.y + fy * img.h]);
          for (const [x, y] of pts) {
            await page.mouse.click(x, y);
            await sleep(350);
          }
          await page.mouse.click(pts[0][0], pts[0][1]);
          await settle(page, 1200);
          await mark(page, await byText(page, "Boş Çiz", "button"));
        },
      },
      {
        title: "Çatı tipi ve yükseklik",
        text: "Seçili kütle için duvar yüksekliği, çatı tipi (düz teras, beşik, kırma, tek eğim), eğim ve parapet ayarlanır. Depo ve fabrika çatıları için genellikle düz teras seçilir.",
        run: async (page) => {
          // Çatı tipi özel açılır liste: tetikleyiciye tıkla, "teras" içeren seçeneği seç
          const trigger = await byText(page, "Kırma (Hip) — Tüm kenarlardan eğimli", "button, [role=combobox], div");
          await trigger.click();
          await sleep(500);
          const opt = await page.evaluateHandle(() =>
            [...document.querySelectorAll("[role=option], li, button, div")]
              .filter((n) => /teras/i.test(n.textContent || "") && n.getBoundingClientRect().height > 0 && n.getBoundingClientRect().height < 80)
              .sort((a, b) => a.textContent.length - b.textContent.length)[0] || null,
          );
          if (!opt.asElement()) throw new Error("Teras çatı seçeneği bulunamadı");
          await opt.asElement().click();
          await settle(page, 900);
          await mark(page, await byText(page, "Çatı tipi", "p, span, label, div"));
          await mark(page, await byText(page, "Tamamla & Kilitle", "button"), { click: true });
        },
      },
      {
        title: "Çatıyı kilitleyip panel yerleşimine geçin",
        text: "“Tamamla & Kilitle” çatı modelini sabitler ve doğrudan panel yerleşimine geçer. Panel modeli katalogdan seçilir veya ölçüleri girilir; yön, panel arası, çatı kenar payı ve dizi arası boşluklar ayarlanır.",
        run: async (page) => {
          await press(page, await byText(page, "Tamamla & Kilitle", "button"), 2500);
          await mark(page, await byText(page, "Panelleri Otomatik Yerleştir", "button"), { click: true });
        },
      },
      {
        title: "Paneller yerleşti",
        text: "“Panelleri Otomatik Yerleştir” çatıya sığan en fazla paneli dizer. Paneller tek tek tıklanıp taşınabilir, döndürülebilir (R) veya silinebilir (Del); boş alanda dikdörtgen çizerek çoklu seçim yapılır.",
        toast: true,
        run: async (page) => {
          await press(page, await byText(page, "Panelleri Otomatik Yerleştir", "button"), 3000);
          await top(page);
        },
      },
      {
        title: "3B görünüm",
        text: "“3B” düğmesi binayı, çatıyı ve panelleri uydu görüntüsü üzerinde üç boyutlu gösterir. Fareyle döndürülür, tekerlekle yakınlaştırılır.",
        run: async (page) => {
          await press(page, await byText(page, "3B", "button"), 4000);
          await mark(page, await byText(page, "3B", "button"), { click: true });
        },
      },
      {
        title: "Analiz özeti",
        text: "Toplam panel sayısı, kurulu güç, özgül üretim ve yaklaşık yıllık üretim gösterilir. Üretim tahmini şehir bazlı özgül üretimle yapılır.",
        run: async (page) => {
          await press(page, await byText(page, "Analiz", "button"), 2500);
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
