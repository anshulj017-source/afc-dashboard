"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties
} from 'lucide-react';

// === YOUR LIVE DATA LINKS ===
const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";

// Helper: Convert Week Number to Approximate Date 
const getDateFromWeek = (week, year = 2026) => {
  return new Date(year, 0, 1 + (week - 1) * 7);
};

const getMonthFromWeek = (week, year) => {
  return getDateFromWeek(week, year).toLocaleString('en-US', { month: 'short' });
};

// Helper: Standardize Country Abbreviations (Merge Engine)
const normalizeMarket = (marketName) => {
  if (!marketName || marketName === 'BLANK' || marketName === 'Unknown') return 'Other';
  const cleanName = marketName.trim();
  const upperName = cleanName.toUpperCase();
  
  const aliases = {
    'KWT': 'Kuwait', 'KW': 'Kuwait', 'KUWAIT': 'Kuwait',
    'KSA': 'Saudi Arabia', 'SAU': 'Saudi Arabia', 'SA': 'Saudi Arabia', 'SAUDI ARABIA': 'Saudi Arabia',
    'UAE': 'United Arab Emirates', 'ARE': 'United Arab Emirates', 'AE': 'United Arab Emirates', 'UNITED ARAB EMIRATES': 'United Arab Emirates',
    'QAT': 'Qatar', 'QA': 'Qatar', 'QATAR': 'Qatar',
    'BHR': 'Bahrain', 'BH': 'Bahrain', 'BAHRAIN': 'Bahrain',
    'OMN': 'Oman', 'OM': 'Oman', 'OMAN': 'Oman',
    'EGY': 'Egypt', 'EG': 'Egypt', 'EGYPT': 'Egypt',
    'UK': 'United Kingdom', 'GBR': 'United Kingdom', 'GB': 'United Kingdom',
    'US': 'United States', 'USA': 'United States',
    'ID': 'Indonesia', 'IDN': 'Indonesia', 'INDONESIA': 'Indonesia'
  };
  
  return aliases[upperName] || cleanName;
};

// Safe numerical parsing
const parseMetric = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarketView, setSelectedMarketView] = useState('All');
  
  // Advanced Filter States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [compareWeeks, setCompareWeeks] = useState([]); 
  const [trafficFilter, setTrafficFilter] = useState('All'); 

  // --- FETCH LIVE DATA FROM MULTIPLE SHEETS ---
  useEffect(() => {
    Promise.all([
      d3.csv(COMBINED_COUNTRY_CSV_URL),
      d3.csv(RAW_ADJUST_CSV_URL)
    ])
      .then(([adData, mmpData]) => {
        const s1 = adData.map(row => {
          const week = parseInt(row['Week'] || row['week']) || 0;
          const year = parseInt(row['Year'] || row['year']) || 0;
          return {
            cost: parseMetric(row['Cost'] || row['Spend'] || row['cost']),
            impressions: parseMetric(row['Impression'] || row['Impressions']),
            clicks: parseMetric(row['Clicks'] || row['clicks']),
            installs: 0, 
            purchases: 0,
            week, year,
            date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Channel Country']),
            channel: (!row['Channel'] || row['Channel'] === 'BLANK') ? 'Other' : row['Channel'],
            source: 'AdNetwork',
            trafficType: 'Paid' 
          };
        });

        const s2 = mmpData.map(row => {
          const week = parseInt(row['Week'] || row['week'] || row['Wk']) || 0;
          const year = parseInt(row['Year'] || row['year'] || row['Yr']) || 0;
          
          const rawClass = Object.values(row)[11] || row['Classification'] || row['Network classification'] || '';
          const trafficType = rawClass.toString().toLowerCase().includes('organic') ? 'Organic' : 'Paid';

          const purchases = parseMetric(Object.values(row)[7] || row['Purchases'] || row['Total Purchases']);

          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install'] || row['Total Installs'] || row['Network Installs']),
            purchases,
            week, year,
            date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: (!row['Network'] || row['Network'] === 'BLANK' || row['Network'] === 'Organic') ? 'Other' : (row['Network'] || row['Source']),
            source: 'Adjust',
            trafficType
          };
        });
        
        setData([...s1, ...s2]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please ensure CSV links are correct and published.");
        setLoading(false);
      });
  }, []);

  // --- RESILIENT DATA PROCESSING ---
  const { processedData, allTimeKeys } = useMemo(() => {
    if (!data || data.length === 0) return { processedData: [], allTimeKeys: [] };
    
    const rows = data.map(row => ({
      ...row,
      timeKey: (row.year === 0 || row.week === 0) ? 0 : (row.year * 100 + row.week)
    })).filter(r => r.timeKey > 0);

    const timeKeys = Array.from(new Set(rows.map(d => d.timeKey))).sort((a, b) => a - b);
    return { processedData: rows, allTimeKeys: timeKeys };
  }, [data]);

  // Master Filter Engine
  const filteredData = useMemo(() => {
    return processedData.filter(d => {
      let passTraffic = true;
      if (trafficFilter !== 'All') {
        passTraffic = d.trafficType === trafficFilter;
      }
      let passTime = true;
      if (compareWeeks.length > 0) {
        passTime = compareWeeks.includes(d.timeKey);
      } else {
        if (dateRange.start) passTime = passTime && d.date >= new Date(dateRange.start);
        if (dateRange.end) passTime = passTime && d.date <= new Date(dateRange.end);
      }
      return passTraffic && passTime;
    });
  }, [processedData, dateRange, compareWeeks, trafficFilter]);

  // Aggregation Engine
  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.cost);
    const impressions = d3.sum(rows, d => d.impressions);
    const clicks = d3.sum(rows, d => d.clicks);
    const installs = d3.sum(rows, d => d.installs);
    const purchases = d3.sum(rows, d => d.purchases);
    
    return {
      cost, impressions, clicks, installs, purchases,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
      cpi: installs > 0 ? cost / installs : 0,
      cpp: purchases > 0 ? cost / purchases : 0,
      cvr: clicks > 0 ? (installs / clicks) * 100 : 0
    };
  };

  const metrics = useMemo(() => aggregate(filteredData), [filteredData]);

  const weeklyTimeline = useMemo(() => {
    return d3.groups(filteredData, d => d.timeKey)
      .map(([key, values]) => ({
        timeKey: key,
        week: values[0].week,
        year: values[0].year,
        ...aggregate(values)
      }))
      .sort((a, b) => a.timeKey - b.timeKey);
  }, [filteredData]);

  const marketBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.market)
      .map(([name, values]) => ({ name, ...aggregate(values) }))
      .filter(m => m.cost >= 1) 
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  const channelBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.channel)
      .map(([name, values]) => ({ name, ...aggregate(values) }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);


  // --- DYNAMIC AI INSIGHTS ---
  const getAIInsight = (context, activeData = null) => {
    if (filteredData.length === 0) return "No data available for the current selection.";
    
    if (context === 'summary') {
      const cvrToPurchase = metrics.installs > 0 ? ((metrics.purchases / metrics.installs) * 100).toFixed(1) : 0;
      return `Funnel Efficiency: ${cvrToPurchase}% of all installs convert into a purchase, yielding a global Cost Per Purchase (CPP) of $${metrics.cpp.toFixed(2)}. ${marketBreakdown[0]?.name || 'Top market'} remains your heaviest investment vehicle.`;
    }
    if (context === 'detailed') {
      const dataToAnalyze = activeData || weeklyTimeline;
      if (dataToAnalyze.length > 1) {
        const sortedByCPP = [...dataToAnalyze].filter(w => w.purchases > 0).sort((a,b)=>a.cpp-b.cpp);
        const worstCPP = [...dataToAnalyze].filter(w => w.purchases > 0).sort((a,b)=>b.cpp-a.cpp)[0];
        
        let string = `Week ${sortedByCPP[0]?.week} yielded the highest conversion efficiency ($${sortedByCPP[0]?.cpp.toFixed(2)} CPP). `;
        if (worstCPP && worstCPP.cpp > sortedByCPP[0].cpp * 1.5) {
           string += `Conversely, Week ${worstCPP.week} saw CPP spike to $${worstCPP.cpp.toFixed(2)}, indicating heavy ad waste or tracking drop-off.`;
        } else {
           string += `Overall stability is strong across the selected timeframe for this view.`;
        }
        return string;
      }
      return "Analyzing single week data. Add more weeks to see CPI & CPP progression trends over time.";
    }
    return "";
  };

  // --- COMPONENTS ---
  const MetricCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 group">
      <div className={`w-8 h-8 rounded-xl ${color} bg-opacity-10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-lg font-black text-slate-900 truncate" title={value}>{value}</h3>
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
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">AI Funnel Insight</span>
        </div>
        <p className="text-xl font-medium leading-relaxed italic max-w-4xl">"{text}"</p>
      </div>
    </div>
  );

  const MarketNavigator = () => (
    <div className="flex gap-3 overflow-x-auto pb-4 mb-8 border-b border-slate-100 hide-scrollbar">
      <button 
        onClick={() => setSelectedMarketView('All')} 
        className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedMarketView === 'All' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
      >
        Global Overview
      </button>
      {marketBreakdown.map(m => (
        <button 
          key={m.name} 
          onClick={() => setSelectedMarketView(m.name)} 
          className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedMarketView === m.name ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}
        >
          {m.name}
        </button>
      ))}
    </div>
  );

  const BarChart = ({ chartData, valueKey, labelKey = 'name', color = 'bg-indigo-500', isCurrency = false, isPercent = false }) => {
    const maxVal = d3.max(chartData, d => d[valueKey]) || 1;
    return (
      <div className="space-y-4">
        {chartData.slice(0, 8).map((item, i) => {
          const formattedVal = isPercent ? `${item[valueKey].toFixed(2)}%` : isCurrency ? `$${d3.format(",.2f")(item[valueKey])}` : d3.format(",.0f")(item[valueKey]);
          return (
            <div key={i} className="group relative">
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item[labelKey]}</span>
                <span className="text-[10px] font-black text-slate-400 tabular-nums">{formattedVal}</span>
              </div>
              <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full ${color} rounded-full transition-all duration-1000 group-hover:opacity-70`}
                  style={{ width: `${(item[valueKey] / maxVal) * 100}%` }}
                />
              </div>
              {/* Custom Tooltip */}
              <div className="absolute -top-10 right-0 bg-slate-800 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-slate-700">
                <span className="font-bold">{item[labelKey]}</span> <span className="text-slate-400 mx-1">|</span> {formattedVal}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const MarketBarChartCard = ({ title, icon: Icon, data, dataKey, color, isCurrency, insight }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-6">
           <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
           <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h4>
        </div>
        <div className="flex-1 mb-6">
           <BarChart chartData={data} valueKey={dataKey} color={color} isCurrency={isCurrency} />
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl mt-auto border border-slate-100 relative overflow-hidden group">
           <Zap className="w-16 h-16 absolute -right-4 -top-4 opacity-5 text-indigo-500 group-hover:scale-125 transition-transform" />
           <p className="text-xs font-bold text-slate-600 relative z-10">"{insight}"</p>
        </div>
    </div>
  );

  const DualAxisLineChart = ({ chartData, leftKey, rightKey, leftColorText, rightColorText, leftColorHex, rightColorHex, isLeftCurrency, isRightCurrency, width = 800, height = 300, insight = null }) => {
    if (!chartData || chartData.length < 2) return (
      <div className="h-full w-full min-h-[250px] flex items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 text-[10px] font-black text-slate-300 uppercase">Select multiple periods</div>
    );
    const margin = { top: 20, right: 50, bottom: 40, left: 50 };
    const iw = width - margin.left - margin.right;
    const ih = height - margin.top - margin.bottom;

    const x = d3.scalePoint().domain(chartData.map(d => `W${d.week}`)).range([0, iw]);
    const yLeft = d3.scaleLinear().domain([0, d3.max(chartData, d => d[leftKey]) * 1.1 || 1]).range([ih, 0]);
    const yRight = d3.scaleLinear().domain([0, d3.max(chartData, d => d[rightKey]) * 1.1 || 1]).range([ih, 0]);

    const lineLeft = d3.line().x(d => x(`W${d.week}`)).y(d => yLeft(d[leftKey])).curve(d3.curveMonotoneX);
    const lineRight = d3.line().x(d => x(`W${d.week}`)).y(d => yRight(d[rightKey])).curve(d3.curveMonotoneX);

    const skipCount = Math.ceil(chartData.length / 10);

    return (
      <div className="flex flex-col h-full">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible min-h-[250px] flex-1">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {yLeft.ticks(5).map(t => (
              <g key={`l-${t}`} transform={`translate(0, ${yLeft(t)})`}>
                <line x2={iw} stroke="#f1f5f9" strokeWidth="1" />
                <text x="-10" dy="0.32em" textAnchor="end" className={`text-[9px] ${leftColorText} font-bold`}>{isLeftCurrency ? `$${d3.format(".1s")(t)}` : d3.format(".1s")(t)}</text>
              </g>
            ))}
            {yRight.ticks(5).map(t => (
               <g key={`r-${t}`} transform={`translate(${iw}, ${yRight(t)})`}>
                 <text x="10" dy="0.32em" textAnchor="start" className={`text-[9px] ${rightColorText} font-bold`}>{isRightCurrency ? `$${d3.format(".1s")(t)}` : d3.format(".1s")(t)}</text>
               </g>
            ))}
            
            <path d={lineLeft(chartData)} fill="none" stroke={leftColorHex} strokeWidth="4" strokeLinecap="round" />
            <path d={lineRight(chartData)} fill="none" stroke={rightColorHex} strokeWidth="4" strokeLinecap="round" strokeDasharray="6,6" />
            
            {/* Custom Interactive Tooltip Crosshairs */}
            {chartData.map((d, i) => (
               <g key={`hover-${i}`} className="group cursor-pointer">
                 <rect x={x(`W${d.week}`) - 15} y={0} width={30} height={ih} fill="transparent" />
                 <line x1={x(`W${d.week}`)} x2={x(`W${d.week}`)} y1={0} y2={ih} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" className="opacity-0 group-hover:opacity-100" />
                 <foreignObject x={x(`W${d.week}`) > iw / 2 ? x(`W${d.week}`) - 140 : x(`W${d.week}`) + 10} y={10} width="130" height="90" className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                   <div className="bg-slate-800 text-white text-[10px] p-2.5 rounded-xl shadow-2xl flex flex-col gap-1.5 border border-slate-700">
                     <span className="font-black text-slate-300 border-b border-slate-600 pb-1">Week {d.week}, {d.year}</span>
                     <div className="flex justify-between"><span className={leftColorText.replace('fill-', 'text-').replace('300', '400')}>{leftKey.toUpperCase()}:</span> <span>{isLeftCurrency ? '$' : ''}{d3.format(",.2f")(d[leftKey])}</span></div>
                     <div className="flex justify-between"><span className={rightColorText.replace('fill-', 'text-').replace('300', '400')}>{rightKey.toUpperCase()}:</span> <span>{isRightCurrency ? '$' : ''}{d3.format(",.2f")(d[rightKey])}</span></div>
                   </div>
                 </foreignObject>
               </g>
            ))}

            {chartData.map((d, i) => (
              (i % skipCount === 0 || i === chartData.length - 1) && (
                <g key={`x-${i}`} transform={`translate(${x(`W${d.week}`)}, ${ih})`}>
                  <text y="24" textAnchor="middle" className="text-[10px] fill-slate-400 font-black">W{d.week}</text>
                </g>
              )
            ))}
          </g>
        </svg>
        {insight && (
          <div className="bg-slate-50 p-4 rounded-2xl mt-6 border border-slate-100 relative overflow-hidden group">
             <Zap className="w-12 h-12 absolute -right-2 -top-2 opacity-5 text-indigo-500 group-hover:scale-125 transition-transform" />
             <p className="text-xs font-bold text-slate-600 relative z-10">"{insight}"</p>
          </div>
        )}
      </div>
    );
  };

  // --- RENDERS ---
  const renderSummary = () => (
    <div className="animate-in fade-in duration-700">
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 mb-10">
        <MetricCard label="Ad Spend" value={`$${d3.format(",.0f")(metrics.cost)}`} icon={DollarSign} color="bg-blue-600" />
        <MetricCard label="Impressions" value={(metrics.impressions / 1000000).toFixed(2) + 'M'} icon={Eye} color="bg-indigo-600" />
        <MetricCard label="Clicks" value={d3.format(",.0f")(metrics.clicks)} icon={MousePointer2} color="bg-purple-600" />
        <MetricCard label="Installs" value={d3.format(",.0f")(metrics.installs)} icon={Download} color="bg-emerald-600" />
        <MetricCard label="Purchases" value={d3.format(",.0f")(metrics.purchases)} icon={ShoppingCart} color="bg-fuchsia-600" />
        <MetricCard label="CVR" value={`${metrics.cvr.toFixed(2)}%`} icon={TrendingUp} color="bg-rose-500" />
        <MetricCard label="CPI" value={`$${metrics.cpi.toFixed(2)}`} icon={Activity} color="bg-amber-500" />
        <MetricCard label="CPP" value={`$${metrics.cpp.toFixed(2)}`} icon={Target} color="bg-red-500" />
      </div>
      <InsightBox text={getAIInsight('summary')} />
    </div>
  );

  const renderMarket = () => (
    <div className="animate-in fade-in duration-500">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Market Intelligence</h2>
        </div>
        <MarketNavigator />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <MarketBarChartCard title="Total Installs" icon={Download} data={[...marketBreakdown].sort((a,b)=>b.installs-a.installs)} dataKey="installs" color="bg-emerald-500" insight="Breakdown of volume by market." />
            <MarketBarChartCard title="Total Purchases" icon={ShoppingCart} data={[...marketBreakdown].sort((a,b)=>b.purchases-a.purchases)} dataKey="purchases" color="bg-fuchsia-500" insight="Purchase conversion intensity." />
        </div>
    </div>
  );

  const renderChannel = () => (
     <div className="animate-in fade-in duration-500">
        <h2 className="text-3xl font-black mb-8">Channel Attribution</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[2.5rem] border shadow-sm">
              <BarChart3 className="w-5 h-5 text-indigo-500 mb-4" />
              <div className="space-y-5">
                 {channelBreakdown.slice(0, 6).map((item, i) => (
                    <div key={i}><div className="flex justify-between text-xs font-black">{item.name} <span>${d3.format(",.0f")(item.cost)}</span></div><div className="h-2 bg-blue-100 rounded-full"><div className="h-full bg-blue-600 rounded-full" style={{width: `${(item.cost / d3.max(channelBreakdown, d=>d.cost)) * 100}%`}}></div></div></div>
                 ))}
              </div>
           </div>
        </div>
     </div>
  );

  return (
    <div className="min-h-screen bg-[#fcfdfe] text-slate-900 font-sans p-6">
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
           <h1 className="text-xl font-black">ROVA PERFORMANCE</h1>
           <nav className="flex gap-4">
              {[ {id:'summary', label:'Summary'}, {id:'market', label:'Markets'}, {id:'channel', label:'Channels'}, {id:'detailed', label:'Detailed Data'} ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`font-black uppercase text-xs ${activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</button>
              ))}
           </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-12">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'channel' && renderChannel()}
        {activeTab === 'detailed' && <div className="p-10 bg-white rounded-3xl">Detailed data view active...</div>}
      </main>
    </div>
  );
}
