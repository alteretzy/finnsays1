/**
 * Data Aggregator — Multi-Source Market Data Manager
 * Priority-based source selection with fallback cascade, caching, and deduplication
 */

import { getQuote as finnhubGetQuote, getCandles as finnhubGetCandles } from '@/lib/finnhub/api';
import { coinGeckoClient } from '@/lib/coingecko/client';
import { polygonClient } from '@/lib/polygon/client';
import { deduplicator } from '@/lib/utils/deduplicator';
import { logAPIError } from '@/lib/errors/handler';

// ── Crypto symbol → CoinGecko ID mapping ──────────
const CRYPTO_ID_MAP: Record<string, string> = {
    'BTC-USD': 'bitcoin',
    'ETH-USD': 'ethereum',
    'BNB-USD': 'binancecoin',
    'SOL-USD': 'solana',
    'XRP-USD': 'ripple',
    'ADA-USD': 'cardano',
    'DOGE-USD': 'dogecoin',
    'DOT-USD': 'polkadot',
    'AVAX-USD': 'avalanche-2',
    'LINK-USD': 'chainlink',
    'MATIC-USD': 'matic-network',
    'LTC-USD': 'litecoin',
    'UNI-USD': 'uniswap',
    'XLM-USD': 'stellar',
    'ATOM-USD': 'cosmos',
    'NEAR-USD': 'near',
    'APT-USD': 'aptos',
    'ARB-USD': 'arbitrum',
    'OP-USD': 'optimism',
    'AAVE-USD': 'aave',
    'GRT-USD': 'the-graph',
    'FIL-USD': 'filecoin',
    'RNDR-USD': 'render-token',
    'INJ-USD': 'injective-protocol',
    'SUI-USD': 'sui',
    'TON-USD': 'the-open-network',
    'SHIB-USD': 'shiba-inu',
    'PEPE-USD': 'pepe',
    'ICP-USD': 'internet-computer',
    'TRX-USD': 'tron',
};

// ── Commodity/Metal Finnhub OANDA symbols ─────────
const OANDA_MAP: Record<string, string> = {
    'GC=F': 'OANDA:XAU_USD',
    'SI=F': 'OANDA:XAG_USD',
    'PL=F': 'OANDA:XPT_USD',
    'PA=F': 'OANDA:XPD_USD',
    'HG=F': 'OANDA:XCU_USD',
    'CL=F': 'OANDA:BCO_USD',
    'NG=F': 'OANDA:NATGAS_USD',
    'ZC=F': 'OANDA:CORN_USD',
    'ZW=F': 'OANDA:WHEAT_USD',
    'ZS=F': 'OANDA:SOYBN_USD',
    'KC=F': 'OANDA:COFFEE_USD',
    'CT=F': 'OANDA:COTTON_USD',
    'SB=F': 'OANDA:SUGAR_USD',
    'CC=F': 'OANDA:COCOA_USD',
};

// ── In-memory cache ───────────────────────────────
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string, ttlMs: number): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttlMs) {
        cache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
    cache.set(key, { data, timestamp: Date.now() });
}

// ── Quote type ────────────────────────────────────
export interface AggregatedQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    volume: number;
    timestamp: number;
    source: string;
}

export interface AggregatedCandle {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// ── Helper: detect asset type ─────────────────────
function isCrypto(symbol: string): boolean {
    return symbol.endsWith('-USD') && !symbol.includes('=');
}

function isCommodityOrMetal(symbol: string): boolean {
    return symbol.includes('=F');
}

// ── DataAggregator class ──────────────────────────

class DataAggregator {
    /**
     * Get a real-time quote with multi-source fallback cascade
     */
    async getQuote(symbol: string): Promise<AggregatedQuote | null> {
        return deduplicator.deduplicate(`quote:${symbol}`, async () => {
            // Check cache (1s TTL for real-time data)
            const cached = getCached<AggregatedQuote>(`quote:${symbol}`, 1000);
            if (cached) return cached;

            let result: AggregatedQuote | null = null;

            if (isCrypto(symbol)) {
                result = await this.getCryptoQuote(symbol);
            } else if (isCommodityOrMetal(symbol)) {
                result = await this.getCommodityQuote(symbol);
            } else {
                result = await this.getStockQuote(symbol);
            }

            if (result) {
                setCache(`quote:${symbol}`, result);
            }

            return result;
        });
    }

    /**
     * Get historical candles with source-appropriate fetching
     */
    async getCandles(
        symbol: string,
        resolution: string,
        from: number,
        to: number
    ): Promise<AggregatedCandle[]> {
        return deduplicator.deduplicate(`candles:${symbol}:${resolution}:${from}:${to}`, async () => {
            const cacheKey = `candles:${symbol}:${resolution}:${from}:${to}`;
            const cached = getCached<AggregatedCandle[]>(cacheKey, 300_000); // 5 min TTL
            if (cached) return cached;

            let candles: AggregatedCandle[] = [];

            if (isCrypto(symbol)) {
                candles = await this.getCryptoCandles(symbol, from, to);
            } else if (isCommodityOrMetal(symbol)) {
                candles = await this.getCommodityCandles(symbol, resolution, from, to);
            } else {
                candles = await this.getStockCandles(symbol, resolution, from, to);
            }

            if (candles.length > 0) {
                setCache(cacheKey, candles);
            }

            return candles;
        });
    }

    // ── Stock Quote (Finnhub → Polygon → fallback) ──

    private async getStockQuote(symbol: string): Promise<AggregatedQuote | null> {
        // 1. Try Finnhub (primary)
        try {
            const q = await finnhubGetQuote(symbol);
            if (q.c && q.c > 0) {
                return {
                    symbol,
                    price: q.c,
                    change: q.d || 0,
                    changePercent: q.dp || 0,
                    high: q.h,
                    low: q.l,
                    open: q.o,
                    previousClose: q.pc,
                    volume: 0,
                    timestamp: (q.t || Math.floor(Date.now() / 1000)) * 1000,
                    source: 'finnhub',
                };
            }
        } catch (e) {
            logAPIError('DataAggregator.getStockQuote.finnhub', e);
        }

        // 2. Try Polygon (if enabled)
        if (polygonClient.isEnabled) {
            try {
                const snap = await polygonClient.getSnapshot(symbol);
                const t = snap.ticker;
                return {
                    symbol,
                    price: t.day.c || t.lastTrade.p,
                    change: t.todaysChange,
                    changePercent: t.todaysChangePerc,
                    high: t.day.h,
                    low: t.day.l,
                    open: t.day.o,
                    previousClose: t.prevDay.c,
                    volume: t.day.v,
                    timestamp: t.updated || Date.now(),
                    source: 'polygon',
                };
            } catch (e) {
                logAPIError('DataAggregator.getStockQuote.polygon', e);
            }
        }

        return null;
    }

    // ── Crypto Quote (CoinGecko → Finnhub BINANCE) ──

    private async getCryptoQuote(symbol: string): Promise<AggregatedQuote | null> {
        const coinId = CRYPTO_ID_MAP[symbol];

        // 1. Try CoinGecko
        if (coinId) {
            try {
                const prices = await coinGeckoClient.getSimplePrice(
                    [coinId], 'usd', true
                );
                const coin = prices[coinId];
                if (coin && coin.usd > 0) {
                    return {
                        symbol,
                        price: coin.usd,
                        change: coin.usd * ((coin.usd_24h_change || 0) / 100),
                        changePercent: coin.usd_24h_change || 0,
                        high: coin.usd,
                        low: coin.usd,
                        open: coin.usd,
                        previousClose: coin.usd,
                        volume: coin.usd_24h_vol || 0,
                        timestamp: (coin.last_updated_at || Math.floor(Date.now() / 1000)) * 1000,
                        source: 'coingecko',
                    };
                }
            } catch (e) {
                logAPIError('DataAggregator.getCryptoQuote.coingecko', e);
            }
        }

        // 2. Fallback: Finnhub BINANCE
        try {
            const binanceSymbol = `BINANCE:${symbol.replace('-USD', 'USDT')}`;
            const q = await finnhubGetQuote(binanceSymbol);
            if (q.c && q.c > 0) {
                return {
                    symbol,
                    price: q.c,
                    change: q.d || 0,
                    changePercent: q.dp || 0,
                    high: q.h,
                    low: q.l,
                    open: q.o,
                    previousClose: q.pc,
                    volume: 0,
                    timestamp: (q.t || Math.floor(Date.now() / 1000)) * 1000,
                    source: 'finnhub-binance',
                };
            }
        } catch (e) {
            logAPIError('DataAggregator.getCryptoQuote.finnhub', e);
        }

        return null;
    }

    // ── Commodity/Metal Quote (Finnhub OANDA) ───────

    private async getCommodityQuote(symbol: string): Promise<AggregatedQuote | null> {
        const oandaSymbol = OANDA_MAP[symbol];
        const searchSymbol = oandaSymbol || symbol;

        try {
            const q = await finnhubGetQuote(searchSymbol);
            if (q.c && q.c > 0) {
                return {
                    symbol,
                    price: q.c,
                    change: q.d || 0,
                    changePercent: q.dp || 0,
                    high: q.h,
                    low: q.l,
                    open: q.o,
                    previousClose: q.pc,
                    volume: 0,
                    timestamp: (q.t || Math.floor(Date.now() / 1000)) * 1000,
                    source: 'finnhub-oanda',
                };
            }
        } catch (e) {
            logAPIError('DataAggregator.getCommodityQuote', e);
        }

        return null;
    }

    // ── Stock Candles (Finnhub → Polygon) ───────────

    private async getStockCandles(
        symbol: string,
        resolution: string,
        from: number,
        to: number
    ): Promise<AggregatedCandle[]> {
        // 1. Try Finnhub
        try {
            const candles = await finnhubGetCandles(symbol, resolution, from, to);
            if (candles.s === 'ok' && candles.t?.length > 0) {
                return candles.t.map((time: number, i: number) => ({
                    time: new Date(time * 1000).toISOString().split('T')[0],
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i],
                }));
            }
        } catch (e) {
            logAPIError('DataAggregator.getStockCandles.finnhub', e);
        }

        // 2. Try Polygon
        if (polygonClient.isEnabled) {
            try {
                const fromDate = new Date(from * 1000).toISOString().split('T')[0];
                const toDate = new Date(to * 1000).toISOString().split('T')[0];
                const timespan = resolution === 'D' ? 'day' : resolution === 'W' ? 'week' : 'day';
                const data = await polygonClient.getAggregates(symbol, 1, timespan, fromDate, toDate);
                if (data.results?.length) {
                    return data.results.map((bar) => ({
                        time: new Date(bar.t).toISOString().split('T')[0],
                        open: bar.o,
                        high: bar.h,
                        low: bar.l,
                        close: bar.c,
                        volume: bar.v,
                    }));
                }
            } catch (e) {
                logAPIError('DataAggregator.getStockCandles.polygon', e);
            }
        }

        return [];
    }

    // ── Crypto Candles (CoinGecko OHLC) ─────────────

    private async getCryptoCandles(
        symbol: string,
        from: number,
        to: number
    ): Promise<AggregatedCandle[]> {
        const coinId = CRYPTO_ID_MAP[symbol];
        if (!coinId) return [];

        const diffDays = Math.ceil((to - from) / 86400);
        const validDays = [1, 7, 14, 30, 90, 180, 365];
        const days = validDays.find(d => d >= diffDays) || 'max';

        try {
            const ohlcData = await coinGeckoClient.getOHLC(coinId, 'usd', days);
            if (ohlcData?.length > 0) {
                return ohlcData.map((point) => ({
                    time: new Date(point[0]).toISOString().split('T')[0],
                    open: point[1],
                    high: point[2],
                    low: point[3],
                    close: point[4],
                    volume: 0,
                }));
            }
        } catch (e) {
            logAPIError('DataAggregator.getCryptoCandles.ohlc', e);
        }

        // Fallback: use market chart (line data, not OHLC)
        try {
            const chart = await coinGeckoClient.getMarketChart(coinId, 'usd', days);
            if (chart.prices?.length > 0) {
                return chart.prices.map(([ts, price]) => ({
                    time: new Date(ts).toISOString().split('T')[0],
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume: 0,
                }));
            }
        } catch (e) {
            logAPIError('DataAggregator.getCryptoCandles.chart', e);
        }

        return [];
    }

    // ── Commodity/Metal Candles (Finnhub OANDA) ─────

    private async getCommodityCandles(
        symbol: string,
        resolution: string,
        from: number,
        to: number
    ): Promise<AggregatedCandle[]> {
        const oandaSymbol = OANDA_MAP[symbol] || symbol;

        try {
            const candles = await finnhubGetCandles(oandaSymbol, resolution, from, to);
            if (candles.s === 'ok' && candles.t?.length > 0) {
                return candles.t.map((time: number, i: number) => ({
                    time: new Date(time * 1000).toISOString().split('T')[0],
                    open: candles.o[i],
                    high: candles.h[i],
                    low: candles.l[i],
                    close: candles.c[i],
                    volume: candles.v[i],
                }));
            }
        } catch (e) {
            logAPIError('DataAggregator.getCommodityCandles', e);
        }

        return [];
    }
}

// Singleton export
export const dataAggregator = new DataAggregator();
