"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties, Trophy, ArrowRight, FileText
} from 'lucide-react';

const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";

// SSR-Safe Date Parsing
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const getDateFromWeek = (week, year = 2024) => {
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  d.setHours(12, 0, 0, 0); // Noon prevents timezone-based day shifting
  return d;
};
const getMonthFromWeek = (week, year) => MONTHS[getDateFromWeek(week, year).getMonth()];

const formatShort = (num) => {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
  return d3.format(",.0f")(num);
};

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

const normalizeChannel = (channelName) => {
  if (!channelName || channelName === 'BLANK' || channelName === 'Unknown') return 'Other';
  const cleanName = channelName.toString().trim();
  const lowerName = cleanName.toLowerCase();
  if (lowerName.includes('apple')) return 'Apple Search';
  if (lowerName.includes('facebook') || lowerName.includes('meta')) return 'Facebook';
  if (lowerName.includes('google') || lowerName.includes('gmp')) return 'Google';
  if (lowerName.includes('tiktok')) return 'TikTok';
  if (lowerName.includes('snapchat')) return 'Snapchat';
  if (lowerName.includes('twitter') || lowerName === 'x') return 'X';
  return cleanName;
};

const parseWeekType = (val) => {
  if (!val || val === 'BLANK' || val === 'Unknown') return 'BAU';
  const clean = val.toString().toLowerCase().trim();
  if (clean.includes('salary')) return 'Salary Weeks';
  if (clean.includes('bau')) return 'BAU';
  return val.toString().trim() || 'BAU';
};

const parseMetric = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;
};

// --- EXTRACTED STABLE UI COMPONENTS ---
const MetricCard = ({ label, value, color }) => (
  <div className="bg-[#131A2A]/80 backdrop-blur-xl p-6 rounded-[1.5rem] border border-white/5 shadow-xl transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:-translate-y-1 relative overflow-hidden group">
    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-purple-500/10 transition-colors duration-500"></div>
    <p className={`text-[10px] font-black ${color} uppercase tracking-widest mb-2 relative z-10`}>{label}</p>
    <h3 className="text-2xl font-black text-white truncate relative z-10" title={value}>{value}</h3>
  </div>
);

const InsightBox = ({ text }) => (
  <div className="bg-gradient-to-br from-[#2D1B69] to-[#1A0B2E] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-purple-900/20 mb-10 relative overflow-hidden border border-purple-500/30">
    <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-32 h-32 text-purple-300" /></div>
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md"><Zap className="w-4 h-4 text-purple-300" /></div>
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-200">AI Detailed Insight</span>
      </div>
      <div className="text-base font-medium leading-relaxed max-w-5xl text-purple-50">
         {typeof text === 'string' ? `"${text}"` : text}
      </div>
    </div>
  </div>
);

const NavigationBar = ({ items, selected, setSelected, defaultLabel = "Global Overview" }) => (
  <div className="flex gap-3 overflow-x-auto pb-4 mb-8 border-b border-white/5 hide-scrollbar">
    <button onClick={() => setSelected('All')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selected === 'All' ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' : 'bg-[#131A2A] text-slate-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}>{defaultLabel}</button>
    {items.map(item => (
      <button key={item.name} onClick={() => setSelected(item.name)} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selected === item.name ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' : 'bg-[#131A2A] text-slate-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}>{item.name}</button>
    ))}
  </div>
);

const BarChart = ({ chartData, valueKey, labelKey = 'name', color = 'bg-purple-500', isCurrency = false, isPercent = false, onClickItem = null, exSym = '$', exRate = 1 }) => {
  const maxVal = d3.max(chartData, d => d[valueKey]) || 1;
  return (
    <div className="space-y-4">
      {chartData.slice(0, 8).map((item, i) => {
        const valStr = isPercent ? `${item[valueKey].toFixed(2)}%` : isCurrency ? `${exSym}${d3.format(",.0f")(item[valueKey] * exRate)}` : formatShort(item[valueKey]);
        return (
          <div key={i} onClick={() => onClickItem && onClickItem(item[labelKey])} className={`group relative ${onClickItem ? 'cursor-pointer' : ''}`}>
            <div className="flex justify-between items-end mb-1.5">
              <span className={`text-xs font-bold text-white truncate max-w-[150px] ${onClickItem ? 'group-hover:text-purple-300 transition-colors' : ''}`}>{item[labelKey]}</span>
              <span className="text-[10px] font-black text-slate-400 tabular-nums">{valStr}</span>
            </div>
            <div className="h-2.5 bg-[#1e293b] rounded-full overflow-hidden relative">
              <div className={`h-full ${color} rounded-full transition-all duration-1000 group-hover:brightness-125`} style={{ width: `${(item[valueKey] / maxVal) * 100}%` }} />
            </div>
            <div className="absolute -top-10 right-0 bg-[#0f172a] text-white text-[10px] py-1.5 px-3 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-white/10">
              <span className="font-bold text-purple-300">{item[labelKey]}</span> <span className="text-slate-600 mx-1">|</span> {valStr}
              {onClickItem && <span className="ml-2 text-emerald-400 font-bold tracking-widest">CLICK TO DRILL</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const EntityBarChartCard = ({ title, icon: Icon, data, dataKey, color, isCurrency, insight, drillDownType, onDrillDown, exSym, exRate }) => (
  <div className="bg-[#131A2A] p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col h-full hover:border-purple-500/30 transition-colors group">
      <div className="flex items-center gap-3 mb-6">
         <div className={`p-2 rounded-xl bg-white/5`}><Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} /></div>
         <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
      </div>
      <div className="flex-1 mb-6"><BarChart chartData={data} valueKey={dataKey} color={color} isCurrency={isCurrency} onClickItem={drillDownType ? (name) => onDrillDown(drillDownType, name) : null} exSym={exSym} exRate={exRate} /></div>
      <div className="bg-white/5 p-4 rounded-2xl mt-auto border border-white/5 relative overflow-hidden">
         <Zap className={`w-16 h-16 absolute -right-4 -top-4 opacity-5 ${color.replace('bg-', 'text-')} group-hover:scale-110 transition-transform`} />
         <p className="text-xs font-bold text-slate-400 relative z-10">"{insight}"</p>
      </div>
  </div>
);

const DualAxisLineChart = ({ chartData, leftKey, rightKey, leftColorText, rightColorText, leftColorHex, rightColorHex, isLeftCurrency, isRightCurrency, exSym = '$', exRate = 1 }) => {
  if (!chartData || chartData.length < 2) return (
    <div className="h-full w-full min-h-[250px] flex items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">Select multiple periods</div>
  );
  const width = 800; const height = 300;
  const margin = { top: 20, right: 50, bottom: 40, left: 50 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;
  const x = d3.scalePoint().domain(chartData.map(d => `W${d.week}`)).range([0, iw]);
  const yLeft = d3.scaleLinear().domain([0, d3.max(chartData, d => d[leftKey]) * 1.1 || 1]).range([ih, 0]);
  const yRight = d3.scaleLinear().domain([0, d3.max(chartData, d => d[rightKey]) * 1.1 || 1]).range([ih, 0]);
  const lineLeft = d3.line().x(d => x(`W${d.week}`)).y(d => yLeft(d[leftKey])).curve(d3.curveMonotoneX);
  const lineRight = d3.line().x(d => x(`W${d.week}`)).y(d => yRight(d[rightKey])).curve(d3.curveMonotoneX);
  const skipCount = Math.ceil(chartData.length / 10);
  const fmtT = (t, isC) => isC ? `${exSym}${d3.format(".1s")(t * exRate)}` : d3.format(".1s")(t);

  return (
    <div className="flex flex-col h-full w-full relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible min-h-[250px] flex-1">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yLeft.ticks(5).map(t => (
            <g key={`l-${t}`} transform={`translate(0, ${yLeft(t)})`}>
              <line x2={iw} stroke="#1e293b" strokeWidth="1" />
              <text x="-10" dy="0.32em" textAnchor="end" className={`text-[9px] ${leftColorText} font-bold`}>{fmtT(t, isLeftCurrency)}</text>
            </g>
          ))}
          {yRight.ticks(5).map(t => (
             <g key={`r-${t}`} transform={`translate(${iw}, ${yRight(t)})`}>
               <text x="10" dy="0.32em" textAnchor="start" className={`text-[9px] ${rightColorText} font-bold`}>{fmtT(t, isRightCurrency)}</text>
             </g>
          ))}
          <path d={lineLeft(chartData)} fill="none" stroke={leftColorHex} strokeWidth="4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${leftColorHex}60)` }} />
          <path d={lineRight(chartData)} fill="none" stroke={rightColorHex} strokeWidth="4" strokeLinecap="round" strokeDasharray="6,6" style={{ filter: `drop-shadow(0 0 8px ${rightColorHex}60)` }} />
          {chartData.map((d, i) => (
             <g key={`hover-${i}`} className="group cursor-pointer">
               <rect x={x(`W${d.week}`) - 15} y={0} width={30} height={ih} fill="transparent" />
               <line x1={x(`W${d.week}`)} x2={x(`W${d.week}`)} y1={0} y2={ih} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" className="opacity-0 group-hover:opacity-100" />
               <foreignObject x={x(`W${d.week}`) > iw / 2 ? x(`W${d.week}`) - 140 : x(`W${d.week}`) + 10} y={10} width="130" height="90" className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                 <div className="bg-[#0f172a]/90 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl flex flex-col gap-1.5 border border-white/10">
                   <span className="font-black text-slate-300 border-b border-white/10 pb-1.5 mb-0.5">Week {d.week}, {d.year}</span>
                   <div className="flex justify-between"><span className={leftColorText.replace('fill-', 'text-')}>{leftKey.toUpperCase()}:</span> <span>{isLeftCurrency ? `${exSym}${d3.format(",.2f")(d[leftKey] * exRate)}` : d3.format(",.2f")(d[leftKey])}</span></div>
                   <div className="flex justify-between"><span className={rightColorText.replace('fill-', 'text-')}>{rightKey.toUpperCase()}:</span> <span>{isRightCurrency ? `${exSym}${d3.format(",.2f")(d[rightKey] * exRate)}` : d3.format(",.2f")(d[rightKey])}</span></div>
                 </div>
               </foreignObject>
             </g>
          ))}
          {chartData.map((d, i) => ((i % skipCount === 0 || i === chartData.length - 1) && (
            <g key={`x-${i}`} transform={`translate(${x(`W${d.week}`)}, ${ih})`}>
              <text y="24" textAnchor="middle" className="text-[10px] fill-slate-500 font-black">W{d.week}</text>
            </g>
          )))}
        </g>
      </svg>
    </div>
  );
};


// === MAIN APPLICATION ===
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarketView, setSelectedMarketView] = useState('All');
  const [selectedChannelView, setSelectedChannelView] = useState('All');
  const [selectedDetailedChannel, setSelectedDetailedChannel] = useState('All');
  
  const [selectedWeekTypeView, setSelectedWeekTypeView] = useState('');
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [compareWeeks, setCompareWeeks] = useState([]); 
  const [trafficFilter, setTrafficFilter] = useState('All'); 

  const [currency, setCurrency] = useState('USD');
  const [kpi, setKpi] = useState({ isOpen: false, isSet: false, budget: '', impressions: '', installs: '' });

  const [reportModal, setReportModal] = useState({ isOpen: false, start: '', end: '', market: 'All', channel: 'All', traffic: 'All' });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const exRate = currency === 'BHD' ? 0.377 : 1;
  const exSym = currency === 'BHD' ? 'BD ' : '$';
  const formatC = (val, dec = 0) => `${exSym}${d3.format(`,.${dec}f`)(val * exRate)}`;

  useEffect(() => {
    if (isGeneratingPdf) {
      const timer = setTimeout(() => {
        window.print();
        setIsGeneratingPdf(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isGeneratingPdf]);

  useEffect(() => {
    Promise.all([d3.csv(COMBINED_COUNTRY_CSV_URL), d3.csv(RAW_ADJUST_CSV_URL)])
      .then(([adData, mmpData]) => {
        const s1 = adData.map(row => {
          const week = parseInt(row['Week'] || row['week']) || 0;
          const year = parseInt(row['Year'] || row['year']) || 2024;
          const rawS1Channel = Object.values(row)[7] || row['Channel'];
          const rawWeekTypeS1 = Object.values(row)[12] || row['Week Type'];

          return {
            cost: parseMetric(row['Cost'] || row['Spend'] || row['cost']),
            impressions: parseMetric(row['Impression'] || row['Impressions']),
            clicks: parseMetric(row['Clicks'] || row['clicks']),
            installs: 0, logins: 0, purchases: 0,
            week, year, date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Channel Country']),
            channel: (!rawS1Channel || rawS1Channel === 'BLANK') ? 'Other' : normalizeChannel(rawS1Channel),
            weekType: parseWeekType(rawWeekTypeS1),
            source: 'AdNetwork', trafficType: 'Paid' 
          };
        });

        const s2 = mmpData.map(row => {
          const week = parseInt(row['Week'] || row['week'] || row['Wk']) || 0;
          const year = parseInt(row['Year'] || row['year']) || 2024;
          const rawClass = Object.values(row)[11] || row['Classification'] || row['Network classification'] || '';
          const trafficType = rawClass.toString().toLowerCase().includes('organic') ? 'Organic' : 'Paid';
          const purchases = parseMetric(Object.values(row)[7] || row['Purchases'] || row['Total Purchases']);
          const logins = parseMetric(Object.values(row)[8] || row['login_success'] || row['Logins']);
          const rawS2Channel = Object.values(row)[3] || row['Network'] || row['Source'];
          const rawWeekTypeS2 = Object.values(row)[17] || row['Week Type'];

          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install'] || row['Total Installs'] || row['Network Installs']),
            logins, purchases, week, year, date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: (!rawS2Channel || rawS2Channel === 'BLANK' || rawS2Channel === 'Organic') ? 'Other' : normalizeChannel(rawS2Channel),
            weekType: parseWeekType(rawWeekTypeS2),
            source: 'Adjust', trafficType
          };
        });
        
        setData([...s1, ...s2]);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setError("Failed to load data.");
        setLoading(false);
      });
  }, []);

  const { processedData, allTimeKeys } = useMemo(() => {
    if (!data || data.length === 0) return { processedData: [], allTimeKeys: [] };
    const rows = data.map(row => ({
      ...row,
      timeKey: (row.year === 0 || row.week === 0) ? 0 : (row.year * 100 + row.week)
    })).filter(r => r.timeKey > 0);
    const timeKeys = Array.from(new Set(rows.map(d => d.timeKey))).sort((a, b) => a - b);
    return { processedData: rows, allTimeKeys: timeKeys };
  }, [data]);

  const filteredData = useMemo(() => {
    return processedData.filter(d => {
      let passTraffic = true;
      if (trafficFilter !== 'All') passTraffic = d.trafficType === trafficFilter;
      let passTime = true;
      if (compareWeeks.length > 0) {
        passTime = compareWeeks.includes(d.timeKey);
      } else {
        if (dateRange.start) {
          const startDate = new Date(dateRange.start); startDate.setHours(0, 0, 0, 0);
          passTime = passTime && d.date >= startDate;
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end); endDate.setHours(23, 59, 59, 999);
          passTime = passTime && d.date <= endDate;
        }
      }
      return passTraffic && passTime;
    });
  }, [processedData, dateRange, compareWeeks, trafficFilter]);

  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.cost), impressions = d3.sum(rows, d => d.impressions);
    const clicks = d3.sum(rows, d => d.clicks), installs = d3.sum(rows, d => d.installs);
    const logins = d3.sum(rows, d => d.logins), purchases = d3.sum(rows, d => d.purchases);
    return {
      cost, impressions, clicks, installs, logins, purchases,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
      cpi: installs > 0 ? cost / installs : 0,
      cpp: purchases > 0 ? cost / purchases : 0,
      cvr: clicks > 0 ? (installs / clicks) * 100 : 0,
      ltr: installs > 0 ? (logins / installs) * 100 : 0,
      ltp: logins > 0 ? (purchases / logins) * 100 : 0
    };
  };

  const metrics = useMemo(() => aggregate(filteredData), [filteredData]);
  const weeklyTimeline = useMemo(() => d3.groups(filteredData, d => d.timeKey).map(([key, values]) => ({ timeKey: key, week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a, b) => a.timeKey - b.timeKey), [filteredData]);
  const marketBreakdown = useMemo(() => d3.groups(filteredData, d => d.market).map(([name, values]) => ({ name, ...aggregate(values) })).filter(m => m.cost >= 1 || m.purchases >= 1).sort((a, b) => b.cost - a.cost), [filteredData]);
  const channelBreakdown = useMemo(() => d3.groups(filteredData, d => d.channel).map(([name, values]) => ({ name, ...aggregate(values) })).filter(m => m.cost >= 1 || m.purchases >= 1).sort((a, b) => b.cost - a.cost), [filteredData]);

  const handleDrillDown = (type, value) => {
    setActiveTab('detailed');
    if (type === 'market') {
      setSelectedMarketView(value);
      setSelectedDetailedChannel('All');
    } else if (type === 'channel') {
      setSelectedDetailedChannel(value);
      setSelectedMarketView('All');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getAIInsight = (context, activeData = null, marketFilteredData = null, selectedType = 'All Weeks') => {
    if (filteredData.length === 0) return "No data available for the current selection.";
    
    if (context === 'detailed') {
      if (!selectedType) return ""; 
      if (!activeData || activeData.length === 0) return "Analyzing single week data. Select a broader date range or market view to see progression trends over time.";
      
      const computeStats = (dataArray) => {
        const tImps = d3.sum(dataArray, d => d.impressions), tClicks = d3.sum(dataArray, d => d.clicks);
        const tInstalls = d3.sum(dataArray, d => d.installs), tLogins = d3.sum(dataArray, d => d.logins);
        const tPurchases = d3.sum(dataArray, d => d.purchases), tCost = d3.sum(dataArray, d => d.cost);
        return { tImps, tClicks, tInstalls, tLogins, tPurchases, tCost, avgCpi: tInstalls > 0 ? tCost/tInstalls : 0, avgCpp: tPurchases > 0 ? tCost/tPurchases : 0 };
      };

      if (selectedType === 'Salary Weeks' || selectedType === 'BAU') {
        const stats = computeStats(marketFilteredData.filter(d => d.weekType === selectedType));
        return (
          <div className="space-y-4 text-sm text-purple-50">
             <div>
                <strong className="text-white text-base">Performance Overview ({selectedType}):</strong>
                <ul className="list-none mt-3 space-y-1.5 bg-white/5 p-5 rounded-xl border border-white/10">
                  <li><strong>Ad Spend:</strong> {formatC(stats.tCost)}</li>
                  <li><strong>Impressions:</strong> {formatShort(stats.tImps)}</li>
                  <li><strong>Clicks:</strong> {formatShort(stats.tClicks)}</li>
                  <li><strong>Installs:</strong> {d3.format(",.0f")(stats.tInstalls)}</li>
                  <li><strong>Purchases:</strong> {d3.format(",.0f")(stats.tPurchases)}</li>
                </ul>
             </div>
             <p className="mt-4"><strong className="text-white">Efficiency Metrics:</strong> The average Cost Per Install (CPI) settled at <span className="text-amber-300 font-bold">{formatC(stats.avgCpi, 2)}</span>, with a Cost Per Purchase (CPP) of <span className="text-red-400 font-bold">{formatC(stats.avgCpp, 2)}</span>.</p>
             <p><strong className="text-white">Action Plan:</strong> {selectedType === 'Salary Weeks' ? 'Consumer purchasing power is at its peak. Maximize daily budget caps, increase bids on high-intent keywords, and prioritize aggressive retargeting to capture immediate conversions.' : 'Focus on top-funnel acquisition and brand awareness. Maintain strict CPP limits, optimize creative assets, and build retargeting pools for the next salary cycle.'}</p>
          </div>
        );
      } else {
        const sStats = computeStats(marketFilteredData.filter(d => d.weekType === 'Salary Weeks'));
        const bStats = computeStats(marketFilteredData.filter(d => d.weekType === 'BAU'));
        const cppDiff = bStats.avgCpp > 0 ? ((sStats.avgCpp - bStats.avgCpp) / bStats.avgCpp) * 100 : 0;
        const volDiff = bStats.tPurchases > 0 ? ((sStats.tPurchases - bStats.tPurchases) / bStats.tPurchases) * 100 : 0;

        return (
          <div className="space-y-4 text-sm text-purple-50">
             <strong className="text-white text-base">Comparison Analysis (Salary vs BAU):</strong>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                   <p className="font-bold text-white mb-3 border-b border-white/10 pb-2">Salary Weeks</p>
                   <ul className="space-y-1.5">
                     <li><strong>Spend:</strong> {formatC(sStats.tCost)}</li>
                     <li><strong>Installs:</strong> {d3.format(",.0f")(sStats.tInstalls)}</li>
                     <li><strong>Purchases:</strong> {d3.format(",.0f")(sStats.tPurchases)}</li>
                   </ul>
                   <div className="mt-4 pt-3 border-t border-white/10 text-xs">
                      <span className="text-amber-300 font-bold">{formatC(sStats.avgCpi, 2)} CPI</span> <span className="mx-2">|</span> <span className="text-red-400 font-bold">{formatC(sStats.avgCpp, 2)} CPP</span>
                   </div>
                </div>
                <div className="bg-white/5 p-5 rounded-xl border border-white/10">
                   <p className="font-bold text-white mb-3 border-b border-white/10 pb-2">BAU Periods</p>
                   <ul className="space-y-1.5">
                     <li><strong>Spend:</strong> {formatC(bStats.tCost)}</li>
                     <li><strong>Installs:</strong> {d3.format(",.0f")(bStats.tInstalls)}</li>
                     <li><strong>Purchases:</strong> {d3.format(",.0f")(bStats.tPurchases)}</li>
                   </ul>
                   <div className="mt-4 pt-3 border-t border-white/10 text-xs">
                      <span className="text-amber-300 font-bold">{formatC(bStats.avgCpi, 2)} CPI</span> <span className="mx-2">|</span> <span className="text-red-400 font-bold">{formatC(bStats.avgCpp, 2)} CPP</span>
                   </div>
                </div>
             </div>
             <p className="mt-4"><strong className="text-white">Observation:</strong> Salary week CPP is {cppDiff > 0 ? `${cppDiff.toFixed(1)}% higher` : `${Math.abs(cppDiff).toFixed(1)}% lower`} than BAU periods, with purchase volume shifting by {volDiff > 0 ? '+' : ''}{volDiff.toFixed(1)}%.</p>
             <p><strong className="text-white">Action Plan:</strong> Implement a pulsing budget strategy. Allocate ~65% of monthly budgets to Salary Weeks to capture high-intent users, while pacing BAU spend to focus on low-cost installs and audience building.</p>
          </div>
        );
      }
    }
    return "";
  };

  const renderPrintableReport = () => {
    const pData = processedData.filter(d => {
       let passT = reportModal.traffic === 'All' ? true : d.trafficType === reportModal.traffic;
       let passM = reportModal.market === 'All' ? true : d.market === reportModal.market;
       let passC = reportModal.channel === 'All' ? true : d.channel === reportModal.channel;
       let passTime = true;
       if (reportModal.start) { const sd = new Date(reportModal.start); sd.setHours(0,0,0,0); passTime = passTime && d.date >= sd; }
       if (reportModal.end) { const ed = new Date(reportModal.end); ed.setHours(23,59,59,999); passTime = passTime && d.date <= ed; }
       return passT && passM && passC && passTime;
    });

    const reportMetrics = aggregate(pData);
    const reportTimeline = d3.groups(pData, d => d.timeKey).map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a,b) => a.week - b.week);

    const ltr = reportMetrics.installs > 0 ? ((reportMetrics.logins / reportMetrics.installs) * 100).toFixed(1) : 0;
    const ltp = reportMetrics.logins > 0 ? ((reportMetrics.purchases / reportMetrics.logins) * 100).toFixed(1) : 0;
    const cvr = reportMetrics.installs > 0 ? ((reportMetrics.purchases / reportMetrics.installs) * 100).toFixed(1) : 0;

    let advancedInsight = "";
    let actionPlan = "";
    
    if (reportTimeline.length > 1) {
        const sortedByCPP = [...reportTimeline].filter(w => w.purchases > 0).sort((a,b)=>a.cpp-b.cpp);
        const bestWeek = sortedByCPP[0];
        const worstWeek = sortedByCPP[sortedByCPP.length - 1];
        
        advancedInsight = `Over the selected period, a total investment of ${formatC(reportMetrics.cost)} yielded ${d3.format(",.0f")(reportMetrics.purchases)} verified purchases. The funnel demonstrates a ${ltr}% Install-to-Login rate and a strong ${ltp}% Login-to-Purchase conversion rate (a ${cvr}% overall install-to-purchase conversion rate). Performance peaked during Week ${bestWeek?.week} ('${bestWeek?.year}'), which delivered the most cost-effective conversions at ${formatC(bestWeek?.cpp, 2)} CPP. Conversely, Week ${worstWeek?.week} experienced the highest acquisition costs at ${formatC(worstWeek?.cpp, 2)} CPP.`;

        actionPlan = `The blended Cost Per Purchase (CPP) stabilized at ${formatC(reportMetrics.cpp, 2)} alongside an average CPI of ${formatC(reportMetrics.cpi, 2)}. Based on these trends, optimizing ad placements toward the performance patterns of Week ${bestWeek?.week} could yield significant efficiency gains. Re-allocating 15-20% of the budget from lower-converting demographic sets toward this specific market/channel combination during peak 'Salary Week' periods will further suppress this CPP while scaling overall volume. Monitor the drop-off between clicks (${formatShort(reportMetrics.clicks)}) and installs (${formatShort(reportMetrics.installs)}) to identify potential landing page friction.`;
    } else {
        advancedInsight = `Over the selected period, a total investment of ${formatC(reportMetrics.cost)} yielded ${d3.format(",.0f")(reportMetrics.purchases)} verified purchases. The funnel demonstrates a ${ltr}% Install-to-Login rate and a strong ${ltp}% Login-to-Purchase conversion rate.`;
        
        actionPlan = `The blended Cost Per Purchase (CPP) stands at ${formatC(reportMetrics.cpp, 2)}. With ${formatShort(reportMetrics.impressions)} impressions generated, focus on retargeting strategies to push more users through the funnel from login to purchase. Expanding the date range of this report will unlock deeper trend analyses and predictive pacing insights.`;
    }

    return (
      <div className="bg-white text-slate-900 min-h-screen p-10 w-[1000px] mx-auto print-only relative z-[99999]">
         <div className="flex justify-between items-end border-b-2 border-slate-200 pb-6 mb-8">
            <div>
               <h1 className="text-4xl font-black tracking-tighter text-slate-900">ROVA PERFORMANCE</h1>
               <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Detailed Intelligence Report</p>
            </div>
            <div className="text-right">
               <p className="text-xs font-bold text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
               <div className="mt-2 text-xs font-bold text-slate-700 space-y-1">
                 <p>Market: <span className="text-indigo-600">{reportModal.market}</span></p>
                 <p>Channel: <span className="text-indigo-600">{reportModal.channel}</span></p>
                 <p>Traffic: <span className="text-indigo-600">{reportModal.traffic}</span></p>
                 <p>Dates: <span className="text-indigo-600">{reportModal.start || 'All Time'} to {reportModal.end || 'All Time'}</span></p>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ad Spend</p><h3 className="text-xl font-black text-slate-900">{formatC(reportMetrics.cost)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impressions</p><h3 className="text-xl font-black text-slate-900">{formatShort(reportMetrics.impressions)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clicks</p><h3 className="text-xl font-black text-slate-900">{formatShort(reportMetrics.clicks)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Installs</p><h3 className="text-xl font-black text-slate-900">{formatShort(reportMetrics.installs)}</h3></div>
         </div>
         <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Logins</p><h3 className="text-xl font-black text-slate-900">{formatShort(reportMetrics.logins)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Purchases</p><h3 className="text-xl font-black text-slate-900">{formatShort(reportMetrics.purchases)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CPI</p><h3 className="text-xl font-black text-amber-500">{formatC(reportMetrics.cpi, 2)}</h3></div>
            <div className="p-4 border border-slate-200 rounded-2xl"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CPP</p><h3 className="text-xl font-black text-red-500">{formatC(reportMetrics.cpp, 2)}</h3></div>
         </div>

         <div className="grid grid-cols-2 gap-8 mb-8">
           <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Volume Trend (Installs vs Purchases)</h4>
              <div className="h-[250px]"><DualAxisLineChart chartData={reportTimeline} leftKey="installs" rightKey="purchases" leftColorText="fill-emerald-600" rightColorText="fill-rose-600" leftColorHex="#10b981" rightColorHex="#f43f5e" isLeftCurrency={false} isRightCurrency={false} exSym={exSym} exRate={exRate} /></div>
           </div>
           <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Efficiency Trend (CPI vs CPP)</h4>
              <div className="h-[250px]"><DualAxisLineChart chartData={reportTimeline} leftKey="cpi" rightKey="cpp" leftColorText="fill-amber-600" rightColorText="fill-red-600" leftColorHex="#f59e0b" rightColorHex="#ef4444" isLeftCurrency={true} isRightCurrency={true} exSym={exSym} exRate={exRate} /></div>
           </div>
           <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Awareness (Impressions vs CPM)</h4>
              <div className="h-[250px]"><DualAxisLineChart chartData={reportTimeline} leftKey="impressions" rightKey="cpm" leftColorText="fill-cyan-600" rightColorText="fill-purple-600" leftColorHex="#0891b2" rightColorHex="#9333ea" isLeftCurrency={false} isRightCurrency={true} exSym={exSym} exRate={exRate} /></div>
           </div>
           <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Engagement (Clicks vs CPC)</h4>
              <div className="h-[250px]"><DualAxisLineChart chartData={reportTimeline} leftKey="clicks" rightKey="cpc" leftColorText="fill-blue-600" rightColorText="fill-orange-600" leftColorHex="#2563eb" rightColorHex="#ea580c" isLeftCurrency={false} isRightCurrency={true} exSym={exSym} exRate={exRate} /></div>
           </div>
         </div>

         <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 break-inside-avoid">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500" /> AI Executive Summary & Action Plan</h4>
            <div className="text-sm text-slate-700 space-y-3 font-medium">
               <p>This report isolates performance for <strong>{reportModal.market}</strong> across <strong>{reportModal.channel}</strong> campaigns ({reportModal.traffic} traffic).</p>
               <p>{advancedInsight}</p>
               <p><strong>Strategic Recommendations:</strong> {actionPlan}</p>
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 font-sans selection:bg-purple-500/30 selection:text-purple-100">
      
      {/* REPORT CONFIGURATION MODAL */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 no-print">
           <div className="absolute inset-0 bg-[#0B0F19]/80 backdrop-blur-sm" onClick={() => setReportModal({...reportModal, isOpen: false})}></div>
           <div className="bg-[#131A2A] w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-8 relative z-10 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-xl font-black text-white flex items-center gap-3"><FileText className="text-purple-400 w-6 h-6"/> Report Configuration</h3>
                 <button onClick={() => setReportModal({...reportModal, isOpen: false})} className="text-slate-500 hover:text-white"><Zap className="w-5 h-5 rotate-45"/></button>
              </div>
              <div className="space-y-5">
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Date Range</label>
                    <div className="flex gap-3">
                       <input type="date" value={reportModal.start} onChange={e=>setReportModal({...reportModal, start: e.target.value})} className="w-full text-sm font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 cursor-pointer" />
                       <input type="date" value={reportModal.end} onChange={e=>setReportModal({...reportModal, end: e.target.value})} className="w-full text-sm font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 cursor-pointer" />
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Market Filter</label>
                    <select value={reportModal.market} onChange={e=>setReportModal({...reportModal, market: e.target.value})} className="w-full px-4 py-3 bg-[#0B0F19] border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 cursor-pointer">
                       <option value="All">Global (All Markets)</option>
                       {marketBreakdown.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Channel Filter</label>
                    <select value={reportModal.channel} onChange={e=>setReportModal({...reportModal, channel: e.target.value})} className="w-full px-4 py-3 bg-[#0B0F19] border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 cursor-pointer">
                       <option value="All">All Channels</option>
                       {channelBreakdown.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Traffic Segment</label>
                    <select value={reportModal.traffic} onChange={e=>setReportModal({...reportModal, traffic: e.target.value})} className="w-full px-4 py-3 bg-[#0B0F19] border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 cursor-pointer">
                       <option value="All">Combined (Paid & Organic)</option>
                       <option value="Paid">Paid Only</option>
                       <option value="Organic">Organic Only</option>
                    </select>
                 </div>
              </div>
              <button 
                onClick={() => { setReportModal({...reportModal, isOpen: false}); setIsGeneratingPdf(true); }} 
                className="mt-8 w-full bg-gradient-to-r from-purple-600 to-rose-500 text-white rounded-xl py-4 font-black text-sm shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02]"
              >
                Compile & Download PDF
              </button>
           </div>
        </div>
      )}

      {/* PDF OVERLAY & HIDDEN RENDER */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 bg-[#0B0F19] z-[99998] flex items-center justify-center no-print">
           <div className="flex flex-col items-center gap-4">
             <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
             <p className="text-sm font-bold text-emerald-400 tracking-widest uppercase">Compiling PDF Report...</p>
           </div>
        </div>
      )}

      <div className="print-only">
         {renderPrintableReport()}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print { 
          @page { size: A4; margin: 0; } 
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
          .no-print { display: none !important; } 
          .print-only { display: block !important; } 
        } 
        @media screen { .print-only { display: none !important; } }
      `}} />

      <div className="no-print">
        <header className="sticky top-0 z-[100] bg-[#0B0F19]/80 backdrop-blur-2xl border-b border-white/5 px-6 py-4 shadow-xl">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-white px-3 py-2 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                <span className="text-xl font-black text-[#0B0F19] tracking-tighter">stc</span>
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter text-white leading-none">ROVA PERFORMANCE</h1>
                <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.25em] mt-1.5">Intelligence Dashboard</p>
              </div>
            </div>

            <nav className="flex items-center gap-2 bg-[#131A2A] p-1.5 rounded-2xl border border-white/5 overflow-x-auto hide-scrollbar">
              {[
                { id: 'summary', label: 'Summary', icon: LayoutDashboard },
                { id: 'market', label: 'Markets', icon: Globe },
                { id: 'channel', label: 'Channels', icon: Layers },
                { id: 'detailed', label: 'Detailed Data', icon: TableProperties },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                    activeTab === tab.id 
                    ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <button 
                 onClick={() => setCurrency(c => c === 'USD' ? 'BHD' : 'USD')}
                 className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all font-black text-xs tracking-widest uppercase bg-[#131A2A] border-white/5 text-slate-300 hover:border-purple-500/50 hover:text-white"
              >
                 <DollarSign className="w-4 h-4 text-emerald-400" /> {currency}
              </button>

              <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all font-bold text-sm ${
                    (dateRange.start || compareWeeks.length > 0 || trafficFilter !== 'All')
                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-300' 
                    : 'bg-[#131A2A] border-white/5 text-slate-300 hover:border-purple-500/50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {(dateRange.start || compareWeeks.length > 0 || trafficFilter !== 'All') ? 'Filters Active' : 'Filter Data'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                    <div className="absolute right-0 mt-3 w-96 bg-[#131A2A] rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 p-6 animate-in zoom-in-95 duration-200">
                      <div className="flex justify-between items-center mb-6 px-1 border-b border-white/5 pb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Filters</span>
                        <button onClick={() => { setDateRange({start:'', end:''}); setCompareWeeks([]); setTrafficFilter('All'); }} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300">
                          Reset All
                        </button>
                      </div>
                      
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Users className="w-3 h-3" /> Traffic Segment</h4>
                          <div className="flex bg-[#0B0F19] p-1 rounded-xl border border-white/5">
                            {['All', 'Paid', 'Organic'].map(type => (
                               <button key={type} onClick={() => setTrafficFilter(type)} className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all ${trafficFilter === type ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                                 {type}
                               </button>
                            ))}
                          </div>
                        </div>
                        <div className={compareWeeks.length > 0 ? 'opacity-30 pointer-events-none' : ''}>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><CalendarDays className="w-3 h-3" /> Custom Date Range</h4>
                          <div className="flex gap-2">
                             <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ colorScheme: 'dark' }} className="w-full text-xs font-bold text-slate-200 bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-purple-500 cursor-pointer" />
                             <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ colorScheme: 'dark' }} className="w-full text-xs font-bold text-slate-200 bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-purple-500 cursor-pointer" />
                          </div>
                        </div>
                        <div className={dateRange.start || dateRange.end ? 'opacity-30 pointer-events-none' : ''}>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Compare Specific Weeks</h4>
                          <div className="max-h-40 overflow-y-auto pr-2 grid grid-cols-2 gap-2 custom-scrollbar">
                             {allTimeKeys.map(key => {
                                const year = Math.floor(key / 100);
                                const week = key % 100;
                                const isSelected = compareWeeks.includes(key);
                                return (
                                   <button key={key} onClick={() => setCompareWeeks(prev => isSelected ? prev.filter(k => k !== key) : [...prev, key])} className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${isSelected ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'border-white/5 hover:bg-white/5 text-slate-400 hover:text-white'}`}>
                                     W{week} '{year.toString().slice(2)}
                                     {isSelected && <Check className="w-3 h-3 text-purple-400" />}
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
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-12 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none rounded-full blur-[100px]"></div>
          <div className="relative z-10">
            {activeTab === 'summary' && renderSummary()}
            {activeTab === 'market' && renderMarket()}
            {activeTab === 'channel' && renderChannel()}
            {activeTab === 'detailed' && renderDetailed()}
          </div>
        </main>

        <footer className="max-w-7xl mx-auto px-6 pb-12 border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-4">
            <Info className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">MMP Cross-Engine v4.9 | PDF Report Engine & Stable Component Architecture Active</span>
          </div>
          <div className="flex gap-4 items-center bg-[#131A2A] px-4 py-2 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Secure Connect</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
