import { NextRequest, NextResponse } from 'next/server';

const parseMeta = (html: string, keys: string[]) => {
  for (const key of keys) {
    const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const match = html.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return '';
};

const parseTitle = (html: string) => {
  const ogTitle = parseMeta(html, ['og:title', 'twitter:title']);
  if (ogTitle) return ogTitle;
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? 'Produk Marketplace';
};

const parsePrice = (html: string) => {
  const metaPrice = parseMeta(html, ['product:price:amount', 'og:price:amount']);
  if (metaPrice) {
    const numeric = Number(metaPrice.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(numeric) && numeric > 0) return Math.round(numeric);
  }

  const ldjsonMatch = html.match(/"price"\s*:\s*"?([\d.]+)"?/i);
  if (ldjsonMatch?.[1]) {
    return Math.round(Number(ldjsonMatch[1]));
  }

  return 0;
};

const parseImage = (html: string) => {
  return (
    parseMeta(html, ['og:image', 'twitter:image']) ||
    'https://images.unsplash.com/photo-1556742031-c6961e8560b0?w=1200&q=80&auto=format&fit=crop'
  );
};

const inferSource = (url: string): string => {
  if (url.includes('shopee')) return 'Shopee';
  if (url.includes('tokopedia')) return 'Tokopedia';
  if (url.includes('alibaba')) return 'Alibaba';
  if (url.includes('1688')) return '1688';
  if (url.includes('aliexpress')) return 'AliExpress';
  return 'Marketplace';
};

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url?: string };

  if (!url) {
    return NextResponse.json({ error: 'URL tidak boleh kosong.' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 }
    });
    const html = await response.text();

    const title = parseTitle(html);
    const image = parseImage(html);
    const price = parsePrice(html) || 120000;

    return NextResponse.json({
      title,
      image,
      price,
      source: inferSource(url)
    });
  } catch {
    return NextResponse.json(
      {
        title: 'Produk Import Best Seller',
        image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=1200&q=80&auto=format&fit=crop',
        price: 120000,
        source: inferSource(url)
      },
      { status: 200 }
    );
  }
}
