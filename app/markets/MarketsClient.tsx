'use client';

import Link from 'next/link';
import FadeIn from '@/components/animations/FadeIn';
import SearchBar from '@/components/data/SearchBar';
import FilterChips from '@/components/data/FilterChips';
import DataTable from '@/components/data/DataTable';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import Sparkline from '@/components/charts/Sparkline';
import MarketIndices from '@/components/data/MarketIndices';
import SectorHeatmap from '@/components/data/SectorHeatmap';
import LivePrice from '@/components/data/LivePrice';
import LiveChange from '@/components/data/LiveChange';
import { useMarketData } from '@/hooks/useMarketData';
import { formatMarketCap, formatVolume } from '@/lib/utils/formatters';
import { ASSET_TYPES } from '@/lib/utils/constants';
import { MarketAsset } from '@/lib/finnhub/types';

interface MarketsClientProps {
    initialData: MarketAsset[];
}

const columns = [
    {
        key: 'symbol',
        label: 'Asset',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (_: string, row: MarketAsset) => (
            <Link href={`/asset/${row.symbol}`} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-xs font-light text-white/50">
                    {row.symbol.charAt(0)}
                </div>
                <div>
                    <p className="text-sm font-light text-white/80 group-hover:text-white transition-colors">
                        {row.symbol}
                    </p>
                    <p className="text-xs text-white/30 font-light">{row.name}</p>
                </div>
            </Link>
        ),
    },
    {
        key: 'type',
        label: 'Type',
        render: (value: string) => (
            <Badge>
                {value.charAt(0).toUpperCase() + value.slice(1)}
            </Badge>
        ),
    },
    {
        key: 'price',
        label: 'Price',
        align: 'right' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (value: number, row: MarketAsset) => (
            <LivePrice symbol={row.symbol} initialPrice={value} />
        ),
    },
    {
        key: 'changePercent',
        label: '24h Change',
        align: 'right' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (value: number, row: MarketAsset) => (
            <LiveChange
                symbol={row.symbol}
                initialChange={value}
            />
        ),
    },
    {
        key: 'volume',
        label: 'Volume',
        align: 'right' as const,
        render: (value: number) => (
            <span className="text-white/40 tabular-nums font-light">{formatVolume(value)}</span>
        ),
    },
    {
        key: 'marketCap',
        label: 'Market Cap',
        align: 'right' as const,
        render: (value: number) => (
            <span className="text-white/40 tabular-nums font-light">{formatMarketCap(value)}</span>
        ),
    },
    {
        key: 'sparklineData',
        label: '7D',
        align: 'right' as const,
        width: '120px',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render: (value: number[], row: MarketAsset) => (
            <div className="w-[100px] ml-auto">
                <Sparkline data={value} height={28} color={row.changePercent >= 0 ? '#10B981' : '#EF4444'} />
            </div>
        ),
    },
];

import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function MarketsClient({ initialData }: MarketsClientProps) {
    const {
        search,
        setSearch,
        selectedTypes,
        setSelectedTypes,
        sortKey,
        sortDirection,
        handleSort,
        currentPage,
        setCurrentPage,
        totalPages,
        paginatedData,
        totalResults,
    } = useMarketData({ data: initialData, pageSize: 10 });

    return (
        <ErrorBoundary>
            <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-24 md:py-28">
                {/* Page Header */}
                <FadeIn>
                    <div className="mb-8">
                        <p className="text-[10px] tracking-[0.3em] uppercase text-white/25 mb-3 font-light">
                            Market Intelligence
                        </p>
                        <h1 className="text-3xl md:text-5xl font-extralight tracking-tight mb-4">
                            All Markets
                        </h1>
                        <p className="text-sm text-white/30 font-light max-w-xl leading-relaxed">
                            Real-time prices, trends, and analytics across
                            stocks, cryptocurrencies, precious metals & commodities.
                        </p>
                    </div>
                </FadeIn>

                {/* Indices */}
                <FadeIn delay={0.05}>
                    <MarketIndices />
                </FadeIn>

                {/* Sector Heatmap */}
                <FadeIn delay={0.1}>
                    {(!selectedTypes.length || selectedTypes.includes('stock')) && (
                        <SectorHeatmap assets={initialData} />
                    )}
                </FadeIn>

                {/* Search + Filters */}
                <FadeIn delay={0.15}>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
                        <SearchBar value={search} onChange={setSearch} />
                        <FilterChips
                            options={[...ASSET_TYPES]}
                            selected={selectedTypes}
                            onChange={setSelectedTypes}
                            multiSelect={false}
                        />
                    </div>
                </FadeIn>

                {/* Results count */}
                <FadeIn delay={0.2}>
                    <p className="text-[11px] text-white/20 mb-4 font-light">
                        {totalResults} asset{totalResults !== 1 ? 's' : ''} found
                    </p>
                </FadeIn>

                {/* Table */}
                <FadeIn delay={0.15}>
                    <DataTable
                        data={paginatedData}
                        columns={columns}
                        onSort={handleSort}
                        sortKey={sortKey}
                        sortDirection={sortDirection}
                        onRowClick={(row) => {
                            window.location.href = `/asset/${row.symbol}`;
                        }}
                    />
                </FadeIn>

                {/* Pagination */}
                {totalPages > 1 && (
                    <FadeIn delay={0.2}>
                        <div className="mt-8">
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    </FadeIn>
                )}
            </main>
        </ErrorBoundary>
    );
}
