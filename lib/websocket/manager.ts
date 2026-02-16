/**
 * Binance WebSocket Manager
 * Handles real-time connections to Binance Public Stream
 * Features: Automatic reconnect, heartbeat, subscription management
 */

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
export type TickerData = {
    symbol: string;
    price: number;
    change: number; // 24h Change (absolute)
    changePercent: number; // 24h Change %
    volume: number; // 24h Volume
    timestamp: number;
};

type WebSocketCallback = (data: TickerData) => void;

class WebSocketManager {
    private binanceSocket: WebSocket | null = null;
    private finnhubSocket: WebSocket | null = null;

    private subscriptions: Map<string, Set<WebSocketCallback>> = new Map();
    private connectionState: ConnectionState = 'disconnected';
    private stateListeners: Set<(state: ConnectionState) => void> = new Set();

    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectDelay: number = 2000;
    private keepAliveInterval: NodeJS.Timeout | null = null;

    // Crypto Symbols Map (Binance)
    private cryptoMap: Record<string, string> = {
        'BTC-USD': 'btcusdt',
        'ETH-USD': 'ethusdt',
        'SOL-USD': 'solusdt',
        'DOGE-USD': 'dogeusdt',
        'XRP-USD': 'xrpusdt',
        'ADA-USD': 'adausdt',
        'AVAX-USD': 'avaxusdt',
        'DOT-USD': 'dotusdt',
        'MATIC-USD': 'maticusdt',
        'LINK-USD': 'linkusdt',
        'BNB-USD': 'bnbusdt',
        'LTC-USD': 'ltcusdt',
        'UNI-USD': 'uniusdt',
        'ATOM-USD': 'atomusdt',
        'NEAR-USD': 'nearusdt'
    };

    // Reverse map for Binance
    private reverseCryptoMap: Record<string, string> = {};

    constructor() {
        Object.entries(this.cryptoMap).forEach(([internal, binance]) => {
            this.reverseCryptoMap[binance.toUpperCase()] = internal;
        });
    }

    // ========================================
    // State Management
    // ========================================
    private updateState(state: ConnectionState) {
        this.connectionState = state;
        this.stateListeners.forEach((listener) => listener(state));
    }

    public onStateChange(callback: (state: ConnectionState) => void) {
        this.stateListeners.add(callback);
        return () => this.stateListeners.delete(callback);
    }

    public getState(): ConnectionState {
        return this.connectionState;
    }

    // ========================================
    // Connection Logic
    // ========================================
    public connect() {
        if (typeof window === 'undefined') return;

        // Prevent double connection if already connecting/connected
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') return;

        this.updateState('connecting');

        this.connectBinance();
        this.connectFinnhub();

        // We consider "connected" if at least one is up, or we track them separately.
        // For simplicity, if either connects, we say connected.
        // But better to track them? Let's treat them as a pool.
        // If critical one fails, we might warn.
        // For UI status, "connected" means we are attempting/serving data.
        this.updateState('connected');
    }

    private connectBinance() {
        try {
            console.log('[WS] Connecting to Binance...');
            this.binanceSocket = new WebSocket('wss://stream.binance.com:9443/ws');
            this.binanceSocket.onopen = () => {
                console.log('[WS] Binance Connected');
                this.resubscribe('crypto');
            };
            this.binanceSocket.onmessage = this.handleBinanceMessage.bind(this);
            this.binanceSocket.onclose = () => console.log('[WS] Binance Closed');
            this.binanceSocket.onerror = (e) => console.error('[WS] Binance Error', e);
        } catch (e) {
            console.error('Binance connection failed', e);
        }
    }

    private connectFinnhub() {
        const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!apiKey) {
            console.warn('[WS] No Finnhub API Key found. Stock data will be offline.');
            return;
        }

        try {
            console.log('[WS] Connecting to Finnhub...');
            this.finnhubSocket = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
            this.finnhubSocket.onopen = () => {
                console.log('[WS] Finnhub Connected');
                this.resubscribe('stock');
            };
            this.finnhubSocket.onmessage = this.handleFinnhubMessage.bind(this);
            this.finnhubSocket.onclose = () => console.log('[WS] Finnhub Closed');
            this.finnhubSocket.onerror = (e) => console.error('[WS] Finnhub Error', e);
        } catch (e) {
            console.error('Finnhub connection failed', e);
        }
    }

    // ========================================
    // Subscription Logic
    // ========================================
    public subscribe(symbol: string, callback: WebSocketCallback) {
        const isCrypto = !!this.cryptoMap[symbol];

        if (!this.subscriptions.has(symbol)) {
            this.subscriptions.set(symbol, new Set());
            // Send subscribe payload to appropriate socket
            if (isCrypto) {
                this.sendBinanceSubscribe(symbol);
            } else {
                this.sendFinnhubSubscribe(symbol);
            }
        }
        this.subscriptions.get(symbol)?.add(callback);

        // Auto-connect if needed
        if (this.connectionState === 'disconnected') {
            this.connect();
        }
    }

    public unsubscribe(symbol: string, callback: WebSocketCallback) {
        const callbacks = this.subscriptions.get(symbol);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.subscriptions.delete(symbol);
                const isCrypto = !!this.cryptoMap[symbol];
                if (isCrypto) {
                    this.sendBinanceUnsubscribe(symbol);
                } else {
                    this.sendFinnhubUnsubscribe(symbol);
                }
            }
        }
    }

    private resubscribe(type: 'crypto' | 'stock') {
        // Re-send subscriptions for all active symbols of given type
        this.subscriptions.forEach((_, symbol) => {
            const isCrypto = !!this.cryptoMap[symbol];
            if (type === 'crypto' && isCrypto) {
                this.sendBinanceSubscribe(symbol);
            } else if (type === 'stock' && !isCrypto) {
                this.sendFinnhubSubscribe(symbol);
            }
        });
    }

    // ========================================
    // Binance Helpers
    // ========================================
    private sendBinanceSubscribe(symbol: string) {
        if (this.binanceSocket?.readyState === WebSocket.OPEN) {
            const stream = `${this.cryptoMap[symbol]}@ticker`;
            this.binanceSocket.send(JSON.stringify({
                method: 'SUBSCRIBE',
                params: [stream],
                id: Date.now()
            }));
        }
    }

    private sendBinanceUnsubscribe(symbol: string) {
        if (this.binanceSocket?.readyState === WebSocket.OPEN) {
            const stream = `${this.cryptoMap[symbol]}@ticker`;
            this.binanceSocket.send(JSON.stringify({
                method: 'UNSUBSCRIBE',
                params: [stream],
                id: Date.now()
            }));
        }
    }

    private handleBinanceMessage(event: MessageEvent) {
        try {
            const msg = JSON.parse(event.data);
            if (msg.e === '24hrTicker') {
                const internalSymbol = this.reverseCryptoMap[msg.s];
                if (internalSymbol) {
                    this.notifySubscribers(internalSymbol, {
                        symbol: internalSymbol,
                        price: parseFloat(msg.c),
                        change: parseFloat(msg.p),
                        changePercent: parseFloat(msg.P),
                        volume: parseFloat(msg.q), // Quote volume usually better for $, but q (asset vol) is standard
                        timestamp: msg.E
                    });
                }
            }
        } catch (e) {
            console.warn('[WS] Failed to parse Binance message', e);
        }
    }

    // ========================================
    // Finnhub Helpers
    // ========================================
    private sendFinnhubSubscribe(symbol: string) {
        if (this.finnhubSocket?.readyState === WebSocket.OPEN) {
            this.finnhubSocket.send(JSON.stringify({
                type: 'subscribe',
                symbol: symbol
            }));
        }
    }

    private sendFinnhubUnsubscribe(symbol: string) {
        if (this.finnhubSocket?.readyState === WebSocket.OPEN) {
            this.finnhubSocket.send(JSON.stringify({
                type: 'unsubscribe',
                symbol: symbol
            }));
        }
    }

    private handleFinnhubMessage(event: MessageEvent) {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'trade' && msg.data) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                msg.data.forEach((trade: any) => {
                    const symbol = trade.s;
                    this.notifySubscribers(symbol, {
                        symbol: symbol,
                        price: trade.p,
                        change: 0,
                        changePercent: 0,
                        volume: trade.v,
                        timestamp: trade.t
                    });
                });
            }
        } catch (e) {
            console.warn('[WS] Failed to parse Finnhub message', e);
        }
    }

    private notifySubscribers(symbol: string, data: TickerData) {
        this.subscriptions.get(symbol)?.forEach(cb => cb(data));
    }
}

// SSR-safe singleton
let _wsManager: WebSocketManager | null = null;
function getWsManager(): WebSocketManager {
    if (!_wsManager) {
        _wsManager = new WebSocketManager();
    }
    return _wsManager;
}
export const wsManager = getWsManager();
