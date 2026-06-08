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
  BarChart3,
  Download,
  Target,
  ShoppingCart
} from 'lucide-react';

// === YOUR LIVE DATA LINKS ===
const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";

// Helper: Convert Week Number to Month Name 
const getMonthFromWeek = (week, year = 2026) => {
  const date = new Date(year, 0, 1 + (week - 1) * 7);
  return date.toLocaleString('en-US', { month: 'short' });
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
    'US': 'United States', 'USA': 'United States'
  };
  
  return aliases[upperName] || cleanName;
};

// Safe numerical parsing
const parseMetric = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '')) || 0;
};

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('summary');
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedMarketView, setSelectedMarketView] = useState('All'); // Market interactive state

  // --- FETCH LIVE DATA FROM MULTIPLE SHEETS ---
  useEffect(() => {
    Promise.all([
      d3.csv(COMBINED_COUNTRY_CSV_URL),
      d3.csv(RAW_ADJUST_CSV_URL)
    ])
      .then(([adData, mmpData]) => {
        // Map Ad Data
        const s1 = adData.map(row => ({
          cost: parseMetric(row['Cost'] || row['Spend'] || row['cost']),
          impressions: parseMetric(row['Impression'] || row['Impressions'] || row['impressions']),
          clicks: parseMetric(row['Clicks'] || row['clicks']),
          installs: 0, 
          purchases: 0,
          week: parseInt(row['Week'] || row['week'] || row['Wk']) || 0,
          year: parseInt(row['Year'] || row['year'] || row['Yr']) || 0,
          market: normalizeMarket(row['Channel Country']),
          channel: (!row['Channel'] || row['Channel'] === 'BLANK') ? 'Other' : row['Channel'],
          source: 'AdNetwork'
        }));

        // Map Adjust (MMP) Data
        const s2 = mmpData.map(row => ({
          cost: 0, impressions: 0, clicks: 0,
          installs: parseMetric(row['Installs'] || row['Install'] || row['installs'] || row['Network Installs'] || row['Total Installs']),
          purchases: parseMetric(row['Purchases'] || row['Purchase'] || row['Revenue Events'] || row['Events'] || row['Total Purchases']),
          week: parseInt(row['Week'] || row['week'] || row['Wk']) || 0,
          year: parseInt(row['Year'] || row['year'] || row['Yr']) || 0,
          market: normalizeMarket(row['Country'] || row['Geo']),
          channel: (!row['Network'] || row['Network'] === 'BLANK' || row['Network'] === 'Organic' || row['Source'] === 'BLANK') ? 'Other' : (row['Network'] || row['Source']),
          source: 'Adjust'
        }));
        
        setData([...s1, ...s2]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching multi-sheet data:", err);
        setError("Failed to load data. Please ensure both CSV links are correct and published.");
        setLoading(false);
      });
  }, []);

  // --- RESILIENT DATA PROCESSING ---
  const { processedData, allWeeks, allYears } = useMemo(() => {
    if (!data || data.length === 0) return { processedData: [], allWeeks: [], allYears: [] };
    
    const rows = data.map(row => ({
      ...row,
      timeKey: (row.year === 0 || row.week === 0) ? 0 : (row.year * 100 + row.week)
    })).filter(r => r.timeKey > 0);

    const weeks = Array.from(new Set(rows.map(d => d.week))).sort((a, b) => a - b);
    const years = Array.from(new Set(rows.map(d => d.year))).sort((a, b) => a - b);

    return { processedData: rows, allWeeks: weeks, allYears: years };
  }, [data]);

  const filteredData = useMemo(() => {
    if (selectedWeeks.length === 0) return processedData;
    return processedData.filter(d => selectedWeeks.includes(d.week));
  }, [processedData, selectedWeeks]);

  // Aggregation Engine (Combines Spend, Installs, Purchases)
  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.cost);
    const impressions = d3.sum(rows, d => d.impressions);
    const clicks = d3.sum(rows, d => d.clicks);
    const installs = d3.sum(rows, d => d.installs);
    const purchases = d3.sum(rows, d => d.purchases);
    
    return {
      cost,
      impressions,
      clicks,
      installs,
      purchases,
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
      .filter(m => m.cost > 0 || m.installs > 0 || m.purchases > 0) // Ensures Bahrain and others show up
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  const channelBreakdown = useMemo(() => {
    return d3.groups(filteredData, d => d.channel)
      .map(([name, values]) => ({ name, ...aggregate(values) }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);

  // --- AI INSIGHTS ---
  const getAIInsight = (context) => {
    if (filteredData.length === 0) return "No data available for the current selection.";
    
    if (context === 'summary') {
      const topMarket = marketBreakdown[0];
      return `Your overall Cost Per Purchase (CPP) is $${metrics.cpp.toFixed(2)}. ${topMarket?.name || 'Various markets'} led the spend, driving ${d3.format(",.0f")(topMarket?.purchases || 0)} purchases at a $${topMarket?.cpp.toFixed(2)} CPP.`;
    }
    if (context === 'weekly') {
      if (weeklyTimeline.length > 1) {
        const sortedByCPP = [...weeklyTimeline].filter(w => w.purchases > 0).sort((a,b)=>a.cpp-b.cpp);
        return `Peak conversion efficiency occurred in Week ${sortedByCPP[0]?.week} (${getMonthFromWeek(sortedByCPP[0]?.week)}), achieving a low CPP of $${sortedByCPP[0]?.cpp.toFixed(2)}. Total Adjust purchases stand at ${metrics.purchases.toLocaleString()}.`;
      }
      return "Analyzing single week data. Add more weeks to see CPI & CPP progression trends over time.";
    }
    return "";
  };

  // --- COMPONENTS ---
  const MetricCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
      <div className={`w-8 h-8 rounded-xl ${color} bg-opacity-10 flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <h3 className="text-lg font-black text-slate-900 truncate">{value}</h3>
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
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">Funnel Intelligence</span>
        </div>
        <p className="text-xl font-medium leading-relaxed italic max-w-4xl">"{text}"</p>
      </div>
    </div>
  );

  const BarChart = ({ chartData, valueKey, labelKey = 'name', color = 'bg-indigo-500', isCurrency = false, isPercent = false }) => {
    const maxVal = d3.max(chartData, d => d[valueKey]) || 1;
    return (
      <div className="space-y-4">
        {chartData.slice(0, 8).map((item, i) => (
          <div key={i}>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{item[labelKey]}</span>
              <span className="text-[10px] font-black text-slate-400 tabular-nums">
                {isPercent ? `${item[valueKey].toFixed(2)}%` : isCurrency ? `$${d3.format(",.0f")(item[valueKey])}` : d3.format(",.0f")(item[valueKey])}
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

  // Reusable component for market dashboard cards
  const MarketBarChartCard = ({ title, icon: Icon, data, dataKey, color, isCurrency, insight }) => (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col h-full">
        <div className="flex items-center gap-2 mb-6">
           <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
           <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">{title}</h4>
        </div>
        <div className="flex-1 mb-6">
           <BarChart chartData={data} valueKey={dataKey} color={color} isCurrency={isCurrency} />
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl mt-auto border border-slate-100">
           <p className="text-xs font-bold text-slate-600">"{insight}"</p>
        </div>
    </div>
  );

  // Generic Dual Axis Line Chart for dynamic weekly trend plots
  const DualAxisLineChart = ({ chartData, leftKey, rightKey, leftColorText, rightColorText, leftColorHex, rightColorHex, isLeftCurrency, isRightCurrency, width = 800, height = 300 }) => {
    if (!chartData || chartData.length < 2) return (
      <div className="h-full w-full min-h-[250px] flex items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200 text-[10px] font-black text-slate-300 uppercase">Select multiple weeks</div>
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
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible min-h-[250px]">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yLeft.ticks(5).map(t => (
            <g key={`l-${t}`} transform={`translate(0, ${yLeft(t)})`}>
              <line x2={iw} stroke="#f1f5f9" strokeWidth="1" />
              <text x="-10" dy="0.32em" textAnchor="end" className={`text-[9px] ${leftColorText} font-bold`}>
                {isLeftCurrency ? `$${d3.format(".1s")(t)}` : d3.format(".1s")(t)}
              </text>
            </g>
          ))}
          {yRight.ticks(5).map(t => (
             <g key={`r-${t}`} transform={`translate(${iw}, ${yRight(t)})`}>
               <text x="10" dy="0.32em" textAnchor="start" className={`text-[9px] ${rightColorText} font-bold`}>
                 {isRightCurrency ? `$${d3.format(".1s")(t)}` : d3.format(".1s")(t)}
               </text>
             </g>
          ))}
          <path d={lineLeft(chartData)} fill="none" stroke={leftColorHex} strokeWidth="4" strokeLinecap="round" />
          <path d={lineRight(chartData)} fill="none" stroke={rightColorHex} strokeWidth="4" strokeLinecap="round" strokeDasharray="6,6" />
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

  const renderWeekly = () => (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Weekly Funnel Matrix</h2>
        <p className="text-slate-500 font-medium italic">Combining upper-funnel ad data with bottom-funnel adjust conversions.</p>
      </div>
      <InsightBox text={getAIInsight('weekly')} />
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="px-8 py-5">Fiscal Window</th>
                <th className="px-8 py-5 text-right text-indigo-500">Cost</th>
                <th className="px-8 py-5 text-right">Clicks</th>
                <th className="px-8 py-5 text-right text-emerald-500">Installs</th>
                <th className="px-8 py-5 text-right text-fuchsia-500">Purchases</th>
                <th className="px-8 py-5 text-right text-amber-500">CPI</th>
                <th className="px-8 py-5 text-right text-red-500">CPP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {weeklyTimeline.map((w, i) => (
                <tr key={i} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span className="font-black text-slate-800">W{w.week} - {getMonthFromWeek(w.week, w.year)} {w.year}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-mono font-bold text-slate-600">${w.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-8 py-5 text-right font-mono text-slate-400">{w.clicks.toLocaleString()}</td>
                  <td className="px-8 py-5 text-right font-mono font-bold text-emerald-600">{w.installs.toLocaleString()}</td>
                  <td className="px-8 py-5 text-right font-mono font-bold text-fuchsia-600">{w.purchases.toLocaleString()}</td>
                  <td className="px-8 py-5 text-right">
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black">${w.cpi.toFixed(2)}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-[10px] font-black">${w.cpp.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderMarket = () => {
    // Top Performers Logic for Insights
    const sortedByInstalls = [...marketBreakdown].sort((a, b) => b.installs - a.installs);
    const sortedByPurchases = [...marketBreakdown].sort((a, b) => b.purchases - a.purchases);
    
    // For CPI/CPP, lowest is best. Filter out 0s so they don't break the logic.
    const validCPI = [...marketBreakdown].filter(m => m.installs > 0).sort((a, b) => a.cpi - b.cpi);
    const validCPP = [...marketBreakdown].filter(m => m.purchases > 0).sort((a, b) => a.cpp - b.cpp);

    const installInsight = `${sortedByInstalls[0]?.name || 'Top market'} leads acquisition volume with ${sortedByInstalls[0]?.installs.toLocaleString()} installs.`;
    const purchaseInsight = `${sortedByPurchases[0]?.name || 'Top market'} drives the highest bottom-funnel intent with ${sortedByPurchases[0]?.purchases.toLocaleString()} purchases.`;
    const cpiInsight = `${validCPI[0]?.name || 'Top market'} offers the most cost-effective acquisition at $${validCPI[0]?.cpi.toFixed(2)} CPI.`;
    const cppInsight = `${validCPP[0]?.name || 'Top market'} delivers the best conversion ROI at $${validCPP[0]?.cpp.toFixed(2)} CPP.`;

    // Dynamic filtering for specific market selection
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
          <p className="text-slate-500 font-medium italic">Geographical footprint matched with true application acquisition.</p>
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
          /* ALL MARKETS VIEW: 4 GRID DASHBOARD */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <MarketBarChartCard title="Total Installs" icon={Download} data={sortedByInstalls} dataKey="installs" color="bg-emerald-500" insight={installInsight} />
            <MarketBarChartCard title="Total Purchases" icon={ShoppingCart} data={sortedByPurchases} dataKey="purchases" color="bg-fuchsia-500" insight={purchaseInsight} />
            <MarketBarChartCard title="Cost Per Install (CPI)" icon={Activity} data={validCPI.slice(0, 8)} dataKey="cpi" color="bg-amber-500" isCurrency={true} insight={cpiInsight} />
            <MarketBarChartCard title="Cost Per Purchase (CPP)" icon={Target} data={validCPP.slice(0, 8)} dataKey="cpp" color="bg-red-500" isCurrency={true} insight={cppInsight} />
          </div>
        ) : (
          /* SPECIFIC MARKET VIEW: TARGETED TRENDS */
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
                       chartData={activeMarketData} 
                       leftKey="installs" rightKey="purchases" 
                       leftColorText="fill-emerald-300" rightColorText="fill-fuchsia-300"
                       leftColorHex="#10b981" rightColorHex="#d946ef"
                       isLeftCurrency={false} isRightCurrency={false} 
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
                       chartData={activeMarketData} 
                       leftKey="cpi" rightKey="cpp" 
                       leftColorText="fill-amber-300" rightColorText="fill-red-300"
                       leftColorHex="#f59e0b" rightColorHex="#ef4444"
                       isLeftCurrency={true} isRightCurrency={true} 
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
        <p className="text-slate-500 font-medium italic">Marketing platform breakdown and bottom-funnel conversion audits.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Spend vs Installs</h4>
          </div>
          <p className="text-xs text-slate-400 mb-8 font-medium">Dark bar is spend, light bar is resulting MMP installs.</p>
          <div className="space-y-5 mt-4">
             {channelBreakdown.slice(0, 6).map((item, i) => {
                const maxLeft = d3.max(channelBreakdown, d => d.cost) || 1;
                const maxRight = d3.max(channelBreakdown, d => d.installs) || 1;
                return (
                  <div key={i} className="relative">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase mb-1.5">
                      <span className="text-slate-700 truncate max-w-[120px]">{item.name}</span>
                      <div className="flex gap-4">
                        <span>{item.installs > 0 ? `$${item.cpi.toFixed(2)} CPI` : 'N/A'}</span>
                        <span className="text-slate-700">${d3.format(",.0f")(item.cost)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden w-full">
                        <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${(item.cost / maxLeft) * 100}%` }} />
                      </div>
                      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden w-full">
                        <div className="h-full bg-emerald-400 rounded-full transition-all duration-1000 opacity-80" style={{ width: `${(item.installs / maxRight) * 100}%` }} />
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
              <Target className="w-5 h-5 text-amber-500" />
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Efficiency Grid</h4>
            </div>
            <p className="text-xs text-slate-400 mb-8 font-medium">Platform efficiency ranked by Cost Per Purchase (CPP).</p>
          </div>
          <div className="space-y-3">
            {[...channelBreakdown].sort((a,b)=>a.cpp-b.cpp).slice(0, 6).map((c, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
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
                        <span className="text-xs">W{w} <span className="text-slate-400 font-normal">({getMonthFromWeek(w)})</span></span>
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

      <main className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'weekly' && renderWeekly()}
        {activeTab === 'market' && renderMarket()}
        {activeTab === 'channel' && renderChannel()}
      </main>

      <footer className="max-w-7xl mx-auto px-6 pb-12 border-t border-slate-100 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
        <div className="flex items-center gap-4">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">MMP Cross-Engine v4.0</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Data Sync Active</span>
        </div>
      </footer>
    </div>
  );
}
