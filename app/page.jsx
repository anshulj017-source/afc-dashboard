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

// Helper: Standardize Country
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
  const [selectedMarket, setSelectedMarket] = useState('All');

  useEffect(() => {
    Promise.all([d3.csv(COMBINED_COUNTRY_CSV_URL), d3.csv(RAW_ADJUST_SHEET_URL)]).then(([ad, mmp]) => {
      const s1 = ad.map(r => ({ cost: parse(r['Cost']), installs: 0, purchases: 0, logins: 0, market: normalizeMarket(r['Country']), channel: r['Channel'] || 'Other' }));
      const s2 = mmp.map(r => {
        const row = Object.values(r);
        return { cost: 0, installs: parse(r['Installs']), purchases: parse(row[7]), logins: parse(row[8]), market: normalizeMarket(r['Country']), channel: r['Network'] || 'Other' };
      });
      setData([...s1, ...s2]);
      setLoading(false);
    });
  }, []);

  const marketBreakdown = useMemo(() => d3.groups(data, d => d.market)
    .map(([name, v]) => ({ 
      name, 
      installs: d3.sum(v, d=>d.installs), 
      logins: d3.sum(v, d=>d.logins), 
      purchases: d3.sum(v, d=>d.purchases) 
    })), [data]);

  const totals = useMemo(() => {
    const i = d3.sum(data, d=>d.installs);
    const l = d3.sum(data, d=>d.logins);
    const p = d3.sum(data, d=>d.purchases);
    return {
      installs: i,
      logins: l,
      purchases: p,
      ltr: i > 0 ? (l/i)*100 : 0,
      ltp: l > 0 ? (p/l)*100 : 0
    };
  }, [data]);

  if (loading) return <div className="p-20">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <nav className="flex gap-4 mb-8">
        {[ {id:'summary', label:'Summary'}, {id:'market', label:'Markets'}, {id:'channel', label:'Channels'}, {id:'detailed', label:'Detailed Data'} ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-4 py-2 font-black ${activeTab === t.id ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</button>
        ))}
      </nav>

      {activeTab === 'summary' && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-6 bg-white rounded-2xl">Installs: {totals.installs}</div>
          <div className="p-6 bg-white rounded-2xl">Logins: {totals.logins}</div>
          <div className="p-6 bg-white rounded-2xl">Login-to-Purchase %: {totals.ltp.toFixed(1)}%</div>
        </div>
      )}

      {activeTab === 'detailed' && (
        <div className="bg-white p-8 rounded-2xl">
          <table className="w-full">
            <thead><tr><th>Market</th><th>Installs</th><th>Logins</th><th>Purchases</th></tr></thead>
            <tbody>
              {marketBreakdown.map((m,i) => (
                <tr key={i}><td>{m.name}</td><td>{m.installs}</td><td>{m.logins}</td><td>{m.purchases}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
