import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_MARKETS = ['shopee', 'tokopedia', 'alibaba', '1688', 'aliexpress'];

const decodeEntities = (input: string) =>
  input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

const parseMeta = (html: string, keys: string[]) => {
  for (const key of keys) {
    const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const contentFirst = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');

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

const safeFallback = (url: string) => ({
  title: 'Produk Import Best Seller',
  image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80&auto=format&fit=crop',
  price: 120000,
  source: inferSource(url),
  currency: 'IDR',
  url
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

    const html = await response.text();

    const title = parseTitle(html);
    const image = parseImage(html);
    const price = parsePrice(html) || 120000;

    return NextResponse.json({
      title,
      image,
      price,
      source: inferSource(parsedUrl.toString()),
      currency: 'IDR',
      url: parsedUrl.toString()
    });
  } catch {
    return NextResponse.json(safeFallback(parsedUrl.toString()), { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
