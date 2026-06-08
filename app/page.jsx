"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users
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
  const [compareWeeks, setCompareWeeks] = useState([]); // Array of timeKeys (YYYYWW)
  const [trafficFilter, setTrafficFilter] = useState('All'); // 'All', 'Paid', 'Organic'

  // --- FETCH LIVE DATA FROM MULTIPLE SHEETS ---
  useEffect(() => {
    Promise.all([
      d3.csv(COMBINED_COUNTRY_CSV_URL),
      d3.csv(RAW_ADJUST_CSV_URL)
    ])
      .then(([adData, mmpData]) => {
        // Map Ad Data (Sheet 1)
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
            trafficType: 'Paid' // Ad spend is inherently paid
          };
        });

        // Map Adjust MMP Data (Sheet 2)
        const s2 = mmpData.map(row => {
          const week = parseInt(row['Week'] || row['week'] || row['Wk']) || 0;
          const year = parseInt(row['Year'] || row['year'] || row['Yr']) || 0;
          
          // COLUMN L (Index 11): Classification
          const rawClass = Object.values(row)[11] || row['Classification'] || row['Network classification'] || '';
          const trafficType = rawClass.toString().toLowerCase().includes('organic') ? 'Organic' : 'Paid';

          // COLUMN H (Index 7): Purchases
          const purchases = parseMetric(Object.values(row)[7] || row['Purchases'] || row['Total Purchases']);

          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install'] || row['Total Installs'] || row['Network Installs']),
            purchases,
            week, year,
            date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: (!row['Network'] || row['Network'] === 'BLANK' || row['Network'] === 'Organic') ? 'Other' : row['Network'],
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
      // 1. Traffic Filter
      let passTraffic = true;
      if (trafficFilter !== 'All') {
        passTraffic = d.trafficType === trafficFilter;
      }

      // 2. Time Filter (Compare Weeks overrides Date Range if active)
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
      .filter(m => m.cost >= 1) // STRICT $1 MINIMUM AD SPEND
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  const channelBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.channel)
      .map(([name, values]) => ({ name, ...aggregate(values) }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);


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
              <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden" title={`${item[labelKey]}: ${formattedVal}`}>
                <div 
                  className={`h-full ${color} rounded-full transition-all duration-1000 group-hover:opacity-80`}
                  style={{ width: `${(item[valueKey] / maxVal) * 100}%` }}
                />
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
            {/* Grid & Axes */}
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
            
            {/* Lines */}
            <path d={lineLeft(chartData)} fill="none" stroke={leftColorHex} strokeWidth="4" strokeLinecap="round" />
            <path d={lineRight(chartData)} fill="none" stroke={rightColorHex} strokeWidth="4" strokeLinecap="round" strokeDasharray="6,6" />
            
            {/* Interactive Nodes (Tooltips) */}
            {chartData.map((d, i) => (
              <g key={`nodes-${i}`}>
                <circle cx={x(`W${d.week}`)} cy={yLeft(d[leftKey])} r="6" fill={leftColorHex} className="cursor-pointer hover:opacity-75 transition-opacity" stroke="#fff" strokeWidth="2">
                   <title>{`Week ${d.week}: ${isLeftCurrency ? '$' : ''}${d3.format(",.2f")(d[leftKey])}`}</title>
                </circle>
                <circle cx={x(`W${d.week}`)} cy={yRight(d[rightKey])} r="6" fill={rightColorHex} className="cursor-pointer hover:opacity-75 transition-opacity" stroke="#fff" strokeWidth="2">
                   <title>{`Week ${d.week}: ${isRightCurrency ? '$' : ''}${d3.format(",.2f")(d[rightKey])}`}</title>
                </circle>
              </g>
            ))}

            {/* X Axis Labels */}
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
          <div className="bg-slate-50 p-4 rounded-2xl mt-6 border border-slate-100">
             <p className="text-xs font-bold text-slate-600">"{insight}"</p>
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

      <InsightBox text={`Overall funnel analysis shows an aggregated Cost Per Purchase (CPP) of $${metrics.cpp.toFixed(2)}. Out of ${d3.format(",.0f")(metrics.installs)} installs generated, ${d3.format(",.0f")(metrics.purchases)} translated into actual purchases.`} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> Spend vs MMP Installs
            </h4>
            <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"/> Cost</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Installs</span>
            </div>
          </div>
          <div className="flex-1 min-h-[340px]">
             <DualAxisLineChart 
                chartData={weeklyTimeline} 
                leftKey="cost" rightKey="installs" 
                leftColorText="fill-indigo-300" rightColorText="fill-emerald-300"
                leftColorHex="#6366f1" rightColorHex="#10b981"
                isLeftCurrency={true} isRightCurrency={false} 
             />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-fuchsia-500" /> Top Market Purchases
          </h4>
          <BarChart chartData={[...marketBreakdown].sort((a,b)=>b.purchases-a.purchases)} valueKey="purchases" color="bg-fuchsia-500" />
        </div>
      </div>
    </div>
  );

  const renderMarket = () => {
    const sortedByInstalls = [...marketBreakdown].sort((a, b) => b.installs - a.installs);
    const sortedByPurchases = [...marketBreakdown].sort((a, b) => b.purchases - a.purchases);
    const validCPI = [...marketBreakdown].filter(m => m.installs > 0).sort((a, b) => a.cpi - b.cpi);
    const validCPP = [...marketBreakdown].filter(m => m.purchases > 0).sort((a, b) => a.cpp - b.cpp);

    const activeMarketData = selectedMarketView === 'All' 
      ? null 
      : d3.groups(filteredData.filter(d => d.market === selectedMarketView), d => d.timeKey)
          .map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) }))
          .sort((a,b) => a.week - b.week);
          
    const activeMarketSummary = selectedMarketView === 'All' ? null : marketBreakdown.find(m => m.name === selectedMarketView);

    return (
      <div className="animate-in fade-in duration-500">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Market Intelligence</h2>
          <p className="text-slate-500 font-medium italic">Geographical footprint filtered for active ad spend &gt; $1.</p>
        </div>

        {/* Interactive Market Navigator */}
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

        {selectedMarketView === 'All' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <MarketBarChartCard title="Total Installs" icon={Download} data={sortedByInstalls} dataKey="installs" color="bg-emerald-500" 
              insight={`${sortedByInstalls[0]?.name || 'Top market'} leads acquisition volume, accounting for significant portion of total installs.`} />
            <MarketBarChartCard title="Total Purchases" icon={ShoppingCart} data={sortedByPurchases} dataKey="purchases" color="bg-fuchsia-500" 
              insight={`${sortedByPurchases[0]?.name || 'Top market'} drives the highest bottom-funnel intent matching the traffic profile.`} />
            <MarketBarChartCard title="Cost Per Install (CPI)" icon={Activity} data={validCPI.slice(0, 8)} dataKey="cpi" color="bg-amber-500" isCurrency={true} 
              insight={`${validCPI[0]?.name || 'Top market'} offers the most cost-effective top-funnel acquisition at $${validCPI[0]?.cpi.toFixed(2)} CPI.`} />
            <MarketBarChartCard title="Cost Per Purchase (CPP)" icon={Target} data={validCPP.slice(0, 8)} dataKey="cpp" color="bg-red-500" isCurrency={true} 
              insight={`${validCPP[0]?.name || 'Top market'} delivers the best conversion ROI at $${validCPP[0]?.cpp.toFixed(2)} CPP.`} />
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
               <MetricCard label="Ad Spend" value={`$${d3.format(",.0f")(activeMarketSummary?.cost || 0)}`} icon={DollarSign} color="bg-blue-600" />
               <MetricCard label="Installs" value={d3.format(",.0f")(activeMarketSummary?.installs || 0)} icon={Download} color="bg-emerald-600" />
               <MetricCard label="Purchases" value={d3.format(",.0f")(activeMarketSummary?.purchases || 0)} icon={ShoppingCart} color="bg-fuchsia-600" />
               <MetricCard label="CPI" value={`$${(activeMarketSummary?.cpi || 0).toFixed(2)}`} icon={Activity} color="bg-amber-500" />
               <MetricCard label="CPP" value={`$${(activeMarketSummary?.cpp || 0).toFixed(2)}`} icon={Target} color="bg-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                     <Layers className="w-4 h-4 text-emerald-500" /> Volume: Installs & Purchases
                   </h4>
                   <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400">
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"/> Installs</span>
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-fuchsia-500"/> Purchases</span>
                   </div>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart 
                       chartData={activeMarketData} leftKey="installs" rightKey="purchases" 
                       leftColorText="fill-emerald-300" rightColorText="fill-fuchsia-300"
                       leftColorHex="#10b981" rightColorHex="#d946ef" isLeftCurrency={false} isRightCurrency={false} 
                       insight={`Volume analysis for ${selectedMarketView}: Comparing raw install volume directly against eventual purchase conversions.`}
                    />
                 </div>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                     <Activity className="w-4 h-4 text-red-500" /> Efficiency: CPI & CPP
                   </h4>
                   <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400">
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"/> CPI</span>
                     <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"/> CPP</span>
                   </div>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart 
                       chartData={activeMarketData} leftKey="cpi" rightKey="cpp" 
                       leftColorText="fill-amber-300" rightColorText="fill-red-300"
                       leftColorHex="#f59e0b" rightColorHex="#ef4444" isLeftCurrency={true} isRightCurrency={true} 
                       insight={`Efficiency tracking for ${selectedMarketView}: Identifying weeks where acquisition costs detached from purchase revenue goals.`}
                    />
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChannel = () => (
     <div className="animate-in fade-in duration-500">
        <div className="mb-8">
           <h2 className="text-3xl font-black text-slate-900 tracking-tight">Channel Attribution</h2>
           <p className="text-slate-500 font-medium italic">Marketing platform breakdown mapped directly to purchase intent.</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                 <BarChart3 className="w-5 h-5 text-indigo-500" />
                 <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Spend vs Purchases</h4>
              </div>
              <p className="text-xs text-slate-400 mb-8 font-medium">Dark bar is spend, light bar is resulting MMP purchases.</p>
              <div className="space-y-5 mt-4">
                 {channelBreakdown.slice(0, 6).map((item, i) => {
                    const maxLeft = d3.max(channelBreakdown, d => d.cost) || 1;
                    const maxRight = d3.max(channelBreakdown, d => d.purchases) || 1;
                    return (
                       <div key={i} className="relative group">
                          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-1.5">
                             <span className="text-slate-700 truncate max-w-[120px]">{item.name}</span>
                             <div className="flex gap-4">
                                <span>{item.purchases > 0 ? `$${item.cpp.toFixed(2)} CPP` : 'N/A'}</span>
                                <span className="text-slate-700">${d3.format(",.0f")(item.cost)}</span>
                             </div>
                          </div>
                          <div className="flex flex-col gap-1" title={`${item.name} - Spend: $${d3.format(",.2f")(item.cost)} | Purchases: ${item.purchases}`}>
                             <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden w-full">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 group-hover:opacity-80" style={{ width: `${(item.cost / maxLeft) * 100}%` }} />
                             </div>
                             <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden w-full">
                                <div className="h-full bg-fuchsia-400 rounded-full transition-all duration-1000 opacity-80 group-hover:opacity-100" style={{ width: `${(item.purchases / maxRight) * 100}%` }} />
                             </div>
                          </div>
                       </div>
                    )
                 })}
              </div>
           </div>
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                 <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5 text-red-500" />
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Efficiency Grid</h4>
                 </div>
                 <p className="text-xs text-slate-400 mb-8 font-medium">Platform efficiency ranked explicitly by Cost Per Purchase (CPP).</p>
              </div>
              <div className="space-y-3">
                 {[...channelBreakdown].sort((a,b)=>a.cpp-b.cpp).slice(0, 6).map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors" title={`${c.name}: $${c.cpp.toFixed(2)} per purchase`}>
                       <span className="font-bold text-slate-700 text-sm truncate w-1/3">{c.name}</span>
                       <span className="text-amber-600 font-black text-sm w-1/3 text-center">${c.cpi.toFixed(2)} CPI</span>
                       <span className="text-red-600 font-black text-sm w-1/3 text-right">{c.cpp > 0 ? `$${c.cpp.toFixed(2)} CPP` : 'No Purchases'}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
     </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfe] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-500">Syncing multi-source pipeline...</p>
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
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-200/50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">ROVA PERFORMANCE</h1>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em] mt-1.5">Intelligence Dashboard</p>
            </div>
          </div>

          <nav className="flex items-center gap-2 bg-slate-100/60 p-1.5 rounded-2xl border border-slate-200/40 overflow-x-auto hide-scrollbar">
            {[
              { id: 'summary', label: 'Summary', icon: LayoutDashboard },
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
                (dateRange.start || compareWeeks.length > 0 || trafficFilter !== 'All')
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              {(dateRange.start || compareWeeks.length > 0 || trafficFilter !== 'All') ? 'Filters Active' : 'Filter Data'}
              <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-0 mt-3 w-96 bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl z-50 p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6 px-1 border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Filters</span>
                    <button 
                      onClick={() => { setDateRange({start:'', end:''}); setCompareWeeks([]); setTrafficFilter('All'); }} 
                      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                    >
                      Reset All
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Traffic Filter */}
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Users className="w-3 h-3" /> Traffic Segment</h4>
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        {['All', 'Paid', 'Organic'].map(type => (
                           <button 
                             key={type}
                             onClick={() => setTrafficFilter(type)}
                             className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${trafficFilter === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                           >
                             {type}
                           </button>
                        ))}
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className={compareWeeks.length > 0 ? 'opacity-30 pointer-events-none' : ''}>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><CalendarDays className="w-3 h-3" /> Custom Date Range</h4>
                      <div className="flex gap-2">
                         <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500" />
                         <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500" />
                      </div>
                    </div>

                    {/* Compare Specific Weeks */}
                    <div className={dateRange.start || dateRange.end ? 'opacity-30 pointer-events-none' : ''}>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Compare Specific Weeks</h4>
                      <div className="max-h-40 overflow-y-auto pr-2 grid grid-cols-2 gap-2 custom-scrollbar">
                         {allTimeKeys.map(key => {
                            const year = Math.floor(key / 100);
                            const week = key % 100;
                            const isSelected = compareWeeks.includes(key);
                            return (
                               <button 
                                 key={key}
                                 onClick={() => setCompareWeeks(prev => isSelected ? prev.filter(k => k !== key) : [...prev, key])}
                                 className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-100 hover:bg-slate-50 text-slate-600'}`}
                               >
                                 W{week} '{year.toString().slice(2)}
                                 {isSelected && <Check className="w-3 h-3" />}
                               </button>
                            );
                         })}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'weekly' && renderWeekly()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'channel' && renderChannel()}
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-12 border-t border-slate-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
        <div className="flex items-center gap-4">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">MMP Cross-Engine v4.2 | Absolute Parity Active</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Connect</span>
        </div>
      </footer>
    </div>
  );
}
