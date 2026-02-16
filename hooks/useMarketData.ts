'use client';

import { useState, useMemo, useCallback } from 'react';
import { MarketAsset } from '@/lib/finnhub/types';

interface UseMarketDataOptions {
    data: MarketAsset[];
    pageSize?: number;
}

export function useMarketData({ data, pageSize = 10 }: UseMarketDataOptions) {
    const [search, setSearch] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['All']);
    const [sortKey, setSortKey] = useState<string>('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const handleSort = useCallback(
        (key: string) => {
            if (sortKey === key) {
                setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortKey(key);
                setSortDirection('desc');
            }
            setCurrentPage(1);
        },
        [sortKey]
    );

    const filteredData = useMemo(() => {
        let result = [...data];

        // Search
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (item) =>
                    item.symbol.toLowerCase().includes(q) ||
                    item.name.toLowerCase().includes(q)
            );
        }

        // Type filter
        if (!selectedTypes.includes('All') && selectedTypes.length > 0) {
            const typeMap: Record<string, string> = {
                Stocks: 'stock',
                Crypto: 'crypto',
                Commodities: 'commodity',
                Metals: 'metal',
            };
            const filterTypes = selectedTypes.map((t) => typeMap[t]).filter(Boolean);
            result = result.filter((item) => filterTypes.includes(item.type));
        }

        if (sortKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            result.sort((a: any, b: any) => {
                const aVal = a[sortKey];
                const bVal = b[sortKey];
                if (typeof aVal === 'string') {
                    return sortDirection === 'asc'
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                }
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            });
        }

        return result;
    }, [data, search, selectedTypes, sortKey, sortDirection]);

    const totalPages = Math.ceil(filteredData.length / pageSize);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return {
        search,
        setSearch,
        selectedTypes,
        setSelectedTypes: (types: string[]) => {
            setSelectedTypes(types);
            setCurrentPage(1);
        },
        sortKey,
        sortDirection,
        handleSort,
        currentPage,
        setCurrentPage,
        totalPages,
        filteredData,
        paginatedData,
        totalResults: filteredData.length,
    };
}
