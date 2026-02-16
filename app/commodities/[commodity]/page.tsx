import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getQuote, getCandles } from '@/lib/finnhub/api';
import { COMMODITY_MAP } from '@/lib/data/market-data';
import AssetClient from '../../asset/[symbol]/AssetClient';
import { MarketAsset } from '@/lib/finnhub/types';

interface PageProps {
    params: {
        commodity: string;
    };
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const info = COMMODITY_MAP[params.commodity.toLowerCase()];
    if (!info) return { title: 'Commodity Not Found | FinnSays' };
    return {
        title: `${info.name} Price Today (Live) | FinnSays`,
        description: `Track real-time ${info.name} (${info.symbol}) prices, charts, and market news. ${info.description}.`,
    };
}

function generateSparkline(base: number, volatility: number): number[] {
    const points: number[] = [];
    let current = base;
    for (let i = 0; i < 20; i++) {
        current += (Math.random() - 0.48) * volatility;
        points.push(current);
    }
    return points;
}

export default async function CommodityPage({ params }: PageProps) {
    const info = COMMODITY_MAP[params.commodity.toLowerCase()];

    if (!info) {
        notFound();
    }

    // 1. Fetch Data
    // eslint-disable-next-line react-hooks/purity
    const now = Math.floor(Date.now() / 1000);
    const twoMonthsAgo = now - 60 * 24 * 60 * 60;

    const [quoteResult, candlesResult] = await Promise.allSettled([
        getQuote(info.symbol),
        getCandles(info.symbol, 'D', twoMonthsAgo, now)
    ]);

    const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
    const candles = candlesResult.status === 'fulfilled' ? candlesResult.value : null;

    if (!quote || quote.c === 0) {
        // Handle no data or error
        return (
            <main className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold">Data Unavailable</h1>
                <p>Could not fetch data for {info.name}.</p>
            </main>
        );
    }

    // 2. Transform to MarketAsset
    const marketAsset: MarketAsset = {
        symbol: info.symbol,
        name: info.name,
        type: 'commodity',
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        volume: 0,
        marketCap: 0,
        sparklineData: generateSparkline(quote.c, quote.c * 0.01)
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let candleData: any[] = [];
    if (candles && candles.s === 'ok' && candles.t) {
        candleData = candles.t.map((time, i) => ({
            time: new Date(time * 1000).toISOString().split('T')[0],
            open: candles.o[i],
            high: candles.h[i],
            low: candles.l[i],
            close: candles.c[i],
            volume: candles.v[i]
        }));
    }

    // JSON-LD
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": info.name,
        "offers": {
            "@type": "Offer",
            "price": quote.c,
            "priceCurrency": "USD"
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <AssetClient
                symbol={info.symbol}
                asset={marketAsset}
                candleData={candleData}
                recommendations={[]}
            />
        </>
    );
}
