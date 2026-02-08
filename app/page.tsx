'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ProductData = {
  title: string;
  image: string;
  price: number;
  source: string;
};

type CalendarItem = {
  id: string;
  date: string;
  time: string;
  caption: string;
  channel: 'instagram' | 'facebook';
  status: 'draft' | 'scheduled';
};

const STORAGE_KEY = 'resellio-calendar-items';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function inferMarket(url: string): string {
  if (url.includes('shopee')) return 'Shopee';
  if (url.includes('tokopedia')) return 'Tokopedia';
  if (url.includes('alibaba')) return 'Alibaba';
  if (url.includes('1688')) return '1688';
  if (url.includes('aliexpress')) return 'AliExpress';
  return 'Marketplace';
}

function buildCaption(niche: string, title: string, sellingPrice: number, tone: string) {
  const emoji = tone === 'friendly' ? '✨🔥' : tone === 'premium' ? '💎🖤' : '⚡📦';
  const cta = tone === 'premium' ? 'DM sekarang untuk order eksklusif!' : 'Klik link bio / DM untuk order sekarang!';

  return `${emoji} ${title}\n\nProduk ${niche} siap bantu jualan kamu makin cuan!\nHarga mulai ${formatCurrency(sellingPrice)} dengan kualitas import terpercaya.\n\n✅ Ready stok\n✅ Bisa dropship\n✅ Cocok untuk reseller UMKM\n\n${cta}\n\n#reseller #importir #umkm #jualanonline #${niche
    .toLowerCase()
    .replace(/\s+/g, '')} #produkhits`;
}

export default function HomePage() {
  const [link, setLink] = useState('');
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loadingGrabber, setLoadingGrabber] = useState(false);
  const [grabberError, setGrabberError] = useState('');

  const [markup, setMarkup] = useState(25);
  const [shipping, setShipping] = useState(12000);
  const [platformFee, setPlatformFee] = useState(5000);
  const [ads, setAds] = useState(8000);

  const [niche, setNiche] = useState('Fashion Wanita');
  const [tone, setTone] = useState<'friendly' | 'urgent' | 'premium'>('friendly');
  const [caption, setCaption] = useState('');

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [channel, setChannel] = useState<'instagram' | 'facebook'>('instagram');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setItems(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const baseCost = product?.price ?? 0;
  const marginValue = useMemo(() => (baseCost * markup) / 100, [baseCost, markup]);
  const finalPrice = useMemo(() => baseCost + marginValue + shipping + platformFee + ads, [ads, baseCost, marginValue, platformFee, shipping]);

  const handleGrabProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!link) return;

    setLoadingGrabber(true);
    setGrabberError('');

    try {
      const response = await fetch('/api/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link })
      });

      if (!response.ok) {
        throw new Error('Gagal mengambil metadata produk.');
      }

      const data = (await response.json()) as ProductData;
      setProduct(data);
      setCaption(buildCaption(niche, data.title, finalPrice || data.price, tone));
    } catch (error) {
      setGrabberError(error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setLoadingGrabber(false);
    }
  };

  const handleGenerateCaption = () => {
    if (!product) return;
    setCaption(buildCaption(niche, product.title, finalPrice || product.price, tone));
  };

  const handleSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!caption || !scheduleDate || !scheduleTime) {
      setScheduleStatus('Lengkapi caption dan jadwal posting terlebih dahulu.');
      return;
    }

    const newItem: CalendarItem = {
      id: crypto.randomUUID(),
      date: scheduleDate,
      time: scheduleTime,
      caption,
      channel,
      status: 'scheduled'
    };

    setItems((prev) => [...prev, newItem].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption,
            channel,
            scheduleAt: `${scheduleDate}T${scheduleTime}`,
            image: product?.image ?? null,
            productTitle: product?.title ?? null
          })
        });
        setScheduleStatus('Jadwal tersimpan dan payload dikirim ke webhook eksternal.');
      } catch {
        setScheduleStatus('Jadwal tersimpan lokal. Pengiriman webhook gagal, cek URL webhook.');
      }
      return;
    }

    setScheduleStatus('Jadwal tersimpan di Content Calendar (localStorage).');
  };

  return (
    <main className="container">
      <header className="hero">
        <h1>Resellio Dashboard</h1>
        <p>One-stop tools untuk importir & reseller: grab produk, pricing cerdas, caption AI, auto posting, dan content calendar.</p>
      </header>

      <section className="grid">
        <article className="card">
          <h2>1) Product Link Grabber</h2>
          <form onSubmit={handleGrabProduct} className="stack">
            <input
              type="url"
              placeholder="Paste link Shopee/Tokopedia/Alibaba/1688/AliExpress"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              required
            />
            <button type="submit" disabled={loadingGrabber}>{loadingGrabber ? 'Mengambil data...' : 'Ambil Metadata Produk'}</button>
          </form>
          {grabberError ? <p className="error">{grabberError}</p> : null}
          {product ? (
            <div className="productPreview">
              <img src={product.image} alt={product.title} />
              <div>
                <strong>{product.title}</strong>
                <p>Sumber: {product.source}</p>
                <p>Harga sumber: {formatCurrency(product.price)}</p>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h2>2) Smart Pricing Engine</h2>
          <div className="stack compact">
            <label>Markup (%)<input type="number" value={markup} onChange={(event) => setMarkup(Number(event.target.value))} /></label>
            <label>Biaya Shipping<input type="number" value={shipping} onChange={(event) => setShipping(Number(event.target.value))} /></label>
            <label>Biaya Platform<input type="number" value={platformFee} onChange={(event) => setPlatformFee(Number(event.target.value))} /></label>
            <label>Biaya Iklan<input type="number" value={ads} onChange={(event) => setAds(Number(event.target.value))} /></label>
          </div>
          <div className="priceResult">
            <p>Base cost: <strong>{formatCurrency(baseCost)}</strong></p>
            <p>Margin ({markup}%): <strong>{formatCurrency(marginValue)}</strong></p>
            <p>Harga jual disarankan: <strong>{formatCurrency(finalPrice)}</strong></p>
          </div>
        </article>

        <article className="card">
          <h2>3) AI Caption Generator</h2>
          <div className="stack compact">
            <label>Niche produk<input value={niche} onChange={(event) => setNiche(event.target.value)} /></label>
            <label>
              Tone caption
              <select value={tone} onChange={(event) => setTone(event.target.value as 'friendly' | 'urgent' | 'premium')}>
                <option value="friendly">Friendly</option>
                <option value="urgent">Urgent Sales</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <button onClick={handleGenerateCaption} type="button" disabled={!product}>Generate Caption</button>
            <textarea rows={8} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption AI akan muncul di sini..." />
          </div>
        </article>

        <article className="card">
          <h2>4) Instagram Auto Posting & Scheduling</h2>
          <form onSubmit={handleSchedule} className="stack compact">
            <label>Tanggal posting<input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label>
            <label>Jam posting<input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label>
            <label>
              Channel
              <select value={channel} onChange={(event) => setChannel(event.target.value as 'instagram' | 'facebook')}>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook Page</option>
              </select>
            </label>
            <label>Webhook/Meta Endpoint (opsional)<input type="url" placeholder="https://example.com/meta-webhook" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} /></label>
            <button type="submit">Simpan & Kirim Jadwal</button>
          </form>
          <p className="muted">Integrasi production: hubungkan endpoint ini ke Meta Graph API relay (serverless function / automation tool).</p>
          {scheduleStatus ? <p>{scheduleStatus}</p> : null}
        </article>
      </section>

      <section className="card">
        <h2>5) Content Calendar (localStorage)</h2>
        <div className="calendar">
          {items.length === 0 ? <p className="muted">Belum ada jadwal. Tambahkan dari panel scheduling.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="calendarItem">
              <div>
                <strong>{item.channel.toUpperCase()}</strong>
                <p>{item.date} • {item.time}</p>
              </div>
              <p>{item.caption.slice(0, 120)}...</p>
              <span>{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
