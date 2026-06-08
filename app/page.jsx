"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties, Key 
} from 'lucide-react';

// === CONFIGURATION ===
const AD_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const ADJUST_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";
const STC_LOGO = "https://www.stc.com.sa/content/stc/sa/en/about-stc/brand-center/_jcr_content/root/responsivegrid/responsivegrid_1120/responsivegrid_1694/image.coreimg.svg/1676451639800/stc-logo.svg";

// === UTILS ===
const normalizeMarket = (n) => {
  if (!n) return 'Other';
  const a = {'KWT':'Kuwait', 'KW':'Kuwait', 'KSA':'Saudi Arabia', 'SAU':'Saudi Arabia', 'SA':'Saudi Arabia', 'UAE':'United Arab Emirates', 'ID':'Indonesia', 'IDN':'Indonesia'};
  return a[n.trim().toUpperCase()] || n.trim();
};
const parse = (v) => parseFloat(v?.toString().replace(/,/g, '')) || 0;

// === COMPONENTS ===
function MetricCard({ label, val, icon: Icon, color }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-lg">
      <div className={`w-10 h-10 rounded-2xl ${color} bg-opacity-10 flex items-center justify-center mb-4`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <h3 className="text-xl font-black text-slate-900">{val}</h3>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarket, setSelectedMarket] = useState('All');

  useEffect(() => {
    Promise.all([d3.csv(AD_SHEET_URL), d3.csv(ADJUST_SHEET_URL)]).then(([ad, mmp]) => {
      const s1 = ad.map(r => ({ cost: parse(r['Cost']), installs: 0, purchases: 0, logins: 0, market: normalizeMarket(r['Country']), channel: r['Channel'] || 'Other', trafficType: 'Paid' }));
      const s2 = mmp.map(r => {
        const row = Object.values(r);
        return { cost: 0, installs: parse(r['Installs']), purchases: parse(row[7]), logins: parse(row[8]), market: normalizeMarket(r['Country']), channel: r['Network'] || 'Other', trafficType: (r['Classification']||'').includes('Organic') ? 'Organic' : 'Paid' };
      });
      setData([...s1, ...s2]);
      setLoading(false);
    });
  }, []);

  const aggregate = (rows) => {
    const cost = d3.sum(rows, d=>d.cost), installs = d3.sum(rows, d=>d.installs), 
          purchases = d3.sum(rows, d=>d.purchases), logins = d3.sum(rows, d=>d.logins);
    return { cost, installs, purchases, logins, cpi: installs > 0 ? cost/installs : 0, cpp: purchases > 0 ? cost/purchases : 0, ltp: logins > 0 ? (purchases/logins)*100 : 0 };
  };

  const metrics = aggregate(data);
  const marketBreakdown = d3.groups(data, d => d.market)
    .map(([name, v]) => ({ name, ...aggregate(v) }))
    .filter(m => m.cost >= 1);

  if (loading) return <div className="p-20 font-black text-indigo-600 text-center">INITIALIZING DASHBOARD...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="flex justify-between items-center bg-white px-10 py-6 rounded-3xl shadow-sm mb-10">
        <img src={STC_LOGO} alt="STC" className="h-10" />
        <nav className="flex gap-8">
          {[ {id:'summary', label:'Summary'}, {id:'market', label:'Markets'}, {id:'channel', label:'Channels'}, {id:'detailed', label:'Detailed Data'} ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`font-black uppercase text-xs tracking-widest ${activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto">
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <MetricCard label="Ad Spend" val={`$${d3.format(",.0f")(metrics.cost)}`} icon={DollarSign} color="bg-blue-600" />
            <MetricCard label="Installs" val={d3.format(",.0f")(metrics.installs)} icon={Download} color="bg-emerald-600" />
            <MetricCard label="Purchases" val={d3.format(",.0f")(metrics.purchases)} icon={ShoppingCart} color="bg-fuchsia-600" />
            <MetricCard label="Logins" val={d3.format(",.0f")(metrics.logins)} icon={Key} color="bg-amber-500" />
            <MetricCard label="L-to-P %" val={`${metrics.ltp.toFixed(1)}%`} icon={Target} color="bg-red-500" />
          </div>
        )}

        {activeTab === 'detailed' && (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            <h2 className="text-2xl font-black mb-8">Detailed Conversion Data</h2>
            <div className="flex gap-3 mb-8">
              <button onClick={() => setSelectedMarket('All')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">All Markets</button>
              {marketBreakdown.map(m => (
                <button key={m.name} onClick={() => setSelectedMarket(m.name)} className="px-6 py-2 bg-slate-100 rounded-xl text-xs font-black">{m.name}</button>
              ))}
            </div>
            <table className="w-full text-left">
              <thead><tr className="text-[10px] uppercase text-slate-400 border-b"><th className="py-4">Market</th><th className="py-4 text-right">Installs</th><th className="py-4 text-right">Logins</th><th className="py-4 text-right">Purchases</th></tr></thead>
              <tbody>
                {marketBreakdown.filter(m => selectedMarket === 'All' || m.name === selectedMarket).map((m, i) => (
                  <tr key={i} className="border-b text-sm font-bold">
                    <td className="py-6">{m.name}</td>
                    <td className="py-6 text-right">{d3.format(",.0f")(m.installs)}</td>
                    <td className="py-6 text-right">{d3.format(",.0f")(m.logins)}</td>
                    <td className="py-6 text-right">{d3.format(",.0f")(m.purchases)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
