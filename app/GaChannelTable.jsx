import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as d3 from 'd3';
import { Search, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

export const GaChannelTable = ({ aggData, rawData, formatShort }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('sessions');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedChannels, setSelectedChannels] = useState([]);
  
  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('single');
  const [modalChannels, setModalChannels] = useState([]);
  const [trendTimeframe, setTrendTimeframe] = useState('Monthly');
  const [trendMetric, setTrendMetric] = useState('sessions');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredAgg = aggData.filter(d => d.sourceMedium.toLowerCase().includes(searchTerm.toLowerCase()));
  const sortedAgg = [...filteredAgg].sort((a, b) => {
    let valA = a[sortKey];
    let valB = b[sortKey];
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortKey, sortDir, rowsPerPage]);

  const totalPages = Math.ceil(sortedAgg.length / rowsPerPage);
  const paginatedAgg = sortedAgg.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleSelect = (channel, e) => {
    e.stopPropagation();
    setSelectedChannels(prev => prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]);
  };

  const toggleAll = () => {
    if (selectedChannels.length === sortedAgg.length) setSelectedChannels([]);
    else setSelectedChannels(sortedAgg.map(d => d.sourceMedium));
  };

  const openSingle = (channel) => {
    setModalChannels([channel]);
    setModalMode('single');
    setModalOpen(true);
  };

  const openCompare = () => {
    if (selectedChannels.length === 0) return;
    setModalChannels(selectedChannels);
    setModalMode('compare');
    setModalOpen(true);
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!modalOpen) return [];
    const relevantRaw = rawData.filter(d => modalChannels.includes(d.sourceMedium) && d.dateObj);
    
    const timeKeyFunc = trendTimeframe === 'Daily' 
      ? d => d3.timeFormat("%b %d")(d.dateObj)
      : d => d3.timeFormat("%b %Y")(d.dateObj);
      
    const grouped = d3.groups(relevantRaw, timeKeyFunc);
    
    const sortedGrouped = grouped.sort((a, b) => {
      const dateA = d3.min(a[1], d => d.dateObj);
      const dateB = d3.min(b[1], d => d.dateObj);
      return dateA - dateB;
    });

    return sortedGrouped.map(([timeLabel, rows]) => {
      const obj = { time: timeLabel };
      modalChannels.forEach(ch => {
        const chRows = rows.filter(r => r.sourceMedium === ch);
        let val = 0;
        if (trendMetric === 'sessions') val = d3.sum(chRows, r => r.sessions);
        if (trendMetric === 'users') val = d3.sum(chRows, r => r.users);
        if (trendMetric === 'engagedSessions') val = d3.sum(chRows, r => r.engagedSessions);
        obj[ch] = val;
      });
      return obj;
    });
  }, [modalOpen, rawData, modalChannels, trendTimeframe, trendMetric]);

  const COLORS = ['#74FA93', '#F1EAD8', '#CBBB9D', '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl relative">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h3 className="text-xl font-black text-[#F1EAD8]">Source / Medium Analysis</h3>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#74FA93]" />
            <input 
              type="text" 
              placeholder="Search channels..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-[#0C272D] text-[#F1EAD8] text-sm pl-9 pr-4 py-2 rounded-full outline-none border border-[#74FA93]/30 focus:border-[#74FA93]"
            />
          </div>
          <button 
            onClick={openCompare}
            disabled={selectedChannels.length === 0}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${selectedChannels.length > 0 ? 'bg-[#74FA93] text-[#0C272D] hover:bg-[#74FA93]/80' : 'bg-[#0C272D] text-[#CBBB9D] opacity-50 cursor-not-allowed'}`}
          >
            Compare Selected ({selectedChannels.length})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#74FA93]/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0C272D] border-b border-[#74FA93]/20 select-none">
              <th className="px-3 py-3 w-12 text-center">
                <input type="checkbox" checked={selectedChannels.length === sortedAgg.length && sortedAgg.length > 0} onChange={toggleAll} className="accent-[#74FA93] cursor-pointer" />
              </th>
              {[
                { key: 'sourceMedium', label: 'Source / Medium' },
                { key: 'sessions', label: 'Sessions' },
                { key: 'users', label: 'Users' },
                { key: 'engagedSessions', label: 'Engaged' },
                { key: 'newUsers', label: 'New Users' },
                { key: 'avgSessionDuration', label: 'Avg Duration' },
              ].map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)} className="px-3 py-3 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-[#74FA93] transition-colors">
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronDown size={12} className="rotate-180" />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedAgg.map((row, i) => (
              <tr key={i} onClick={() => openSingle(row.sourceMedium)} className="border-b border-[#74FA93]/10 hover:bg-[#74FA93]/10 transition-colors cursor-pointer group">
                <td className="px-3 py-3 w-12 text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedChannels.includes(row.sourceMedium)} onChange={(e) => toggleSelect(row.sourceMedium, e)} className="accent-[#74FA93] cursor-pointer" />
                </td>
                <td className="px-3 py-3 text-sm font-bold text-white group-hover:text-[#74FA93] transition-colors">{row.sourceMedium}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#F1EAD8]">{d3.format(",")(row.sessions)}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#F1EAD8]">{d3.format(",")(row.users)}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#F1EAD8]">{d3.format(",")(row.engagedSessions)}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#F1EAD8]">{d3.format(",")(row.newUsers)}</td>
                <td className="px-3 py-3 text-sm font-medium text-[#CBBB9D]">{d3.format(",.1f")(row.avgSessionDuration)}s</td>
              </tr>
            ))}
            {sortedAgg.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-[#CBBB9D] text-sm">No channels found</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#CBBB9D] uppercase tracking-widest">Rows per page:</span>
          <select 
            value={rowsPerPage} 
            onChange={e => setRowsPerPage(Number(e.target.value))}
            className="bg-[#0C272D] text-[#74FA93] text-xs font-black uppercase tracking-widest px-2 py-1.5 rounded-lg border border-[#74FA93]/30 outline-none cursor-pointer hover:border-[#74FA93] transition-colors"
          >
            {[10, 20, 50, 100].map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#CBBB9D] uppercase tracking-widest">
            Page {currentPage} of {totalPages || 1}
          </span>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${currentPage === 1 ? 'bg-[#0C272D] border border-gray-700/50 text-gray-600 cursor-not-allowed' : 'bg-[#74FA93]/10 border border-[#74FA93]/30 text-[#74FA93] hover:bg-[#74FA93]/20 hover:text-white'}`}
            >
              Prev
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${currentPage === totalPages || totalPages === 0 ? 'bg-[#0C272D] border border-gray-700/50 text-gray-600 cursor-not-allowed' : 'bg-[#74FA93]/10 border border-[#74FA93]/30 text-[#74FA93] hover:bg-[#74FA93]/20 hover:text-white'}`}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {mounted && modalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] bg-[#000000]/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div className="bg-[#113A42] w-full max-w-5xl rounded-3xl border border-[#74FA93]/30 shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[#74FA93]/20 flex justify-between items-start bg-[#0C272D]">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">
                  {modalMode === 'single' ? modalChannels[0] : 'Channel Comparison'}
                </h2>
                {modalMode === 'compare' && (
                  <div className="flex flex-wrap gap-2">
                    {modalChannels.map((ch, i) => (
                      <span key={ch} className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>
                        {ch}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setModalOpen(false)} className="text-[#CBBB9D] hover:text-white">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            
            <div className="p-6 flex-1 flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="flex bg-[#0C272D] rounded-full p-1 border border-[#74FA93]/20">
                  {['Daily', 'Monthly'].map(t => (
                    <button key={t} onClick={() => setTrendTimeframe(t)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${trendTimeframe === t ? 'bg-[#74FA93] text-[#0C272D]' : 'text-[#74FA93] hover:text-white'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex bg-[#0C272D] rounded-full p-1 border border-[#74FA93]/20">
                  {[
                    { key: 'sessions', label: 'Sessions' },
                    { key: 'users', label: 'Users' },
                    { key: 'engagedSessions', label: 'Engaged' }
                  ].map(m => (
                    <button key={m.key} onClick={() => setTrendMetric(m.key)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${trendMetric === m.key ? 'bg-[#74FA93] text-[#0C272D]' : 'text-[#74FA93] hover:text-white'}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {modalMode === 'single' ? (
                    <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSingle" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#74FA93" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#74FA93" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#74FA93" opacity={0.1} vertical={false} />
                      <XAxis dataKey="time" stroke="#CBBB9D" tick={{fill: '#CBBB9D', fontSize: 10}} tickLine={false} axisLine={false} />
                      <YAxis stroke="#CBBB9D" tick={{fill: '#CBBB9D', fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{backgroundColor: '#0C272D', border: '1px solid rgba(116, 250, 147, 0.2)', borderRadius: '12px', color: '#F1EAD8'}} />
                      <Area type="monotone" dataKey={modalChannels[0]} stroke="#74FA93" strokeWidth={3} fillOpacity={1} fill="url(#colorSingle)" />
                    </AreaChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#74FA93" opacity={0.1} vertical={false} />
                      <XAxis dataKey="time" stroke="#CBBB9D" tick={{fill: '#CBBB9D', fontSize: 10}} tickLine={false} axisLine={false} />
                      <YAxis stroke="#CBBB9D" tick={{fill: '#CBBB9D', fontSize: 10}} tickLine={false} axisLine={false} tickFormatter={formatShort} />
                      <Tooltip contentStyle={{backgroundColor: '#0C272D', border: '1px solid rgba(116, 250, 147, 0.2)', borderRadius: '12px', color: '#F1EAD8'}} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      {modalChannels.map((ch, i) => (
                        <Line key={ch} type="monotone" dataKey={ch} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0}} activeDot={{r: 6}} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
