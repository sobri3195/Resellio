'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ProductData = {
  title: string;
  image: string;
  price: number;
  source: string;
  currency: string;
  url: string;
  niche?: string;
  hashtags?: string[];
};

type CalendarItem = {
  id: string;
  date: string;
  time: string;
  caption: string;
  channel: 'instagram' | 'facebook';
  image?: string;
  productTitle?: string;
  status: 'draft' | 'scheduled' | 'posted';
};

type Tone = 'friendly' | 'urgent' | 'premium';
type CalendarFilter = 'all' | 'instagram' | 'facebook';

const STORAGE_CALENDAR_KEY = 'resellio-calendar-items-v2';
const STORAGE_SETTINGS_KEY = 'resellio-user-settings-v2';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function normalizeHashtag(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, '');
}

function buildCaption(niche: string, title: string, sellingPrice: number, tone: Tone, extraHashtags: string[]) {
  const styles: Record<Tone, { emoji: string; cta: string; opener: string }> = {
    friendly: {
      emoji: '✨🔥',
      opener: 'Siap bikin etalase toko kamu makin standout!',
      cta: 'Klik link bio / DM sekarang, stok terbatas!'
    },
    urgent: {
      emoji: '⚡📦',
      opener: 'Flash deal import hari ini, jangan sampai kehabisan!',
      cta: 'Amankan slot order kamu sekarang juga via DM!'
    },
    premium: {
      emoji: '💎🖤',
      opener: 'Pilihan premium untuk pelanggan yang mencari kualitas terbaik.',
      cta: 'DM untuk order eksklusif & harga reseller spesial.'
    }
  };

  const baseTags = ['reseller', 'importir', 'umkm', 'jualanonline', normalizeHashtag(niche), 'produkhits'];
  const mergedTags = [...new Set([...baseTags, ...extraHashtags.map(normalizeHashtag).filter(Boolean)])]
    .map((tag) => `#${tag}`)
    .join(' ');

  const theme = styles[tone];

  return `${theme.emoji} ${title}

${theme.opener}
Harga rekomendasi jual mulai ${formatCurrency(sellingPrice)}.

✅ Siap dijual ulang
✅ Support dropship/reseller
✅ Cocok untuk UMKM yang ingin scale-up

${theme.cta}

${mergedTags}`;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  const [tone, setTone] = useState<Tone>('friendly');
  const [extraTagsInput, setExtraTagsInput] = useState('');
  const [caption, setCaption] = useState('');
  const [captionStatus, setCaptionStatus] = useState('');

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [channel, setChannel] = useState<'instagram' | 'facebook'>('instagram');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');

  useEffect(() => {
    const savedItems = safeParse<CalendarItem[]>(localStorage.getItem(STORAGE_CALENDAR_KEY), []);
    const savedSettings = safeParse<{
      markup: number;
      shipping: number;
      platformFee: number;
      ads: number;
      niche: string;
      tone: Tone;
      extraTagsInput: string;
      webhookUrl: string;
    } | null>(localStorage.getItem(STORAGE_SETTINGS_KEY), null);

    setItems(savedItems);

    if (savedSettings) {
      setMarkup(savedSettings.markup ?? 25);
      setShipping(savedSettings.shipping ?? 12000);
      setPlatformFee(savedSettings.platformFee ?? 5000);
      setAds(savedSettings.ads ?? 8000);
      setNiche(savedSettings.niche ?? 'Fashion Wanita');
      setTone(savedSettings.tone ?? 'friendly');
      setExtraTagsInput(savedSettings.extraTagsInput ?? '');
      setWebhookUrl(savedSettings.webhookUrl ?? '');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_CALENDAR_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_SETTINGS_KEY,
      JSON.stringify({ markup, shipping, platformFee, ads, niche, tone, extraTagsInput, webhookUrl })
    );
  }, [ads, extraTagsInput, markup, niche, platformFee, shipping, tone, webhookUrl]);

  const baseCost = product?.price ?? 0;
  const marginValue = useMemo(() => (baseCost * markup) / 100, [baseCost, markup]);
  const finalPrice = useMemo(() => baseCost + marginValue + shipping + platformFee + ads, [ads, baseCost, marginValue, platformFee, shipping]);
  const estimatedProfit = useMemo(() => finalPrice - baseCost - shipping - platformFee - ads, [ads, baseCost, finalPrice, platformFee, shipping]);

  const filteredItems = useMemo(
    () => items.filter((item) => (calendarFilter === 'all' ? true : item.channel === calendarFilter)),
    [calendarFilter, items]
  );

  const extraHashtags = useMemo(() => extraTagsInput.split(',').map((value) => value.trim()).filter(Boolean), [extraTagsInput]);

  const handleGrabProduct = async (event: FormEvent) => {
    event.preventDefault();
    if (!link.trim()) return;

    setLoadingGrabber(true);
    setGrabberError('');

    try {
      const response = await fetch('/api/grab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link.trim() })
      });

      const data = (await response.json()) as ProductData | { error: string };
      if (!response.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Gagal mengambil metadata produk.');
      }

      setProduct(data);

      if (data.niche) setNiche(data.niche);
      if (data.hashtags?.length) setExtraTagsInput(data.hashtags.join(', '));

      const generatedNiche = data.niche || niche;
      const generatedTags = data.hashtags?.length ? data.hashtags : extraHashtags;
      setCaption(buildCaption(generatedNiche, data.title, finalPrice || data.price, tone, generatedTags));
      setCaptionStatus('Metadata produk berhasil diambil, niche & hashtag terisi otomatis.');
    } catch (error) {
      setGrabberError(error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setLoadingGrabber(false);
    }
  };

  const handleGenerateCaption = () => {
    if (!product) return;
    setCaption(buildCaption(niche, product.title, finalPrice || product.price, tone, extraHashtags));
    setCaptionStatus('Caption berhasil diperbarui berdasarkan pricing terbaru.');
  };

  const handleCopyCaption = async () => {
    if (!caption) return;
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionStatus('Caption berhasil disalin ke clipboard.');
    } catch {
      setCaptionStatus('Gagal menyalin caption. Silakan copy manual dari textarea.');
    }
  };

  const handleSchedule = async (event: FormEvent) => {
    event.preventDefault();

    if (!caption || !scheduleDate || !scheduleTime) {
      setScheduleStatus('Lengkapi caption dan jadwal posting terlebih dahulu.');
      return;
    }

    const productUrl = product?.url ?? (link.trim() || null);

    const newItem: CalendarItem = {
      id: crypto.randomUUID(),
      date: scheduleDate,
      time: scheduleTime,
      caption,
      channel,
      image: product?.image,
      productTitle: product?.title,
      status: 'scheduled'
    };

    setItems((prev) => [...prev, newItem].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));

    if (!webhookUrl) {
      setScheduleStatus('Jadwal tersimpan di Content Calendar (localStorage).');
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          channel,
          scheduleAt: `${scheduleDate}T${scheduleTime}`,
          image: product?.image ?? null,
          productTitle: product?.title ?? null,
          productUrl,
          source: product?.source ?? null
        })
      });
      setScheduleStatus('Jadwal tersimpan dan payload sukses dikirim ke webhook/Meta relay.');
    } catch {
      setScheduleStatus('Jadwal tersimpan lokal. Pengiriman webhook gagal, cek URL endpoint.');
    }
  };

  const updateItemStatus = (id: string, status: CalendarItem['status']) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <main className="container">
      <header className="hero">
        <h1>Resellio Dashboard</h1>
        <p>Tool produktivitas importir & reseller UMKM berbasis Next.js: grab link produk, pricing engine, caption AI, scheduling, dan calendar visual.</p>
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
            <button type="submit" disabled={loadingGrabber}>{loadingGrabber ? 'Mengambil metadata...' : 'Ambil Metadata Produk'}</button>
          </form>
          {grabberError ? <p className="error">{grabberError}</p> : null}
          {product ? (
            <div className="productPreview">
              <img src={product.image} alt={product.title} loading="lazy" />
              <div>
                <strong>{product.title}</strong>
                <p>Sumber: {product.source}</p>
                <p>Harga sumber: {formatCurrency(product.price)}</p>
                <a href={product.url} target="_blank" rel="noreferrer">Buka produk asal</a>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card">
          <h2>2) Smart Pricing Engine</h2>
          <div className="stack compact">
            <label>Markup (%)<input type="number" min={0} value={markup} onChange={(event) => setMarkup(Number(event.target.value) || 0)} /></label>
            <label>Biaya Shipping<input type="number" min={0} value={shipping} onChange={(event) => setShipping(Number(event.target.value) || 0)} /></label>
            <label>Biaya Platform<input type="number" min={0} value={platformFee} onChange={(event) => setPlatformFee(Number(event.target.value) || 0)} /></label>
            <label>Biaya Iklan<input type="number" min={0} value={ads} onChange={(event) => setAds(Number(event.target.value) || 0)} /></label>
          </div>
          <div className="priceResult">
            <p>Base cost: <strong>{formatCurrency(baseCost)}</strong></p>
            <p>Margin ({markup}%): <strong>{formatCurrency(marginValue)}</strong></p>
            <p>Estimasi profit bersih: <strong>{formatCurrency(estimatedProfit)}</strong></p>
            <p>Harga jual rekomendasi: <strong>{formatCurrency(finalPrice)}</strong></p>
          </div>
        </article>

        <article className="card">
          <h2>3) AI Caption Generator</h2>
          <div className="stack compact">
            <label>Niche produk<input value={niche} onChange={(event) => setNiche(event.target.value)} /></label>
            <label>Hashtag tambahan (pisahkan dengan koma)
              <input value={extraTagsInput} onChange={(event) => setExtraTagsInput(event.target.value)} placeholder="contoh: grosirbaju, fashionmurah" />
            </label>
            <label>
              Tone caption
              <select value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
                <option value="friendly">Friendly</option>
                <option value="urgent">Urgent Sales</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <div className="buttonRow">
              <button onClick={handleGenerateCaption} type="button" disabled={!product}>Generate Caption</button>
              <button onClick={handleCopyCaption} type="button" disabled={!caption}>Copy Caption</button>
            </div>
            <textarea rows={8} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption AI akan muncul di sini..." />
            {captionStatus ? <p className="muted">{captionStatus}</p> : null}
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
            <label>Webhook/Meta Endpoint (opsional)
              <input type="url" placeholder="https://example.com/meta-webhook" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} />
            </label>
            <button type="submit">Simpan & Kirim Jadwal</button>
          </form>
          <p className="muted">Untuk produksi, endpoint dapat diarahkan ke Meta Graph API relay (Vercel Function / Make / n8n / Zapier).</p>
          {scheduleStatus ? <p>{scheduleStatus}</p> : null}
        </article>
      </section>

      <section className="card">
        <div className="calendarHeader">
          <h2>5) Content Calendar (localStorage)</h2>
          <select value={calendarFilter} onChange={(event) => setCalendarFilter(event.target.value as CalendarFilter)}>
            <option value="all">Semua channel</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>

        <div className="calendar">
          {filteredItems.length === 0 ? <p className="muted">Belum ada jadwal. Tambahkan dari panel scheduling.</p> : null}
          {filteredItems.map((item) => (
            <div key={item.id} className="calendarItem">
              <div className="calendarTop">
                <div>
                  <strong>{item.channel.toUpperCase()}</strong>
                  <p>{item.date} • {item.time}</p>
                </div>
                <span>{item.status}</span>
              </div>
              <p>{item.caption.length > 180 ? `${item.caption.slice(0, 180)}...` : item.caption}</p>
              <div className="buttonRow">
                <button type="button" onClick={() => updateItemStatus(item.id, 'draft')}>Mark Draft</button>
                <button type="button" onClick={() => updateItemStatus(item.id, 'posted')}>Mark Posted</button>
                <button type="button" onClick={() => deleteItem(item.id)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
