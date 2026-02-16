import { Metadata } from 'next';
import FadeIn from '@/components/animations/FadeIn';
import LiveNewsWire from '@/components/data/LiveNewsWire';

export const metadata: Metadata = {
    title: 'Latest Market News & Financial Updates',
    description:
        'Stay updated with breaking financial news, market analysis, and real-time updates on stocks, crypto, and commodities. Get instant alerts on market-moving events.',
    keywords: [
        'market news',
        'financial news',
        'stock market updates',
        'breaking financial news',
        'real-time market alerts',
        'investment news',
        'market analysis',
        'earnings reports',
    ],
    openGraph: {
        title: 'Latest Market News — FinnSays',
        description: 'Breaking financial news and real-time market updates',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Market News — FinnSays',
        description: 'Breaking financial news and market analysis',
    },
    alternates: {
        canonical: '/news',
    },
};

interface YahooNewsItem {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
    type: string;
    thumbnail?: {
        resolutions: { url: string; width: number; height: number }[];
    };
    relatedTickers?: string[];
}

async function getMarketNews() {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/news?q=market,crypto,stocks&count=50`, {
            next: { revalidate: 60 }
        });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json) ? json as YahooNewsItem[] : [];
    } catch (e) {
        console.error(e);
        return [];
    }
}

export default async function NewsPage() {
    const news = await getMarketNews();

    return (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 pt-32 pb-12 min-h-screen">
            <FadeIn>
                <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-white/10 pb-6">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-light text-white mb-2">Market Intelligence</h1>
                        <p className="text-white/50 text-sm">
                            Streaming headlines from global financial sources. Real-time updates active.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 mt-4 md:mt-0 animate-pulse">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                        LIVE WIRE
                    </div>
                </div>
            </FadeIn>

            <section className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden min-h-[500px]">
                <LiveNewsWire initialNews={news} />
                {news.length === 0 && (
                    <div className="p-12 text-center text-white/30 text-sm">
                        Connecting to news wire...
                    </div>
                )}
            </section>
        </main>
    );
}
