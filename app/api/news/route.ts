import { NextRequest, NextResponse } from 'next/server';
import { searchYahooNews } from '@/lib/yahoo/client';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || 'stock market';
    const count = parseInt(searchParams.get('count') || '4', 10);

    const news = await searchYahooNews(q, count);
    return NextResponse.json(news);
}
