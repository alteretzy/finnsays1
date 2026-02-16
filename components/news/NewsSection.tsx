'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import FadeIn from '@/components/animations/FadeIn';

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

export default function NewsSection() {
    const [news, setNews] = useState<YahooNewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchNews() {
            try {
                const res = await fetch('/api/news?q=stock+market&count=4');
                if (res.ok) {
                    const data = await res.json();
                    setNews(Array.isArray(data) ? data : []);
                }
            } catch (e) {
                console.error('Failed to fetch Yahoo news:', e);
            } finally {
                setLoading(false);
            }
        }
        fetchNews();
    }, []);

    function getThumbUrl(item: YahooNewsItem): string {
        if (!item.thumbnail?.resolutions?.length) return '';
        // Pick the largest resolution
        const sorted = [...item.thumbnail.resolutions].sort((a, b) => b.width - a.width);
        return sorted[0].url;
    }

    function formatTime(ts: number): string {
        const diff = Date.now() / 1000 - ts;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (loading) {
        return (
            <section className="w-full">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-xl font-light text-white tracking-wide">Market News</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-72 rounded-2xl bg-white/[0.02] border border-white/5 animate-pulse" />
                    ))}
                </div>
            </section>
        );
    }

    if (news.length === 0) {
        return (
            <section className="w-full">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-xl font-light text-white tracking-wide">Market News</h2>
                </div>
                <p className="text-white/50 text-sm text-center py-12">No news available right now.</p>
            </section>
        );
    }

    return (
        <section className="w-full">
            <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-xl font-light text-white tracking-wide">Market News</h2>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-white/50 uppercase tracking-widest">Live</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {news.slice(0, 4).map((item, i) => {
                    const thumb = getThumbUrl(item);
                    return (
                        <FadeIn key={item.uuid} delay={i * 0.1}>
                            <Link
                                href={`/news/${item.uuid}?title=${encodeURIComponent(item.title)}&publisher=${encodeURIComponent(item.publisher)}&time=${item.providerPublishTime}&img=${encodeURIComponent(thumb)}&link=${encodeURIComponent(item.link)}`}
                                className="group block h-full"
                            >
                                <Card className="h-full flex flex-col !p-0 bg-[#0A0A15]/60 hover:bg-[#0F0F20]/80 transition-colors border-white/5" noPadding>
                                    <div className="relative h-40 overflow-hidden rounded-t-2xl">
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                                        {thumb ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={thumb}
                                                alt={item.title}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-[#0055FF]/20 to-[#0033AA]/10" />
                                        )}
                                        <span className="absolute bottom-3 left-4 z-20 text-[10px] uppercase tracking-widest text-[#0055FF] font-semibold bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
                                            {item.publisher}
                                        </span>
                                    </div>
                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="text-sm font-medium text-white/90 leading-snug mb-3 group-hover:text-[#0055FF] transition-colors line-clamp-2">
                                            {item.title}
                                        </h3>
                                        {item.relatedTickers && item.relatedTickers.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {item.relatedTickers.slice(0, 3).map((t) => (
                                                    <span key={t} className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/5">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/50">
                                            <span>{formatTime(item.providerPublishTime)}</span>
                                            <span className="group-hover:translate-x-1 transition-transform">Read &rarr;</span>
                                        </div>
                                    </div>
                                </Card>
                            </Link>
                        </FadeIn>
                    );
                })}
            </div>
        </section>
    );
}
