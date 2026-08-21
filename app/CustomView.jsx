'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Filter, Download, Activity, TrendingUp, BarChart3, Target, Calendar, Globe2, AlertCircle, Search, Check, ChevronDown, Zap, TableProperties } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#74FA93', '#6fa89f', '#c88214', '#00937b', '#eef7f5', '#c88214', '#007542'];

// Helper to get ISO Week number
const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return `Week ${weekNo}`;
};

const MetricCard = ({ label, value, color = "text-[#c88214]" }) => {
  return (
    <div className="card-surface backdrop-blur-2xl/80 backdrop-blur-xl p-6 rounded-[1.5rem] border border-[#c88214]/10 shadow-xl transition-all hover:shadow-[0_0_20px_rgba(116,250,147,0.15)] hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#74FA93]/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#c88214]/10 transition-colors duration-500"></div>
      <p className={`text-[10px] font-black ${color} uppercase tracking-widest mb-2 relative z-10`}>{label}</p>
      <h3 className="text-2xl font-black text-white truncate relative z-10" title={value}>{value}</h3>
    </div>
  );
};

const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOptions = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex-1 relative min-w-[180px]">
      <span className="text-[10px] font-black uppercase text-[#6fa89f] mb-1.5 tracking-widest block">{label}</span>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 card-surface backdrop-blur-2xl border border-[#c88214]/20 rounded-xl text-sm font-black text-[#c88214] shadow-sm cursor-pointer flex justify-between items-center transition-colors hover:border-[#c88214]/50"
      >
        <span className="truncate pr-4">{selected.length === 0 ? 'All Selected' : selected.join(', ')}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setIsOpen(false); setSearchTerm(''); }} />
          <div className="absolute top-full left-0 w-full h-0 z-50">
            <div className="w-full mt-2 card-surface backdrop-blur-2xl border border-[#c88214]/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col max-h-80 overflow-hidden">
              <div className="p-3 border-b border-[#c88214]/10 bg-[#011414]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#6fa89f] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    autoFocus 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full card-surface backdrop-blur-2xl text-white text-xs font-bold pl-9 pr-3 py-2.5 rounded-lg outline-none border border-[#c88214]/20 focus:border-[#c88214] transition-colors" 
                  />
                </div>
              </div>
              <div className="overflow-y-auto p-2 flex-1 custom-scrollbar">
                <div 
                  onClick={() => { onChange([]); setIsOpen(false); setSearchTerm(''); }} 
                  className={`px-3 py-2.5 rounded-lg text-sm font-bold cursor-pointer flex justify-between items-center transition-colors ${selected.length === 0 ? 'bg-[#c88214]/20 text-[#c88214]' : 'text-white hover:bg-[#011414]'}`}
                >
                  All <Check className={`w-4 h-4 ${selected.length === 0 ? 'opacity-100' : 'opacity-0'}`} />
                </div>
                {filteredOptions.map(opt => {
                  const isSel = selected.includes(opt);
                  return (
                    <div 
                      key={opt} 
                      onClick={() => {
                        let next = [...selected];
                        if (isSel) {
                          next = next.filter(n => n !== opt);
                        } else { 
                          next.push(opt); 
                        }
                        onChange(next);
                      }} 
                      className={`px-3 py-2.5 mt-1 rounded-lg text-sm font-bold cursor-pointer flex justify-between items-center transition-colors ${isSel ? 'bg-[#c88214]/20 text-[#c88214]' : 'text-white hover:bg-[#011414]'}`}
                    >
                      <span className="truncate pr-4">{opt}</span> 
                      <Check className={`w-4 h-4 flex-shrink-0 ${isSel ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                  )
                })}
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-4 text-center text-xs font-bold text-[#6fa89f] uppercase tracking-widest">No results found</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


export default function CustomView({ adData = [], exRate = 1, exSym = "$", formatShort = (v)=>v, filterCampaigns = [], dateRange = {start:'', end:''}, userRole = 'admin' }) {
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  const kpiRef = useRef(null);
  const chartsRef = useRef(null);
  const tableRef = useRef(null);
  
  // Data enrichment (Add Week)
  const enrichedData = useMemo(() => {
     if(!adData) return [];
     return adData.map(d => ({
        ...d,
        week: d.dateObj ? getWeekNumber(d.dateObj) : 'Unknown'
     })).filter(d => d.week !== 'Unknown');
  }, [adData]);

  // Filters State
  const [fChannels, setFChannels] = useState([]);
  const [fWeeks, setFWeeks] = useState([]);

  // Extract distinct filter options
  const optChannels = useMemo(() => Array.from(new Set(enrichedData.map(d => d.channel).filter(Boolean))).sort(), [enrichedData]);
  const optWeeks = useMemo(() => {
     const wks = Array.from(new Set(enrichedData.map(d => d.week).filter(Boolean)));
     return wks.sort((a,b) => parseInt(a.replace('Week ','')) - parseInt(b.replace('Week ','')));
  }, [enrichedData]);

  // Apply filters
  const filteredData = useMemo(() => {
    return enrichedData.filter(d => {
       const mChan = fChannels.length === 0 || fChannels.includes(d.channel);
       const mWeek = fWeeks.length === 0 || fWeeks.includes(d.week);
       return mChan && mWeek;
    });
  }, [enrichedData, fChannels, fWeeks]);

  // Actual Metrics for Filtered Data
  const actuals = useMemo(() => {
      return {
          spend: d3.sum(filteredData, d => d.cost) * exRate,
          impressions: d3.sum(filteredData, d => d.impressions),
          clicks: d3.sum(filteredData, d => d.clicks),
          views: d3.sum(filteredData, d => d.videoViews)
      }
  }, [filteredData, exRate]);

  // KPI Tracking State
  const kpiStorageKey = `kpi_afc_tracker`;
  const [kpi, setKpi] = useState({ isOpen: false, isSet: false, budget: '', impressions: '', clicks: '', views: '' });

  // Load KPI goals 
  useEffect(() => {
    const saved = sessionStorage.getItem(kpiStorageKey);
    if (saved) {
        try { 
          setKpi(JSON.parse(saved)); 
        } catch(e){}
    }
  }, [kpiStorageKey]);

  useEffect(() => {
    if(kpi.isOpen || kpi.isSet) {
       sessionStorage.setItem(kpiStorageKey, JSON.stringify(kpi));
    }
  }, [kpi, kpiStorageKey]);

  // Trend Data for Line Chart
  const trendData = useMemo(() => {
      const grouped = d3.groups(filteredData, d => d.dateObj ? d3.timeFormat("%b %d")(d.dateObj) : 'Unknown');
      return grouped.map(([date, vals]) => ({
          date,
          sortDate: vals[0].dateObj,
          Spend: d3.sum(vals, d => d.cost) * exRate,
          Impressions: d3.sum(vals, d => d.impressions),
          Clicks: d3.sum(vals, d => d.clicks)
      })).filter(d => d.date !== 'Unknown').sort((a,b) => a.sortDate - b.sortDate);
  }, [filteredData, exRate]);

  // Channel Mix Data for Pie Chart
  const channelMix = useMemo(() => {
      return d3.groups(filteredData, d => d.channel).map(([channel, vals]) => ({
          name: channel || 'Unknown',
          value: d3.sum(vals, d => d.cost) * exRate
      })).sort((a,b) => b.value - a.value);
  }, [filteredData, exRate]);


  // Table Aggregation by Week
  const tableDataByWeek = useMemo(() => {
      const hasCampFilter = filterCampaigns.length > 0 && !filterCampaigns.includes('All');
      const hasChanFilter = fChannels.length > 0;
      
      const mappedData = filteredData.map(d => ({
          week: d.week,
          campaignName: hasCampFilter ? d.campaignName : 'All Campaigns',
          channel: hasChanFilter ? d.channel : 'All Channels',
          cost: d.cost,
          impressions: d.impressions,
          clicks: d.clicks
      }));

      const groups = d3.groups(mappedData, d => d.week, d => d.campaignName, d => d.channel);
      const rows = [];
      groups.forEach(([week, camps]) => {
          camps.forEach(([camp, chans]) => {
              chans.forEach(([chan, items]) => {
                  rows.push({
                      week,
                      campaignName: camp,
                      channel: chan,
                      cost: d3.sum(items, i => i.cost),
                      impressions: d3.sum(items, i => i.impressions),
                      clicks: d3.sum(items, i => i.clicks),
                  });
              });
          });
      });
      // Sort week numerically, then campaign
      return rows.sort((a,b) => {
         const wa = parseInt(a.week.replace('Week ','')) || 0;
         const wb = parseInt(b.week.replace('Week ','')) || 0;
         if (wa !== wb) return wa - wb;
         return a.campaignName.localeCompare(b.campaignName);
      });
  }, [filteredData, filterCampaigns, fChannels]);

  const generatePpt = async () => {
      if (isGenerating) return;
      setIsGenerating(true);
      try {
          if (!window.PptxGenJS) {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
              });
          }
          if (!window.domtoimage) {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.2/dist/dom-to-image-more.min.js';
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
              });
          }
          
          let pres = new window.PptxGenJS();
          
          pres.defineSlideMaster({
            title: "MASTER_SLIDE",
            background: { color: "0C272D" },
            objects: [
              { image: { x: 8.8, y: 0.2, w: 0.65, h: 0.75, path: window.location.origin + "/loc-logo/Saudi 2027-10.png", sizing: { type: "contain" } } }
            ]
          });

          // Helper to capture DOM and add as slide
          const addSnapshotSlide = async (ref, title) => {
             if (ref && ref.current) {
                try {
                   // dom-to-image-more is much more robust for SVGs and modern CSS
                   const imgData = await window.domtoimage.toPng(ref.current, { bgcolor: '#0C272D', scale: 2 });
                   
                   let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
                   slide.addText(title, { x: 0.5, y: 0.3, w: "90%", h: 0.5, fontSize: 20, bold: true, color: "74FA93" });
                   
                   // Load image to get dimensions
                   const img = new Image();
                   img.src = imgData;
                   await new Promise(r => img.onload = r);
                   
                   const imgRatio = img.width / img.height;
                   let w = 9;
                   let h = w / imgRatio;
                   if (h > 4.5) {
                      h = 4.5;
                      w = h * imgRatio;
                   }
                   
                   slide.addImage({ data: imgData, x: 0.5, y: 0.9, w: w, h: h });
                } catch (captureErr) {
                   console.error(`Error capturing snapshot for ${title}:`, captureErr);
                   let errMsg = captureErr.message || captureErr.toString() || "Unknown Error";
                   let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
                   slide.addText(`${title}\n(Snapshot Capture Failed)\n${errMsg}`, { x: 0.5, y: 2, w: "90%", h: 2, fontSize: 16, bold: true, color: "EF476F", align: 'center' });
                }
             }
          };

          // Slide 1: Title
          let slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
          slide.addText("Dashboard Snapshot Report", { x: 0.5, y: 2, w: "90%", h: 1, fontSize: 36, bold: true, color: "FFFFFF", align: 'center' });
          let filterText = `Filters Applied:\nChannels: ${fChannels.length ? fChannels.join(', ') : 'All'}\nWeeks: ${fWeeks.length ? fWeeks.join(', ') : 'All'}`;
          slide.addText(filterText, { x: 0.5, y: 3.5, w: "90%", h: 2, fontSize: 14, color: "CBBB9D", align: 'center', valign: 'top' });

          // DOM Snapshots
          if (kpi.isSet) {
              await addSnapshotSlide(kpiRef, "KPI Goal Pacing");
          }
          await addSnapshotSlide(chartsRef, "Performance & Channel Mix");
          await addSnapshotSlide(tableRef, "Data Breakdown");

          await pres.writeFile({ fileName: `AFC_Dashboard_Snapshot_${new Date().getTime()}.pptx` });
      } catch (err) {
          console.error("PPTX Error", err);
          alert("Error generating PPTX: " + (err.message || err.toString()));
      }
      setIsGenerating(false);
  };

  const renderKpiTracker = () => {
    const hasCampaign = filterCampaigns.length > 0 && !filterCampaigns.includes('All');
    const hasDate = (dateRange.start && dateRange.end) || fWeeks.length > 0;
    const canSetKpi = hasCampaign && hasDate;

    if (!canSetKpi) {
      return (
        <div className="mb-8 w-full border border-dashed border-[#c88214]/20 rounded-[2rem] p-8 text-[#6fa89f]/50 flex items-center justify-center gap-3 font-bold text-sm card-surface backdrop-blur-2xl/50 cursor-not-allowed">
          <Target className="w-5 h-5 opacity-50" /> KPI Tracker (Requires at least one Campaign AND a Date Range or Week filter to activate)
        </div>
      );
    }

    if (kpi.isOpen && !kpi.isSet) {
      return (
        <div className="mb-8 card-surface backdrop-blur-2xl p-8 rounded-[2rem] border border-[#c88214]/30 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#c88214]/10 rounded-full blur-3xl"></div>
           <div className="flex justify-between items-center mb-6 relative z-10">
             <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
               <Target className="w-4 h-4 text-[#c88214]" /> Configure KPI Targets
             </h4>
             <button onClick={() => setKpi({...kpi, isOpen: false})} className="text-[#6fa89f] hover:text-white"><Zap className="w-4 h-4 rotate-45"/></button>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              <input type="number" placeholder={`Budget (${exSym})`} value={kpi.budget} onChange={e=>setKpi({...kpi, budget: e.target.value})} className="w-full text-xs font-bold text-white bg-[#011414] border border-[#c88214]/20 rounded-xl px-4 py-3 outline-none focus:border-[#c88214]" />
              <input type="number" placeholder="Target Impressions" value={kpi.impressions} onChange={e=>setKpi({...kpi, impressions: e.target.value})} className="w-full text-xs font-bold text-white bg-[#011414] border border-[#c88214]/20 rounded-xl px-4 py-3 outline-none focus:border-[#c88214]" />
              <input type="number" placeholder="Target Clicks" value={kpi.clicks} onChange={e=>setKpi({...kpi, clicks: e.target.value})} className="w-full text-xs font-bold text-white bg-[#011414] border border-[#c88214]/20 rounded-xl px-4 py-3 outline-none focus:border-[#c88214]" />
              <input type="number" placeholder="Target Views" value={kpi.views} onChange={e=>setKpi({...kpi, views: e.target.value})} className="w-full text-xs font-bold text-white bg-[#011414] border border-[#c88214]/20 rounded-xl px-4 py-3 outline-none focus:border-[#c88214]" />
           </div>
           <button onClick={() => setKpi({...kpi, isSet: true, isOpen: false})} className="mt-6 w-full bg-[#74FA93] text-[#0C272D] rounded-xl py-3 font-black text-sm shadow-lg shadow-[#74FA93]/20 transition-all hover:scale-[1.01] relative z-10">Track Pacing Against Live Data</button>
        </div>
      );
    }

    if (kpi.isSet) {
      const bPct = Math.min((actuals.spend / (parseFloat(kpi.budget) || 1)) * 100, 100);
      const impPct = Math.min((actuals.impressions / (parseFloat(kpi.impressions) || 1)) * 100, 100);
      const clkPct = Math.min((actuals.clicks / (parseFloat(kpi.clicks) || 1)) * 100, 100);
      const viewPct = Math.min((actuals.views / (parseFloat(kpi.views) || 1)) * 100, 100);

      const ProgressBar = ({ label, actual, target, pct, isCurr, color = "bg-[#74FA93]" }) => (
        <div>
          <div className="flex justify-between items-end text-xs font-bold text-[#6fa89f] mb-2">
            <span>{label}</span>
            <span className="text-white text-right">
              Delivered: {isCurr ? `${exSym}${formatShort(actual)}` : formatShort(actual)} <span className={color.replace('bg-','text-')}>({pct.toFixed(1)}%)</span><br/>
              <span className="text-[10px] text-white/50 font-medium">Target: {isCurr ? `${exSym}${formatShort(target)}` : formatShort(target)}</span>
            </span>
          </div>
          <div className="h-2 bg-[#011414] rounded-full overflow-hidden border border-[#c88214]/10">
            <div className={`h-full ${color} rounded-full relative`} style={{ width: `${pct}%` }}>
              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
        </div>
      );

      return (
        <div ref={kpiRef} className="mb-8 card-surface backdrop-blur-2xl p-8 rounded-[2rem] border border-[#c88214]/30 shadow-xl animate-in fade-in">
           <div className="flex justify-between items-center mb-6">
             <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
               <Target className="w-4 h-4 text-[#c88214]" /> Goal Pacing Tracker
             </h4>
             <button onClick={() => setKpi({...kpi, isSet: false, isOpen: true})} className="text-xs font-black uppercase tracking-widest text-[#c88214] hover:text-white">Edit Goals</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {userRole !== 'non-finance' && <ProgressBar label="Budget Delivery" actual={actuals.spend} target={kpi.budget} pct={bPct} isCurr color="bg-[#74FA93]" />}
              <ProgressBar label="Impressions Generated" actual={actuals.impressions} target={kpi.impressions} pct={impPct} color="bg-[#6fa89f]" />
              <ProgressBar label="Clicks Generated" actual={actuals.clicks} target={kpi.clicks} pct={clkPct} color="bg-[#c88214]" />
              <ProgressBar label="Video Views" actual={actuals.views} target={kpi.views} pct={viewPct} color="bg-[#007542]" />
           </div>
        </div>
      );
    }

    return (
      <button onClick={() => setKpi({...kpi, isOpen: true})} className="mb-8 w-full border border-dashed border-[#c88214]/30 rounded-[2rem] p-6 text-[#c88214] hover:text-white hover:border-[#c88214]/80 hover:bg-[#74FA93]/5 transition-all flex items-center justify-center gap-3 font-bold text-sm">
        <Target className="w-5 h-5 text-[#c88214]" /> Set Campaign Goal & KPI Pacing Tracker
      </button>
    );
  };


  return (
    <div className="space-y-8 animate-[fadeIn_0.5s_ease-out] mb-24">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 card-surface backdrop-blur-2xl/80 backdrop-blur-xl p-8 rounded-[2rem] border border-[#c88214]/20 shadow-2xl relative z-50">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#74FA93]/5 rounded-full blur-3xl -ml-10 -mt-10"></div>
        <div className="relative z-10">
           <h2 className="text-3xl font-black text-white flex items-center gap-3">
             <Filter className="text-[#c88214] w-8 h-8" /> Custom Data Hub
           </h2>
           <p className="text-[#6fa89f] text-sm mt-2 font-medium tracking-wide">Advanced slicing, goal tracking, and export suite.</p>
        </div>
        
        <div className="flex flex-wrap gap-4 items-end w-full xl:w-auto relative z-40">
           <MultiSelectDropdown label="Week" options={optWeeks} selected={fWeeks} onChange={setFWeeks} />
           <MultiSelectDropdown label="Channel" options={optChannels} selected={fChannels} onChange={setFChannels} />
           
           <button 
             onClick={generatePpt}
             disabled={isGenerating}
             className="bg-gradient-to-r from-[#74FA93] to-[#45d468] hover:scale-[1.02] text-[#0C272D] font-black px-8 py-3.5 rounded-xl flex items-center gap-2 transition-all ml-auto shadow-[0_0_20px_rgba(116,250,147,0.3)] disabled:opacity-50 disabled:scale-100"
           >
              {isGenerating ? 'Capturing...' : <><Download className="w-5 h-5" /> Export PPTX</>}
           </button>
        </div>
      </div>

      {renderKpiTracker()}

      {/* DYNAMIC CHARTS */}
      {filteredData.length > 0 ? (
         <>
           <div ref={chartsRef}>
             <div className={`grid grid-cols-2 md:grid-cols-${userRole === 'non-finance' ? '3' : '4'} gap-6 mb-8`}>
              {userRole !== 'non-finance' && <MetricCard label="Total Spend" value={`${exSym}${formatShort(actuals.spend)}`} />}
              <MetricCard label="Impressions" value={formatShort(actuals.impressions)} color="text-[#6fa89f]" />
              <MetricCard label="Clicks" value={formatShort(actuals.clicks)} color="text-[#c88214]" />
              <MetricCard label="Video Views" value={formatShort(actuals.views)} color="text-[#007542]" />
           </div>

           <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
              <div className="card-surface backdrop-blur-2xl/80 backdrop-blur-xl border border-[#c88214]/10 rounded-[2rem] p-8 xl:col-span-2 shadow-xl">
                 <h3 className="text-lg font-black text-white mb-8 flex items-center gap-2 uppercase tracking-widest text-sm">
                   <TrendingUp className="text-[#c88214] w-5 h-5" /> Performance Trend
                 </h3>
                 <div className="h-72">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                       <XAxis dataKey="date" stroke="#6fa89f" fontSize={12} tickLine={false} axisLine={false} />
                       {userRole !== 'non-finance' && <YAxis yAxisId="left" stroke="#74FA93" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatShort} />}
                       <YAxis yAxisId={userRole === 'non-finance' ? "left" : "right"} orientation={userRole === 'non-finance' ? "left" : "right"} stroke="#c88214" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatShort} />
                       <RechartsTooltip contentStyle={{ backgroundColor: '#0C272D', borderColor: '#74FA9320', color: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                       <Legend wrapperStyle={{ paddingTop: '20px' }} />
                       {userRole !== 'non-finance' && <Line yAxisId="left" type="monotone" dataKey="Spend" stroke="#74FA93" strokeWidth={4} dot={false} activeDot={{r:8, fill: '#74FA93', stroke: '#0C272D', strokeWidth: 2}} />}
                       <Line yAxisId={userRole === 'non-finance' ? "left" : "right"} type="monotone" dataKey="Impressions" stroke="#c88214" strokeWidth={4} dot={false} activeDot={{r:8, fill: '#c88214', stroke: '#0C272D', strokeWidth: 2}} />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
              </div>

              <div className="card-surface backdrop-blur-2xl/80 backdrop-blur-xl border border-[#c88214]/10 rounded-[2rem] p-8 shadow-xl">
                 <h3 className="text-lg font-black text-white mb-8 flex items-center gap-2 uppercase tracking-widest text-sm">
                   <Activity className="text-[#c88214] w-5 h-5" /> Channel Mix
                 </h3>
                 <div className="h-72">
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie data={channelMix} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                         {channelMix.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Pie>
                       <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0C272D', borderColor: '#74FA9320', color: '#fff', borderRadius: '16px', fontSize: '12px' }}
                          formatter={(val) => `${exSym}${d3.format(",.2f")(val)}`}
                       />
                       <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                     </PieChart>
                   </ResponsiveContainer>
                 </div>
              </div>
           </div>
           </div>

           {/* Data Table */}
           <div ref={tableRef} className="card-surface backdrop-blur-2xl/80 backdrop-blur-xl border border-[#c88214]/10 rounded-[2rem] p-8 shadow-xl overflow-x-auto custom-scrollbar">
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-widest text-sm">
                 <TableProperties className="text-[#c88214] w-5 h-5" /> Data Breakdown
              </h3>
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="border-b border-[#c88214]/20">
                       <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest">Week</th>
                       <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest">Campaign</th>
                       <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest">Channel</th>
                       {userRole !== 'non-finance' && <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest text-right">Spend</th>}
                       <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest text-right">Impressions</th>
                       <th className="py-4 px-4 text-[#6fa89f] font-bold text-xs uppercase tracking-widest text-right">Clicks</th>
                    </tr>
                 </thead>
                 <tbody>
                    {tableDataByWeek.slice(0, 50).map((d, i) => (
                       <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 px-4 text-white text-sm font-medium">{d.week}</td>
                          <td className="py-4 px-4 text-white text-sm font-bold">{d.campaignName}</td>
                          <td className="py-4 px-4 text-[#c88214] text-sm font-bold">{d.channel}</td>
                          {userRole !== 'non-finance' && <td className="py-4 px-4 text-white text-sm font-bold text-right">{exSym}{d3.format(",.2f")(d.cost * exRate)}</td>}
                          <td className="py-4 px-4 text-white text-sm font-bold text-right">{d3.format(",.0f")(d.impressions)}</td>
                          <td className="py-4 px-4 text-white text-sm font-bold text-right">{d3.format(",.0f")(d.clicks)}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
              {tableDataByWeek.length > 50 && (
                 <div className="text-center text-[#6fa89f] text-xs font-bold mt-6 uppercase tracking-widest">
                   Showing first 50 rows. Export report for full data.
                 </div>
              )}
           </div>
         </>
      ) : (
         <div className="card-surface backdrop-blur-2xl/50 p-16 rounded-[2rem] border border-[#c88214]/10 text-center flex flex-col items-center justify-center">
            <AlertCircle className="w-16 h-16 text-[#007542] mb-6 opacity-80" />
            <h3 className="text-2xl font-black text-white">No data matches your filters</h3>
            <p className="text-[#6fa89f] mt-2 font-medium">Try clearing some selections to see results.</p>
         </div>
      )}
    </div>
  );
}
