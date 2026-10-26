import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { ChevronDown, Download, Search } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLUMNS = [
  { key: 'itemName', label: 'Item Name EN' },
  { key: 'itemsViewed', label: 'Items Viewed' },
  { key: 'itemsAddedToCart', label: 'Items Added to Cart' },
  { key: 'itemsCheckedOut', label: 'Items Checked Out' },
  { key: 'itemPurchaseQuantity', label: 'Item Purchase Quantity' },
];

const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
const COLORS = ['#c88214', '#eef7f5', '#6fa89f', '#00937b', '#EF4444', '#10B981', '#065c5d'];

export const GaItemFunnelTable = ({ rawData, formatShort = value => d3.format('~s')(value) }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('itemsViewed');
  const [sortDir, setSortDir] = useState('desc');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItems, setSelectedItems] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('single');
  const [modalItems, setModalItems] = useState([]);
  const [trendTimeframe, setTrendTimeframe] = useState('Monthly');
  const [trendMetric, setTrendMetric] = useState('itemsViewed');

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

  const chartData = useMemo(() => {
    if (!modalOpen) return [];

    const relevantRows = rawData.filter(row => modalItems.includes(row.itemName) && row.dateObj);
    const timeKey = trendTimeframe === 'Daily'
      ? row => d3.timeFormat('%b %d')(row.dateObj)
      : row => d3.timeFormat('%b %Y')(row.dateObj);

    return d3.groups(relevantRows, timeKey)
      .sort((a, b) => d3.min(a[1], row => row.dateObj) - d3.min(b[1], row => row.dateObj))
      .map(([time, rows]) => {
        const point = { time };
        modalItems.forEach(item => {
          point[item] = d3.sum(
            rows.filter(row => row.itemName === item),
            row => row[trendMetric]
          );
        });
        return point;
      });
  }, [modalOpen, modalItems, rawData, trendMetric, trendTimeframe]);

  const handleSort = key => {
    setCurrentPage(1);
    if (sortKey === key) {
      setSortDir(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir(key === 'itemName' ? 'asc' : 'desc');
  };

  const toggleSelect = item => {
    setSelectedItems(current => current.includes(item)
      ? current.filter(selected => selected !== item)
      : [...current, item]);
  };

  const toggleAll = () => {
    setSelectedItems(selectedItems.length === sortedData.length
      ? []
      : sortedData.map(row => row.itemName));
  };

  const openSingle = item => {
    setModalItems([item]);
    setModalMode('single');
    setModalOpen(true);
  };

  const openCompare = () => {
    if (selectedItems.length === 0) return;
    setModalItems(selectedItems);
    setModalMode('compare');
    setModalOpen(true);
  };

  const handleDownloadCSV = () => {
    const dataToDownload = selectedItems.length > 0
      ? sortedData.filter(row => selectedItems.includes(row.itemName))
      : sortedData;
    if (dataToDownload.length === 0) return;

    const csvRows = [
      COLUMNS.map(column => escapeCsv(column.label)).join(','),
      ...dataToDownload.map(row => COLUMNS.map(column => escapeCsv(row[column.key])).join(',')),
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
        <h3 className="text-xl font-black text-[#eef7f5]">Ticket Sales by Match</h3>
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
                setSelectedItems([]);
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
            {selectedItems.length > 0 ? `CSV (${selectedItems.length})` : 'CSV'}
          </button>
          <button
            onClick={openCompare}
            disabled={selectedItems.length === 0}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${selectedItems.length > 0 ? 'gradient-gold text-[#043e3f] hover:bg-[#c88214]/80' : 'bg-[#011414] text-[#6fa89f] opacity-50 cursor-not-allowed'}`}
          >
            Compare Selected ({selectedItems.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#c88214]/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#011414] border-b border-[#c88214]/20 select-none">
              <th className="px-3 py-3 w-12 text-center">
                <input
                  type="checkbox"
                  checked={selectedItems.length === sortedData.length && sortedData.length > 0}
                  onChange={toggleAll}
                  className="accent-[#c88214] cursor-pointer"
                />
              </th>
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
              <tr key={row.itemName} onClick={() => openSingle(row.itemName)} className="border-b border-[#c88214]/10 hover:bg-[#c88214]/10 transition-colors cursor-pointer group">
                <td className="px-3 py-3 w-12 text-center" onClick={event => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(row.itemName)}
                    onChange={() => toggleSelect(row.itemName)}
                    className="accent-[#c88214] cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 text-sm font-bold text-white">{row.itemName}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsViewed)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsAddedToCart)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemsCheckedOut)}</td>
                <td className="px-4 py-3 text-sm font-medium text-[#eef7f5]">{d3.format(',')(row.itemPurchaseQuantity)}</td>
              </tr>
            ))}
            {sortedData.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-6 py-8 text-center text-[#6fa89f] text-sm">
                  No item funnel data available
                </td>
              </tr>
            )}
            {sortedData.length > 0 && (
              <tr className="bg-[#011414]/80 border-t-2 border-[#c88214]/50">
                <td className="px-3 py-3 w-12"></td>
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
              setSelectedItems([]);
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

      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="card-surface w-full max-w-5xl rounded-3xl border border-[#c88214]/30 shadow-2xl overflow-hidden flex flex-col" onClick={event => event.stopPropagation()}>
            <div className="p-6 border-b border-[#c88214]/20 flex justify-between items-start bg-[#011414]">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">
                  {modalMode === 'single' ? modalItems[0] : 'Match Comparison'}
                </h2>
                {modalMode === 'compare' && (
                  <div className="flex flex-wrap gap-2">
                    {modalItems.map((item, index) => (
                      <span
                        key={item}
                        className="text-xs font-bold px-2 py-1 rounded-md"
                        style={{ backgroundColor: `${COLORS[index % COLORS.length]}20`, color: COLORS[index % COLORS.length] }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[#6fa89f] hover:text-white" aria-label="Close trend popup">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 flex-1 flex flex-col gap-6">
              <div className="flex gap-4 flex-wrap">
                <div className="flex bg-[#011414] rounded-full p-1 border border-[#c88214]/20">
                  {['Daily', 'Monthly'].map(timeframe => (
                    <button
                      key={timeframe}
                      onClick={() => setTrendTimeframe(timeframe)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${trendTimeframe === timeframe ? 'gradient-gold text-[#043e3f]' : 'text-[#c88214] hover:text-white'}`}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
                <div className="flex bg-[#011414] rounded-full p-1 border border-[#c88214]/20">
                  {COLUMNS.slice(1).map(metric => (
                    <button
                      key={metric.key}
                      onClick={() => setTrendMetric(metric.key)}
                      className={`px-3 py-1 text-[10px] font-bold rounded-full transition-colors ${trendMetric === metric.key ? 'bg-[#c88214] text-[#043e3f]' : 'text-[#6fa89f] hover:text-[#c88214]'}`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {modalMode === 'single' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMatchSingle" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00937b" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00937b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00937b" opacity={0.1} vertical={false} />
                      <XAxis dataKey="time" stroke="#6fa89f" tick={{ fill: '#6fa89f', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6fa89f" tick={{ fill: '#6fa89f', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{ backgroundColor: '#043e3f', border: '1px solid rgba(200, 130, 20, 0.2)', borderRadius: '12px', color: '#eef7f5' }} />
                      <Area type="monotone" dataKey={modalItems[0]} stroke="#00937b" strokeWidth={3} fillOpacity={1} fill="url(#colorMatchSingle)" />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00937b" opacity={0.1} vertical={false} />
                      <XAxis dataKey="time" stroke="#6fa89f" tick={{ fill: '#6fa89f', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6fa89f" tick={{ fill: '#6fa89f', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{ backgroundColor: '#043e3f', border: '1px solid rgba(200, 130, 20, 0.2)', borderRadius: '12px', color: '#eef7f5' }} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      {modalItems.map((item, index) => (
                        <Line key={item} type="monotone" dataKey={item} stroke={COLORS[index % COLORS.length]} strokeWidth={3} dot={{ r: 3, fill: COLORS[index % COLORS.length], strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
