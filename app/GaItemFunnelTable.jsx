import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { ChevronDown, Download, Search } from 'lucide-react';

const COLUMNS = [
  { key: 'itemName', label: 'Item Name EN' },
  { key: 'itemsViewed', label: 'Items Viewed' },
  { key: 'itemsAddedToCart', label: 'Items Added to Cart' },
  { key: 'itemsCheckedOut', label: 'Items Checked Out' },
  { key: 'itemPurchaseQuantity', label: 'Item Purchase Quantity' },
];

const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;

export const GaItemFunnelTable = ({ rawData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('itemsViewed');
  const [sortDir, setSortDir] = useState('desc');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const aggregatedData = useMemo(() => (
    Array.from(d3.rollup(
      rawData,
      rows => ({
        itemsViewed: d3.sum(rows, row => row.itemsViewed),
        itemsAddedToCart: d3.sum(rows, row => row.itemsAddedToCart),
        itemsCheckedOut: d3.sum(rows, row => row.itemsCheckedOut),
        itemPurchaseQuantity: d3.sum(rows, row => row.itemPurchaseQuantity),
      }),
      row => row.itemName || 'Unknown'
    )).map(([itemName, metrics]) => ({ itemName, ...metrics }))
  ), [rawData]);

  const sortedData = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return aggregatedData
      .filter(row => row.itemName.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => {
        const comparison = typeof a[sortKey] === 'string'
          ? a[sortKey].localeCompare(b[sortKey])
          : a[sortKey] - b[sortKey];
        return sortDir === 'asc' ? comparison : -comparison;
      });
  }, [aggregatedData, searchTerm, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const displayedPage = Math.min(currentPage, totalPages || 1);
  const paginatedData = sortedData.slice(
    (displayedPage - 1) * rowsPerPage,
    displayedPage * rowsPerPage
  );

  const totals = useMemo(() => ({
    itemsViewed: d3.sum(sortedData, row => row.itemsViewed),
    itemsAddedToCart: d3.sum(sortedData, row => row.itemsAddedToCart),
    itemsCheckedOut: d3.sum(sortedData, row => row.itemsCheckedOut),
    itemPurchaseQuantity: d3.sum(sortedData, row => row.itemPurchaseQuantity),
  }), [sortedData]);

  const handleSort = key => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortDir(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir(key === 'itemName' ? 'asc' : 'desc');
  };

  const handleDownloadCSV = () => {
    if (sortedData.length === 0) return;

    const csvRows = [
      COLUMNS.map(column => escapeCsv(column.label)).join(','),
      ...sortedData.map(row => COLUMNS.map(column => escapeCsv(row[column.key])).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ga4_item_funnel.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card-surface backdrop-blur-2xl p-6 rounded-3xl border border-[#c88214]/20 shadow-xl relative">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h3 className="text-xl font-black text-[#eef7f5]">Item Funnel</h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c88214]" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={event => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#011414] text-[#eef7f5] text-sm pl-9 pr-4 py-2 rounded-full outline-none border border-[#c88214]/30 focus:border-[#c88214]"
            />
          </div>
          <button
            onClick={handleDownloadCSV}
            disabled={sortedData.length === 0}
            className="px-4 py-2 rounded-full text-sm font-bold bg-[#011414] text-[#c88214] border border-[#c88214]/30 hover:bg-[#c88214] hover:text-[#043e3f] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#c88214]/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#011414] border-b border-[#c88214]/20 select-none">
              {COLUMNS.map(column => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className="px-4 py-3 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-[#c88214] transition-colors"
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {sortKey === column.key && (
                      <ChevronDown size={12} className={sortDir === 'asc' ? 'rotate-180' : ''} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(row => (
              <tr key={row.itemName} className="border-b border-[#c88214]/10 hover:bg-[#c88214]/10 transition-colors">
                <td className="px-4 py-3 text-sm font-bold text-white">{row.itemName}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsViewed)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsAddedToCart)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsCheckedOut)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemPurchaseQuantity)}</td>
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-8 text-center text-[#6fa89f] text-sm">
                  No item funnel data available
                </td>
              </tr>
            )}
            {sortedData.length > 0 && (
              <tr className="bg-[#011414]/80 border-t-2 border-[#c88214]/50">
                <td className="px-4 py-3 text-sm font-black text-[#c88214]">Total</td>
                <td className="px-4 py-3 text-sm font-black text-white">{d3.format(',')(totals.itemsViewed)}</td>
                <td className="px-4 py-3 text-sm font-black text-white">{d3.format(',')(totals.itemsAddedToCart)}</td>
                <td className="px-4 py-3 text-sm font-black text-white">{d3.format(',')(totals.itemsCheckedOut)}</td>
                <td className="px-4 py-3 text-sm font-black text-white">{d3.format(',')(totals.itemPurchaseQuantity)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#6fa89f] uppercase tracking-widest">Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={event => {
              setRowsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="bg-[#011414] text-[#c88214] text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border border-[#c88214]/30 outline-none cursor-pointer hover:border-[#c88214] transition-colors"
          >
            {[10, 20, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#6fa89f] uppercase tracking-widest">
            Page {displayedPage} of {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, displayedPage - 1))}
              disabled={displayedPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-[#c88214]/10 border border-[#c88214]/30 text-[#c88214] hover:bg-[#c88214]/20 hover:text-white transition-all disabled:bg-[#011414] disabled:border-gray-700/50 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, displayedPage + 1))}
              disabled={displayedPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-[#c88214]/10 border border-[#c88214]/30 text-[#c88214] hover:bg-[#c88214]/20 hover:text-white transition-all disabled:bg-[#011414] disabled:border-gray-700/50 disabled:text-gray-600 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
