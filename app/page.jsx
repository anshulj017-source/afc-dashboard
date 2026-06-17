"use client";
import React, { useState, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { UserButton, SignedIn, SignedOut, SignIn } from "@clerk/nextjs"; 
import { 
  TrendingUp, Globe, Layers, Filter, Activity, DollarSign, MousePointer2, 
  Eye, Zap, LayoutDashboard, CalendarDays, ChevronDown, Info, Check, 
  Download, Target, ShoppingCart, Users, TableProperties, Trophy, ArrowRight, FileText, Megaphone
} from 'lucide-react';

const COMBINED_COUNTRY_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=1273221446&single=true&output=csv";
const RAW_ADJUST_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSt_K4Y6h2g2iVm2CDrc33rQGDToGd41a805URte2UEDqMYB_K8V4YKLIJ9rCMoLdmwvbco7uyevE9U/pub?gid=588241351&single=true&output=csv";

// --- SSR-SAFE CORE HELPERS ---
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const getDateFromWeek = (week, year = 2024) => {
  const d = new Date(year, 0, 1 + (week - 1) * 7);
  d.setHours(12, 0, 0, 0); 
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

// --- STABLE UI COMPONENTS ---
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

// --- REUSABLE MULTI-SELECT DROPDOWN ---
const MultiSelectDropdown = ({ label, options, selected, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="flex-1 relative min-w-[200px]">
      <span className="text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest block">{label}</span>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-[#131A2A] border border-white/10 rounded-xl text-sm font-black text-purple-400 shadow-sm cursor-pointer flex justify-between items-center transition-colors hover:border-purple-500/50"
      >
        <span className="truncate">{selected.includes('All') ? 'All Selected' : selected.join(', ')}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-2 w-full bg-[#131A2A] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 max-h-60 overflow-y-auto custom-scrollbar p-2">
            <div 
              onClick={() => { onChange(['All']); setIsOpen(false); }}
              className={`px-3 py-2.5 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between ${selected.includes('All') ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-white/5'}`}
            >
              All <Check className={`w-4 h-4 ${selected.includes('All') ? 'opacity-100' : 'opacity-0'}`} />
            </div>
            {options.map(opt => {
              const isSel = selected.includes(opt);
              return (
                <div 
                  key={opt}
                  onClick={() => {
                    let next = [...selected];
                    if (next.includes('All')) next = [];
                    if (isSel) {
                      next = next.filter(n => n !== opt);
                      if (next.length === 0) next = ['All'];
                    } else {
                      next.push(opt);
                    }
                    onChange(next);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between mt-1 transition-colors ${isSel ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-white/5'}`}
                >
                  <span className="truncate pr-2">{opt}</span> <Check className={`w-4 h-4 flex-shrink-0 ${isSel ? 'text-purple-400 opacity-100' : 'opacity-0'}`} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  );
};

const DonutChart = ({ chartData, valueKey, labelKey = 'name', isCurrency = false, exSym = '$', exRate = 1 }) => {
  const [hovered, setHovered] = useState(null);
  const validData = chartData.filter(d => d[valueKey] > 0);
  if (validData.length === 0) return <div className="flex h-full w-full min-h-[200px] items-center justify-center text-[10px] text-slate-500 font-black uppercase tracking-widest">No Data Available</div>;

  const width = 250;
  const height = 250;
  const margin = 10;
  const radius = Math.min(width, height) / 2 - margin;
  
  const total = d3.sum(validData, d => d[valueKey]);
  const pie = d3.pie().value(d => d[valueKey]).sort(null);
  const data_ready = pie(validData);
  
  const arc = d3.arc().innerRadius(radius * 0.65).outerRadius(radius);
  const hoverArc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius * 1.05);
  const colorScale = d3.scaleOrdinal().range(['#a855f7', '#34d399', '#fb7185', '#fbbf24', '#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f43f5e']);

  const defaultDisplay = data_ready.length > 0 ? data_ready[0].data : null;
  const displayData = hovered || defaultDisplay;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative min-h-[250px]">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {data_ready.map((d, i) => {
            const isHovered = hovered && hovered[labelKey] === d.data[labelKey];
            return (
              <path 
                key={i}
                d={isHovered ? hoverArc(d) : arc(d)} 
                fill={colorScale(d.data[labelKey])} 
                stroke="#131A2A" 
                strokeWidth="3" 
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHovered(d.data)}
                onMouseLeave={() => setHovered(null)}
                style={{ filter: isHovered ? `drop-shadow(0 0 10px ${colorScale(d.data[labelKey])}90)` : 'none' }}
              />
            );
          })}
          {displayData && (
            <text textAnchor="middle" dy="-0.8em" className="fill-white font-black text-xs pointer-events-none tracking-wide">
              {displayData[labelKey].length > 16 ? displayData[labelKey].substring(0,14)+'...' : displayData[labelKey]}
              <tspan x="0" dy="1.6em" className="fill-slate-300 font-bold text-sm">
                {isCurrency ? `${exSym}${d3.format(",.0f")(displayData[valueKey] * exRate)}` : d3.format(",.0f")(displayData[valueKey])}
              </tspan>
              <tspan x="0" dy="1.4em" className="fill-purple-400 font-black text-sm">
                {total > 0 ? ((displayData[valueKey] / total) * 100).toFixed(1) : 0}%
              </tspan>
            </text>
          )}
        </g>
      </svg>
    </div>
  );
};

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

const ComparisonLineChart = ({ rawData, metric, colorSW, colorBAU, isCurrency, exSym = '$', exRate = 1, aggregateFn, width = 800, height = 300 }) => {
  if (!rawData || rawData.length === 0) return (
    <div className="h-full w-full min-h-[300px] flex items-center justify-center bg-white/5 rounded-3xl border border-dashed border-white/10 text-[10px] font-black text-slate-500 uppercase tracking-widest">Insufficient Data</div>
  );
  
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;

  const grouped = d3.groups(rawData, d => d.timeKey).sort((a,b) => a[0] - b[0]);
  const chartData = grouped.map(([key, values]) => {
     const swRows = values.filter(v => v.weekType === 'Salary Weeks');
     const bauRows = values.filter(v => v.weekType === 'BAU');
     const swAgg = swRows.length > 0 ? aggregateFn(swRows) : null;
     const bauAgg = bauRows.length > 0 ? aggregateFn(bauRows) : null;
     return {
        timeKey: key,
        week: values[0].week,
        year: values[0].year,
        sw: swAgg ? swAgg[metric] : null,
        bau: bauAgg ? bauAgg[metric] : null
     };
  });

  const x = d3.scalePoint().domain(chartData.map(d => `W${d.week}`)).range([0, iw]);
  const maxVal = d3.max(chartData, d => Math.max(d.sw || 0, d.bau || 0)) * 1.1 || 1;
  const y = d3.scaleLinear().domain([0, maxVal]).range([ih, 0]);

  const lineSW = d3.line().defined(d => d.sw !== null).x(d => x(`W${d.week}`)).y(d => y(d.sw)).curve(d3.curveMonotoneX);
  const lineBAU = d3.line().defined(d => d.bau !== null).x(d => x(`W${d.week}`)).y(d => y(d.bau)).curve(d3.curveMonotoneX);
  
  const skipCount = Math.ceil(chartData.length / 10);
  const fmtT = (t, isC) => isC ? `${exSym}${d3.format(".1s")(t * exRate)}` : d3.format(".1s")(t);

  return (
    <div className="flex flex-col h-full w-full relative">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible min-h-[250px] flex-1">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {y.ticks(5).map(t => (
            <g key={`t-${t}`} transform={`translate(0, ${y(t)})`}>
              <line x2={iw} stroke="#1e293b" strokeWidth="1" strokeDasharray="2,2" />
              <text x="-10" dy="0.32em" textAnchor="end" className="text-[9px] fill-slate-400 font-bold">{fmtT(t, isCurrency)}</text>
            </g>
          ))}
          <path d={lineSW(chartData)} fill="none" stroke={colorSW} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${colorSW}60)` }} />
          <path d={lineBAU(chartData)} fill="none" stroke={colorBAU} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${colorBAU}60)` }} />
          
          {chartData.map((d, i) => (
             <g key={`pts-${i}`}>
               {d.sw !== null && <circle cx={x(`W${d.week}`)} cy={y(d.sw)} r="4" fill="#0f172a" stroke={colorSW} strokeWidth="2" />}
               {d.bau !== null && <circle cx={x(`W${d.week}`)} cy={y(d.bau)} r="4" fill="#0f172a" stroke={colorBAU} strokeWidth="2" />}
             </g>
          ))}

          {chartData.map((d, i) => (
             <g key={`hover-${i}`} className="group cursor-pointer">
               <rect x={x(`W${d.week}`) - 15} y={0} width={30} height={ih} fill="transparent" />
               <line x1={x(`W${d.week}`)} x2={x(`W${d.week}`)} y1={0} y2={ih} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" className="opacity-0 group-hover:opacity-100" />
               <foreignObject x={x(`W${d.week}`) > iw / 2 ? x(`W${d.week}`) - 130 : x(`W${d.week}`) + 10} y={10} width="120" height="90" className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                 <div className="bg-[#0f172a]/90 backdrop-blur-md text-white text-[10px] p-3 rounded-xl shadow-2xl flex flex-col gap-1.5 border border-white/10">
                   <span className="font-black text-slate-300 border-b border-white/10 pb-1.5 mb-0.5">Week {d.week}, {d.year}</span>
                   {d.sw !== null && <div className="flex justify-between"><span style={{color: colorSW}}>Salary Week:</span> <span>{isCurrency ? `${exSym}${d3.format(",.2f")(d.sw * exRate)}` : d3.format(",.2f")(d.sw)}</span></div>}
                   {d.bau !== null && <div className="flex justify-between"><span style={{color: colorBAU}}>BAU:</span> <span>{isCurrency ? `${exSym}${d3.format(",.2f")(d.bau * exRate)}` : d3.format(",.2f")(d.bau)}</span></div>}
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
  const [isMounted, setIsMounted] = useState(false);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientDate, setClientDate] = useState("");
  
  const [activeTab, setActiveTab] = useState('summary');
  
  // --- UNIFIED GLOBAL MULTI-SELECT FILTERS ---
  const [filterMarkets, setFilterMarkets] = useState(['All']);
  const [filterChannels, setFilterChannels] = useState(['All']);
  const [filterCampaigns, setFilterCampaigns] = useState(['All']);
  const [selectedWeekTypeView, setSelectedWeekTypeView] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [compareWeeks, setCompareWeeks] = useState([]); 
  const [trafficFilter, setTrafficFilter] = useState('All'); 

  const [currency, setCurrency] = useState('USD');
  const [kpi, setKpi] = useState({ isOpen: false, isSet: false, budget: '', impressions: '', installs: '', purchases: '' });

  const [reportModal, setReportModal] = useState({ isOpen: false, start: '', end: '', market: 'All', channel: 'All', traffic: 'All' });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const exRate = currency === 'BHD' ? 0.377 : 1;
  const exSym = currency === 'BHD' ? 'BD ' : '$';
  const formatC = (val, dec = 0) => `${exSym}${d3.format(`,.${dec}f`)(val * exRate)}`;

  useEffect(() => {
    setIsMounted(true);
    setClientDate(new Date().toLocaleDateString());
  }, []);

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
          const rawCampTypeS1 = row['Campaign Objective'] || row['campaign objective'] || Object.values(row)[13] || 'Unknown';

          return {
            cost: parseMetric(row['Cost'] || row['Spend'] || row['cost']),
            impressions: parseMetric(row['Impression'] || row['Impressions']),
            clicks: parseMetric(row['Clicks'] || row['clicks']),
            installs: 0, logins: 0, purchases: 0, sessions: 0,
            week, year, date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Channel Country']),
            channel: (!rawS1Channel || rawS1Channel === 'BLANK') ? 'Other' : normalizeChannel(rawS1Channel),
            weekType: parseWeekType(rawWeekTypeS1),
            campaignType: rawCampTypeS1.toString().trim(),
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
          const sessions = parseMetric(row['Sessions'] || row['sessions'] || Object.values(row)[9] || 0);
          const rawS2Channel = Object.values(row)[3] || row['Network'] || row['Source'];
          const rawWeekTypeS2 = Object.values(row)[17] || row['Week Type'];
          const rawCampTypeS2 = row['Campaign Objective'] || row['campaign objective'] || Object.values(row)[18] || 'Unknown';

          return {
            cost: 0, impressions: 0, clicks: 0,
            installs: parseMetric(row['Installs'] || row['Install'] || row['Total Installs'] || row['Network Installs']),
            logins, purchases, sessions, week, year, date: getDateFromWeek(week, year),
            market: normalizeMarket(row['Country'] || row['Geo']),
            channel: (!rawS2Channel || rawS2Channel === 'BLANK' || rawS2Channel === 'Organic') ? 'Other' : normalizeChannel(rawS2Channel),
            weekType: parseWeekType(rawWeekTypeS2),
            campaignType: rawCampTypeS2.toString().trim(),
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

  // Dynamic Options for Multi-Select Dropdowns based on active Master Filters
  const uniqueMarkets = useMemo(() => Array.from(new Set(filteredData.map(d => d.market))).sort(), [filteredData]);
  const uniqueChannels = useMemo(() => Array.from(new Set(filteredData.map(d => d.channel))).sort(), [filteredData]);
  const uniqueCampaigns = useMemo(() => Array.from(new Set(filteredData.map(d => d.campaignType))).sort(), [filteredData]);

  // Tab-specific filtered data applying the multi-select dropdowns
  const tabData = useMemo(() => {
    let d = filteredData;
    if (!filterMarkets.includes('All')) d = d.filter(x => filterMarkets.includes(x.market));
    if (!filterChannels.includes('All')) d = d.filter(x => filterChannels.includes(x.channel));
    if (!filterCampaigns.includes('All')) d = d.filter(x => filterCampaigns.includes(x.campaignType));
    return d;
  }, [filteredData, filterMarkets, filterChannels, filterCampaigns]);

  const aggregate = (rows) => {
    const cost = d3.sum(rows, d => d.cost), impressions = d3.sum(rows, d => d.impressions);
    const clicks = d3.sum(rows, d => d.clicks), installs = d3.sum(rows, d => d.installs);
    const logins = d3.sum(rows, d => d.logins), purchases = d3.sum(rows, d => d.purchases);
    const sessions = d3.sum(rows, d => d.sessions || 0);
    return {
      cost, impressions, clicks, installs, logins, purchases, sessions,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpc: clicks > 0 ? cost / clicks : 0,
      cpm: impressions > 0 ? (cost / impressions) * 1000 : 0,
      cpi: installs > 0 ? cost / installs : 0,
      cpp: purchases > 0 ? cost / purchases : 0,
      cvr: clicks > 0 ? (installs / clicks) * 100 : 0,
      ltr: installs > 0 ? (logins / installs) * 100 : 0, // Install to Login
      ltp: logins > 0 ? (purchases / logins) * 100 : 0,
      ipr: installs > 0 ? (purchases / installs) * 100 : 0 // Install to Purchase
    };
  };

  const metrics = useMemo(() => aggregate(filteredData), [filteredData]);
  const weeklyTimeline = useMemo(() => d3.groups(filteredData, d => d.timeKey).map(([key, values]) => ({ timeKey: key, week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a, b) => a.timeKey - b.timeKey), [filteredData]);
  
  const marketBreakdown = useMemo(() => d3.groups(filteredData, d => d.market)
    .map(([name, values]) => ({ name, ...aggregate(values) }))
    .filter(m => trafficFilter === 'Paid' ? m.cost >= 1 : (m.cost >= 1 || m.purchases >= 1 || m.installs >= 1))
    .sort((a, b) => b.cost - a.cost), [filteredData, trafficFilter]);
    
  const channelBreakdown = useMemo(() => d3.groups(filteredData, d => d.channel)
    .map(([name, values]) => ({ name, ...aggregate(values) }))
    .filter(c => trafficFilter === 'Paid' ? c.cost >= 1 : (c.cost >= 1 || c.purchases >= 1 || c.installs >= 1))
    .sort((a, b) => b.cost - a.cost), [filteredData, trafficFilter]);

  const handleDrillDown = (type, value) => {
    setActiveTab('detailed');
    if (type === 'market') {
      setFilterMarkets([value]);
      setFilterChannels(['All']);
      setFilterCampaigns(['All']);
    } else if (type === 'channel') {
      setFilterChannels([value]);
      setFilterMarkets(['All']);
      setFilterCampaigns(['All']);
    } else if (type === 'campaign') {
      setActiveTab('campaign');
      setFilterCampaigns([value]);
      setFilterMarkets(['All']);
      setFilterChannels(['All']);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function getAIInsight(context, activeData = null, marketFilteredData = null, selectedType = 'All Weeks') {
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
             <strong className="text-white text-base">Trend Analysis (Salary vs BAU):</strong>
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
             <p><strong className="text-white">Action Plan:</strong> The trend lines map directly to behavioral purchasing cycles. Use the visual comparison above to establish aggressive budget pulsing rules during Salary Week windows while maintaining a consistent baseline throughout BAU.</p>
          </div>
        );
      }
    }

    if (context === 'campaign') {
       const sortedBySpend = [...activeData].sort((a,b)=>b.cost - a.cost);
       const sortedByPurchases = [...activeData].sort((a,b)=>b.purchases - a.purchases);
       const validCPP = [...activeData].filter(d=>d.purchases>0).sort((a,b)=>a.cpp - b.cpp);
       
       const topSpend = sortedBySpend[0];
       const topPurchases = sortedByPurchases[0];
       const bestCPP = validCPP[0];

       if (!topSpend) return "Insufficient campaign data based on current filters.";

       return (
          <div className="space-y-3 text-sm text-purple-50">
             <p className="flex items-start gap-3"><span className="text-purple-400 mt-0.5">●</span> <strong>Investment Focus:</strong> '{topSpend?.name}' is currently the primary driver of ad spend, consuming {formatC(topSpend?.cost)} and generating {formatShort(topSpend?.impressions)} top-funnel impressions.</p>
             <p className="flex items-start gap-3"><span className="text-rose-400 mt-0.5">●</span> <strong>Volume Leader:</strong> The '{topPurchases?.name}' objective completely dominates bottom-funnel activity, delivering {formatShort(topPurchases?.purchases)} verified purchases.</p>
             <p className="flex items-start gap-3"><span className="text-amber-400 mt-0.5">●</span> <strong>Efficiency Champion:</strong> The most cost-effective conversion path is '{bestCPP?.name}', achieving a highly efficient CPP of {formatC(bestCPP?.cpp, 2)}.</p>
             <p className="flex items-start gap-3 mt-4 pt-4 border-t border-white/10"><span className="text-emerald-400 font-bold">Action Plan:</span> Reallocating budget from lower-performing algorithmic segments into the '{bestCPP?.name}' framework could drastically improve overall return on ad spend (ROAS) while maintaining target purchase volume.</p>
          </div>
       );
    }
    return "";
  }

  // --- RENDERS ---
  function renderLeaderboard() {
    const topInstalls = [...channelBreakdown].sort((a,b)=>b.installs - a.installs)[0];
    const topCPP = [...channelBreakdown].filter(c=>c.purchases > 0 && c.cost > 0).sort((a,b)=>a.cpp - b.cpp)[0];
    const topMarket = [...marketBreakdown].sort((a,b)=>b.purchases - a.purchases)[0];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
         <div onClick={() => handleDrillDown('market', topMarket?.name)} className="bg-[#131A2A] p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-purple-500/50 hover:bg-white/5 transition-all cursor-pointer group">
            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl group-hover:scale-110 transition-transform"><Trophy className="w-5 h-5"/></div>
            <div className="flex-1"><p className="text-[10px] uppercase tracking-widest text-slate-400 flex justify-between">Top Market (Sales) <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-purple-400"/></p><p className="font-black text-white">{topMarket?.name || 'N/A'}</p></div>
         </div>
         <div onClick={() => handleDrillDown('channel', topInstalls?.name)} className="bg-[#131A2A] p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-emerald-500/50 hover:bg-white/5 transition-all cursor-pointer group">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform"><Layers className="w-5 h-5"/></div>
            <div className="flex-1"><p className="text-[10px] uppercase tracking-widest text-slate-400 flex justify-between">Volume Leader <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-emerald-400"/></p><p className="font-black text-white">{topInstalls?.name || 'N/A'}</p></div>
         </div>
         <div onClick={() => handleDrillDown('channel', topCPP?.name)} className="bg-[#131A2A] p-5 rounded-2xl border border-white/5 flex items-center gap-4 hover:border-amber-500/50 hover:bg-white/5 transition-all cursor-pointer group">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform"><Zap className="w-5 h-5"/></div>
            <div className="flex-1"><p className="text-[10px] uppercase tracking-widest text-slate-400 flex justify-between">Most Efficient Paid <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-400"/></p><p className="font-black text-white">{topCPP?.name || 'N/A'} <span className="text-amber-400 text-xs font-bold">({formatC(topCPP?.cpp, 2)} CPP)</span></p></div>
         </div>
      </div>
    );
  }

  function renderKpiTracker() {
    const canSetKpi = dateRange.start && dateRange.end && trafficFilter === 'Paid';

    if (!canSetKpi) {
      return (
        <div className="mb-8 w-full border border-dashed border-white/10 rounded-2xl p-6 text-slate-500 flex items-center justify-center gap-3 font-bold text-sm bg-[#131A2A]/50 cursor-not-allowed">
          <Target className="w-5 h-5 opacity-50" /> KPI Tracker (Requires custom Date Range & 'Paid' Traffic filter to activate)
        </div>
      );
    }

    if (kpi.isOpen && !kpi.isSet) {
      return (
        <div className="mb-8 bg-[#131A2A] p-8 rounded-[2rem] border border-purple-500/30 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4">
           <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
           <div className="flex justify-between items-center mb-6 relative z-10">
             <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4 text-purple-400" /> Configure KPI Targets ({dateRange.start} to {dateRange.end})</h4>
             <button onClick={() => setKpi({...kpi, isOpen: false})} className="text-slate-400 hover:text-white"><Zap className="w-4 h-4 rotate-45"/></button>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              <input type="number" placeholder={`Budget (${currency})`} value={kpi.budget} onChange={e=>setKpi({...kpi, budget: e.target.value})} className="w-full text-xs font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500" />
              <input type="number" placeholder="Target Impressions" value={kpi.impressions} onChange={e=>setKpi({...kpi, impressions: e.target.value})} className="w-full text-xs font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500" />
              <input type="number" placeholder="Target Installs" value={kpi.installs} onChange={e=>setKpi({...kpi, installs: e.target.value})} className="w-full text-xs font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500" />
              <input type="number" placeholder="Target Purchases" value={kpi.purchases} onChange={e=>setKpi({...kpi, purchases: e.target.value})} className="w-full text-xs font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500" />
           </div>
           <button onClick={() => setKpi({...kpi, isSet: true, isOpen: false})} className="mt-6 w-full bg-gradient-to-r from-purple-600 to-rose-500 text-white rounded-xl py-3 font-black text-sm shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.01] relative z-10">Track Pacing Against Live Data</button>
        </div>
      );
    }

    if (kpi.isSet) {
      const actuals = metrics; 
      const bPct = Math.min((actuals.cost / (parseFloat(kpi.budget) / exRate || 1)) * 100, 100);
      const impPct = Math.min((actuals.impressions / (parseFloat(kpi.impressions) || 1)) * 100, 100);
      const instPct = Math.min((actuals.installs / (parseFloat(kpi.installs) || 1)) * 100, 100);
      const purPct = Math.min((actuals.purchases / (parseFloat(kpi.purchases) || 1)) * 100, 100);

      const ProgressBar = ({ label, actual, target, pct, isCurr, color = "bg-purple-500" }) => (
        <div>
          <div className="flex justify-between text-xs font-bold text-slate-300 mb-2">
            <span>{label}</span>
            <span>{isCurr ? formatC(actual) : d3.format(",.0f")(actual)} / {isCurr ? `${exSym}${d3.format(",.0f")(target)}` : d3.format(",.0f")(target)}</span>
          </div>
          <div className="h-2 bg-[#0B0F19] rounded-full overflow-hidden border border-white/5">
            <div className={`h-full ${color} rounded-full relative`} style={{ width: `${pct}%` }}>
              <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
        </div>
      );

      return (
        <div className="mb-8 bg-[#131A2A] p-8 rounded-[2rem] border border-white/5 shadow-xl animate-in fade-in">
           <div className="flex justify-between items-center mb-6">
             <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Target className="w-4 h-4 text-purple-400" /> Goal Pacing ({dateRange.start} to {dateRange.end})</h4>
             <button onClick={() => setKpi({...kpi, isSet: false, isOpen: true})} className="text-xs font-black uppercase tracking-widest text-purple-400 hover:text-purple-300">Edit Goals</button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <ProgressBar label="Budget Delivery" actual={actuals.cost} target={kpi.budget} pct={bPct} isCurr color="bg-blue-500" />
              <ProgressBar label="Impressions Generated" actual={actuals.impressions} target={kpi.impressions} pct={impPct} color="bg-cyan-500" />
              <ProgressBar label="Installs Acquired" actual={actuals.installs} target={kpi.installs} pct={instPct} color="bg-emerald-500" />
              <ProgressBar label="Purchases Acquired" actual={actuals.purchases} target={kpi.purchases} pct={purPct} color="bg-rose-500" />
           </div>
        </div>
      );
    }

    return (
      <button onClick={() => setKpi({...kpi, isOpen: true})} className="mb-8 w-full border border-dashed border-white/10 rounded-2xl p-6 text-slate-400 hover:text-white hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-3 font-bold text-sm">
        <Target className="w-5 h-5 text-purple-400" /> Set Campaign Goal & KPI Pacing Tracker
      </button>
    );
  }

  function renderSummary() {
    const ltr = metrics.installs > 0 ? ((metrics.logins / metrics.installs) * 100).toFixed(2) : 0;
    const ltp = metrics.logins > 0 ? ((metrics.purchases / metrics.logins) * 100).toFixed(2) : 0;
    const cvr = metrics.installs > 0 ? ((metrics.purchases / metrics.installs) * 100).toFixed(2) : 0;
    const topMarket = marketBreakdown[0]?.name || 'N/A';
    const topChannel = channelBreakdown[0]?.name || 'N/A';

    const summaryInsights = [
      `Overall Funnel Efficiency: Out of ${formatShort(metrics.installs)} installs, ${ltr}% successfully logged in, and ${ltp}% of those logins resulted in a confirmed purchase.`,
      `Cost Dynamics: The blended Cost Per Install (CPI) sits at ${formatC(metrics.cpi, 2)}, scaling to an effective Cost Per Purchase (CPP) of ${formatC(metrics.cpp, 2)}.`,
      `Platform vs Adjust Sync: A total ad spend of ${formatC(metrics.cost)} generated ${formatShort(metrics.clicks)} clicks, converting to ${formatShort(metrics.purchases)} Adjust-verified purchases (a ${cvr}% install-to-purchase rate).`,
      `Market & Channel Leaders: '${topMarket}' is currently the most active geographical market, while '${topChannel}' drives the highest measurable bottom-funnel engagement.`
    ];

    return (
      <div className="animate-in fade-in duration-700">
        
        {renderLeaderboard()}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          <MetricCard label="Ad Spend" value={formatC(metrics.cost)} color="text-purple-400" />
          <MetricCard label="Impressions" value={formatShort(metrics.impressions)} color="text-cyan-400" />
          <MetricCard label="Clicks" value={formatShort(metrics.clicks)} color="text-blue-400" />
          <MetricCard label="Installs" value={formatShort(metrics.installs)} color="text-emerald-400" />
          <MetricCard label="Logins" value={formatShort(metrics.logins)} color="text-amber-400" />
          <MetricCard label="Purchases" value={formatShort(metrics.purchases)} color="text-rose-400" />
          <MetricCard label="Install-to-Login %" value={`${metrics.ltr.toFixed(2)}%`} color="text-teal-400" />
          <MetricCard label="Login-to-Purch %" value={`${metrics.ltp.toFixed(2)}%`} color="text-pink-400" />
          <MetricCard label="CPI" value={formatC(metrics.cpi, 2)} color="text-orange-400" />
          <MetricCard label="CPP" value={formatC(metrics.cpp, 2)} color="text-red-400" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col relative overflow-hidden">
            <div className="flex justify-between items-center mb-8 relative z-10">
              <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4 text-purple-400" /> Spend vs MMP Installs</h4>
              <div className="flex gap-4 text-[10px] font-black uppercase text-slate-400">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"/> Cost</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"/> Installs</span>
              </div>
            </div>
            <div className="flex-1 min-h-[340px] relative z-10">
               <DualAxisLineChart chartData={weeklyTimeline} leftKey="cost" rightKey="installs" leftColorText="fill-purple-400" rightColorText="fill-emerald-400" leftColorHex="#a855f7" rightColorHex="#34d399" isLeftCurrency={true} isRightCurrency={false} exSym={exSym} exRate={exRate} />
            </div>
          </div>
          <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
            <h4 className="text-sm font-black text-white mb-6 uppercase tracking-widest flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-rose-400" /> Top Market Purchases</h4>
            <BarChart chartData={[...marketBreakdown].sort((a,b)=>b.purchases-a.purchases)} valueKey="purchases" color="bg-rose-500" onClickItem={(name) => handleDrillDown('market', name)} exSym={exSym} exRate={exRate} />
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-br from-purple-900/40 to-slate-900/40 border border-purple-500/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
           <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="bg-purple-500/20 p-2 rounded-xl"><Zap className="w-5 h-5 text-purple-400" /></div>
              <h4 className="text-lg font-black text-white tracking-tight">Executive AI Analysis</h4>
           </div>
           <ul className="space-y-4 relative z-10">
              {summaryInsights.map((bullet, idx) => (
                 <li key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                    <p className="text-sm font-medium text-slate-300 leading-relaxed">{bullet}</p>
                 </li>
              ))}
           </ul>
        </div>
      </div>
    );
  }

  function renderMarket() {
    const activeMarketData = filterMarkets.includes('All') 
      ? null 
      : d3.groups(tabData, d => d.timeKey).map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a,b) => a.week - b.week);
          
    const activeMarketSummary = filterMarkets.includes('All') ? null : aggregate(tabData);

    const sortedByInstalls = [...marketBreakdown].sort((a, b) => b.installs - a.installs);
    const sortedByPurchases = [...marketBreakdown].sort((a, b) => b.purchases - a.purchases);
    const validCPI = [...marketBreakdown].filter(m => m.installs > 0 && m.cost > 0).sort((a, b) => a.cpi - b.cpi);
    const validCPP = [...marketBreakdown].filter(m => m.purchases > 0 && m.cost > 0).sort((a, b) => a.cpp - b.cpp);

    return (
      <div className="animate-in fade-in duration-500">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white tracking-tight">Market Intelligence</h2>
          <p className="text-slate-400 font-medium italic">Geographical footprint filtered dynamically by traffic segment parameters.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 border-b border-white/5 pb-6">
          <MultiSelectDropdown label="Market Filter" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
          <MultiSelectDropdown label="Channel Filter" options={uniqueChannels} selected={filterChannels} onChange={setFilterChannels} />
        </div>

        {filterMarkets.includes('All') ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EntityBarChartCard title="Total Installs" icon={Download} data={sortedByInstalls} dataKey="installs" color="bg-emerald-500" insight={`${sortedByInstalls[0]?.name || 'Top market'} leads acquisition volume.`} drillDownType="market" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Total Purchases" icon={ShoppingCart} data={sortedByPurchases} dataKey="purchases" color="bg-rose-500" insight={`${sortedByPurchases[0]?.name || 'Top market'} drives highest bottom-funnel intent.`} drillDownType="market" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Cost Per Install (CPI)" icon={Activity} data={validCPI.slice(0, 8)} dataKey="cpi" color="bg-amber-500" isCurrency={true} insight={`${validCPI[0]?.name || 'Top market'} offers most cost-effective top-funnel acquisition.`} drillDownType="market" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Cost Per Purchase (CPP)" icon={Target} data={validCPP.slice(0, 8)} dataKey="cpp" color="bg-red-500" isCurrency={true} insight={`${validCPP[0]?.name || 'Top market'} delivers best conversion ROI.`} drillDownType="market" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
               <MetricCard label="Ad Spend" value={formatC(activeMarketSummary?.cost || 0)} color="text-purple-400" />
               <MetricCard label="Installs" value={formatShort(activeMarketSummary?.installs || 0)} color="text-emerald-400" />
               <MetricCard label="Purchases" value={formatShort(activeMarketSummary?.purchases || 0)} color="text-rose-400" />
               <MetricCard label="CPI" value={formatC(activeMarketSummary?.cpi || 0, 2)} color="text-amber-400" />
               <MetricCard label="CPP" value={formatC(activeMarketSummary?.cpp || 0, 2)} color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Volume: Installs & Purchases</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeMarketData} leftKey="installs" rightKey="purchases" leftColorText="fill-emerald-400" rightColorText="fill-rose-400" leftColorHex="#34d399" rightColorHex="#fb7185" isLeftCurrency={false} isRightCurrency={false} exSym={exSym} exRate={exRate} />
                 </div>
               </div>

               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Efficiency: CPI & CPP</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeMarketData} leftKey="cpi" rightKey="cpp" leftColorText="fill-amber-400" rightColorText="fill-red-400" leftColorHex="#fbbf24" rightColorHex="#f87171" isLeftCurrency={true} isRightCurrency={true} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderChannel() {
    const sortedByInstalls = [...channelBreakdown].sort((a, b) => b.installs - a.installs);
    const sortedByPurchases = [...channelBreakdown].sort((a, b) => b.purchases - a.purchases);
    const validCPI = [...channelBreakdown].filter(c => c.installs > 0 && c.cost > 0).sort((a, b) => a.cpi - b.cpi);
    const validCPP = [...channelBreakdown].filter(c => c.purchases > 0 && c.cost > 0).sort((a, b) => a.cpp - b.cpp);

    const activeChannelData = filterChannels.includes('All') 
      ? null 
      : d3.groups(tabData, d => d.timeKey).map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a,b) => a.week - b.week);
          
    const activeChannelSummary = filterChannels.includes('All') ? null : aggregate(tabData);

    return (
      <div className="animate-in fade-in duration-500">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white tracking-tight">Channel Attribution</h2>
          <p className="text-slate-400 font-medium italic">Marketing platform performance filtered dynamically by traffic segment.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 border-b border-white/5 pb-6">
          <MultiSelectDropdown label="Market Filter" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
          <MultiSelectDropdown label="Channel Filter" options={uniqueChannels} selected={filterChannels} onChange={setFilterChannels} />
        </div>

        {filterChannels.includes('All') ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EntityBarChartCard title="Total Installs" icon={Download} data={sortedByInstalls} dataKey="installs" color="bg-emerald-500" insight={`${sortedByInstalls[0]?.name || 'Top channel'} drives highest top-funnel acquisition.`} drillDownType="channel" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Total Purchases" icon={ShoppingCart} data={sortedByPurchases} dataKey="purchases" color="bg-rose-500" insight={`${sortedByPurchases[0]?.name || 'Top channel'} brings in highest volume of paying users.`} drillDownType="channel" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Cost Per Install (CPI)" icon={Activity} data={validCPI.slice(0, 8)} dataKey="cpi" color="bg-amber-500" isCurrency={true} insight={`${validCPI[0]?.name || 'Top channel'} provides cheapest initial user acquisition.`} drillDownType="channel" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            <EntityBarChartCard title="Cost Per Purchase (CPP)" icon={Target} data={validCPP.slice(0, 8)} dataKey="cpp" color="bg-red-500" isCurrency={true} insight={`${validCPP[0]?.name || 'Top channel'} is your most efficient conversion engine.`} drillDownType="channel" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
          </div>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
               <MetricCard label="Ad Spend" value={formatC(activeChannelSummary?.cost || 0)} color="text-purple-400" />
               <MetricCard label="Impressions" value={formatShort(activeChannelSummary?.impressions || 0)} color="text-cyan-400" />
               <MetricCard label="Clicks" value={formatShort(activeChannelSummary?.clicks || 0)} color="text-blue-400" />
               <MetricCard label="Installs" value={formatShort(activeChannelSummary?.installs || 0)} color="text-emerald-400" />
               <MetricCard label="Purchases" value={formatShort(activeChannelSummary?.purchases || 0)} color="text-rose-400" />
               <MetricCard label="CPI" value={formatC(activeChannelSummary?.cpi || 0, 2)} color="text-amber-400" />
               <MetricCard label="CPP" value={formatC(activeChannelSummary?.cpp || 0, 2)} color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Volume: Installs & Purchases</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeChannelData} leftKey="installs" rightKey="purchases" leftColorText="fill-emerald-400" rightColorText="fill-rose-400" leftColorHex="#34d399" rightColorHex="#fb7185" isLeftCurrency={false} isRightCurrency={false} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-red-400" /> Efficiency: CPI & CPP</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeChannelData} leftKey="cpi" rightKey="cpp" leftColorText="fill-amber-400" rightColorText="fill-red-400" leftColorHex="#fbbf24" rightColorHex="#f87171" isLeftCurrency={true} isRightCurrency={true} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Eye className="w-4 h-4 text-cyan-400" /> Awareness: Impressions & CPM</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeChannelData} leftKey="impressions" rightKey="cpm" leftColorText="fill-cyan-400" rightColorText="fill-purple-400" leftColorHex="#0891b2" rightColorHex="#9333ea" isLeftCurrency={false} isRightCurrency={true} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><MousePointer2 className="w-4 h-4 text-blue-400" /> Engagement: Clicks & CPC</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeChannelData} leftKey="clicks" rightKey="cpc" leftColorText="fill-blue-400" rightColorText="fill-orange-400" leftColorHex="#2563eb" rightColorHex="#ea580c" isLeftCurrency={false} isRightCurrency={true} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCampaign() {
    const validCPI = [...campaignTypeBreakdown].filter(c => c.installs > 0 && c.cost > 0).sort((a, b) => a.cpi - b.cpi);
    const validCPP = [...campaignTypeBreakdown].filter(c => c.purchases > 0 && c.cost > 0).sort((a, b) => a.cpp - b.cpp);

    const activeCampaignData = filterCampaigns.includes('All') 
      ? null 
      : d3.groups(tabData, d => d.timeKey).map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) })).sort((a,b) => a.week - b.week);
          
    const activeCampaignSummary = filterCampaigns.includes('All') ? null : aggregate(tabData);

    return (
      <div className="animate-in fade-in duration-500">
        <div className="mb-6">
          <h2 className="text-3xl font-black text-white tracking-tight">Campaign Objectives</h2>
          <p className="text-slate-400 font-medium italic">Attribution and efficiency mapped by creative and strategic intent.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 border-b border-white/5 pb-6">
          <MultiSelectDropdown label="Market Filter" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
          <MultiSelectDropdown label="Channel Filter" options={uniqueChannels} selected={filterChannels} onChange={setFilterChannels} />
          <MultiSelectDropdown label="Campaign Type" options={uniqueCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
        </div>

        <InsightBox text={getAIInsight('campaign', campaignTypeBreakdown)} />

        {filterCampaigns.includes('All') ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
               <div className="bg-[#131A2A] p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col hover:border-purple-500/30 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 rounded-xl bg-white/5"><DollarSign className="w-4 h-4 text-purple-400" /></div>
                     <h4 className="text-sm font-black text-white uppercase tracking-widest">Spends by Objective</h4>
                  </div>
                  <div className="flex-1"><DonutChart chartData={campaignTypeBreakdown} valueKey="cost" isCurrency={true} exSym={exSym} exRate={exRate} /></div>
               </div>

               <div className="bg-[#131A2A] p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col hover:border-emerald-500/30 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 rounded-xl bg-white/5"><Download className="w-4 h-4 text-emerald-400" /></div>
                     <h4 className="text-sm font-black text-white uppercase tracking-widest">Installs by Objective</h4>
                  </div>
                  <div className="flex-1"><DonutChart chartData={campaignTypeBreakdown} valueKey="installs" /></div>
               </div>

               <div className="bg-[#131A2A] p-6 rounded-[2rem] border border-white/5 shadow-xl flex flex-col hover:border-rose-500/30 transition-colors">
                  <div className="flex items-center gap-3 mb-6">
                     <div className="p-2 rounded-xl bg-white/5"><ShoppingCart className="w-4 h-4 text-rose-400" /></div>
                     <h4 className="text-sm font-black text-white uppercase tracking-widest">Purchases by Obj.</h4>
                  </div>
                  <div className="flex-1"><DonutChart chartData={campaignTypeBreakdown} valueKey="purchases" /></div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <EntityBarChartCard title="CPI by Objective" icon={Activity} data={validCPI.slice(0, 8)} dataKey="cpi" color="bg-amber-500" isCurrency={true} insight={`${validCPI[0]?.name || 'Top objective'} offers most cost-effective acquisition.`} drillDownType="campaign" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
              <EntityBarChartCard title="CPP by Objective" icon={Target} data={validCPP.slice(0, 8)} dataKey="cpp" color="bg-red-500" isCurrency={true} insight={`${validCPP[0]?.name || 'Top objective'} is your most efficient conversion type.`} drillDownType="campaign" onDrillDown={handleDrillDown} exSym={exSym} exRate={exRate} />
            </div>

            <div className="bg-[#131A2A] rounded-[2rem] border border-white/5 shadow-xl overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead className="bg-[#1A2235] border-b border-white/5">
                    <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-6 py-5">Campaign Objective</th>
                      <th className="px-6 py-5 text-right text-purple-400">Cost</th>
                      <th className="px-6 py-5 text-right">Impressions</th>
                      <th className="px-6 py-5 text-right">Clicks</th>
                      <th className="px-6 py-5 text-right text-emerald-400">Installs</th>
                      <th className="px-6 py-5 text-right text-indigo-400">Sessions</th>
                      <th className="px-6 py-5 text-right text-cyan-400">Logins</th>
                      <th className="px-6 py-5 text-right text-slate-500">Ins-Log %</th>
                      <th className="px-6 py-5 text-right text-rose-400">Purchases</th>
                      <th className="px-6 py-5 text-right text-slate-500">Ins-Pur %</th>
                      <th className="px-6 py-5 text-right text-amber-400">CPI</th>
                      <th className="px-6 py-5 text-right text-red-400">CPP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {campaignTypeBreakdown.map((row, i) => (
                      <tr key={i} onClick={() => setFilterCampaigns([row.name])} className="hover:bg-white/5 transition-colors group cursor-pointer">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                            <span className="font-black text-white group-hover:text-purple-300 transition-colors">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-slate-300">{formatC(row.cost)}</td>
                        <td className="px-6 py-5 text-right font-mono text-slate-400">{formatShort(row.impressions)}</td>
                        <td className="px-6 py-5 text-right font-mono text-slate-400">{formatShort(row.clicks)}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-emerald-400">{formatShort(row.installs)}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-indigo-400">{formatShort(row.sessions)}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-cyan-400">{formatShort(row.logins)}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-slate-500">{row.ltr.toFixed(1)}%</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-rose-400">{formatShort(row.purchases)}</td>
                        <td className="px-6 py-5 text-right font-mono font-bold text-slate-500">{row.ipr.toFixed(1)}%</td>
                        <td className="px-6 py-5 text-right"><span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-[10px] font-black border border-amber-500/20">{formatC(row.cpi, 2)}</span></td>
                        <td className="px-6 py-5 text-right"><span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-[10px] font-black border border-red-500/20">{formatC(row.cpp, 2)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
               <MetricCard label="Ad Spend" value={formatC(activeCampaignSummary?.cost || 0)} color="text-purple-400" />
               <MetricCard label="Impressions" value={formatShort(activeCampaignSummary?.impressions || 0)} color="text-cyan-400" />
               <MetricCard label="Clicks" value={formatShort(activeCampaignSummary?.clicks || 0)} color="text-blue-400" />
               <MetricCard label="Installs" value={formatShort(activeCampaignSummary?.installs || 0)} color="text-emerald-400" />
               <MetricCard label="Purchases" value={formatShort(activeCampaignSummary?.purchases || 0)} color="text-rose-400" />
               <MetricCard label="CPI" value={formatC(activeCampaignSummary?.cpi || 0, 2)} color="text-amber-400" />
               <MetricCard label="CPP" value={formatC(activeCampaignSummary?.cpp || 0, 2)} color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Volume: Installs & Purchases</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeCampaignData} leftKey="installs" rightKey="purchases" leftColorText="fill-emerald-400" rightColorText="fill-rose-400" leftColorHex="#34d399" rightColorHex="#fb7185" isLeftCurrency={false} isRightCurrency={false} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
               <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
                 <div className="flex justify-between items-center mb-8">
                   <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-red-400" /> Efficiency: CPI & CPP</h4>
                 </div>
                 <div className="flex-1 min-h-[300px]">
                    <DualAxisLineChart chartData={activeCampaignData} leftKey="cpi" rightKey="cpp" leftColorText="fill-amber-400" rightColorText="fill-red-400" leftColorHex="#fbbf24" rightColorHex="#f87171" isLeftCurrency={true} isRightCurrency={true} exSym={exSym} exRate={exRate} />
                 </div>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderDetailed() {
    const activeDetailedData = (selectedWeekTypeView === '' || selectedWeekTypeView === 'All Weeks')
      ? tabData
      : tabData.filter(d => d.weekType === selectedWeekTypeView);

    const activeTableData = d3.groups(activeDetailedData, d => d.timeKey)
        .map(([key, values]) => ({ week: values[0].week, year: values[0].year, ...aggregate(values) }))
        .sort((a,b) => a.week - b.week);

    const isAllWeeks = selectedWeekTypeView === 'All Weeks';
    const isSpecificWeek = selectedWeekTypeView === 'Salary Weeks' || selectedWeekTypeView === 'BAU';
    const isDefaultView = selectedWeekTypeView === '';
    const isAnySelected = selectedWeekTypeView !== '';
    const shouldShowDefaultCharts = (isSpecificWeek || isDefaultView || compareWeeks.length > 0 || dateRange.start || dateRange.end);

    return (
      <div className="animate-in fade-in duration-500">
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight">Detailed Data Hub</h2>
            <p className="text-slate-400 font-medium italic">Granular timeline combining upper-funnel ad data with bottom-funnel adjust conversions.</p>
          </div>
          <button onClick={() => setReportModal({...reportModal, isOpen: true})} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none hover:scale-105">
            <FileText className="w-4 h-4" /> Export Report
          </button>
        </div>

        {renderKpiTracker()}

        <div className="flex flex-col md:flex-row gap-4 mb-8 border-b border-white/5 pb-6">
          <MultiSelectDropdown label="Market Filter" options={uniqueMarkets} selected={filterMarkets} onChange={setFilterMarkets} />
          <MultiSelectDropdown label="Channel Filter" options={uniqueChannels} selected={filterChannels} onChange={setFilterChannels} />
          <MultiSelectDropdown label="Campaign Type" options={uniqueCampaigns} selected={filterCampaigns} onChange={setFilterCampaigns} />
        </div>
        
        <div className="flex gap-3 overflow-x-auto pb-4 mb-8 border-b border-white/5 hide-scrollbar">
          {['All Weeks', 'Salary Weeks', 'BAU'].map(type => (
            <button 
              key={type} 
              onClick={() => setSelectedWeekTypeView(prev => prev === type ? '' : type)} 
              className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-sm font-black transition-all ${selectedWeekTypeView === type ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' : 'bg-[#131A2A] text-slate-400 border border-white/5 hover:bg-white/5 hover:text-white'}`}
            >
              {type}
            </button>
          ))}
        </div>

        {isAnySelected && (
          <InsightBox text={getAIInsight('detailed', activeTableData, tabData, selectedWeekTypeView)} />
        )}

        {shouldShowDefaultCharts && !isAllWeeks && activeTableData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-in fade-in zoom-in-95 duration-500">
             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <div className="flex justify-between items-center mb-8">
                 <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Volume: Installs vs Purchases</h4>
               </div>
               <div className="flex-1 min-h-[300px]">
                  <DualAxisLineChart chartData={activeTableData} leftKey="installs" rightKey="purchases" leftColorText="fill-emerald-400" rightColorText="fill-rose-400" leftColorHex="#34d399" rightColorHex="#fb7185" isLeftCurrency={false} isRightCurrency={false} exSym={exSym} exRate={exRate} />
               </div>
             </div>
             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <div className="flex justify-between items-center mb-8">
                 <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2"><Activity className="w-4 h-4 text-red-400" /> Efficiency: CPI vs CPP</h4>
               </div>
               <div className="flex-1 min-h-[300px]">
                  <DualAxisLineChart chartData={activeTableData} leftKey="cpi" rightKey="cpp" leftColorText="fill-amber-400" rightColorText="fill-red-400" leftColorHex="#fbbf24" rightColorHex="#f87171" isLeftCurrency={true} isRightCurrency={true} exSym={exSym} exRate={exRate} />
               </div>
             </div>
          </div>
        )}

        {isAllWeeks && activeTableData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 animate-in fade-in zoom-in-95 duration-500">
             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-400" /> Installs (SW vs BAU)</h4>
               <div className="flex-1 min-h-[300px]">
                 <ComparisonLineChart rawData={tabData} metric="installs" colorSW="#34d399" colorBAU="#047857" isCurrency={false} exSym={exSym} exRate={exRate} aggregateFn={aggregate} />
               </div>
             </div>
             
             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-rose-400" /> Purchases (SW vs BAU)</h4>
               <div className="flex-1 min-h-[300px]">
                 <ComparisonLineChart rawData={tabData} metric="purchases" colorSW="#fb7185" colorBAU="#be123c" isCurrency={false} exSym={exSym} exRate={exRate} aggregateFn={aggregate} />
               </div>
             </div>

             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> CPI (SW vs BAU)</h4>
               <div className="flex-1 min-h-[300px]">
                 <ComparisonLineChart rawData={tabData} metric="cpi" colorSW="#fbbf24" colorBAU="#b45309" isCurrency={true} exSym={exSym} exRate={exRate} aggregateFn={aggregate} />
               </div>
             </div>

             <div className="bg-[#131A2A] p-8 rounded-[2.5rem] border border-white/5 shadow-xl flex flex-col">
               <h4 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2"><Target className="w-4 h-4 text-red-400" /> CPP (SW vs BAU)</h4>
               <div className="flex-1 min-h-[300px]">
                 <ComparisonLineChart rawData={tabData} metric="cpp" colorSW="#f87171" colorBAU="#991b1b" isCurrency={true} exSym={exSym} exRate={exRate} aggregateFn={aggregate} />
               </div>
             </div>
          </div>
        )}
        
        <div className="bg-[#131A2A] rounded-[2rem] border border-white/5 shadow-xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-[#1A2235] border-b border-white/5">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-5">Fiscal Window</th>
                  <th className="px-6 py-5 text-right text-purple-400">Cost</th>
                  <th className="px-6 py-5 text-right">Clicks</th>
                  <th className="px-6 py-5 text-right text-emerald-400">Installs</th>
                  <th className="px-6 py-5 text-right text-indigo-400">Sessions</th>
                  <th className="px-6 py-5 text-right text-cyan-400">Logins</th>
                  <th className="px-6 py-5 text-right text-slate-500">Ins-Log %</th>
                  <th className="px-6 py-5 text-right text-rose-400">Purchases</th>
                  <th className="px-6 py-5 text-right text-slate-500">Ins-Pur %</th>
                  <th className="px-6 py-5 text-right text-amber-400">CPI</th>
                  <th className="px-6 py-5 text-right text-red-400">CPP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeTableData.map((w, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                        <span className="font-black text-white">W{w.week} - {getMonthFromWeek(w.week, w.year)} {w.year}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-slate-300">{formatC(w.cost)}</td>
                    <td className="px-6 py-5 text-right font-mono text-slate-400">{d3.format(",.0f")(w.clicks)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-emerald-400">{d3.format(",.0f")(w.installs)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-indigo-400">{d3.format(",.0f")(w.sessions)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-cyan-400">{d3.format(",.0f")(w.logins)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-slate-500">{w.ltr.toFixed(1)}%</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-rose-400">{d3.format(",.0f")(w.purchases)}</td>
                    <td className="px-6 py-5 text-right font-mono font-bold text-slate-500">{w.ipr.toFixed(1)}%</td>
                    <td className="px-6 py-5 text-right"><span className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-[10px] font-black border border-amber-500/20">{formatC(w.cpi, 2)}</span></td>
                    <td className="px-6 py-5 text-right"><span className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-[10px] font-black border border-red-500/20">{formatC(w.cpp, 2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderPrintableReport() {
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
      <div className="bg-white text-slate-900 min-h-screen p-10 w-[1000px] mx-auto">
         <div className="flex justify-between items-end border-b-2 border-slate-200 pb-6 mb-8">
            <div>
               <h1 className="text-4xl font-black tracking-tighter text-slate-900">ROVA PERFORMANCE</h1>
               <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Detailed Intelligence Report</p>
            </div>
            <div className="text-right">
               <p className="text-xs font-bold text-slate-500">Generated: {clientDate}</p>
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
  }

  // Strict bailout: Wait until React has fully mounted in the browser before rendering anything.
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0B0F19] text-slate-200 font-sans selection:bg-purple-500/30 selection:text-purple-100">
      
      <SignedOut>
        <div className="flex w-full items-center justify-center min-h-screen">
           <SignIn routing="hash" forceRedirectUrl="/" />
        </div>
      </SignedOut>

      <SignedIn>
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-64 flex-shrink-0 bg-[#0B0F19] border-r border-white/5 flex flex-col z-[100] no-print">
          <div className="p-6 border-b border-white/5 flex items-center gap-4">
            <div className="bg-white px-2 py-1.5 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <span className="text-lg font-black text-[#0B0F19] tracking-tighter">stc</span>
            </div>
            <div className="leading-tight">
              <h1 className="text-[15px] font-black tracking-tighter text-white">ROVA PERF.</h1>
              <p className="text-[8px] font-black text-purple-400 uppercase tracking-[0.2em] mt-0.5">Intelligence</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {[
              { id: 'summary', label: 'Summary', icon: LayoutDashboard },
              { id: 'market', label: 'Markets', icon: Globe },
              { id: 'channel', label: 'Channels', icon: Layers },
              { id: 'campaign', label: 'Campaigns', icon: Megaphone },
              { id: 'detailed', label: 'Details', icon: TableProperties },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all ${
                  activeTab === tab.id 
                  ? 'bg-gradient-to-r from-purple-600 to-rose-500 text-white shadow-lg shadow-purple-500/25 border-none' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/5 space-y-4">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                (dateRange.start || compareWeeks.length > 0 || trafficFilter !== 'All')
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50' 
                : 'bg-[#131A2A] border border-white/5 text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2"><Filter className="w-4 h-4"/> Master Filters</div>
            </button>
            <div className="flex items-center justify-between px-2 pb-2">
              <button 
                  onClick={() => setCurrency(c => c === 'USD' ? 'BHD' : 'USD')}
                  className="flex items-center gap-2 transition-all font-black text-xs tracking-widest uppercase text-slate-400 hover:text-white"
              >
                  <DollarSign className="w-4 h-4 text-emerald-400" /> {currency}
              </button>
              <div className="bg-[#131A2A] border border-white/10 rounded-full p-1 shadow-lg shadow-purple-500/10 hover:border-purple-500/50 transition-colors">
                <UserButton afterSignOutUrl="/" />
              </div>
            </div>
          </div>
        </aside>

        {/* MASTER FILTER SLIDE-OUT PANEL */}
        {isFilterOpen && (
          <div className="no-print">
            <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)} />
            <div className="fixed top-0 left-64 h-full w-96 bg-[#131A2A] border-r border-white/5 shadow-[20px_0_50px_rgba(0,0,0,0.5)] z-50 p-8 overflow-y-auto animate-in slide-in-from-left duration-300 custom-scrollbar">
              <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Master Time Filters</span>
                <button onClick={() => { setDateRange({start:'', end:''}); setCompareWeeks([]); setTrafficFilter('All'); }} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300">
                  Reset All
                </button>
              </div>
              
              <div className="space-y-8">
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
                      <input style={{ colorScheme: 'dark' }} type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full text-xs font-bold text-slate-200 bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-purple-500 cursor-pointer" />
                      <input style={{ colorScheme: 'dark' }} type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full text-xs font-bold text-slate-200 bg-[#0B0F19] border border-white/10 rounded-xl px-3 py-2 outline-none focus:border-purple-500 cursor-pointer" />
                  </div>
                </div>
                <div className={dateRange.start || dateRange.end ? 'opacity-30 pointer-events-none' : ''}>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2"><Layers className="w-3 h-3" /> Compare Specific Weeks</h4>
                  <div className="max-h-64 overflow-y-auto pr-2 grid grid-cols-2 gap-2 custom-scrollbar">
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
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto relative custom-scrollbar scroll-smooth">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-purple-900/10 via-transparent to-transparent pointer-events-none rounded-full blur-[100px]"></div>
          
          <div className="p-8 lg:p-12 max-w-7xl mx-auto relative z-10">
            {activeTab === 'summary' && renderSummary()}
            {activeTab === 'market' && renderMarket()}
            {activeTab === 'channel' && renderChannel()}
            {activeTab === 'campaign' && renderCampaign()}
            {activeTab === 'detailed' && renderDetailed()}
          </div>

          <footer className="max-w-7xl mx-auto px-8 lg:px-12 pb-12 border-t border-white/5 mt-4 pt-8 flex flex-col md:flex-row justify-between items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
              <Info className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">MMP Cross-Engine v7.0 | Global Sidebar UI Active</span>
            </div>
            <div className="flex gap-4 items-center bg-[#131A2A] px-4 py-2 rounded-full border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live Secure Connect</span>
            </div>
          </footer>
        </main>

        {/* REPORT MODAL & PDF OVERLAYS */}
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
                         <input style={{ colorScheme: 'dark' }} type="date" value={reportModal.start} onChange={e=>setReportModal({...reportModal, start: e.target.value})} className="w-full text-sm font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 cursor-pointer" />
                         <input style={{ colorScheme: 'dark' }} type="date" value={reportModal.end} onChange={e=>setReportModal({...reportModal, end: e.target.value})} className="w-full text-sm font-bold text-white bg-[#0B0F19] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 cursor-pointer" />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Market Filter</label>
                      <select value={reportModal.market} onChange={e=>setReportModal({...reportModal, market: e.target.value})} className="w-full px-4 py-3 bg-[#0B0F19] border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 cursor-pointer">
                         <option value="All">Global (All Markets)</option>
                         {uniqueMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">Channel Filter</label>
                      <select value={reportModal.channel} onChange={e=>setReportModal({...reportModal, channel: e.target.value})} className="w-full px-4 py-3 bg-[#0B0F19] border border-white/10 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 cursor-pointer">
                         <option value="All">All Channels</option>
                         {uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}
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
          
          /* Custom scrollbar matching the dark theme */
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(168,85,247,0.5); }
        `}} />
      </SignedIn>
    </div>
  );
}
