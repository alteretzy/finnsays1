import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { coinGeckoClient } from '@/lib/coingecko/client';
import AssetClient from '../../asset/[symbol]/AssetClient';
import { MarketAsset } from '@/lib/finnhub/types';

interface PageProps {
    params: {
        coin: string;
    };
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const coinId = params.coin.toLowerCase();
    try {
        const coin = await coinGeckoClient.getCoin(coinId);
        return {
            title: `${coin.name} (${coin.symbol.toUpperCase()}) Price & Charts | FinnSays`,
            description: `Live ${coin.name} price, market cap, and trading volume. Real-time ${coin.name} charts and news.`,
        };
    } catch {
        return { title: `${params.coin} Price | FinnSays` };
    }
}

export default async function CryptoPage({ params }: PageProps) {
    const coinId = params.coin.toLowerCase();

    // 1. Fetch Data
    // We need details + OHLC
    const [coinData, ohlcData] = await Promise.allSettled([
        coinGeckoClient.getCoin(coinId),
        coinGeckoClient.getOHLC(coinId, 'usd', 30) // 30 days
    ]);

    const coin = coinData.status === 'fulfilled' ? coinData.value : null;
    const ohlc = ohlcData.status === 'fulfilled' ? ohlcData.value : [];

    if (!coin) {
        notFound();
    }

    const symbol = coin.symbol.toUpperCase() + '-USD';
    const currentPrice = coin.market_data.current_price.usd;

    // 2. Transform to MarketAsset
    const marketAsset: MarketAsset = {
        symbol: symbol,
        name: coin.name,
        type: 'crypto',
        price: currentPrice,
        change: coin.market_data.price_change_24h,
        changePercent: coin.market_data.price_change_percentage_24h,
        volume: coin.market_data.total_volume.usd,
        marketCap: coin.market_data.market_cap.usd,
        sparklineData: ohlc.length > 0
            ? ohlc.slice(-20).map(x => x[4])
            : []
    };

    // 3. Transform OHLC
    // CoinGecko OHLC: [time, open, high, low, close]
    const candleData = ohlc.map(d => ({
        time: new Date(d[0]).toISOString().split('T')[0],
        open: d[1],
        high: d[2],
        low: d[3],
        close: d[4],
        volume: 0 // CoinGecko OHLC endpoint doesn't return volume unfortunately
    }));

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Currency",
        "name": coin.name,
        "currency": "USD",
        "currentExchangeRate": {
            "@type": "ExchangeRateSpecification",
            "currency": "USD",
            "currentExchangeRate": currentPrice
        }
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <AssetClient
                symbol={symbol}
                asset={marketAsset}
                candleData={candleData}
                recommendations={[]} // No recommendations for crypto usually
            />
        </>
    );
}
