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

// Helper: Convert Week Number to Approximate Date (Safely bounded)
const getDateFromWeek = (week, year = 2024) => {
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  d.setHours(0, 0, 0, 0); // Normalize to local midnight
  return d;
};

const getMonthFromWeek = (week, year) => {
  return getDateFromWeek(week, year).toLocaleString('en-US', { month: 'short' });
};

// Helper: Standardize Country Abbreviations
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

// Helper: Standardize Channel Names
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
  const [selectedChannelView, setSelectedChannelView] = useState('All');
  
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
          const year = parseInt(row['Year'] || row['year']) || 2024; // Default to 2024 if missing
          
          const rawS1Channel = Object.values(row)[7] || row['Channel'];

          return {
            cost: parseMetric(row['Cost'] || row['Spend'] || row['cost']),
            impressions: parseMetric(row['Impression'] || row['Impressions']),
            clicks: parseMetric(row['Clicks'] || row['clicks']),
            installs: 0, 
            logins: 0,
            purchases: 0,
            week, year,
            date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Channel Country']),
            channel: (!rawS1Channel || rawS1Channel === 'BLANK') ? 'Other' : normalizeChannel(rawS1Channel),
            source: 'AdNetwork',
            trafficType: 'Paid' 
          };
        });

        const s2 = mmpData.map(row => {
          const week = parseInt(row['Week'] || row['week'] || row['Wk']) || 0;
          const year = parseInt(row['Year'] || row['year'] || row['Yr']) || 2024; // Default to 2024 if missing
          
          const rawClass = Object.values(row)[11] || row['Classification'] || row['Network classification'] || '';
          const trafficType = rawClass.toString().toLowerCase().includes('organic') ? 'Organic' : 'Paid';

          const purchases = parseMetric(Object.values(row)[7] || row['Purchases'] || row['Total Purchases']);
          const logins = parseMetric(Object.values(row)[8] || row['login_success'] || row['Logins']);
          
          const rawS2Channel = Object.values(row)[3] || row['Network'] || row['Source'];

          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install'] || row['Total Installs'] || row['Network Installs']),
            logins,
            purchases,
            week, year,
            date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: (!rawS2Channel || rawS2Channel === 'BLANK' || rawS2Channel === 'Organic') ? 'Other' : normalizeChannel(rawS2Channel),
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

  // Master Filter Engine (Updated for precision date filtering)
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
        if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          startDate.setHours(0, 0, 0, 0);
          passTime = passTime && d.date >= startDate;
        }
        if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          passTime = passTime && d.date <= endDate;
        }
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
    const logins = d3.sum(rows, d => d.logins);
    const purchases = d3.sum(rows, d => d.purchases);
    
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
      .filter(m => m.cost >= 1 || m.purchases >= 1)
      .sort((a, b) => b.cost - a.cost);
  }, [filteredData]);


  // --- DYNAMIC AI INSIGHTS ---
  const getAIInsight = (context, activeData = null) => {
    if (filteredData.length === 0) return "No data available for the current selection.";
    
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

  // --- UI COMPONENTS ---
  const MetricCard = ({ label, value, color }) => (
    <div className="bg-[#131A2A]/80 backdrop-blur-xl p-6 rounded-[1.5rem] border border-white/5 shadow-xl transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:-translate-y-1 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-purple-500/10 transition-colors duration-500"></div>
      <p className={`text-[10px] font-black ${color} uppercase tracking-widest mb-2 relative z-10`}>{label}</p>
      <h3 className="text-2xl font-black text-white truncate relative z-10" title={value}>{value}</h3>
    </div>
  );

  const InsightBox = ({ text }) => (
    <div className="bg-gradient-to-br from-[#2D1B69] to-[#1A0B2E] rounded-[2.5rem] p-8 text-white shadow-2xl shadow-purple-900/20 mb-10 relative overflow-hidden border border-purple-500/30">
      <div className="absolute top-0 right-0 p-8 opacity-10">
        <Zap className="w-32 h-32 text-purple-300" />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
            <Zap className="w-4 h-4 text-purple-300" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-200">AI Funnel Insight</span>
        </div>
        <p className="text-xl font-medium leading-relaxed italic max-w-4xl text-purple-50">"{text}"</p>
      </div>
    </div>
  );

  const MarketNavigator = () => (
    <div className="flex gap-3 overflow-x-auto pb-4 mb-8 border-b border-white/5 hide-scrollbar">
      <button 
        onClick={() => setSelectedMarketView('All')} 
        className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedMarketView === 'All' ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' : 'bg-[#131A2A] text-slate-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}
      >
        Global Overview
      </button>
      {marketBreakdown.map(m => (
        <button 
          key={m.name} 
          onClick={() => setSelectedMarketView(m.name)} 
          className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedMarketView === m.name ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' : 'bg-[#131A2A] text
