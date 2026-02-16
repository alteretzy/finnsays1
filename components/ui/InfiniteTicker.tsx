'use client';

import { motion } from 'framer-motion';

const items = [
    'Bitcoin', 'Ethereum', 'BNB', 'Solana', 'Cardano',
    'Avalanche', 'Polygon', 'Chainlink', 'Uniswap', 'Aave',
    'Binance', 'Coinbase', 'dYdX', 'Arbitrum', 'Optimism',
];

export default function InfiniteTicker() {
    // Duplicate items so the loop is seamless
    const doubled = [...items, ...items];

    return (
        <div className="group/ticker relative w-full overflow-hidden border-y border-white/5 py-5">
            {/* Left fade */}
            <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
            {/* Right fade */}
            <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

            <motion.div
                className="flex gap-12 whitespace-nowrap group-hover/ticker:[animation-play-state:paused]"
                animate={{ x: ['0%', '-50%'] }}
                transition={{
                    x: {
                        repeat: Infinity,
                        repeatType: 'loop',
                        duration: 30,
                        ease: 'linear',
                    },
                }}
            >
                {doubled.map((name, i) => (
                    <span
                        key={`${name}-${i}`}
                        className="text-sm font-light text-white/25 uppercase tracking-widest flex items-center gap-3 select-none cursor-default transition-all duration-300 hover:text-white hover:[text-shadow:0_0_12px_rgba(255,255,255,0.5)] group/item"
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0055FF]/40 transition-all duration-300 group-hover/item:bg-[#0055FF] group-hover/item:shadow-[0_0_8px_rgba(0,85,255,0.6)]" />
                        {name}
                    </span>
                ))}
            </motion.div>
        </div>
    );
}
