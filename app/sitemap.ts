import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://finnsays.com'; // Replace with actual domain

    // Static routes
    const routes = [
        '',
        '/markets',
        '/screener',
        '/news',
        '/watchlist',
        '/contact',
        '/technology',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // Dynamic routes (Top assets example)
    // In a real app, fetch these from DB/API
    const assets = ['BTC-USD', 'ETH-USD', 'AAPL', 'TSLA', 'NVDA', 'AMD'].map((symbol) => ({
        url: `${baseUrl}/asset/${symbol}`,
        lastModified: new Date(),
        changeFrequency: 'always' as const,
        priority: 0.9,
    }));

    return [...routes, ...assets];
}
