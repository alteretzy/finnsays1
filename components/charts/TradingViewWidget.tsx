'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewWidgetProps {
    symbol: string;
    assetType?: 'stock' | 'crypto' | 'commodity' | 'metal';
    height?: number;
}

function getTradingViewSymbol(symbol: string, assetType?: string): string {
    // Map our symbols to TradingView-compatible symbols
    const cryptoMap: Record<string, string> = {
        BTC: 'BINANCE:BTCUSDT',
        ETH: 'BINANCE:ETHUSDT',
        BNB: 'BINANCE:BNBUSDT',
        SOL: 'BINANCE:SOLUSDT',
        ADA: 'BINANCE:ADAUSDT',
        XRP: 'BINANCE:XRPUSDT',
        DOGE: 'BINANCE:DOGEUSDT',
        DOT: 'BINANCE:DOTUSDT',
        AVAX: 'BINANCE:AVAXUSDT',
        MATIC: 'BINANCE:MATICUSDT',
        LINK: 'BINANCE:LINKUSDT',
        UNI: 'BINANCE:UNIUSDT',
        ATOM: 'BINANCE:ATOMUSDT',
        LTC: 'BINANCE:LTCUSDT',
        FIL: 'BINANCE:FILUSDT',
        NEAR: 'BINANCE:NEARUSDT',
        APT: 'BINANCE:APTUSDT',
        ARB: 'BINANCE:ARBUSDT',
        OP: 'BINANCE:OPUSDT',
        SHIB: 'BINANCE:SHIBUSDT',
    };

    const commodityMap: Record<string, string> = {
        'GC=F': 'COMEX:GC1!',
        'SI=F': 'COMEX:SI1!',
        'PL=F': 'NYMEX:PL1!',
        'PA=F': 'NYMEX:PA1!',
        'HG=F': 'COMEX:HG1!',
        'CL=F': 'NYMEX:CL1!',
        'NG=F': 'NYMEX:NG1!',
        'ZW=F': 'CBOT:ZW1!',
        'ZC=F': 'CBOT:ZC1!',
        'ZS=F': 'CBOT:ZS1!',
        'KC=F': 'ICEUS:KC1!',
        'CC=F': 'ICEUS:CC1!',
        'CT=F': 'ICEUS:CT1!',
        'SB=F': 'ICEUS:SB1!',
    };

    if (assetType === 'crypto' && cryptoMap[symbol]) {
        return cryptoMap[symbol];
    }

    if ((assetType === 'commodity' || assetType === 'metal') && commodityMap[symbol]) {
        return commodityMap[symbol];
    }

    // Default: use NASDAQ or NYSE prefix for stocks
    if (assetType === 'stock') {
        return `NASDAQ:${symbol}`;
    }

    return symbol;
}

function TradingViewWidget({ symbol, assetType, height = 500 }: TradingViewWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        // Clear previous widget
        container.innerHTML = '';

        const tvSymbol = getTradingViewSymbol(symbol, assetType);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol: tvSymbol,
            interval: 'D',
            timezone: 'Asia/Kolkata',
            theme: 'dark',
            style: '1',
            locale: 'en',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            gridColor: 'rgba(255, 255, 255, 0.03)',
            hide_top_toolbar: false,
            hide_legend: false,
            allow_symbol_change: true,
            save_image: false,
            calendar: false,
            hide_volume: false,
            support_host: 'https://www.tradingview.com',
            withdateranges: true,
            details: true,
            hotlist: false,
            show_popup_button: false,
        });

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = '100%';
        widgetDiv.style.width = '100%';

        container.appendChild(widgetDiv);
        container.appendChild(script);

        return () => {
            container.innerHTML = '';
        };
    }, [symbol, assetType]);

    return (
        <div className="tradingview-widget-container rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.01]" style={{ height }}>
            <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
        </div>
    );
}

export default memo(TradingViewWidget);
