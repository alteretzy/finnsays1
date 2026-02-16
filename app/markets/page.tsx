import { Metadata } from 'next';
import MarketsClient from './MarketsClient';
import { getMarketData } from '@/lib/data/market-data';

export const metadata: Metadata = {
    title: 'All Markets — Stocks, Crypto, Metals & Commodities',
    description:
        'Explore real-time market data for stocks, cryptocurrencies, precious metals and commodities. Sort, filter, and analyze 100+ assets with institutional-grade tools.',
    keywords: [
        'stock market',
        'cryptocurrency prices',
        'gold price',
        'commodity prices',
        'market data',
        'real-time quotes',
        'asset comparison',
    ],
    openGraph: {
        title: 'All Markets — FinnSays',
        description:
            'Explore real-time market data for stocks, crypto, metals & commodities',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'All Markets — FinnSays',
        description: 'Explore 100+ assets with real-time market data',
    },
    alternates: {
        canonical: '/markets',
    },
};

export const revalidate = 60;

export default async function MarketsPage() {
    const marketData = await getMarketData();
    return <MarketsClient initialData={marketData} />;
}
