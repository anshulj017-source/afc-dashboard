"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties, Key
} from 'lucide-react';

const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";
const STC_LOGO_URL = "https://www.stc.com.sa/content/stc/sa/en/about-stc/brand-center/_jcr_content/root/responsivegrid/responsivegrid_1120/responsivegrid_1694/image.coreimg.svg/1676451639800/stc-logo.svg";

const normalizeMarket = (marketName) => {
  if (!marketName || marketName === 'BLANK' || marketName === 'Unknown') return 'Other';
  const aliases = { 'KWT':'Kuwait', 'KW':'Kuwait', 'KSA':'Saudi Arabia', 'SAU':'Saudi Arabia', 'UAE':'United Arab Emirates', 'ARE':'United Arab Emirates', 'QAT':'Qatar', 'BHR':'Bahrain', 'OMN':'Oman', 'EGY':'Egypt', 'UK':'United Kingdom', 'US':'United States', 'ID':'Indonesia', 'IDN':'Indonesia' };
  return aliases[marketName.toUpperCase()] || marketName.trim();
};

const parseMetric = (val) => parseFloat(val?.toString().replace(/,/g, '').trim()) || 0;

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarketView, setSelectedMarketView] = useState('All');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [trafficFilter, setTrafficFilter] = useState('All'); 

  useEffect(() => {
    Promise.all([d3.csv(COMBINED_COUNTRY_CSV_URL), d3.csv(RAW_ADJUST_CSV_URL)])
      .then(([adData, mmpData]) => {
        const s1 = adData.map(row => ({
          cost: parseMetric(row['Cost'] || row['Spend']), impressions: parseMetric(row['Impression']), clicks: parseMetric(row['Clicks']),
          installs: 0, purchases: 0, logins: 0,
          week: parseInt(row['Week'] || row['week']) || 0, year: parseInt(row['Year'] || row['year']) || 0,
          market: normalizeMarket(row['Country'] || row['Channel Country']), channel: row['Channel'] || 'Other',
          trafficType: 'Paid'
        }));

        const s2 = mmpData.map(row => {
          const rawRow = Object.values(row);
          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install']),
            purchases: parseMetric(rawRow[7] || row['Purchases']), // Column H
            logins: parseMetric(rawRow[8] || row['login_success']), // Column I
            week: parseInt(row['Week'] || row['Wk']) || 0, year: parseInt(row['Year'] || row['Yr']) || 0,
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: row['Network'] || 'Other',
            trafficType: (row['Classification'] || '').toLowerCase().includes('organic') ? 'Organic' : 'Paid'
          };
        });
        setData([...s1, ...s2]);
        setLoading(false);
      });
  }, []);

  const aggregate = (rows) => {
    const sum = (key) => d3.sum(rows, d => d[key]);
    const cost = sum('cost'), clicks = sum('clicks'), installs = sum('installs'), purchases = sum('purchases'), logins = sum('logins');
    return {
      cost, installs, purchases, logins,
      cpi: installs > 0 ? cost / installs : 0,
      cpp: purchases > 0 ? cost / purchases : 0,
      ltr: installs > 0 ? (logins / installs) * 100 : 0,
      ltp: logins > 0 ? (purchases / logins) * 100 : 0
    };
  };

  const metrics = useMemo(() => aggregate(filteredData), [data, trafficFilter]); // simplified for brevity
  const filteredData = data.filter(d => trafficFilter === 'All' || d.trafficType === trafficFilter);
  const weeklyTimeline = useMemo(() => d3.groups(filteredData, d => d.year * 100 + d.week).map(([k, v]) => ({ timeKey: k, week: v[0].week, year: v[0].year, ...aggregate(v) })), [filteredData]);
  const marketBreakdown = useMemo(() => d3.groups(filteredData, d => d.market).map(([name, v]) => ({ name, ...aggregate(v) })).filter(m => m.cost >= 1), [filteredData]);

  // --- RENDER FUNCTIONS ---
  const renderSummary = () => (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard label="Ad Spend" value={`$${d3.format(",.0f")(metrics.cost)}`} icon={DollarSign} color="bg-blue-600" />
      <MetricCard label="Installs" value={d3.format(",.0f")(metrics.installs)} icon={Download} color="bg-emerald-600" />
      <MetricCard label="Purchases" value={d3.format(",.0f")(metrics.purchases)} icon={ShoppingCart} color="bg-fuchsia-600" />
      <MetricCard label="Login Success" value={d3.format(",.0f")(metrics.logins)} icon={Key} color="bg-amber-500" />
      <MetricCard label="Login to Purch %" value={`${metrics.ltp.toFixed(1)}%`} icon={Target} color="bg-red-500" />
    </div>
  );

  const renderDetailed = () => (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] uppercase text-slate-400">
            <th className="py-4">Week</th>
            <th className="py-4 text-right">Installs</th>
            <th className="py-4 text-right">Logins</th>
            <th className="py-4 text-right">Install-to-Login %</th>
            <th className="py-4 text-right">Purchases</th>
            <th className="py-4 text-right">Login-to-Purchase %</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {weeklyTimeline.map((w, i) => (
            <tr key={i} className="text-sm font-bold">
              <td className="py-4">W{w.week}</td>
              <td className="py-4 text-right">{w.installs}</td>
              <td className="py-4 text-right">{w.logins}</td>
              <td className="py-4 text-right">{w.ltr.toFixed(1)}%</td>
              <td className="py-4 text-right">{w.purchases}</td>
              <td className="py-4 text-right">{w.ltp.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="flex items-center justify-between bg-white px-8 py-4 rounded-2xl shadow-sm mb-8">
        <img src={STC_LOGO_URL} alt="STC Logo" className="h-10 w-auto" />
        <nav className="flex gap-4">
           {['summary', 'market', 'channel', 'detailed'].map(tab => (
             <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-black uppercase text-xs ${activeTab === tab ? 'text-indigo-600' : 'text-slate-400'}`}>{tab}</button>
           ))}
        </nav>
      </header>
      <main>
        {activeTab === 'summary' && renderSummary()}
        {activeTab === 'detailed' && renderDetailed()}
        {/* Add renderMarket and renderChannel similar to previous iterations */}
      </main>
    </div>
  );
}
