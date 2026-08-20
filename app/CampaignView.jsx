import React, { useState, useMemo } from 'react';
import InfoTooltip from './components/InfoTooltip';
import * as d3 from 'd3';
import { ChevronDown, Calendar, Layers, Activity } from 'lucide-react';

const COLORS = ['#74FA93', '#c88214', '#00937b', '#EF4444', '#065c5d', '#10B981', '#eef7f5', '#6fa89f'];

export default function CampaignView({ adData, exRate = 1, exSym = '$', formatShort = (v) => v, userRole }) {
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedPhases, setSelectedPhases] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState({}); // { phaseName: [channelNames] }

  // 1. Process Campaigns
  const campaigns = useMemo(() => {
    return Array.from(new Set(adData.map(d => d.campaignName))).sort();
  }, [adData]);

  // Set default campaign
  React.useEffect(() => {
    if (!selectedCampaign && campaigns.length > 0) {
      setSelectedCampaign(campaigns[0]);
    }
  }, [campaigns, selectedCampaign]);

  // 2. Process data for selected campaign
  const campaignData = useMemo(() => {
    if (!selectedCampaign) return [];
    return adData.filter(d => d.campaignName === selectedCampaign && d.dateObj);
  }, [adData, selectedCampaign]);

  // 3. Extract Phases and Channels with their min/max dates and bursts
  const { phases, campaignMinDate, campaignMaxDate } = useMemo(() => {
    if (campaignData.length === 0) return { phases: [], campaignMinDate: new Date(), campaignMaxDate: new Date() };

    const cMin = d3.min(campaignData, d => d.dateObj);
    const cMax = d3.max(campaignData, d => d.dateObj);

    // Helper to extract bursts of activity (gaps > 1.5 days mean a new burst)
    const getBursts = (rows) => {
      if (rows.length === 0) return [];
      const times = Array.from(new Set(rows.map(r => r.dateObj.getTime()))).sort((a,b) => a - b);
      const bursts = [];
      let currentStart = times[0];
      let currentEnd = times[0];
      const gapThreshold = 129600000; // 1.5 days in ms
      
      for (let i = 1; i < times.length; i++) {
        const t = times[i];
        if ((t - currentEnd) > gapThreshold) {
          bursts.push({ start: new Date(currentStart), end: new Date(currentEnd) });
          currentStart = t;
        }
        currentEnd = t;
      }
      bursts.push({ start: new Date(currentStart), end: new Date(currentEnd) });
      return bursts;
    };

    const groupedByPhase = d3.group(campaignData, d => d.phase);
    
    const phaseList = Array.from(groupedByPhase, ([phaseName, phaseRows]) => {
      const pMin = d3.min(phaseRows, d => d.dateObj);
      const pMax = d3.max(phaseRows, d => d.dateObj);
      
      const groupedByChannel = d3.group(phaseRows, d => d.channel);
      const channelList = Array.from(groupedByChannel, ([channelName, chRows]) => {
        return {
          name: channelName,
          minDate: d3.min(chRows, d => d.dateObj),
          maxDate: d3.max(chRows, d => d.dateObj),
          bursts: getBursts(chRows)
        };
      }).sort((a, b) => a.minDate - b.minDate);

      return {
        name: phaseName,
        minDate: pMin,
        maxDate: pMax,
        bursts: getBursts(phaseRows),
        channels: channelList
      };
    }).sort((a, b) => a.minDate - b.minDate);

    return { phases: phaseList, campaignMinDate: cMin, campaignMaxDate: cMax };
  }, [campaignData]);

  // Create time scale for percentage calculations
  const timeScale = useMemo(() => {
    if (!campaignMinDate || !campaignMaxDate) return null;
    // Add a little padding to the ends
    const min = new Date(campaignMinDate);
    min.setDate(min.getDate() - 2);
    const max = new Date(campaignMaxDate);
    max.setDate(max.getDate() + 2);
    
    return d3.scaleTime().domain([min, max]).range([0, 100]);
  }, [campaignMinDate, campaignMaxDate]);

  // Generate ticks for the X-axis
  const ticks = useMemo(() => {
    if (!timeScale) return [];
    return timeScale.ticks(d3.timeWeek.every(2)).map(date => ({
      date,
      percent: timeScale(date),
      label: d3.timeFormat('%b %d')(date)
    }));
  }, [timeScale]);

  const togglePhase = (phaseName) => {
    setSelectedPhases(prev => 
      prev.includes(phaseName) ? prev.filter(p => p !== phaseName) : [...prev, phaseName]
    );
  };

  const toggleChannel = (phaseName, channelName) => {
    setSelectedChannels(prev => {
      const current = prev[phaseName] || [];
      const next = current.includes(channelName) 
        ? current.filter(c => c !== channelName)
        : [...current, channelName];
      return { ...prev, [phaseName]: next };
    });
  };

  // Calculate table data based on selections
  const tableData = useMemo(() => {
    if (!selectedCampaign) return [];
    let data = campaignData;

    if (selectedPhases.length > 0) {
      data = data.filter(d => selectedPhases.includes(d.phase));
      const hasAnyChannelSelection = selectedPhases.some(p => selectedChannels[p] && selectedChannels[p].length > 0);
      if (hasAnyChannelSelection) {
        data = data.filter(d => {
          const activeChs = selectedChannels[d.phase] || [];
          return activeChs.length === 0 || activeChs.includes(d.channel);
        });
      }
    }

    const grouped = d3.groups(data, d => d.channel).map(([channel, rows]) => {
      const impressions = d3.sum(rows, d => d.impressions);
      const clicks = d3.sum(rows, d => d.clicks);
      const views = d3.sum(rows, d => d.videoViews);
      const spend = d3.sum(rows, d => d.cost);
      
      return {
        channel,
        spend,
        impressions,
        clicks,
        views,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpv: views > 0 ? spend / views : 0
      };
    });
    return grouped.sort((a,b) => b.spend - a.spend);
  }, [campaignData, selectedCampaign, selectedPhases, selectedChannels]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-7xl mx-auto">
      {/* Top Controls */}
      <div className="card-surface backdrop-blur-2xl p-6 rounded-3xl border border-[#c88214]/20 shadow-xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex-1 w-full md:w-auto">
          <label className="text-[10px] font-black text-[#6fa89f] uppercase tracking-widest mb-2 block flex items-center gap-2">
            <Layers size={14} /> Selected Tournament
          </label>
          <div className="relative">
            <select 
              value={selectedCampaign} 
              onChange={e => {
                setSelectedCampaign(e.target.value);
                setSelectedPhases([]);
                setSelectedChannels({});
              }}
              className="w-full md:max-w-xs bg-[#011414] text-[#c88214] text-sm font-bold pl-4 pr-10 py-3 rounded-xl border border-[#c88214]/30 outline-none appearance-none cursor-pointer hover:border-[#c88214] transition-colors"
            >
              {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#c88214] pointer-events-none" size={16} />
          </div>
        </div>

        {selectedCampaign && phases.length > 0 && (
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-[#6fa89f] uppercase tracking-widest mb-2 block flex items-center gap-2">
              <Activity size={14} /> Active Phases ({phases.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {phases.map((p, i) => {
                const isActive = selectedPhases.includes(p.name);
                const color = COLORS[i % COLORS.length];
                return (
                  <button
                    key={p.name}
                    onClick={() => togglePhase(p.name)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border`}
                    style={{
                      backgroundColor: isActive ? `${color}20` : '#0C272D',
                      borderColor: isActive ? color : 'rgba(116, 250, 147, 0.2)',
                      color: isActive ? color : '#6fa89f'
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
              {selectedPhases.length > 0 && (
                <button 
                  onClick={() => { setSelectedPhases([]); setSelectedChannels({}); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-400/10 transition-colors ml-auto border border-transparent"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Gantt Chart */}
      {selectedCampaign && selectedPhases.length > 0 && timeScale && (
        <div className="card-surface backdrop-blur-2xl p-8 rounded-3xl border border-[#c88214]/20 shadow-xl overflow-hidden relative">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-[#eef7f5] flex items-center gap-3">
              <Calendar className="text-[#c88214]" /> Tournament Timeline
              <InfoTooltip definition="Definition for Tournament Timeline" />
            </h3>
            <div className="text-xs font-bold text-[#6fa89f] bg-[#011414] px-4 py-2 rounded-lg border border-[#c88214]/10">
              {d3.timeFormat('%b %d, %Y')(campaignMinDate)} - {d3.timeFormat('%b %d, %Y')(campaignMaxDate)}
            </div>
          </div>

          <div className="relative pt-6 pb-4 overflow-x-auto custom-scrollbar">
            <div className="min-w-[800px] relative">
              {/* X-Axis Ticks */}
              <div className="absolute top-0 left-[200px] right-0 h-full pointer-events-none">
                {ticks.map((tick, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-[#c88214]/10 flex flex-col justify-start" style={{ left: `${tick.percent}%` }}>
                    <span className="text-[9px] font-black text-[#6fa89f] uppercase tracking-widest -ml-4 -mt-6 card-surface backdrop-blur-2xl px-1">{tick.label}</span>
                  </div>
                ))}
              </div>

              {/* Gantt Rows */}
              <div className="relative z-10 flex flex-col gap-6 mt-4">
                {phases.filter(p => selectedPhases.includes(p.name)).map((phase, i) => {
                  const pColor = COLORS[phases.findIndex(p0 => p0.name === phase.name) % COLORS.length];
                  const pLeft = timeScale(phase.minDate);
                  const pWidth = timeScale(phase.maxDate) - pLeft;
                  const activeChannels = selectedChannels[phase.name] || [];

                  return (
                    <div key={phase.name} className="flex flex-col gap-2">
                      
                      {/* Phase Row */}
                      <div className="flex items-center gap-4">
                        {/* Label */}
                        <div className="w-[184px] flex-shrink-0 text-right pr-4 border-r border-[#c88214]/20">
                          <h4 className="text-sm font-bold" style={{ color: pColor }}>{phase.name}</h4>
                          <p className="text-[10px] text-[#6fa89f]">{d3.timeFormat('%b %d')(phase.minDate)} - {d3.timeFormat('%b %d')(phase.maxDate)}</p>
                        </div>
                        {/* Bar Area */}
                        <div className="flex-1 relative h-10 bg-[#011414]/50 rounded-lg overflow-hidden group">
                          {phase.bursts.map((b, bi) => {
                            const bLeft = timeScale(b.start);
                            const bWidth = timeScale(b.end) - bLeft;
                            return (
                              <div 
                                key={bi}
                                className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-lg transition-all duration-500 flex items-center justify-center overflow-hidden cursor-pointer"
                                style={{ 
                                  left: `${bLeft}%`, 
                                  width: `${Math.max(bWidth, 0.5)}%`, 
                                  backgroundColor: pColor,
                                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)'
                                }}
                                title={`${phase.name}: ${d3.timeFormat('%b %d, %Y')(b.start)} to ${d3.timeFormat('%b %d, %Y')(b.end)}`}
                              >
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Channel Controls for this Phase */}
                      <div className="ml-[200px] flex gap-2 flex-wrap mb-2">
                        {phase.channels.map(ch => {
                          const isChActive = activeChannels.includes(ch.name);
                          return (
                            <button
                              key={ch.name}
                              onClick={() => toggleChannel(phase.name, ch.name)}
                              className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all border`}
                              style={{
                                backgroundColor: isChActive ? `${pColor}15` : 'transparent',
                                borderColor: isChActive ? pColor : 'rgba(255,255,255,0.1)',
                                color: isChActive ? pColor : '#6fa89f'
                              }}
                            >
                              {ch.name}
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Channel Bars */}
                      {activeChannels.map(chName => {
                        const chData = phase.channels.find(c => c.name === chName);
                        if (!chData) return null;

                        return (
                          <div key={chName} className="flex items-center gap-4 mt-1">
                            <div className="w-[184px] flex-shrink-0 text-right pr-4">
                              <span className="text-xs font-medium text-[#eef7f5]">{chName}</span>
                            </div>
                            <div className="flex-1 relative h-6 bg-[#011414]/30 rounded-md">
                              {chData.bursts.map((b, bi) => {
                                const chLeft = timeScale(b.start);
                                const chWidth = timeScale(b.end) - chLeft;
                                return (
                                  <div 
                                    key={bi}
                                    className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full transition-all duration-500 cursor-pointer"
                                    style={{ 
                                      left: `${chLeft}%`, 
                                      width: `${Math.max(chWidth, 0.2)}%`, 
                                      backgroundColor: pColor,
                                      opacity: 0.7
                                    }}
                                    title={`${chName} Live Duration: ${d3.timeFormat('%b %d, %Y')(b.start)} to ${d3.timeFormat('%b %d, %Y')(b.end)}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Table */}
      {selectedCampaign && tableData.length > 0 && (
        <div className="card-surface backdrop-blur-2xl p-8 rounded-3xl border border-[#c88214]/20 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-[#eef7f5] flex items-center gap-3">
              <Activity className="text-[#c88214]" /> Performance Metrics Breakdown
              <InfoTooltip definition="Definition for Performance Metrics Breakdown" />
            </h3>
            <span className="text-xs font-bold text-[#6fa89f] bg-[#011414] px-4 py-2 rounded-lg border border-[#c88214]/10">
              Based on Selection
            </span>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#c88214]/20">
                  <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 rounded-tl-xl">Channel</th>
                  {userRole !== 'non-finance' && <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">Spend</th>}
                  <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">Impressions</th>
                  <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">Clicks</th>
                  <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">Video Views</th>
                  <th className={`py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right ${userRole === 'non-finance' ? 'rounded-tr-xl' : ''}`}>CTR</th>
                  {userRole !== 'non-finance' && (
                    <>
                      <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">CPM</th>
                      <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right">CPC</th>
                      <th className="py-4 px-4 text-[10px] font-black text-[#6fa89f] uppercase tracking-widest bg-[#011414]/50 text-right rounded-tr-xl">CPV</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={row.channel} className={`border-b border-[#c88214]/10 hover:bg-[#74FA93]/5 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#011414]/20'}`}>
                    <td className="py-4 px-4 text-sm font-bold text-[#eef7f5]">{row.channel}</td>
                    {userRole !== 'non-finance' && <td className="py-4 px-4 text-sm font-medium text-white text-right">{exSym}{d3.format(",.2f")(row.spend * exRate)}</td>}
                    <td className="py-4 px-4 text-sm font-medium text-[#c88214] text-right">{d3.format(",")(row.impressions)}</td>
                    <td className="py-4 px-4 text-sm font-medium text-[#6fa89f] text-right">{d3.format(",")(row.clicks)}</td>
                    <td className="py-4 px-4 text-sm font-medium text-[#c88214] text-right">{formatShort(row.views)}</td>
                    <td className="py-4 px-4 text-sm font-bold text-white text-right">{row.ctr.toFixed(2)}%</td>
                    {userRole !== 'non-finance' && (
                      <>
                        <td className="py-4 px-4 text-sm font-medium text-white text-right">{exSym}{d3.format(",.2f")(row.cpm * exRate)}</td>
                        <td className="py-4 px-4 text-sm font-medium text-white text-right">{exSym}{d3.format(",.2f")(row.cpc * exRate)}</td>
                        <td className="py-4 px-4 text-sm font-medium text-white text-right">{exSym}{d3.format(",.2f")(row.cpv * exRate)}</td>
                      </>
                    )}
                  </tr>
                ))}
                {tableData.length > 0 && (() => {
                  const tSpend = d3.sum(tableData, d => d.spend);
                  const tImp = d3.sum(tableData, d => d.impressions);
                  const tClicks = d3.sum(tableData, d => d.clicks);
                  const tViews = d3.sum(tableData, d => d.views);
                  const tCtr = tImp > 0 ? (tClicks / tImp) * 100 : 0;
                  const tCpm = tImp > 0 ? (tSpend / tImp) * 1000 : 0;
                  const tCpc = tClicks > 0 ? tSpend / tClicks : 0;
                  const tCpv = tViews > 0 ? tSpend / tViews : 0;
                  return (
                    <tr className="bg-[#011414]/80 border-t-2 border-[#c88214]/50">
                      <td className="py-4 px-4 text-sm font-black text-[#c88214]">Total</td>
                      {userRole !== 'non-finance' && <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{exSym}{d3.format(",.2f")(tSpend * exRate)}</td>}
                      <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{d3.format(",")(tImp)}</td>
                      <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{d3.format(",")(tClicks)}</td>
                      <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{formatShort(tViews)}</td>
                      <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{tCtr.toFixed(2)}%</td>
                      {userRole !== 'non-finance' && (
                        <>
                          <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{exSym}{d3.format(",.2f")(tCpm * exRate)}</td>
                          <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{exSym}{d3.format(",.2f")(tCpc * exRate)}</td>
                          <td className="py-4 px-4 text-sm font-black text-[#c88214] text-right">{exSym}{d3.format(",.2f")(tCpv * exRate)}</td>
                        </>
                      )}
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
