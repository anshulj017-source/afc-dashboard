"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, 
  Globe, 
  Layers, 
  Filter, 
  Activity,
  DollarSign,
  MousePointer2,
  Eye,
  Zap,
  LayoutDashboard,
  Calendar,
  ChevronDown,
  Info,
  Check,
  BarChart3
} from 'lucide-react';

// LIVE GOOGLE SHEET CSV LINK
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?output=csv";

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('summary');
  const [selectedWeeks, setSelectedWeeks] = useState([]); // Empty = All
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- FETCH LIVE DATA ---
  useEffect(() => {
    d3.csv(SHEET_CSV_URL)
      .then((csvData) => {
        setData(csvData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching sheet data:", err);
        setError("Failed to load data from Google Sheets. Ensure the sheet is published to the web.");
        setLoading(false);
      });
  }, []);

  // --- DATA PROCESSING ---
  const { processedData, allWeeks, allYears } = useMemo(() => {
    if (!data || data.length === 0) return { processedData: [], allWeeks: [], allYears: [] };
    
    const rows = data.map(row => {
      const cost = parseFloat(row['Cost']) || 0;
      const imps = parseFloat(row['Impression'] || row['Impressions']) || 0;
      const clicks = parseFloat(row['Clicks']) || 0;
      const week = parseInt(row['Week']);
      const year = parseInt(row['Year']);
      const market = row['Channel Country'];
      const channel = row['Channel'];
      
      return {
        originalRow: row,
        val: {
          cost,
          impressions: imps,
          clicks,
          market: (!market || market === 'BLANK') ? 'Other' : market,
          channel: (!channel || channel === 'BLANK') ? 'Other' : channel,
          week: isNaN(week) ? 0 : week,
          year: isNaN(year) ? 0 : year,
          timeKey: (isNaN(year) || isNaN(week)) ? 0 : (year * 100 + week)
        }
      };
    }).filter(r => r.val.timeKey > 0);

    const weeks = Array.from(new Set(rows.map(d => d.val.week))).sort((a, b) => a - b);
    const years = Array.from(new Set(rows.map(d => d.val.year))).sort((a, b) => a - b);

    return { processedData: rows, allWeeks: weeks, allYears: years };
  }, [data]);

  // Unified Filtered Data
  const filteredData = useMemo(() => {
    if (selectedWeeks.length === 0) return processedData;
    return processedData.filter(d => selectedWeeks.includes(d.val.week));
  }, [processedData, selectedWeeks]);

  // Aggregation
  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.val.cost);
    const impressions = d3.sum(rows, d => d.val.impressions);
    const clicks = d3.sum(rows, d => d.val.clicks);
    return {
      cost,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      cpm: impressions > 0 ? (cost / impressions) * 1000 : 0
    };
  };

  const metrics = useMemo(() => aggregate(filteredData), [filteredData]);

  const weeklyTimeline = useMemo(() => {
    const grouped = d3.groups(filteredData, d => d.val.timeKey)
      .map(([key, values]) => ({
        timeKey: key,
        week: values[0].val.week,
        year: values[0].val.year,
        ...aggregate(values)
      }))
      .sort((a, b) => a.timeKey - b.timeKey);
    return grouped;
  }, [filteredData]);

  const marketBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.val.market)
      .map(([name, values]) => ({
        name,
        ...aggregate(values)
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  const channelBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.val.channel)
      .map(([name, values]) => ({
        name,
        ...aggregate(values)
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  // --- AI INSIGHTS ---
  const getAIInsight = (context) => {
    if (filteredData.length === 0) return "No data available for the current selection.";
    
    if (context === 'summary') {
      const topMarket = marketBreakdown[0];
      return `Across your selection, ${topMarket?.name || 'various markets'} accounts for the largest budget slice ($${d3.format(",.0f")(topMarket?.cost || 0)}). Overall campaign efficiency is ${metrics.ctr.toFixed(2)}% CTR with a CPM of $${metrics.cpm.toFixed(2)}.`;
    }
    if (context === 'weekly') {
      if (weeklyTimeline.length > 1) {
        const trend = weeklyTimeline[weeklyTimeline.length-1].cost - weeklyTimeline[0].cost;
        return `Weekly spend trend shows a ${trend >= 0 ? 'growth' : 'contraction'} from first selected period to last. Peak efficiency was achieved in Week ${[...weeklyTimeline].sort((a,b)=>b.ctr-a.ctr)[0]?.week} with ${[...weeklyTimeline].sort((a,b)=>b.ctr-a.ctr)[0]?.ctr.toFixed(2)}% CTR.`;
      }
      return "Analyzing single week data. Add more weeks to the filter to see comparative performance trends.";
    }
    if (context === 'market') {
      const mostEfficient = [...marketBreakdown].sort((a, b) => b.ctr - a.ctr)[0];
      return `${marketBreakdown[0]?.name} drives the highest volume, but ${mostEfficient?.name} is your efficiency champion with a ${mostEfficient?.ctr.toFixed(2)}% CTR. There may be room to scale performance in high-efficiency markets.`;
    }
    if (context === 'channel') {
      const cheapestCPC = [...channelBreakdown].sort((a, b) => a.cpc - b.cpc)[0];
      return `${channelBreakdown[0]?.name} dominates spend. However, ${cheapestCPC?.name} provides the most cost-effective traffic at $${cheapestCPC?.cpc.toFixed(2)} per click.`;
    }
    return "";
  };

  // --- COMPONENTS ---
  const MetricCard = ({ label, value, subValue, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-2xl ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-2xl font-black text-slate-900">{value}</h3>
      <p className="text-xs text-slate-500 mt-1 font-medium">{subValue}</p>
    </div>
  );

  const InsightBox = ({ text }) => (
    <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 mb-10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
        <Zap className="w-32 h-32" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <Zap className="w-4 h-4 text-amber-300" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">AI Intelligence Pulse</span>
        </div>
        <p className="text-xl font-medium leading-relaxed italic max-w-4xl">"{text}"</p>
      </div>
    </div>
  );

  const BarChart = ({ chartData, valueKey, labelKey = 'name', color = 'bg-indigo-500', isPercent = false }) => {
    const maxVal = d3.max(chartData, d => d[valueKey]) || 1;
    return (
      <div className="space-y-4">
        {chartData.slice(0, 8).map((item, i) => (
          <div key={i}>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item[labelKey]}</span>
              <span className="text-[10px] font-black text-slate-400 tabular-nums">
                {isPercent ? `${item[valueKey].toFixed(2)}%` : `$${d3.format(",.0f")(item[valueKey])}`}
              </span>
            </div>
            <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden">
              <div 
                className={`h-full ${color} rounded-full transition-all duration-1000`}
                style={{ width: `${(item[valueKey] / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const AreaChart = ({ chartData, width = 800, height = 300 }) => {
    if (!chartData || chartData.length < 2) return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Select multiple weeks to visualize trend</p>
      </div>
    );
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const iw = width - margin.left - margin.right;
    const ih = height - margin.top - margin.bottom;

    const x = d3.scalePoint().domain(chartData.map(d => `W${d.week}`)).range([0, iw]);
    const y = d3.scaleLinear().domain([0, d3.max(chartData, d => d.cost) * 1.15]).range([ih, 0]);

    const area = d3.area()
      .x(d => x(`W${d.week}`))
      .y0(ih)
      .y1(d => y(d.cost))
      .curve(d3.curveMonotoneX);

    const line = d3.line()
      .x(d => x(`W${d.week}`))
      .y(d => y(d.cost))
      .curve(d3.curveMonotoneX);

    const labels = chartData.map(d => `W${d.week}`);
    const skipCount = Math.ceil(labels.length / 10);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        <defs>
          <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map(t => (
            <g key={t} transform={`translate(0, ${y(t)})`}>
              <line x2={iw} stroke="#f1f5f9" strokeWidth="1" />
              <text x="-10" dy="0.32em" textAnchor="end" className="text-[10px] fill-slate-300 font-bold">${d3.format(".1s")(t)}</text>
            </g>
          ))}
          <path d={area(chartData)} fill="url(#areaGrad)" />
          <path d={line(chartData)} fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
          {chartData.map((d, i) => (
            (i % skipCount === 0 || i === chartData.length - 1) && (
              <g key={i} transform={`translate(${x(`W${d.week}`)}, ${ih})`}>
                <text y="24" textAnchor="middle" className="text-[10px] fill-slate-400 font-black">W{d.week}</text>
              </g>
            )
          ))}
        </g>
      </svg>
    );
  };

  // --- RENDERS ---
  const renderSummary = () => (
    <div className="animate-in fade-in duration-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard label="Global Cost" value={`$${d3.format(",.2f")(metrics.cost)}`} subValue="Gross Ad Spend" icon={DollarSign} color="bg-blue-600" />
        <MetricCard label="Impressions" value={(metrics.impressions / 1000000).toFixed(2) + 'M'} subValue="Brand Reach" icon={Eye} color="bg-indigo-600" />
        <MetricCard label="Total Clicks" value={metrics.clicks.toLocaleString()} subValue="User Engagement" icon={MousePointer2} color="bg-purple-600" />
        <MetricCard label="Avg CTR" value={metrics.ctr.toFixed(2) + '%'} subValue="Click Efficiency" icon={Activity} color="bg-emerald-600" />
      </div>

      <InsightBox text={getAIInsight('summary')} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <h4 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Spend Progression
          </h4>
          <div className="flex-1 min-h-[340px]">
            <AreaChart chartData={weeklyTimeline} />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black text-slate-800 mb-8 uppercase tracking-widest flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" /> Top Markets
          </h4>
          <BarChart chartData={marketBreakdown} valueKey="cost" />
        </div>
      </div>
    </div>
  );

  const renderWeekly = () => (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Weekly Performance</h2>
        <p className="text-slate-500 font-medium italic">Fiscal period analysis for {selectedWeeks.length > 0 ? `${selectedWeeks.length} weeks` : 'all recorded time'}</p>
      </div>
      <InsightBox text={getAIInsight('weekly')} />
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-8">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="px-8 py-5">Fiscal Window</th>
              <th className="px-8 py-5 text-right">Cost</th>
              <th className="px-8 py-5 text-right">Impressions</th>
              <th className="px-8 py-5 text-right">Clicks</th>
              <th className="px-8 py-5 text-right">CTR</th>
              <th className="px-8 py-5 text-right">CPC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {weeklyTimeline.map((w, i) => (
              <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="font-black text-slate-800">Week {w.week}, {w.year}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-mono font-bold text-slate-600">${w.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="px-8 py-5 text-right font-mono text-slate-400">{w.impressions.toLocaleString()}</td>
                <td className="px-8 py-5 text-right font-mono text-slate-400">{w.clicks.toLocaleString()}</td>
                <td className="px-8 py-5 text-right">
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black">{w.ctr.toFixed(2)}%</span>
                </td>
                <td className="px-8 py-5 text-right font-mono text-slate-400">${w.cpc.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMarket = () => (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Market Analysis</h2>
        <p className="text-slate-500 font-medium italic">Geographical footprint & performance ROI</p>
      </div>
      <InsightBox text={getAIInsight('market')} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {marketBreakdown.map((m, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm relative group overflow-hidden">
             <div className="absolute -right-6 -bottom-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
               <Globe className="w-24 h-24" />
             </div>
             <h4 className="text-lg font-black text-slate-900 mb-6 truncate">{m.name}</h4>
             <div className="space-y-5 relative z-10">
               <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Budget</p>
                 <p className="text-xl font-bold text-slate-800">${m.cost.toLocaleString()}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-slate-50 p-3 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1">CTR</p>
                   <p className="text-sm font-bold text-indigo-600">{m.ctr.toFixed(2)}%</p>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Clicks</p>
                   <p className="text-sm font-bold text-slate-800">{d3.format(".2s")(m.clicks)}</p>
                 </div>
               </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChannel = () => (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Channel Attribution</h2>
        <p className="text-slate-500 font-medium italic">Marketing platform breakdown and efficiency audit</p>
      </div>
      <InsightBox text={getAIInsight('channel')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Spend by Channel</h4>
          </div>
          <BarChart chartData={channelBreakdown} valueKey="cost" color="bg-blue-600" />
        </div>
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Channel CTR (%)</h4>
          </div>
          <BarChart chartData={channelBreakdown} valueKey="ctr" color="bg-emerald-500" isPercent={true} />
        </div>
      </div>
    </div>
  );

  // Loading & Error States
  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfe] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">Syncing live dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fcfdfe] flex items-center justify-center">
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-center">
          <p className="text-red-600 font-bold mb-2">Connection Error</p>
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* HEADER */}
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-200/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">ROVA PERFORMANCE</h1>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] mt-1.5">Intelligence Dashboard</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200/40">
            {[
              { id: 'summary', label: 'Summary', icon: LayoutDashboard },
              { id: 'weekly', label: 'Weekly', icon: Calendar },
              { id: 'market', label: 'Markets', icon: Globe },
              { id: 'channel', label: 'Channels', icon: Layers },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200/50' 
                  : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all font-bold text-sm ${
                selectedWeeks.length > 0 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              {selectedWeeks.length === 0 ? 'All Weeks' : `${selectedWeeks.length} Selected`}
              <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[2rem] border border-slate-200 shadow-2xl z-50 p-5 max-h-[400px] overflow-y-auto animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Timeframe Filter</span>
                    <button 
                      onClick={() => setSelectedWeeks([])} 
                      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {allWeeks.map(w => (
                      <button
                        key={w}
                        onClick={() => setSelectedWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border ${
                          selectedWeeks.includes(w) 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-black' 
                          : 'border-slate-100 hover:bg-slate-50 text-slate-600 font-bold'
                        }`}
                      >
                        <span className="text-xs">Week {w}</span>
                        {selectedWeeks.includes(w) && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'weekly' && renderWeekly()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'channel' && renderChannel()}
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 pb-12 border-t border-slate-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
        <div className="flex items-center gap-4">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Consolidated Growth Attribution Engine v2.0</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Data Sync Active</span>
        </div>
      </footer>
    </div>
  );
}
