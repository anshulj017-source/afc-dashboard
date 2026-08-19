import React, { useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BarChart3, Zap, Grid, List, Check, Search, ChevronDown, MonitorPlay } from 'lucide-react';

const formatC = (val, dec=2) => val != null ? `$${d3.format(`,.${dec}f`)(val)}` : '$0.00';

const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="relative min-w-[120px] z-30">
      <span className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest mb-1.5 block">{label}</span>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1.5 bg-[#113A42] border border-[#74FA93]/30 rounded-lg text-xs font-bold text-[#F1EAD8] cursor-pointer flex justify-between items-center hover:border-[#74FA93] transition-colors"
      >
        <span className="truncate pr-2">{selected.includes('All') ? 'All Selected' : selected.join(', ')}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-[#113A42] border border-[#74FA93]/30 rounded-xl shadow-2xl z-50 flex flex-col max-h-64 overflow-hidden">
          <div className="p-2 border-b border-[#74FA93]/10 relative">
            <Search className="w-4 h-4 text-[#CBBB9D] absolute left-4 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search..." autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#0C272D] text-[#F1EAD8] text-xs font-bold pl-9 pr-3 py-2 rounded-lg outline-none border border-transparent focus:border-[#74FA93]/50" />
          </div>
          <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
            <div onClick={() => { onChange(['All']); setIsOpen(false); setSearchTerm(''); }} className={`px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex justify-between ${selected.includes('All') ? 'bg-[#74FA93]/20 text-[#74FA93]' : 'text-[#F1EAD8] hover:bg-[#0C272D]'}`}>
              All <Check className={`w-4 h-4 ${selected.includes('All') ? 'opacity-100' : 'opacity-0'}`} />
            </div>
            {filtered.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <div key={opt} onClick={() => {
                  let next = [...selected];
                  if (next.includes('All')) next = [];
                  if (isSel) {
                    next = next.filter(n => n !== opt);
                    if (next.length === 0) next = ['All'];
                  } else { next.push(opt); }
                  onChange(next);
                }} className={`px-3 py-2 mt-1 rounded-lg text-sm font-bold cursor-pointer flex justify-between ${isSel ? 'bg-[#74FA93]/20 text-[#74FA93]' : 'text-[#F1EAD8] hover:bg-[#0C272D]'}`}>
                  <span className="truncate pr-2">{opt}</span> <Check className={`w-4 h-4 flex-shrink-0 ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Invisible overlay to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
};

export default function CreativeView({ data, exRate, exSym, formatShort }) {
  const CREATIVES_PER_PAGE = 24;
  const [creativePage, setCreativePage] = useState(1);
  const [creativeViewMode, setCreativeViewMode] = useState('grid');
  
  const [filterMarkets, setFilterMarkets] = useState(['All']);
  const [filterLanguages, setFilterLanguages] = useState(['All']);
  const [filterCampaigns, setFilterCampaigns] = useState(['All']);

  const uniqueMarkets = useMemo(() => Array.from(new Set(data.map(x => x.market))).filter(Boolean).sort(), [data]);
  const uniqueLanguages = useMemo(() => Array.from(new Set(data.map(x => x.language))).filter(Boolean).sort(), [data]);
  const uniqueCampaigns = useMemo(() => Array.from(new Set(data.map(x => x.campaignName))).filter(Boolean).sort(), [data]);

  // Aggregate creative performance
  const creativeTabData = useMemo(() => {
    const filtered = data.filter(d => {
      if (!filterMarkets.includes('All') && !filterMarkets.includes(d.market)) return false;
      if (!filterLanguages.includes('All') && !filterLanguages.includes(d.language)) return false;
      if (!filterCampaigns.includes('All') && !filterCampaigns.includes(d.campaignName)) return false;
      return true;
    });

    const grouped = d3.groups(filtered, d => d.adName);
    return grouped.map(([adName, rows]) => {
      const imp = d3.sum(rows, r => r.impressions);
      const clk = d3.sum(rows, r => r.clicks);
      const cst = d3.sum(rows, r => r.cost) * exRate;
      const views = d3.sum(rows, r => r.views);
      const ctr = imp > 0 ? clk / imp : 0;
      const cpc = clk > 0 ? cst / clk : 0;
      const cpv = views > 0 ? cst / views : 0;
      
      return {
        adName,
        creativeName: rows[0].creativeName,
        campaignName: rows[0].campaignName,
        adImageUrl: rows[0].adImageUrl,
        market: rows[0].market,
        language: rows[0].language,
        impressions: imp,
        clicks: clk,
        cost: cst,
        views: views,
        ctr,
        cpc,
        cpv,
      };
    }).sort((a,b) => b.cost - a.cost); // sort by spend
  }, [data, filterMarkets, filterLanguages, filterCampaigns, exRate]);

  const topCTR = [...creativeTabData].filter(x => x.impressions > 500).sort((a,b) => b.ctr - a.ctr).slice(0, 10);
  const topCPC = [...creativeTabData].filter(x => x.clicks > 10).sort((a,b) => a.cpc - b.cpc).slice(0, 10); // Lowest CPC
  const topCost = [...creativeTabData].filter(x => x.cost > 0).sort((a,b) => b.cost - a.cost).slice(0, 10); // Highest Spend

  const bestCPC = topCPC[0];
  const bestCTR = topCTR[0];
  let insightText = "Not enough data to generate insights.";
  if (bestCPC && bestCTR) {
    insightText = `Creative "${bestCPC.creativeName}" is driving the most cost-efficient clicks at ${exSym}${d3.format(",.2f")(bestCPC.cpc)} CPC. Meanwhile, "${bestCTR.creativeName}" is capturing the highest attention with a ${(bestCTR.ctr*100).toFixed(2)}% CTR.`;
  }

  const paginatedData = creativeTabData.slice((creativePage - 1) * CREATIVES_PER_PAGE, creativePage * CREATIVES_PER_PAGE);
  const totalPages = Math.ceil(creativeTabData.length / CREATIVES_PER_PAGE);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-[#F1EAD8] tracking-tight">Creative Performance</h2>
          <p className="text-[#CBBB9D] font-medium italic mt-1">Independent creative asset analysis.</p>
        </div>
      </div>
      
      {/* TOP 10 SUMMARY GRAPHS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         <div className="bg-[#113A42] rounded-2xl border border-[#74FA93]/20 p-6 shadow-xl flex flex-col">
            <h3 className="text-sm font-black text-[#F1EAD8] uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#736BED]"/> Top 10 by CTR</h3>
            <div className="flex-1 space-y-3">
               {topCTR.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1">
                     <div className="flex justify-between text-xs text-[#CBBB9D]">
                        <span className="truncate w-3/4">{i+1}. {c.creativeName}</span>
                        <span className="font-bold text-[#736BED]">{(c.ctr*100).toFixed(2)}%</span>
                     </div>
                     <div className="w-full bg-[#0C272D] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#736BED] h-full rounded-full" style={{width: `${Math.min(100, (c.ctr / (topCTR[0]?.ctr || 1)) * 100)}%`}}></div>
                     </div>
                  </div>
               ))}
               {topCTR.length === 0 && <div className="text-[#CBBB9D] text-xs py-4 text-center">No data available</div>}
            </div>
         </div>
         
         <div className="bg-[#113A42] rounded-2xl border border-[#74FA93]/20 p-6 shadow-xl flex flex-col">
            <h3 className="text-sm font-black text-[#F1EAD8] uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#74FA93]"/> Top 10 by CPC (Lowest)</h3>
            <div className="flex-1 space-y-3">
               {topCPC.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1">
                     <div className="flex justify-between text-xs text-[#CBBB9D]">
                        <span className="truncate w-3/4">{i+1}. {c.creativeName}</span>
                        <span className="font-bold text-[#74FA93]">{exSym}{d3.format(",.2f")(c.cpc)}</span>
                     </div>
                     <div className="w-full bg-[#0C272D] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#74FA93] h-full rounded-full" style={{width: `${Math.min(100, (c.cpc / (topCPC[topCPC.length-1]?.cpc || 1)) * 100)}%`}}></div>
                     </div>
                  </div>
               ))}
               {topCPC.length === 0 && <div className="text-[#CBBB9D] text-xs py-4 text-center">No data available</div>}
            </div>
         </div>
         
         <div className="bg-[#113A42] rounded-2xl border border-[#74FA93]/20 p-6 shadow-xl flex flex-col">
            <h3 className="text-sm font-black text-[#F1EAD8] uppercase tracking-widest mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-rose-400"/> Top 10 by Spend</h3>
            <div className="flex-1 space-y-3">
               {topCost.map((c, i) => (
                  <div key={i} className="flex flex-col gap-1">
                     <div className="flex justify-between text-xs text-[#CBBB9D]">
                        <span className="truncate w-3/4">{i+1}. {c.creativeName}</span>
                        <span className="font-bold text-rose-400">{exSym}{formatShort(c.cost)}</span>
                     </div>
                     <div className="w-full bg-[#0C272D] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{width: `${Math.min(100, (c.cost / (topCost[0]?.cost || 1)) * 100)}%`}}></div>
                     </div>
                  </div>
               ))}
               {topCost.length === 0 && <div className="text-[#CBBB9D] text-xs py-4 text-center">No data available</div>}
            </div>
         </div>
      </div>

      <div className="bg-[#113A42] p-6 rounded-2xl border border-[#74FA93]/20 break-inside-avoid mb-8 shadow-lg">
         <h4 className="text-sm font-black text-[#74FA93] uppercase tracking-widest mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-[#74FA93]" /> AI Creative Insights</h4>
         <p className="text-sm text-[#F1EAD8] font-medium">{insightText}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 border-b border-[#74FA93]/20 pb-6">
        <MultiSelectDropdown label="Market" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
        <MultiSelectDropdown label="Language" options={uniqueLanguages} selected={filterLanguages} onChange={setFilterLanguages} />
        <MultiSelectDropdown label="Campaign" options={uniqueCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
      </div>

      <div className="flex flex-wrap justify-between items-end gap-4 mb-6 mt-4">
         <h3 className="text-lg font-black text-[#F1EAD8] tracking-tight">Creative Library ({creativeTabData.length})</h3>
         <div className="flex bg-[#0C272D] rounded-xl border border-[#74FA93]/20 p-1">
           <button onClick={() => setCreativeViewMode('grid')} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${creativeViewMode === 'grid' ? 'bg-[#74FA93] text-[#0C272D] shadow-md' : 'text-[#CBBB9D] hover:text-white'}`}>
             <Grid className="w-4 h-4"/> Grid
           </button>
           <button onClick={() => setCreativeViewMode('list')} className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${creativeViewMode === 'list' ? 'bg-[#74FA93] text-[#0C272D] shadow-md' : 'text-[#CBBB9D] hover:text-white'}`}>
             <List className="w-4 h-4"/> List
           </button>
         </div>
      </div>

      {creativeViewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedData.map((c, i) => (
            <div key={i} className="bg-[#113A42] rounded-3xl border border-[#74FA93]/20 shadow-xl overflow-hidden group flex flex-col hover:-translate-y-1 transition-transform">
               <div onClick={(e) => { 
                  if(c.adImageUrl) window.open(c.adImageUrl, '_blank');
               }} className={`h-48 bg-[#0C272D] relative overflow-hidden flex items-center justify-center group-hover:bg-[#1A4D57] transition-colors block ${c.adImageUrl ? 'cursor-pointer' : 'cursor-default'}`}>
                  {c.adImageUrl ? (
                     <img src={c.adImageUrl} alt={c.creativeName} className="object-cover w-full h-full" onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/400x300/0C272D/74FA93?text=Preview+Unavailable'; }} />
                  ) : (
                     <img src={`https://placehold.co/400x300/0C272D/74FA93?text=No+Preview`} alt="No Preview" className="object-cover w-full h-full opacity-50 grayscale" />
                  )}
               </div>
               <div className="p-6 flex-1 flex flex-col">
                  <h4 className="text-sm font-black text-[#F1EAD8] break-words whitespace-normal mb-4 leading-tight truncate" title={c.creativeName}>
                     {c.creativeName}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 mb-4 flex-1">
                     <div className="bg-[#0C272D] rounded-xl p-3 border border-[#74FA93]/10">
                       <p className="text-[10px] font-black uppercase text-[#CBBB9D] tracking-widest mb-1">Spend</p>
                       <p className="text-sm font-bold text-rose-400">{exSym}{formatShort(c.cost)}</p>
                     </div>
                     <div className="bg-[#0C272D] rounded-xl p-3 border border-[#74FA93]/10">
                       <p className="text-[10px] font-black uppercase text-[#CBBB9D] tracking-widest mb-1">CTR</p>
                       <p className="text-sm font-bold text-[#736BED]">{(c.ctr*100).toFixed(2)}%</p>
                     </div>
                     <div className="bg-[#0C272D] rounded-xl p-3 border border-[#74FA93]/10">
                       <p className="text-[10px] font-black uppercase text-[#CBBB9D] tracking-widest mb-1">CPC</p>
                       <p className="text-sm font-bold text-[#74FA93]">{exSym}{d3.format(",.2f")(c.cpc)}</p>
                     </div>
                     <div className="bg-[#0C272D] rounded-xl p-3 border border-[#74FA93]/10">
                       <p className="text-[10px] font-black uppercase text-[#CBBB9D] tracking-widest mb-1">Views</p>
                       <p className="text-sm font-bold text-amber-400">{formatShort(c.views)}</p>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#113A42] rounded-3xl border border-[#74FA93]/20 overflow-x-auto shadow-xl">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-[#0C272D] border-b border-[#74FA93]/20">
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">Preview</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">Creative Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">Spend</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">CTR</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">CPC</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest">Views</th>
                 </tr>
              </thead>
              <tbody>
                 {paginatedData.map((c, i) => (
                    <tr key={i} className="border-b border-[#74FA93]/10 hover:bg-[#74FA93]/5 transition-colors">
                       <td className="px-6 py-3">
                          <div className="w-16 h-10 bg-[#0C272D] rounded-lg overflow-hidden border border-[#74FA93]/20">
                             {c.adImageUrl && <img src={c.adImageUrl} className="w-full h-full object-cover" />}
                          </div>
                       </td>
                       <td className="px-6 py-4 text-sm font-bold text-[#F1EAD8] whitespace-nowrap max-w-[250px] truncate" title={c.creativeName}>
                          {c.creativeName}
                       </td>
                       <td className="px-6 py-4 text-sm font-bold text-rose-400 whitespace-nowrap">{exSym}{formatShort(c.cost)}</td>
                       <td className="px-6 py-4 text-sm font-bold text-[#736BED] whitespace-nowrap">{(c.ctr*100).toFixed(2)}%</td>
                       <td className="px-6 py-4 text-sm font-bold text-[#74FA93] whitespace-nowrap">{exSym}{d3.format(",.2f")(c.cpc)}</td>
                       <td className="px-6 py-4 text-sm font-bold text-amber-400 whitespace-nowrap">{formatShort(c.views)}</td>
                    </tr>
                 ))}
                 {paginatedData.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-[#CBBB9D] text-sm font-bold">No creatives match the current filters</td></tr>}
              </tbody>
           </table>
        </div>
      )}

      {totalPages > 1 && (
         <div className="flex justify-center items-center gap-4 mt-8">
            <button 
               onClick={() => setCreativePage(p => Math.max(1, p-1))} 
               disabled={creativePage === 1}
               className="px-4 py-2 bg-[#113A42] border border-[#74FA93]/30 rounded-xl text-xs font-black text-[#74FA93] uppercase tracking-widest hover:bg-[#74FA93]/20 disabled:opacity-50 transition-colors"
            >
               Prev
            </button>
            <span className="text-sm font-black text-[#CBBB9D]">
               Page {creativePage} of {totalPages}
            </span>
            <button 
               onClick={() => setCreativePage(p => Math.min(totalPages, p+1))} 
               disabled={creativePage === totalPages}
               className="px-4 py-2 bg-[#113A42] border border-[#74FA93]/30 rounded-xl text-xs font-black text-[#74FA93] uppercase tracking-widest hover:bg-[#74FA93]/20 disabled:opacity-50 transition-colors"
            >
               Next
            </button>
         </div>
      )}
    </div>
  );
}
