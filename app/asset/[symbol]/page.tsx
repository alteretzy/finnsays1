import AssetClient from './AssetClient';
import { getCandles, getAnalystRecommendations } from '@/lib/finnhub/api';
import { getMarketData } from '@/lib/data/market-data';
import { getMockCandleData } from '@/lib/finnhub/api';
import { dataAggregator } from '@/lib/dataManager/aggregator';

export const revalidate = 60;

// Generate static params from our curated watchlist
export async function generateStaticParams() {
    const data = await getMarketData();
    return data.map((asset) => ({
        symbol: asset.symbol,
    }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    const allAssets = await getMarketData();
    const asset = allAssets.find((a) => a.symbol === symbol);

    if (!asset) {
        return { title: 'Asset Not Found | FinnSays' };
    }

    const priceStr = asset.price < 1
        ? asset.price.toFixed(4)
        : asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const changeEmoji = asset.changePercent >= 0 ? '📈' : '📉';
    const changePrefix = asset.change >= 0 ? '+' : '';

    return {
        title: `${asset.symbol} ${asset.name} — $${priceStr} ${changeEmoji} ${changePrefix}${asset.changePercent.toFixed(2)}%`,
        description: `Track ${asset.name} (${asset.symbol}) live price, real-time candlestick charts, technical indicators, and market news. Current price: $${priceStr} (${changePrefix}${asset.changePercent.toFixed(2)}%).`,
        keywords: [
            `${asset.symbol} price`,
            `${asset.name} stock`,
            `${asset.symbol} chart`,
            `${asset.symbol} live`,
            `${asset.symbol} analysis`,
            `buy ${asset.symbol}`,
            `${asset.name} market data`,
            'real-time market data',
            'financial data',
        ],
        openGraph: {
            title: `${asset.symbol} — ${asset.name} $${priceStr}`,
            description: `Live price, charts, and market data for ${asset.name}. 24h: ${changeEmoji} ${changePrefix}${asset.changePercent.toFixed(2)}%`,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image' as const,
            title: `${asset.name} — $${priceStr}`,
            description: `24h: ${changeEmoji} ${changePrefix}${asset.changePercent.toFixed(2)}% | Live market data on FinnSays`,
        },
        alternates: {
            canonical: `/asset/${symbol}`,
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-image-preview': 'large' as const,
                'max-snippet': -1,
            },
        },
    };
}

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }) {
    const { symbol } = await params;
    const allAssets = await getMarketData();
    const asset = allAssets.find((a) => a.symbol === symbol) || null;
    const recommendations = await getAnalystRecommendations(symbol);

    // Use DataAggregator to fetch candles for all asset types
    let candleData;
    try {
        // eslint-disable-next-line react-hooks/purity
        const now = Math.floor(Date.now() / 1000);
        const twoMonthsAgo = now - 60 * 24 * 60 * 60;
        const candles = await dataAggregator.getCandles(symbol, 'D', twoMonthsAgo, now);
        if (candles.length > 0) {
            candleData = candles;
        }
    } catch (e) {
        console.warn('[asset] DataAggregator candle fetch failed:', e);
    }

    // Fallback to direct Finnhub for stocks
    if (!candleData && asset && asset.type === 'stock') {
        try {
            // eslint-disable-next-line react-hooks/purity
            const now = Math.floor(Date.now() / 1000);
            const monthAgo = now - 60 * 24 * 60 * 60;
            const candles = await getCandles(symbol, 'D', monthAgo, now);
            if (candles.s === 'ok' && candles.t) {
                candleData = candles.t.map((time: number, index: number) => ({
                    time: new Date(time * 1000).toISOString().split('T')[0],
                    open: candles.o[index],
                    high: candles.h[index],
                    low: candles.l[index],
                    close: candles.c[index],
                    volume: candles.v[index],
                }));
            }
        } catch (e) {
            console.warn('[asset] Finnhub candle fallback failed:', e);
        }
    }

    // Last resort: mock data
    if (!candleData || candleData.length === 0) {
        candleData = getMockCandleData();
    }

    // JSON-LD Schema — enhanced FinancialProduct
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FinancialProduct',
        name: asset?.name || symbol,
        identifier: symbol,
        category: asset?.type || 'Financial Instrument',
        description: `Real-time ${asset?.name || symbol} market data, price charts, and analysis`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://finnsays.com'}/asset/${symbol}`,
        offers: {
            '@type': 'Offer',
            price: asset?.price || 0,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            priceValidUntil: new Date(Date.now() + 86_400_000).toISOString().split('T')[0],
        },
        brand: {
            '@type': 'Brand',
            name: asset?.name || symbol,
        },
        provider: {
            '@type': 'Organization',
            name: 'FinnSays',
            url: process.env.NEXT_PUBLIC_SITE_URL || 'https://finnsays.com',
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <AssetClient
                symbol={symbol}
                asset={asset}
                candleData={candleData}
                recommendations={recommendations}
            />
        </>
    );
}

