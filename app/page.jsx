"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, ChevronDown, Search, Check, 
  TableProperties, MonitorPlay, BarChart3, Smartphone, List, Download, RefreshCw, Users, Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { GaChannelTable } from './GaChannelTable';
import AdminView from './AdminView';
import CampaignView from './CampaignView';

const GEO_URL = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

const BASE_URL = "/api/sheets?type=afc";
const CHANNELS = [
  { name: 'TikTok', gid: '0', viewsCol: 9, compCol: 11 }, // J=9, L=11 (approx)
  { name: 'Snapchat', gid: '1220368554', viewsCol: 8, compCol: 10 }, // I=8
  { name: 'Meta', gid: '796244792', viewsCol: 9, compCol: 11 }, // J=9
  { name: 'DV360', gid: '357397097', viewsCol: 9, compCol: 11, subCol: 11 }, // J=9, sub=L(11)
  { name: 'X', gid: '1750570025', viewsCol: 9, compCol: 11 }, // J=9
  { name: 'Google', gid: '1637892512', viewsCol: 6, compCol: 8, subCol: 12 }, // G=6, sub=M(12)
  { name: 'Amazon', gid: '770767992', viewsCol: 10, compCol: 10, subCol: 11 } // K=10, sub=L(11)
];
const GA4_GID = '954158669';

// --- HELPERS ---
const formatShort = (num) => {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return d3.format(",.0f")(num);
};

const parseMetric = (val) => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  return parseFloat(val.toString().replace(/[$,]/g, '').trim()) || 0;
};

const normalizeMarket = (marketName) => {
  if (!marketName || marketName === 'BLANK' || marketName === 'Unknown') return 'Other';
  const cleanName = marketName.trim();
  const upperName = cleanName.toUpperCase();
  const aliases = {
    'AU': 'Australia',
    'MY': 'Malaysia',
    'SG': 'Singapore',
    'ID': 'Indonesia', 'IDN': 'Indonesia',
    'IN': 'India',
    'PH': 'Philippines',
    'TH': 'Thailand',
    'VN': 'Vietnam',
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

// --- COMPONENTS ---
const MetricCard = ({ label, value, color, icon: Icon }) => (
  <div className="bg-[#113A42] p-6 rounded-2xl border border-[#74FA93]/20 shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform">
    <div className="absolute top-0 right-0 w-24 h-24 bg-[#74FA93]/10 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-[#74FA93]/20 transition-colors duration-500"></div>
    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest mb-2">{label}</p>
        <h3 className={`text-2xl font-black ${color} truncate`} title={value}>{value}</h3>
      </div>
    </div>
  </div>
);

const MultiSelect = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const filtered = options.filter(o => o.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative min-w-[120px] z-30">
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
    </div>
  );
};

const DataTable = ({ data, columns, totals }) => (
  <div className="overflow-x-auto bg-[#113A42] rounded-2xl border border-[#74FA93]/20 z-10 relative">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#0C272D] border-b border-[#74FA93]/20">
          {columns.map((col, i) => (
            <th key={i} className="px-6 py-4 text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest whitespace-nowrap">{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b border-[#74FA93]/10 hover:bg-[#74FA93]/5 transition-colors">
            {columns.map((col, j) => (
              <td key={j} className="px-6 py-4 text-sm font-medium text-[#F1EAD8] whitespace-nowrap">
                {col.format ? col.format(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
        {totals && data.length > 0 && (
          <tr className="bg-[#0C272D]/80 border-t-2 border-[#74FA93]/50">
            {columns.map((col, j) => (
              <td key={j} className="px-6 py-4 text-sm font-black text-[#74FA93] whitespace-nowrap">
                {totals[col.key] !== undefined 
                  ? (col.format ? col.format(totals[col.key], totals) : totals[col.key])
                  : ''}
              </td>
            ))}
          </tr>
        )}
        {data.length === 0 && <tr><td colSpan={columns.length} className="px-6 py-8 text-center text-[#CBBB9D] text-sm">No data available</td></tr>}
      </tbody>
    </table>
  </div>
);

// --- MAIN APP ---
export default function App() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [adData, setAdData] = useState([]);
  const [gaData, setGaData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  
  // State: Global Filters
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterCampaigns, setFilterCampaigns] = useState(['All']);
  const [filterMarkets, setFilterMarkets] = useState(['All']);
  const [filterPaidOrganic, setFilterPaidOrganic] = useState(['All']);
  
  // State: Currency
  const [currency, setCurrency] = useState('USD'); // 'USD' or 'SAR'
  const exRate = currency === 'SAR' ? 3.75 : 1;
  const exSym = currency === 'SAR' ? 'SAR ' : '$';
  
  // State: Chart Filters
  const [perfMetric, setPerfMetric] = useState('CPM');
  const [perfSort, setPerfSort] = useState('Top 5');
  const [gaMetric, setGaMetric] = useState('Sessions');
  const [mapMetric, setMapMetric] = useState('Sessions');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().isAdmin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (e) {
          console.error("Error fetching user role", e);
        }
        setIsAuthLoading(false);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchPromises = CHANNELS.map(ch => 
      d3.csv(`${BASE_URL}&gid=${ch.gid}`).then(raw => {
        return raw.map(row => {
          const vals = Object.values(row);
          // Find 'DB' prefixed columns dynamically if they exist, otherwise fallback
          const campDB = row['Campaign DB'] || row['Campaign name'] || row['Campaign Name'] || 'Unknown';
          const phaseDB = row['Phase DB'] || row['Phase'] || 'Unknown';
          const countryDB = normalizeMarket(row['Country DB'] || row['Country'] || 'Unknown');
          const langDB = row['Language DB'] || row['Language'] || 'Unknown';
          
          let finalChannel = ch.name;
          if (ch.subCol !== undefined && vals[ch.subCol] && vals[ch.subCol].trim() !== '') {
            const rawSub = vals[ch.subCol].trim();
            if (rawSub.toLowerCase() === 'youtube') {
              finalChannel = 'Youtube';
            } else {
              finalChannel = rawSub;
            }
          }
          
          let rawCost = parseMetric(row['Cost (USD)'] || row['Cost'] || row['Total cost'] || row['Total media cost'] || row['Spend']);
          if (ch.name === 'X') {
            rawCost = rawCost / 3.75;
          }

          return {
            date: row['Date'],
            dateObj: row['Date'] ? new Date(row['Date']) : null,
            campaignName: campDB,
            phase: phaseDB,
            country: countryDB,
            language: langDB,
            channel: finalChannel,
            adName: row['Ad name'] || row['Ad Name'] || 'Unknown',
            cost: rawCost,
            impressions: parseMetric(row['Impressions']),
            clicks: parseMetric(row['Clicks'] || row['Swipes'] || row['Link clicks'] || row['Click-throughs']),
            videoViews: parseMetric(vals[ch.viewsCol]), // based on user mapping
            videoViews6s: parseMetric(row['6-second video views'] || row['Three-second video views'] || 0),
            videoViews15s: parseMetric(row['15-second video views (focused view)'] || row['ThruPlay actions'] || 0),
            videoCompletions: parseMetric(vals[ch.compCol]) // approx 100% views mapped column
          };
        });
      })
    );

    // Fetch GA4 Data
    const gaPromise = d3.csv(`${BASE_URL}&gid=${GA4_GID}`).then(raw => {
      return raw.map(row => {
        const rawPaid = row['Paid/Organic'] || 'Unknown';
        let paidOrganic = 'Unknown';
        if (rawPaid.toLowerCase() === 'paid') paidOrganic = 'Paid';
        else if (rawPaid.toLowerCase() === 'organic') paidOrganic = 'Organic';
        else paidOrganic = rawPaid;

        return {
          date: row['Date'],
          dateObj: row['Date'] ? new Date(row['Date']) : null,
          sourceMedium: row['Session source / medium'],
          country: normalizeMarket(row['Country']),
          sessions: parseMetric(row['Sessions']),
          users: parseMetric(row['Total users']),
          engagedSessions: parseMetric(row['Engaged sessions']),
          newUsers: parseMetric(row['New users']),
          avgSessionDuration: parseMetric(row['Average session length (sec)']),
          paidOrganic
        };
      });
    });

    Promise.all([...fetchPromises, gaPromise]).then(results => {
      const gaResults = results.pop();
      const combinedAds = results.flat();
      setAdData(combinedAds);
      setGaData(gaResults);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [isAuthenticated]);

  const resetFilters = () => {
    setFilterCampaigns(['All']);
    setFilterMarkets(['All']);
    setFilterPaidOrganic(['All']);
    setDateRange({ start: '', end: '' });
  };

  const uniqueCampaigns = useMemo(() => Array.from(new Set(adData.map(d => d.campaignName))).sort(), [adData]);
  const uniqueMarkets = useMemo(() => {
    const combined = [...adData.map(d => d.country), ...gaData.map(d => d.country)];
    return Array.from(new Set(combined)).filter(Boolean).sort();
  }, [adData, gaData]);
  const uniquePaidOrganic = useMemo(() => Array.from(new Set(gaData.map(d => d.paidOrganic))).sort(), [gaData]);

  // Apply filters to Ad Data
  const filteredAdData = useMemo(() => {
    return adData.filter(d => {
      if (!filterCampaigns.includes('All') && !filterCampaigns.includes(d.campaignName)) return false;
      if (!filterMarkets.includes('All') && !filterMarkets.includes(d.country)) return false;
      if (dateRange.start && d.dateObj && d.dateObj < new Date(dateRange.start)) return false;
      if (dateRange.end && d.dateObj && d.dateObj > new Date(dateRange.end)) return false;
      return true;
    });
  }, [adData, filterCampaigns, filterMarkets, dateRange]);

  // Apply filters to GA Data (only Date and Market apply)
  const filteredGaData = useMemo(() => {
    return gaData.filter(d => {
      if (!filterMarkets.includes('All') && !filterMarkets.includes(d.country)) return false;
      if (!filterPaidOrganic.includes('All') && !filterPaidOrganic.includes(d.paidOrganic)) return false;
      if (dateRange.start && d.dateObj && d.dateObj < new Date(dateRange.start)) return false;
      if (dateRange.end && d.dateObj && d.dateObj > new Date(dateRange.end)) return false;
      return true;
    });
  }, [gaData, filterMarkets, filterPaidOrganic, dateRange]);

  const agg = useMemo(() => {
    const cost = d3.sum(filteredAdData, d => d.cost);
    const impressions = d3.sum(filteredAdData, d => d.impressions);
    const clicks = d3.sum(filteredAdData, d => d.clicks);
    const views = d3.sum(filteredAdData, d => d.videoViews);
    const views6s = d3.sum(filteredAdData, d => d.videoViews6s);
    const views15s = d3.sum(filteredAdData, d => d.videoViews15s);
    const completions = d3.sum(filteredAdData, d => d.videoCompletions);
    const sessions = d3.sum(filteredGaData, d => d.sessions);
    return { cost, impressions, clicks, views, completions, views6s, views15s, sessions };
  }, [filteredAdData, filteredGaData]);

  const gaSourceData = useMemo(() => {
    return Array.from(d3.rollup(filteredGaData, 
      v => ({
        sessions: d3.sum(v, d => d.sessions),
        users: d3.sum(v, d => d.users),
        engagedSessions: d3.sum(v, d => d.engagedSessions),
        newUsers: d3.sum(v, d => d.newUsers),
        avgSessionDuration: d3.mean(v.filter(d => d.sessions > 0), d => d.avgSessionDuration) || 0
      }),
      d => d.sourceMedium
    )).map(([sourceMedium, metrics]) => ({
      sourceMedium,
      ...metrics
    }));
  }, [filteredGaData]);

  // Chart Data preparation
  const monthlyChartData = useMemo(() => {
    const getMonthKey = (dateObj) => {
      if (!dateObj || isNaN(dateObj)) return 'Unknown';
      return dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    
    const validData = filteredAdData.filter(d => d.dateObj && !isNaN(d.dateObj));
    const grouped = d3.groups(validData, d => getMonthKey(d.dateObj));
    
    return grouped.map(([month, vals]) => {
      const sortDate = new Date(vals[0].dateObj.getFullYear(), vals[0].dateObj.getMonth(), 1);
      return {
        month,
        sortDate,
        cost: d3.sum(vals, d => d.cost) * exRate,
        impressions: d3.sum(vals, d => d.impressions)
      };
    }).sort((a,b) => a.sortDate - b.sortDate);
  }, [filteredAdData, exRate]);

  const topCountriesGa = useMemo(() => {
    const grouped = d3.groups(filteredGaData, d => d.country);
    return grouped.map(([country, vals]) => ({
      country,
      sessions: d3.sum(vals, d => d.sessions),
      users: d3.sum(vals, d => d.users),
      engagedSessions: d3.sum(vals, d => d.engagedSessions)
    })).sort((a,b) => {
      if (gaMetric === 'Users') return b.users - a.users;
      if (gaMetric === 'Engaged Sessions') return b.engagedSessions - a.engagedSessions;
      return b.sessions - a.sessions;
    }).slice(0, 10);
  }, [filteredGaData, gaMetric]);

  const channelPerformance = useMemo(() => {
    const grouped = d3.groups(filteredAdData, d => d.channel);
    let data = grouped.map(([channel, vals]) => {
      const totalCost = d3.sum(vals, d => d.cost) * exRate;
      const totalImpressions = d3.sum(vals, d => d.impressions);
      const totalClicks = d3.sum(vals, d => d.clicks);
      return {
        channel,
        cpm: totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0,
        cpc: totalClicks > 0 ? (totalCost / totalClicks) : 0
      };
    });

    const metricKey = perfMetric.toLowerCase();
    
    // Filter out 0s
    data = data.filter(d => d[metricKey] > 0);
    
    // Sort descending (Highest first)
    data.sort((a,b) => b[metricKey] - a[metricKey]);
    
    if (perfSort === 'Top 5') {
      return data.slice(0, 5);
    } else {
      // Bottom 5 (Lowest first, so we take the last 5 and reverse them)
      return data.slice(-5).reverse();
    }
  }, [filteredAdData, exRate, perfMetric, perfSort]);

  const groupBy = (key) => d3.groups(filteredAdData, d => d[key]).map(([name, vals]) => ({
    name,
    cost: d3.sum(vals, d => d.cost),
    impressions: d3.sum(vals, d => d.impressions),
    clicks: d3.sum(vals, d => d.clicks),
    views: d3.sum(vals, d => d.videoViews),
  })).sort((a,b) => b.cost - a.cost);

  const NAV_ITEMS = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'campaign', label: 'Campaign View', icon: Calendar },
    { id: 'channel', label: 'Channel wise', icon: Activity },
    { id: 'market', label: 'Market wise', icon: Globe },
    { id: 'detailed', label: 'Detailed data', icon: TableProperties },
    { id: 'webtraffic', label: 'Web Traffic', icon: MonitorPlay }
  ];

  // Admin button is rendered separately at the bottom left

  const LoadingScreen = ({ message }) => (
    <div className="min-h-screen bg-[#0C272D] flex flex-col items-center justify-center text-[#74FA93] gap-6 relative overflow-hidden">
      
      <div className="relative flex flex-col items-center justify-center animate-pulse">
        <img src="/logo.png" alt="Loading Logo" className="h-24 md:h-32 object-contain" onError={(e) => e.target.style.display = 'none'} />
      </div>
      
      <div className="flex flex-col items-center gap-2 z-10">
        <span className="text-sm md:text-base font-bold text-[#74FA93] tracking-[0.2em]">{message}</span>
        <div className="flex gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#74FA93] animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#74FA93] animate-bounce" style={{ animationDelay: '0.15s' }}></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#74FA93] animate-bounce" style={{ animationDelay: '0.3s' }}></div>
        </div>
      </div>
    </div>
  );

  if (isAuthLoading) return <LoadingScreen message="AUTHENTICATING" />;
  if (loading) return <LoadingScreen message="LOADING DATA" />;

  // Helper for generating totals row for grouped data
  const getTotals = (dataArr, label = 'Total') => {
    if (!dataArr || dataArr.length === 0) return null;
    const tImp = d3.sum(dataArr, d => d.impressions);
    const tClicks = d3.sum(dataArr, d => d.clicks);
    return {
      name: label,
      cost: d3.sum(dataArr, d => d.cost),
      impressions: tImp,
      clicks: tClicks,
      views: d3.sum(dataArr, d => d.views),
      ctr: tImp > 0 ? (tClicks / tImp) * 100 : 0
    };
  };

  const renderContent = () => {
    if (activeTab === 'summary') {
      return (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Total Spend" value={`${exSym}${formatShort(agg.cost * exRate)}`} color="text-white" icon={DollarSign} />
            <MetricCard label="Impressions" value={formatShort(agg.impressions)} color="text-[#74FA93]" icon={Eye} />
            <MetricCard label="Clicks" value={formatShort(agg.clicks)} color="text-[#CBBB9D]" icon={MousePointer2} />
            <MetricCard label="Video Views" value={formatShort(agg.views)} color="text-[#736BED]" icon={MonitorPlay} />
            <MetricCard label="6s Video Views" value={formatShort(agg.views6s)} color="text-[#F1EAD8]" />
            <MetricCard label="15s Video Views" value={formatShort(agg.views15s)} color="text-[#F1EAD8]" />
            <MetricCard label="Video Completions (100%)" value={formatShort(agg.completions)} color="text-white" icon={Check} />
            <MetricCard label="Total Web Sessions" value={formatShort(agg.sessions)} color="text-[#74FA93]" icon={Globe} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
             {/* Chart 1: Monthly Spend vs Impressions */}
             <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl h-[400px]">
                <h3 className="text-[#F1EAD8] font-black mb-4">Monthly Spend vs Impressions</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={monthlyChartData}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#74FA93" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#74FA93" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" stroke="#CBBB9D" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#74FA93" fontSize={10} tickFormatter={(t) => `${exSym}${d3.format(",.2f")(t)}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#CBBB9D" fontSize={10} tickFormatter={(t) => d3.format(",")(t)} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0C272D', borderColor: '#74FA9320', color: '#fff' }} 
                      formatter={(value, name) => [name === 'Spend' ? `${exSym}${d3.format(",.2f")(value)}` : d3.format(",")(value), name]}
                    />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="cost" name="Spend" stroke="#74FA93" fillOpacity={1} fill="url(#colorCost)" />
                    <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#CBBB9D" strokeWidth={3} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
             
             {/* Chart 2: Performance by Channel */}
             <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl h-[400px] flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[#F1EAD8] font-black">{perfMetric} by Channel</h3>
                  <div className="flex gap-2">
                    <div className="flex bg-[#0C272D] p-1 rounded-lg border border-[#74FA93]/20">
                      <button onClick={() => setPerfMetric('CPM')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${perfMetric === 'CPM' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>CPM</button>
                      <button onClick={() => setPerfMetric('CPC')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${perfMetric === 'CPC' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>CPC</button>
                    </div>
                    <div className="flex bg-[#0C272D] p-1 rounded-lg border border-[#74FA93]/20">
                      <button onClick={() => setPerfSort('Top 5')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${perfSort === 'Top 5' ? 'bg-[#736BED] text-white' : 'text-slate-400 hover:text-white'}`}>Top 5</button>
                      <button onClick={() => setPerfSort('Bottom 5')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${perfSort === 'Bottom 5' ? 'bg-[#736BED] text-white' : 'text-slate-400 hover:text-white'}`}>Bottom 5</button>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={channelPerformance} margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="channel" stroke="#CBBB9D" fontSize={10} />
                    <YAxis stroke="#CBBB9D" fontSize={10} tickFormatter={(t) => `${exSym}${d3.format(",.2f")(t)}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0C272D', borderColor: '#74FA9320', color: '#fff' }} 
                      cursor={{fill: '#ffffff10'}} 
                      formatter={(value) => [`${exSym}${d3.format(",.2f")(value)}`, perfMetric]}
                    />
                    <Bar dataKey={perfMetric.toLowerCase()} name={perfMetric} fill="#736BED" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Chart 3: Top Countries Web Traffic (Full Width) */}
          <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl h-[400px] mb-8 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-[#F1EAD8] font-black">Top Countries by Web Traffic</h3>
              <div className="flex bg-[#0C272D] p-1 rounded-lg border border-[#74FA93]/20">
                <button onClick={() => setGaMetric('Sessions')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${gaMetric === 'Sessions' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>Sessions</button>
                <button onClick={() => setGaMetric('Users')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${gaMetric === 'Users' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>Users</button>
                <button onClick={() => setGaMetric('Engaged Sessions')} className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${gaMetric === 'Engaged Sessions' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>Engaged</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={topCountriesGa} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" horizontal={false} />
                <XAxis type="number" stroke="#CBBB9D" fontSize={10} tickFormatter={(t) => d3.format(",")(t)} />
                <YAxis dataKey="country" type="category" stroke="#CBBB9D" fontSize={10} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0C272D', borderColor: '#74FA9320', color: '#fff' }} 
                  cursor={{fill: '#ffffff10'}} 
                  formatter={(value) => [d3.format(",")(value), gaMetric]}
                />
                <Bar dataKey={gaMetric === 'Users' ? 'users' : gaMetric === 'Engaged Sessions' ? 'engagedSessions' : 'sessions'} name={gaMetric} fill="#74FA93" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gradient-to-br from-[#26085C] to-[#0C272D] p-8 rounded-3xl border border-[#74FA93]/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><Zap className="w-32 h-32 text-[#74FA93]" /></div>
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-3"><Zap className="text-[#74FA93] w-6 h-6"/> AI Performance Insights</h3>
            <div className="text-[#F1EAD8] leading-relaxed max-w-4xl space-y-2 relative z-10 font-medium">
              <p>• The top performing channel generated <strong>{formatShort(agg.views)}</strong> total video views.</p>
              <p>• We saw a total of <strong>{formatShort(agg.sessions)}</strong> web sessions based on GA4 data across the selected period.</p>
              <p>• The overall cost per view stands at <strong>{agg.views > 0 ? `${exSym}${((agg.cost * exRate) / agg.views).toFixed(4)}` : `${exSym}0`}</strong>, indicating highly efficient media delivery.</p>
            </div>
          </div>
        </div>
      );
    }
    
    if (activeTab === 'campaign') {
      return (
        <div className="w-full h-full">
          <CampaignView adData={filteredAdData} exRate={exRate} exSym={exSym} formatShort={formatShort} />
        </div>
      );
    }
    
    if (activeTab === 'channel') {
      return (
        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white flex items-center gap-3"><Activity className="text-[#74FA93]" /> Channel Performance</h2>
          <DataTable 
            data={groupBy('channel')} 
            totals={getTotals(groupBy('channel'), 'Total')}
            columns={[
              { key: 'name', label: 'Channel' },
              { key: 'cost', label: 'Spend', format: v => `${exSym}${d3.format(",.2f")(v * exRate)}` },
              { key: 'impressions', label: 'Impressions', format: v => d3.format(",.0f")(v) },
              { key: 'clicks', label: 'Clicks', format: v => d3.format(",.0f")(v) },
              { key: 'views', label: 'Video Views', format: v => d3.format(",.0f")(v) },
              { key: 'ctr', label: 'CTR', format: (v, row) => row.impressions ? `${((row.clicks/row.impressions)*100).toFixed(2)}%` : '0%' }
            ]} 
          />
        </div>
      );
    }

    if (activeTab === 'market') {
      return (
        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white flex items-center gap-3"><Globe className="text-[#74FA93]" /> Market Performance</h2>
          <DataTable 
            data={groupBy('country')} 
            totals={getTotals(groupBy('country'), 'Total')}
            columns={[
              { key: 'name', label: 'Market / Country' },
              { key: 'cost', label: 'Spend', format: v => `${exSym}${d3.format(",.2f")(v * exRate)}` },
              { key: 'impressions', label: 'Impressions', format: v => d3.format(",.0f")(v) },
              { key: 'clicks', label: 'Clicks', format: v => d3.format(",.0f")(v) },
              { key: 'views', label: 'Video Views', format: v => d3.format(",.0f")(v) }
            ]} 
          />
        </div>
      );
    }

    if (activeTab === 'detailed') {
      return (
        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white flex items-center gap-3"><TableProperties className="text-[#74FA93]" /> Raw Ad Data</h2>
          <div className="bg-[#113A42] p-4 rounded-xl border border-[#74FA93]/30 flex justify-between items-center mb-4">
            <span className="text-[#CBBB9D] font-bold text-sm">Showing top 100 rows</span>
          </div>
          <DataTable 
            data={filteredAdData.slice(0, 100)} 
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'campaignName', label: 'Campaign' },
              { key: 'channel', label: 'Channel' },
              { key: 'country', label: 'Country' },
              { key: 'language', label: 'Language' },
              { key: 'cost', label: 'Spend', format: v => `${exSym}${d3.format(",.2f")(v * exRate)}` },
              { key: 'impressions', label: 'Impr.', format: v => d3.format(",.0f")(v) },
              { key: 'clicks', label: 'Clicks', format: v => d3.format(",.0f")(v) }
            ]} 
          />
        </div>
      );
    }

    if (activeTab === 'webtraffic') {
      const totalGaSessions = d3.sum(filteredGaData, d => d.sessions);
      const totalGaUsers = d3.sum(filteredGaData, d => d.users);
      const totalGaEngaged = d3.sum(filteredGaData, d => d.engagedSessions);
      const totalGaNewUsers = d3.sum(filteredGaData, d => d.newUsers);
      
      const gaWithSessions = filteredGaData.filter(d => d.sessions > 0);
      const totalGaMarkets = new Set(gaWithSessions.map(d => d.country)).size;
      
      const avgDuration = gaWithSessions.length > 0 
        ? d3.mean(gaWithSessions, d => d.avgSessionDuration) 
        : 0;

      const mapDataGrouped = d3.groups(filteredGaData, d => d.country).map(([country, vals]) => ({
        country,
        sessions: d3.sum(vals, d => d.sessions),
        users: d3.sum(vals, d => d.users),
        engagedSessions: d3.sum(vals, d => d.engagedSessions)
      }));
      const mapDataDict = Object.fromEntries(mapDataGrouped.map(d => [d.country, d]));
      
      const getMapVal = (d) => {
        if (!d) return 0;
        if (mapMetric === 'Engaged Sessions') return d.engagedSessions;
        if (mapMetric === 'Total Users') return d.users;
        return d.sessions;
      };

      const maxVal = d3.max(mapDataGrouped, getMapVal) || 1;
      const colorScale = d3.scaleSequential(d3.interpolate('#113A42', '#74FA93')).domain([0, maxVal]);

      return (
        <div className="space-y-8">
          <div className="flex justify-between items-center bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl mb-4 flex-wrap gap-4">
            <h2 className="text-2xl font-black text-white flex items-center gap-3"><MonitorPlay className="text-[#74FA93]" /> Web Traffic (GA4)</h2>
            <div className="flex gap-4 items-end">
              <MultiSelect label="Paid / Organic" options={uniquePaidOrganic} selected={filterPaidOrganic} onChange={setFilterPaidOrganic} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Sessions" value={formatShort(totalGaSessions)} icon={Eye} color="text-white" />
            <MetricCard label="Total Markets" value={d3.format(",")(totalGaMarkets)} icon={Globe} color="text-[#74FA93]" />
            <MetricCard label="Engaged Sessions" value={formatShort(totalGaEngaged)} icon={Activity} color="text-[#CBBB9D]" />
            <MetricCard label="New Users" value={formatShort(totalGaNewUsers)} icon={TrendingUp} color="text-white" />
            <MetricCard label="Total Users" value={formatShort(totalGaUsers)} icon={MousePointer2} color="text-[#74FA93]" />
            <MetricCard label="Avg Session (s)" value={d3.format(",.1f")(avgDuration)} icon={List} color="text-[#CBBB9D]" />
          </div>

          <div className="bg-[#113A42] p-6 rounded-3xl border border-[#74FA93]/20 shadow-xl relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-[#F1EAD8] font-black">Global Web Traffic</h3>
              <div className="flex gap-2">
                {['Sessions', 'Engaged Sessions', 'Total Users'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMapMetric(m)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${mapMetric === m ? 'bg-[#74FA93] text-[#0C272D]' : 'bg-[#0C272D] text-[#74FA93] border border-[#74FA93]/30 hover:bg-[#74FA93]/20'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="w-full h-[500px] bg-[#0C272D]/50 rounded-2xl overflow-hidden border border-[#74FA93]/10">
              <ComposableMap projection="geoMercator" projectionConfig={{ scale: 100 }} width={800} height={400}>
                <ZoomableGroup>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryName = geo.properties.name;
                        const normName = normalizeMarket(countryName);
                        const data = mapDataDict[normName];
                        const val = getMapVal(data);
                        const fill = val > 0 ? colorScale(val) : '#1A4D57';
                        
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={fill}
                            stroke="#0C272D"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: 'none' },
                              hover: { fill: '#F1EAD8', outline: 'none', cursor: 'pointer' },
                              pressed: { outline: 'none' },
                            }}
                            data-tooltip-id="map-tooltip"
                            data-tooltip-content={`${countryName}: ${d3.format(",")(val)} ${mapMetric}`}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              <ReactTooltip id="map-tooltip" style={{ backgroundColor: '#0C272D', color: '#74FA93', fontWeight: 'bold' }} />
            </div>
          </div>
          
          <GaChannelTable aggData={gaSourceData} rawData={filteredGaData} formatShort={formatShort} />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0C272D] font-sans selection:bg-[#74FA93]/30 text-white flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#0C272D]/95 backdrop-blur-xl border-b border-[#74FA93]/20 px-8 py-4 flex flex-wrap gap-4 items-center justify-between shadow-2xl relative">
        <div className="absolute inset-0 z-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('/pattern-1.png')", backgroundSize: '100px', backgroundRepeat: 'repeat-x', backgroundPosition: 'center' }}></div>
        <div className="flex items-center gap-4 relative z-10">
          <img src="/logo.png" alt="AFC Logo" className="h-10 object-contain" onError={(e) => e.target.style.display = 'none'} />
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase">Asia Cup 2027 Dashboard</h1>
            <p className="text-[10px] font-black text-[#74FA93] uppercase tracking-[0.2em]">Asia Cup LOC Overview</p>
          </div>
        </div>
        
        <div className="flex gap-3 flex-wrap flex-1 justify-end items-end relative">
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest block">Start Date</span>
             <input type="date" value={dateRange.start} onClick={e => e.target.showPicker && e.target.showPicker()} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="cursor-pointer px-2.5 py-1.5 bg-[#113A42] border border-[#74FA93]/30 rounded-lg text-xs font-bold text-[#F1EAD8] outline-none focus:border-[#74FA93] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50" />
          </div>
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest block">End Date</span>
             <input type="date" value={dateRange.end} onClick={e => e.target.showPicker && e.target.showPicker()} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="cursor-pointer px-2.5 py-1.5 bg-[#113A42] border border-[#74FA93]/30 rounded-lg text-xs font-bold text-[#F1EAD8] outline-none focus:border-[#74FA93] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50" />
          </div>

          { (activeTab !== 'campaign' && activeTab !== 'webtraffic') ? (
            <MultiSelect label="Campaign" options={uniqueCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
          ) : (
            <div className="opacity-30 pointer-events-none" title="Campaign filter is disabled for this view">
              <MultiSelect label="Campaign" options={uniqueCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
            </div>
          )}
          <MultiSelect label="Market" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
          
          <div className="flex items-end gap-3 ml-2">
             <div className="flex flex-col gap-1">
               <span className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest block">Currency</span>
               <div className="flex bg-[#113A42] p-0.5 rounded-lg border border-[#74FA93]/30">
                 <button onClick={() => setCurrency('USD')} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${currency === 'USD' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>USD</button>
                 <button onClick={() => setCurrency('SAR')} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${currency === 'SAR' ? 'bg-[#74FA93] text-[#0C272D]' : 'text-slate-400 hover:text-white'}`}>SAR</button>
               </div>
             </div>
             <button onClick={resetFilters} className="px-3 py-1.5 bg-[#74FA93]/10 border border-[#74FA93]/50 text-[#74FA93] text-[10px] uppercase font-black rounded-lg hover:bg-[#74FA93]/20 hover:text-white transition-colors flex items-center justify-center gap-1"><RefreshCw className="w-3 h-3"/> Reset</button>
             <button onClick={handleSignOut} className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] uppercase font-black rounded-lg hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center justify-center gap-1">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR TABS */}
        <div className="w-64 border-r border-[#74FA93]/10 bg-[#0C272D] flex flex-col gap-2 overflow-y-auto z-20 relative">
          <div className="p-6 pb-2">
            <div className="text-[10px] font-black text-[#CBBB9D] uppercase tracking-widest mb-4 px-4">Navigation</div>
          {NAV_ITEMS.map(t => {
            const active = activeTab === t.id;
            return (
              <button 
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold transition-all ${
                  active ? 'bg-[#74FA93] text-[#0C272D] shadow-[0_0_15px_rgba(116,250,147,0.3)]' : 'text-[#F1EAD8] hover:bg-[#74FA93]/10 hover:text-[#74FA93]'
                }`}
              >
                <t.icon className="w-5 h-5" />
                {t.label}
              </button>
            )
          })}
          </div>
          <div className="flex-1 min-h-[100px] mt-8 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('/pattern-4.png')", backgroundSize: 'contain', backgroundRepeat: 'repeat-y', backgroundPosition: 'center left' }}></div>
          {isAdmin && (
            <div className="mt-auto p-6 pt-0 z-30 bg-[#0C272D]">
              <button 
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold transition-all ${
                  activeTab === 'admin' ? 'bg-[#74FA93] text-[#0C272D] shadow-[0_0_15px_rgba(116,250,147,0.3)]' : 'text-[#F1EAD8] hover:bg-[#74FA93]/10 hover:text-[#74FA93]'
                }`}
              >
                <Users className="w-5 h-5" />
                Admin
              </button>
            </div>
          )}
        </div>
        
        {/* TABS CONTENT */}
        {activeTab === 'admin' ? (
          <AdminView />
        ) : (
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar relative z-10">
          <div className="absolute top-0 right-0 w-full h-[500px] bg-gradient-to-br from-[#26085C]/10 via-[#0C272D] to-[#0C272D] pointer-events-none -z-10"></div>
          <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none -z-10" style={{ backgroundImage: "url('/pattern-3.png')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'right center' }}></div>
          <div className="absolute bottom-0 left-0 w-full h-12 opacity-5 pointer-events-none -z-10" style={{ backgroundImage: "url('/pattern-2.png')", backgroundSize: '200px', backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom' }}></div>
          {renderContent()}
        </main>
        )}
      </div>
    </div>
  );
}
