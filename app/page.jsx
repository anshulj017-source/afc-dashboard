"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties, Key
} from 'lucide-react';

// === DATA CONFIG ===
const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";
const STC_LOGO_URL = "https://www.stc.com.sa/content/stc/sa/en/about-stc/brand-center/_jcr_content/root/responsivegrid/responsivegrid_1120/responsivegrid_1694/image.coreimg.svg/1676451639800/stc-logo.svg";

// === HELPERS ===
const normalizeMarket = (name) => {
  if (!name || name === 'BLANK') return 'Other';
  const aliases = { 'KWT':'Kuwait', 'KW':'Kuwait', 'KSA':'Saudi Arabia', 'SAU':'Saudi Arabia', 'UAE':'United Arab Emirates', 'ARE':'United Arab Emirates', 'QAT':'Qatar', 'BHR':'Bahrain', 'OMN':'Oman', 'EGY':'Egypt', 'UK':'United Kingdom', 'US':'United States', 'ID':'Indonesia', 'IDN':'Indonesia' };
  return aliases[name.trim().toUpperCase()] || name.trim();
};
const parseMetric = (val) => parseFloat(val?.toString().replace(/,/g, '').trim()) || 0;

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarketView, setSelectedMarketView] = useState('All');
  const [trafficFilter, setTrafficFilter] = useState('All');

  useEffect(() => {
    Promise.all([d3.csv(COMBINED_COUNTRY_CSV_URL), d3.csv(RAW_ADJUST_CSV_URL)])
      .then(([ad, mmp]) => {
        const s1 = ad.map(r => ({ cost: parseMetric(r['Cost']), impressions: parseMetric(r['Impression']), clicks: parseMetric(r['Clicks']), installs: 0, purchases: 0, logins: 0, week: parseInt(r['Week'])||0, year: parseInt(r['Year'])||0, market: normalizeMarket(r['Country']), channel: r['Channel'] || 'Other', trafficType: 'Paid' }));
        const s2 = mmp.map(r => {
          const vals = Object.values(r);
          return { cost: 0, impressions: 0, clicks: 0, installs: parseMetric(r['Installs']), purchases: parseMetric(vals[7]), logins: parseMetric(vals[8]), week: parseInt(r['Week'])||0, year: parseInt(r['Year'])||0, market: normalizeMarket(r['Country']), channel: r['Network'] || 'Other', trafficType: (r['Classification']||'').toLowerCase().includes('organic') ? 'Organic' : 'Paid' };
        });
        setData([...s1, ...s2]);
        setLoading(false);
      });
  }, []);

  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.cost), installs = d3.sum(rows, d => d.installs), purchases = d3.sum(rows, d => d.purchases), logins = d3.sum(rows, d => d.logins);
    return { cost, installs, purchases, logins, cpi: installs > 0 ? cost/installs : 0, cpp: purchases > 0 ? cost/purchases : 0, ltr: installs > 0 ? (logins/installs)*100 : 0, ltp: logins > 0 ? (purchases/logins)*100 : 0 };
  };

  const filtered = data.filter(d => trafficFilter === 'All' || d.trafficType === trafficFilter);
  const metrics = aggregate(filtered);
  const marketBreakdown = d3.groups(filtered, d => d.market).map(([name, v]) => ({ name, ...aggregate(v) })).filter(m => m.cost >= 1).sort((a,b) => b.cost - a.cost);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-white px-8 py-4 shadow-sm mb-8">
        <img src={STC_LOGO_URL} alt="STC" className="h-10" />
        <nav className="flex gap-6">
           {[ {id:'summary', label:'Summary'}, {id:'market', label:'Markets'}, {id:'channel', label:'Channels'}, {id:'detailed', label:'Detailed Data'} ].map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id)} className={`font-black uppercase text-xs ${activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</button>
           ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-6">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-5 gap-4">
            <MetricCard label="Ad Spend" value={`$${d3.format(",.0f")(metrics.cost)}`} icon={DollarSign} color="bg-blue-600" />
            <MetricCard label="Installs" value={d3.format(",.0f")(metrics.installs)} icon={Download} color="bg-emerald-600" />
            <MetricCard label="Purchases" value={d3.format(",.0f")(metrics.purchases)} icon={ShoppingCart} color="bg-fuchsia-600" />
            <MetricCard label="Logins" value={d3.format(",.0f")(metrics.logins)} icon={Key} color="bg-amber-500" />
            <MetricCard label="L-to-P %" value={`${metrics.ltp.toFixed(1)}%`} icon={Target} color="bg-red-500" />
          </div>
        )}
        
        {activeTab === 'detailed' && (
          <div className="bg-white p-8 rounded-[2rem] shadow-sm">
             <div className="flex gap-2 mb-6">
               <button onClick={() => setSelectedMarketView('All')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black">All</button>
               {marketBreakdown.map(m => <button key={m.name} onClick={() => setSelectedMarketView(m.name)} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-black">{m.name}</button>)}
             </div>
             <table className="w-full text-left">
               <thead><tr className="text-[10px] text-slate-400 uppercase"><th className="py-4">Market</th><th className="py-4 text-right">Installs</th><th className="py-4 text-right">Purchases</th></tr></thead>
               <tbody>{marketBreakdown.filter(m => selectedMarketView === 'All' || m.name === selectedMarketView).map((m,i) => <tr key={i} className="border-t text-sm font-bold"><td className="py-4">{m.name}</td><td className="py-4 text-right">{m.installs}</td><td className="py-4 text-right">{m.purchases}</td></tr>)}</tbody>
             </table>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm">
      <div className={`w-8 h-8 rounded-xl ${color} bg-opacity-10 flex items-center justify-center mb-3`}>
        <Icon className={`w-4 h-4 ${color.replace('bg-', 'text-')}`} />
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <h3 className="text-lg font-black text-slate-900">{value}</h3>
    </div>
  );
}
