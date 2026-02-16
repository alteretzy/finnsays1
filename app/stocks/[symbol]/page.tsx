import { Metadata } from 'next';
import { alphaVantageClient } from '@/lib/alphaVantage/client';
import AssetClient from '../../asset/[symbol]/AssetClient';
import { getAnalystRecommendations } from '@/lib/finnhub/api';
import { MarketAsset } from '@/lib/finnhub/types';

interface PageProps {
    params: Promise<{
        symbol: string;
    }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();

    // We try to fetch minimal data for metadata
    try {
        const overview = await alphaVantageClient.getOverview(symbol);
        const name = overview.Name || symbol;
        return {
            title: `${name} (${symbol}) Stock Price & News | FinnSays`,
            description: `Track ${name} (${symbol}) live stock price, analyst ratings, and financial data. Real-time charts and news.`,
        };
    } catch {
        return {
            title: `${symbol} Stock Price | FinnSays`,
        };
    }
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

export default async function StockPage({ params }: PageProps) {
    const { symbol: rawSymbol } = await params;
    const symbol = rawSymbol.toUpperCase();

    // 1. Fetch Data in parallel
    // We use AlphaVantage for details, Finnhub for recommendations
    const [overview, daily, recommendations] = await Promise.allSettled([
        alphaVantageClient.getOverview(symbol),
        alphaVantageClient.getDaily(symbol, 'compact'),
        getAnalystRecommendations(symbol)
    ]);

    const overviewData = overview.status === 'fulfilled' ? overview.value : null;
    const dailyData = daily.status === 'fulfilled' ? daily.value : null;
    const recs = recommendations.status === 'fulfilled' ? recommendations.value : [];

    if (!overviewData || !overviewData.Symbol) {
        // Fallback or not found? 
        // If generic symbol, render generic page
        // notFound();
    }

    // 2. Transform to MarketAsset
    // Alpha Vantage "Global Quote" might be better for real-time price, but Daily has close
    // Let's assume Daily data is sorted desc
    let price = 0;
    let change = 0;
    let changePercent = 0;
    let volume = 0;
    let candleData: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];

    if (dailyData && dailyData['Time Series (Daily)']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const timeSeries = dailyData['Time Series (Daily)'] as Record<string, any>;
        const dates = Object.keys(timeSeries);
        if (dates.length > 0) {
            const today = timeSeries[dates[0]];
            const yesterday = dates.length > 1 ? timeSeries[dates[1]] : null;

            price = parseFloat(today['4. close']);
            volume = parseFloat(today['5. volume']);

            if (yesterday) {
                const prevClose = parseFloat(yesterday['4. close']);
                change = price - prevClose;
                changePercent = (change / prevClose) * 100;
            }

            // Transform to candleData for chart
            // Take last 60 days
            candleData = dates.slice(0, 60).reverse().map(date => {
                const d = timeSeries[date];
                return {
                    time: date,
                    open: parseFloat(d['1. open']),
                    high: parseFloat(d['2. high']),
                    low: parseFloat(d['3. low']),
                    close: parseFloat(d['4. close']),
                    volume: parseFloat(d['5. volume'])
                };
            });
        }
    }

    const marketAsset: MarketAsset = {
        symbol: symbol,
        name: overviewData?.Name || symbol,
        type: 'stock',
        price: price,
        change: change,
        changePercent: changePercent,
        volume: volume,
        marketCap: parseFloat(overviewData?.MarketCapitalization || '0'),
        sparklineData: candleData.length > 0
            ? candleData.slice(-20).map(c => c.close)
            : generateSparkline(price, price * 0.02)
    };

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "FinancialProduct",
        "name": marketAsset.name,
        "tickerSymbol": symbol,
        "offers": {
            "@type": "Offer",
            "price": price,
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
                symbol={symbol}
                asset={marketAsset}
                candleData={candleData}
                recommendations={recs}
            />
        </>
    );
}
