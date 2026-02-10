'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';

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


type MetaConnectionStatus = {
  connected: boolean;
  facebook: {
    page_id: string | null;
    page_name: string | null;
  };
  instagram: {
    ig_user_id: string | null;
    connected: boolean;
  };
  auth: {
    scopes_ok: boolean;
    token_expired: boolean;
    expires_at: string | null;
  };
  notes: string[];
};

type Tone = 'friendly' | 'urgent' | 'premium';
type CalendarFilter = 'all' | 'instagram' | 'facebook';
type CaptionTemplate = 'softsell' | 'hardsell' | 'storytelling';
type DayPart = 'pagi' | 'siang' | 'malam';

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

function applyTemplate(template: CaptionTemplate, text: string) {
  if (template === 'hardsell') return `🚨 PROMO TERBATAS 🚨\n${text}\n\n#buruancheckout`;
  if (template === 'storytelling') {
    return `Awalnya banyak reseller bingung cari produk yang repeat order.\n\n${text}\n\nYuk jadikan produk ini andalan etalase kamu.`;
  }
  return text;
}

function buildCaption(
  niche: string,
  title: string,
  sellingPrice: number,
  tone: Tone,
  extraHashtags: string[],
  template: CaptionTemplate
) {
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

  const baseCaption = `${theme.emoji} ${title}

${theme.opener}
Harga rekomendasi jual mulai ${formatCurrency(sellingPrice)}.

✅ Siap dijual ulang
✅ Support dropship/reseller
✅ Cocok untuk UMKM yang ingin scale-up

${theme.cta}

${mergedTags}`;

  return applyTemplate(template, baseCaption);
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const postingTips: Record<'instagram' | 'facebook', Record<DayPart, string>> = {
  instagram: {
    pagi: '07:00 - 09:00 (konten edukasi + teaser produk)',
    siang: '12:00 - 13:30 (konten promo singkat)',
    malam: '19:00 - 21:00 (waktu konversi tertinggi)'
  },
  facebook: {
    pagi: '08:00 - 10:00 (konten komunitas)',
    siang: '13:00 - 14:00 (promo + CTA WhatsApp)',
    malam: '19:30 - 21:30 (posting katalog + live reminder)'
  }
};

export default function HomePage() {
  const [link, setLink] = useState('');
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loadingGrabber, setLoadingGrabber] = useState(false);
  const [grabberError, setGrabberError] = useState('');

  const [markup, setMarkup] = useState(25);
  const [shipping, setShipping] = useState(12000);
  const [platformFee, setPlatformFee] = useState(5000);
  const [ads, setAds] = useState(8000);
  const [targetProfit, setTargetProfit] = useState(2000000);
  const [psychologicalPricing, setPsychologicalPricing] = useState(true);

  const [niche, setNiche] = useState('Fashion Wanita');
  const [tone, setTone] = useState<Tone>('friendly');
  const [template, setTemplate] = useState<CaptionTemplate>('softsell');
  const [extraTagsInput, setExtraTagsInput] = useState('');
  const [caption, setCaption] = useState('');
  const [captionStatus, setCaptionStatus] = useState('');

  const [items, setItems] = useState<CalendarItem[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [channel, setChannel] = useState<'instagram' | 'facebook'>('instagram');
  const [dayPart, setDayPart] = useState<DayPart>('malam');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [metaStatus, setMetaStatus] = useState<MetaConnectionStatus | null>(null);
  const [metaMessage, setMetaMessage] = useState('');
  const [metaLoading, setMetaLoading] = useState(false);
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('all');
  const [calendarSearch, setCalendarSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const savedItems = safeParse<CalendarItem[]>(localStorage.getItem(STORAGE_CALENDAR_KEY), []);
    const savedSettings = safeParse<{
      markup: number;
      shipping: number;
      platformFee: number;
      ads: number;
      niche: string;
      tone: Tone;
      template: CaptionTemplate;
      extraTagsInput: string;
      webhookUrl: string;
      targetProfit: number;
      psychologicalPricing: boolean;
      dayPart: DayPart;
    } | null>(localStorage.getItem(STORAGE_SETTINGS_KEY), null);

    setItems(savedItems);

    if (savedSettings) {
      setMarkup(savedSettings.markup ?? 25);
      setShipping(savedSettings.shipping ?? 12000);
      setPlatformFee(savedSettings.platformFee ?? 5000);
      setAds(savedSettings.ads ?? 8000);
      setNiche(savedSettings.niche ?? 'Fashion Wanita');
      setTone(savedSettings.tone ?? 'friendly');
      setTemplate(savedSettings.template ?? 'softsell');
      setExtraTagsInput(savedSettings.extraTagsInput ?? '');
      setWebhookUrl(savedSettings.webhookUrl ?? '');
      setTargetProfit(savedSettings.targetProfit ?? 2000000);
      setPsychologicalPricing(savedSettings.psychologicalPricing ?? true);
      setDayPart(savedSettings.dayPart ?? 'malam');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_CALENDAR_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    const syncMetaStatus = async () => {
      try {
        const response = await fetch('/api/meta/status', { cache: 'no-store' });
        const data = (await response.json()) as MetaConnectionStatus;
        setMetaStatus(data);
      } catch {
        setMetaMessage('Gagal membaca status koneksi Meta.');
      }
    };

    const params = new URLSearchParams(window.location.search);
    const meta = params.get('meta');
    const metaError = params.get('meta_error');

    if (meta === 'connected') setMetaMessage('Akun Facebook & Instagram berhasil terhubung.');
    if (meta === 'connected_without_ig') setMetaMessage('Facebook terhubung, tapi Page belum tersambung ke Instagram Business.');
    if (metaError) setMetaMessage(`Koneksi Meta gagal: ${metaError}.`);

    if (meta || metaError) {
      const cleanUrl = `${window.location.pathname}`;
      window.history.replaceState({}, '', cleanUrl);
    }

    syncMetaStatus();
  }, []);


  useEffect(() => {
    localStorage.setItem(
      STORAGE_SETTINGS_KEY,
      JSON.stringify({
        markup,
        shipping,
        platformFee,
        ads,
        niche,
        tone,
        template,
        extraTagsInput,
        webhookUrl,
        targetProfit,
        psychologicalPricing,
        dayPart
      })
    );
  }, [ads, dayPart, extraTagsInput, markup, niche, platformFee, psychologicalPricing, shipping, targetProfit, tone, template, webhookUrl]);

  const baseCost = product?.price ?? 0;
  const marginValue = useMemo(() => (baseCost * markup) / 100, [baseCost, markup]);
  const rawPrice = useMemo(() => baseCost + marginValue + shipping + platformFee + ads, [ads, baseCost, marginValue, platformFee, shipping]);
  const finalPrice = useMemo(() => {
    if (!psychologicalPricing) return rawPrice;
    if (rawPrice <= 1000) return rawPrice;
    const rounded = Math.floor(rawPrice / 1000) * 1000;
    return rounded + 900;
  }, [psychologicalPricing, rawPrice]);
  const estimatedProfit = useMemo(() => finalPrice - baseCost - shipping - platformFee - ads, [ads, baseCost, finalPrice, platformFee, shipping]);
  const breakEvenUnits = useMemo(() => {
    if (estimatedProfit <= 0) return 0;
    return Math.ceil(targetProfit / estimatedProfit);
  }, [estimatedProfit, targetProfit]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const channelMatch = calendarFilter === 'all' ? true : item.channel === calendarFilter;
        const keyword = calendarSearch.toLowerCase().trim();
        const text = `${item.caption} ${item.productTitle ?? ''}`.toLowerCase();
        return channelMatch && (keyword ? text.includes(keyword) : true);
      }),
    [calendarFilter, calendarSearch, items]
  );

  const extraHashtags = useMemo(() => extraTagsInput.split(',').map((value) => value.trim()).filter(Boolean), [extraTagsInput]);
  const hashtagCount = useMemo(() => (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length, [caption]);

  const channelStats = useMemo(() => {
    const instagramCount = items.filter((item) => item.channel === 'instagram').length;
    const facebookCount = items.filter((item) => item.channel === 'facebook').length;
    const posted = items.filter((item) => item.status === 'posted').length;
    return { instagramCount, facebookCount, posted };
  }, [items]);

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
      setCaption(buildCaption(generatedNiche, data.title, finalPrice || data.price, tone, generatedTags, template));
      setCaptionStatus('Metadata produk berhasil diambil, niche & hashtag terisi otomatis.');
    } catch (error) {
      setGrabberError(error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setLoadingGrabber(false);
    }
  };

  const handleGenerateCaption = () => {
    if (!product) return;
    setCaption(buildCaption(niche, product.title, finalPrice || product.price, tone, extraHashtags, template));
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

  const duplicateTomorrow = (item: CalendarItem) => {
    const sourceDate = new Date(`${item.date}T${item.time}`);
    sourceDate.setDate(sourceDate.getDate() + 1);
    const nextDate = sourceDate.toISOString().slice(0, 10);
    const nextTime = sourceDate.toTimeString().slice(0, 5);

    const cloned: CalendarItem = {
      ...item,
      id: crypto.randomUUID(),
      date: nextDate,
      time: nextTime,
      status: 'draft'
    };

    setItems((prev) => [...prev, cloned].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
  };

  const exportCalendar = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `resellio-calendar-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  };


  const handleConnectMeta = async () => {
    setMetaLoading(true);
    setMetaMessage('');

    try {
      const response = await fetch('/api/meta/connect', { cache: 'no-store' });
      const data = (await response.json()) as { oauth_url?: string; error?: string };

      if (!response.ok || !data.oauth_url) {
        throw new Error(data.error ?? 'Gagal memulai koneksi Meta.');
      }

      window.location.href = data.oauth_url;
    } catch (error) {
      setMetaMessage(error instanceof Error ? error.message : 'Terjadi kesalahan koneksi Meta.');
      setMetaLoading(false);
    }
  };

  const handleDisconnectMeta = async () => {
    setMetaLoading(true);
    setMetaMessage('');

    try {
      await fetch('/api/meta/disconnect', { method: 'POST' });
      const response = await fetch('/api/meta/status', { cache: 'no-store' });
      const data = (await response.json()) as MetaConnectionStatus;
      setMetaStatus(data);
      setMetaMessage('Koneksi Meta berhasil diputus.');
    } catch {
      setMetaMessage('Gagal memutus koneksi Meta.');
    } finally {
      setMetaLoading(false);
    }
  };

  const handleImportCalendar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = safeParse<CalendarItem[]>(String(reader.result), []);
        if (!Array.isArray(imported) || !imported.length) {
          setScheduleStatus('File import tidak valid atau kosong.');
          return;
        }
        setItems(imported);
        setScheduleStatus('Calendar berhasil diimport dari file JSON.');
      } catch {
        setScheduleStatus('Gagal membaca file import.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <main className="container">
      <header className="hero">
        <div className="heroBrand">
          <Image src="/logo.svg" alt="Logo Resellio" className="heroLogo" width={56} height={56} priority />
          <h1>Resellio Dashboard</h1>
        </div>
        <p>Tool produktivitas importir & reseller UMKM berbasis Next.js: grab link produk, pricing engine, caption AI, scheduling, dan calendar visual.</p>
      </header>

      <section className="statsGrid">
        <article className="statCard"><p>Total jadwal</p><strong>{items.length}</strong></article>
        <article className="statCard"><p>Instagram plan</p><strong>{channelStats.instagramCount}</strong></article>
        <article className="statCard"><p>Facebook plan</p><strong>{channelStats.facebookCount}</strong></article>
        <article className="statCard"><p>Sudah posted</p><strong>{channelStats.posted}</strong></article>
      </section>

      <section className="card">
        <div className="calendarTop">
          <div>
            <h2>Meta Social Connect (Facebook Page + Instagram)</h2>
            <p className="muted">Status: <strong>{metaStatus?.connected ? 'Connected' : 'Not connected'}</strong></p>
          </div>
        </div>
        {metaStatus?.connected ? (
          <div className="stack compact">
            <p className="muted">Facebook Page: <strong>{metaStatus.facebook.page_name ?? '-'}</strong> ({metaStatus.facebook.page_id ?? '-'})</p>
            <p className="muted">Instagram Business ID: <strong>{metaStatus.instagram.ig_user_id ?? 'Belum terhubung'}</strong></p>
            <p className="muted">Scope valid: <strong>{metaStatus.auth.scopes_ok ? 'Ya' : 'Tidak'}</strong> · Token expired: <strong>{metaStatus.auth.token_expired ? 'Ya' : 'Tidak'}</strong></p>
            <button type="button" onClick={handleDisconnectMeta} disabled={metaLoading}>Disconnect</button>
          </div>
        ) : (
          <button type="button" onClick={handleConnectMeta} disabled={metaLoading}>{metaLoading ? 'Menyambungkan...' : 'Connect Facebook & Instagram'}</button>
        )}
        {metaMessage ? <p className="muted">{metaMessage}</p> : null}
      </section>

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
              <Image src={product.image} alt={product.title} loading="lazy" width={72} height={72} />
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
          <h2>2) Smart Pricing Engine + 4 fitur baru</h2>
          <div className="stack compact">
            <label>Markup (%)<input type="number" min={0} value={markup} onChange={(event) => setMarkup(Number(event.target.value) || 0)} /></label>
            <div className="chipRow">
              {[20, 30, 40].map((value) => (
                <button key={value} type="button" className="chip" onClick={() => setMarkup(value)}>Preset {value}%</button>
              ))}
            </div>
            <label>Biaya Shipping<input type="number" min={0} value={shipping} onChange={(event) => setShipping(Number(event.target.value) || 0)} /></label>
            <label>Biaya Platform<input type="number" min={0} value={platformFee} onChange={(event) => setPlatformFee(Number(event.target.value) || 0)} /></label>
            <label>Biaya Iklan<input type="number" min={0} value={ads} onChange={(event) => setAds(Number(event.target.value) || 0)} /></label>
            <label>Target profit bulanan<input type="number" min={0} value={targetProfit} onChange={(event) => setTargetProfit(Number(event.target.value) || 0)} /></label>
            <label className="inlineLabel"><input type="checkbox" checked={psychologicalPricing} onChange={(event) => setPsychologicalPricing(event.target.checked)} /> Aktifkan psychological pricing (akhiran 900)</label>
          </div>
          <div className="priceResult">
            <p>Base cost: <strong>{formatCurrency(baseCost)}</strong></p>
            <p>Margin ({markup}%): <strong>{formatCurrency(marginValue)}</strong></p>
            <p>Harga raw: <strong>{formatCurrency(rawPrice)}</strong></p>
            <p>Estimasi profit bersih/unit: <strong>{formatCurrency(estimatedProfit)}</strong></p>
            <p>Harga jual rekomendasi: <strong>{formatCurrency(finalPrice)}</strong></p>
            <p>Break-even target profit: <strong>{breakEvenUnits} unit</strong></p>
          </div>
        </article>

        <article className="card">
          <h2>3) AI Caption Generator + 3 fitur baru</h2>
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
            <label>
              Template caption
              <select value={template} onChange={(event) => setTemplate(event.target.value as CaptionTemplate)}>
                <option value="softsell">Soft Sell</option>
                <option value="hardsell">Hard Sell</option>
                <option value="storytelling">Storytelling</option>
              </select>
            </label>
            <div className="buttonRow">
              <button onClick={handleGenerateCaption} type="button" disabled={!product}>Generate Caption</button>
              <button onClick={handleCopyCaption} type="button" disabled={!caption}>Copy Caption</button>
            </div>
            <textarea rows={8} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption AI akan muncul di sini..." />
            <div className="metaRow">
              <span>Jumlah karakter: {caption.length}</span>
              <span>Jumlah hashtag: {hashtagCount}</span>
            </div>
            {captionStatus ? <p className="muted">{captionStatus}</p> : null}
          </div>
        </article>

        <article className="card">
          <h2>4) Instagram Auto Posting & Scheduling + rekomendasi jam</h2>
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
            <label>
              Slot waktu audiens
              <select value={dayPart} onChange={(event) => setDayPart(event.target.value as DayPart)}>
                <option value="pagi">Pagi</option>
                <option value="siang">Siang</option>
                <option value="malam">Malam</option>
              </select>
            </label>
            <p className="muted">Rekomendasi: <strong>{postingTips[channel][dayPart]}</strong></p>
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
          <h2>5) Content Calendar + 3 fitur baru</h2>
          <select value={calendarFilter} onChange={(event) => setCalendarFilter(event.target.value as CalendarFilter)}>
            <option value="all">Semua channel</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>

        <div className="buttonRow">
          <input placeholder="Cari caption / judul produk..." value={calendarSearch} onChange={(event) => setCalendarSearch(event.target.value)} />
          <button type="button" onClick={exportCalendar}>Export JSON</button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportCalendar} style={{ display: 'none' }} />
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
                <button type="button" onClick={() => duplicateTomorrow(item)}>Duplikat +1 hari</button>
                <button type="button" onClick={() => deleteItem(item.id)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
