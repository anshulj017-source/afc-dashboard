"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, Calendar, ChevronDown, Info, Check, 
  BarChart3, Download, Target, ShoppingCart, CalendarDays, Users, TableProperties, Key 
} from 'lucide-react';

// === CONFIGURATION ===
const AD_SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const ADJUST_SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";
const STC_LOGO = "https://www.stc.com.sa/content/stc/sa/en/about-stc/brand-center/_jcr_content/root/responsivegrid/responsivegrid_1120/responsivegrid_1694/image.coreimg.svg/1676451639800/stc-logo.svg";

// === UTILS ===
const normalizeMarket = (n) => {
  if (!n) return 'Other';
  const a = {'KWT':'Kuwait', 'KW':'Kuwait', 'KSA':'Saudi Arabia', 'SAU':'Saudi Arabia', 'UAE':'United Arab Emirates', 'ID':'Indonesia', 'IDN':'Indonesia'};
  return a[n.trim().toUpperCase()] || n.trim();
};
const parse = (v) => parseFloat(v?.toString().replace(/,/g, '')) || 0;

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedMarketView, setSelectedMarketView] = useState('All');

  useEffect(() => {
    Promise.all([d3.csv(AD_SHEET), d3.csv(ADJUST_SHEET)]).then(([ad, mmp]) => {
      const s1 = ad.map(r => ({ cost: parse(r['Cost']), installs: 0, purchases: 0, logins: 0, market: normalizeMarket(r['Country']), channel: r['Channel'] || 'Other' }));
      const s2 = mmp.map(r => {
        const row = Object.values(r);
        return { cost: 0, installs: parse(r['Installs']), purchases: parse(row[7]), logins: parse(row[8]), market: normalizeMarket(r['Country']), channel: r['Network'] || 'Other' };
      });
      setData([...s1, ...s2]);
      setLoading(false);
    });
  }, []);

  const marketData = useMemo(() => d3.groups(data, d => d.market)
    .map(([name, v]) => ({ name, cost: d3.sum(v, d=>d.cost), installs: d3.sum(v, d=>d.installs), purchases: d3.sum(v, d=>d.purchases), logins: d3.sum(v, d=>d.logins) }))
    .filter(m => m.cost >= 1), [data]);

  const renderNav = () => (
    <nav className="flex gap-8">
      {['summary', 'market', 'channel', 'detailed'].map(t => (
        <button key={t} onClick={() => setActiveTab(t)} className={`font-black uppercase text-xs tracking-widest ${activeTab === t ? 'text-indigo-600' : 'text-slate-400'}`}>{t}</button>
      ))}
    </nav>
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen font-black text-slate-400">LOADING DATA...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <header className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm mb-10">
        <img src={STC_LOGO} alt="STC" className="h-10" />
        {renderNav()}
      </header>

      <main>
        {activeTab === 'summary' && (
          <div className="grid grid-cols-4 gap-6 mb-8">
            <StatsCard label="Ad Spend" val={`$${d3.format(",.0f")(d3.sum(data, d=>d.cost))}`} color="bg-blue-600" />
            <StatsCard label="Installs" val={d3.format(",.0f")(d3.sum(data, d=>d.installs))} color="bg-emerald-600" />
            <StatsCard label="Purchases" val={d3.format(",.0f")(d3.sum(data, d=>d.purchases))} color="bg-fuchsia-600" />
            <StatsCard label="Logins" val={d3.format(",.0f")(d3.sum(data, d=>d.logins))} color="bg-amber-500" />
          </div>
        )}

        {activeTab === 'detailed' && (
          <div className="bg-white p-10 rounded-3xl shadow-sm">
            <div className="flex gap-3 mb-8">
              <button onClick={() => setSelectedMarketView('All')} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black">All Markets</button>
              {marketData.map(m => <button key={m.name} onClick={() => setSelectedMarketView(m.name)} className="px-6 py-2 bg-slate-100 rounded-xl text-xs font-black">{m.name}</button>)}
            </div>
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-400 uppercase">
                <tr><th className="py-4">Market</th><th className="py-4 text-right">Installs</th><th className="py-4 text-right">Logins</th><th className="py-4 text-right">Purchases</th></tr>
              </thead>
              <tbody className="divide-y">
                {marketData.filter(m => selectedMarketView === 'All' || m.name === selectedMarketView).map((m, i) => (
                  <tr key={i} className="text-sm font-bold">
                    <td className="py-5">{m.name}</td>
                    <td className="py-5 text-right">{d3.format(",.0f")(m.installs)}</td>
                    <td className="py-5 text-right">{d3.format(",.0f")(m.logins)}</td>
                    <td className="py-5 text-right">{d3.format(",.0f")(m.purchases)}</td>
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

function StatsCard({ label, val, color }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase">{label}</p>
      <h3 className="text-2xl font-black">{val}</h3>
    </div>
  );
}
