import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MARKETS = ['shopee', 'tokopedia', 'alibaba', '1688', 'aliexpress'];

const decodeEntities = (input: string) =>
  input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseMeta = (html: string, keys: string[]) => {
  for (const key of keys) {
    const escapedKey = escapeRegex(key);
    const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedKey}["'][^>]*>`, 'i');
    const match = html.match(propertyFirst) ?? html.match(contentFirst);

    if (match?.[1]) {
      return decodeEntities(match[1].trim());
    }
  }
  return '';
};

const parseTitle = (html: string) => {
  const ogTitle = parseMeta(html, ['og:title', 'twitter:title']);
  if (ogTitle) return ogTitle;

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return decodeEntities(titleMatch?.[1]?.trim() ?? 'Produk Marketplace');
};

const parsePrice = (html: string) => {
  const metaPrice = parseMeta(html, ['product:price:amount', 'og:price:amount']);
  if (metaPrice) {
    const numeric = Number(metaPrice.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(numeric) && numeric > 0) return Math.round(numeric);
  }

  const ldjsonMatch = html.match(/"price"\s*:\s*"?([\d.,]+)"?/i);
  if (ldjsonMatch?.[1]) {
    const value = Number(ldjsonMatch[1].replace(/,/g, ''));
    if (!Number.isNaN(value) && value > 0) return Math.round(value);
  }

  return 0;
};

const parseImage = (html: string) =>
  parseMeta(html, ['og:image', 'twitter:image']) ||
  'https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=1200&q=80&auto=format&fit=crop';

const inferSource = (url: string): string => {
  if (url.includes('shopee')) return 'Shopee';
  if (url.includes('tokopedia')) return 'Tokopedia';
  if (url.includes('alibaba')) return 'Alibaba';
  if (url.includes('1688')) return '1688';
  if (url.includes('aliexpress')) return 'AliExpress';
  return 'Marketplace';
};

const inferNiche = (title: string) => {
  const normalized = title.toLowerCase();

  if (/(hijab|dress|baju|kaos|jaket|celana|fashion|tas|sepatu|rok)/i.test(normalized)) return 'Fashion';
  if (/(skincare|serum|masker|kosmetik|lipstik|makeup|sabun|parfum)/i.test(normalized)) return 'Beauty';
  if (/(botol|tumbler|rak|dapur|organizer|sprei|bantal|karpet|home)/i.test(normalized)) return 'Home Living';
  if (/(lampu|kabel|charger|headset|earphone|speaker|bluetooth|smartwatch|gadget)/i.test(normalized)) return 'Gadget';
  if (/(bayi|anak|mainan|stroller|popok|edukasi)/i.test(normalized)) return 'Ibu & Anak';

  return 'Produk Viral';
};

const buildAutoHashtags = (title: string, niche: string, source: string) => {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
    .slice(0, 4);

  const fixedTags = ['reseller', 'jualanonline', 'produkviral', 'importir', niche, source];
  const clean = [...fixedTags, ...words]
    .map((tag) =>
      tag
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .trim()
        .replace(/\s+/g, '')
    )
    .filter(Boolean);

  return [...new Set(clean)].slice(0, 10);
};

const safeFallback = (url: string) => ({
  title: 'Produk Import Best Seller',
  image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80&auto=format&fit=crop',
  price: 120000,
  source: inferSource(url),
  currency: 'IDR',
  url,
  niche: 'Produk Viral',
  hashtags: ['reseller', 'jualanonline', 'produkviral', 'importir']
});

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url?: string };

  if (!url) {
    return NextResponse.json({ error: 'URL tidak boleh kosong.' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Format URL tidak valid.' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ error: 'Protokol URL tidak didukung.' }, { status: 400 });
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_MARKETS.some((market) => hostname.includes(market))) {
    return NextResponse.json({ error: 'Domain marketplace belum didukung.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 },
      signal: controller.signal
    });

    if (!response.ok) {
      return NextResponse.json(safeFallback(parsedUrl.toString()), { status: 200 });
    }

    const html = await response.text();

    const title = parseTitle(html);
    const image = parseImage(html);
    const price = parsePrice(html) || 120000;

    const source = inferSource(parsedUrl.toString());
    const niche = inferNiche(title);

    return NextResponse.json({
      title,
      image,
      price,
      source,
      currency: 'IDR',
      url: parsedUrl.toString(),
      niche,
      hashtags: buildAutoHashtags(title, niche, source)
    });
  } catch {
    return NextResponse.json(safeFallback(parsedUrl.toString()), { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
