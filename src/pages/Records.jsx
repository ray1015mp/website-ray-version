import React, { useState, useMemo } from "react";
import { useSession } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Chart from "react-apexcharts";
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, getDay, subWeeks, startOfToday } from 'date-fns';
import { toDate } from 'date-fns-tz';

import { getPracticeRecords, getPhonemeSummary } from '../api/supabaseAPI';
import { supabase } from "../supabaseClient";
import Loader from "../components/Loader";
import "../styles/Records.css";
import "../styles/Layout.css";

// =================================================================
// ==   數據處理輔助函數 (Data Processing Helpers)                ==
// =================================================================

const safeJsonParse = (str) => {
  if (typeof str === 'string' && str.trim().startsWith('{')) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const processRecordsForCharts = (records, phonemeSummary) => {
  const initialData = {
    progressChart: { dates: [], errorRates: [] },
    phonemeChart: { phonemes: [], errorCounts: [] },
    heatmapChart: [],
    difficultyChart: { levels: [], counts: [] },
  };

  // --- 直接處理音標圖表數據 ---
  if (phonemeSummary) {
    initialData.phonemeChart = {
      phonemes: phonemeSummary.map(p => p.phoneme),
      errorCounts: phonemeSummary.map(p => p.err_amount),
    };
  }

  // --- ✨ 核心修改：重構熱力圖的計算邏輯 ---
  const timeZone = 'Asia/Hong_Kong';
  const practiceCountsByDay = {};
  if (records) {
    records.forEach(rec => {
      const dateStr = format(toDate(parseISO(rec.created_at), { timeZone }), 'yyyy-MM-dd');
      practiceCountsByDay[dateStr] = (practiceCountsByDay[dateStr] || 0) + 1;
    });
  }

  const today = startOfToday();
  const fourWeeksAgo = startOfWeek(subWeeks(today, 3), { weekStartsOn: 1 });
  const dateInterval = eachDayOfInterval({ start: fourWeeksAgo, end: endOfWeek(today, { weekStartsOn: 1 }) });

  const weeksData = {};
  dateInterval.forEach(day => {
    const weekStartDate = startOfWeek(day, { weekStartsOn: 1 });
    const weekKey = format(weekStartDate, 'yyyy-MM-dd');

    if (!weeksData[weekKey]) {
      const weekEndDate = endOfWeek(day, { weekStartsOn: 1 });
      weeksData[weekKey] = {
        name: `${format(weekStartDate, 'MMM d')} - ${format(weekEndDate, 'd')}`,
        data: Array(7).fill(null).map((_, i) => ({ x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i], y: 0, date: null })),
      };
    }

    const dayIndex = (getDay(day) + 6) % 7;
    const dateStr = format(day, 'yyyy-MM-dd');
    weeksData[weekKey].data[dayIndex] = {
      x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex],
      y: practiceCountsByDay[dateStr] || 0,
      date: dateStr,
    };
  });
  initialData.heatmapChart = Object.values(weeksData);
  // --- 熱力圖邏輯結束 ---

  if (!records || records.length === 0) {
    // 即使沒有記錄，也返回帶有空熱力圖的數據
    return initialData;
  }

  // --- 其他圖表計算邏輯 ---
  const progressData = {};
  records.forEach(rec => {
    const dateStr = format(toDate(parseISO(rec.created_at), { timeZone }), 'yyyy-MM-dd');
    if (!progressData[dateStr]) {
      progressData[dateStr] = { totalRate: 0, count: 0 };
    }
    progressData[dateStr].totalRate += rec.error_rate || 0;
    progressData[dateStr].count += 1;
  });
  initialData.progressChart = {
    dates: Object.keys(progressData).sort(),
    errorRates: Object.keys(progressData).sort().map(date => {
      const avgRate = (progressData[date].totalRate / progressData[date].count) * 100;
      return parseFloat(avgRate.toFixed(2));
    }),
  };

  const difficultyCounts = {};
  records.forEach(rec => {
    const level = rec.diffi_level || 'Unknown';
    difficultyCounts[level] = (difficultyCounts[level] || 0) + 1;
  });
  initialData.difficultyChart = {
    levels: Object.keys(difficultyCounts),
    counts: Object.values(difficultyCounts),
  };

  return initialData;
};

const useUserLanguage = (userId) => {
    const { data } = useQuery({
        queryKey: ['userLanguage', userId],
        queryFn: async () => {
            if (!userId) return 'en';
            const { data: settings } = await supabase.from('user_settings').select('language').eq('user_id', userId).single();
            return settings?.language || 'en';
        },
        enabled: !!userId,
        staleTime: Infinity,
    });
    return { practiceLanguage: data };
};

// =================================================================
// ==   Records 組件                                              ==
// =================================================================

export default function Records() {
  const { t } = useTranslation();
  const session = useSession();
  const userId = session?.user?.id;
  const timeZone = 'Asia/Hong_Kong';

  const [sortConfig, setSortConfig] = useState({ key: "created_at", direction: "desc" });
  const [expandedRow, setExpandedRow] = useState(null);
  
  const { practiceLanguage } = useUserLanguage(userId);

  const { data: rawRecords, isLoading: isLoadingRecords, isError: isRecordsError } = useQuery({
    queryKey: ['practiceRecords', userId],
    queryFn: () => getPracticeRecords(userId),
    enabled: !!userId,
  });

  const { data: phonemeSummary, isLoading: isLoadingPhoneme, isError: isPhonemeError } = useQuery({
    queryKey: ['phonemeSummary', userId, practiceLanguage],
    queryFn: () => getPhonemeSummary(userId, practiceLanguage),
    enabled: !!userId && !!practiceLanguage,
  });

  const chartData = useMemo(() => processRecordsForCharts(rawRecords, phonemeSummary), [rawRecords, phonemeSummary]);
  
  const sortedRecords = useMemo(() => {
    if (!rawRecords) return [];
    const sorted = [...rawRecords].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === "error_rate") {
        valA = parseFloat(valA);
        valB = parseFloat(valB);
      }
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rawRecords, sortConfig]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const getSortClassName = (key) => {
    if (sortConfig.key !== key) return "sortable";
    return `sortable active ${sortConfig.direction}`;
  };

  const progressChartOptions = { chart: { id: "progress", toolbar: { show: false }, background: "transparent" }, xaxis: { categories: chartData.progressChart.dates }, stroke: { curve: "smooth", width: 3 }, colors: ["#4f46e5"], markers: { size: 5 }, grid: { borderColor: "#e2e8f0" }, yaxis: { labels: { formatter: (val) => val.toFixed(0) + "%" } }, tooltip: { y: { formatter: (val) => val.toFixed(2) + "%" } } };
  const phonemeChartOptions = { chart: { id: "phoneme", type: "bar", toolbar: { show: false }, background: "transparent" }, plotOptions: { bar: { horizontal: true, barHeight: "50%", borderRadius: 4 } }, xaxis: { categories: chartData.phonemeChart.phonemes }, colors: ["#f59e0b"], grid: { borderColor: "#e2e8f0" } };
  
  // ✨ [核心修改] 更新熱力圖的 options
  const heatmapChartOptions = { 
    chart: { 
      type: "heatmap", 
      toolbar: { show: false }, 
      background: "transparent",
      fontFamily: "'SF Pro Display', sans-serif",
    }, 
    plotOptions: { 
      heatmap: { 
        radius: 4, 
        enableShades: false, // ✨ 關閉陰影以獲得原始圖片的純色塊效果
        colorScale: { 
          ranges: [
            // 顏色代碼已從原始圖片中精確提取
            { from: 0, to: 0, name: "None", color: "#ebedf0" }, 
            { from: 1, to: 5, name: "Low", color: "#9be9a8" }, 
            { from: 6, to: 10, name: "Medium", color: "#40c463" }, 
            { from: 11, to: 15, name: "High", color: "#30a14e" },
            { from: 16, to: 9999, name: "Very High", color: "#216e39" }
          ] 
        } 
      } 
    }, 
    stroke: { width: 2, colors: ["#ffffff"] }, 
    dataLabels: { enabled: false }, 
    legend: { 
      position: "top", 
      horizontalAlign: "left",
      fontSize: '13px',
      markers: {
        width: 12,
        height: 12,
        radius: 2,
      },
      itemMargin: {
        horizontal: 10,
      }
    }, 
    xaxis: { type: "category", categories: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }, 
    grid: { show: false },
    tooltip: { 
      theme: 'light', 
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const point = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        if (!point || point.date === null) return '';
        
        const practiceCount = point.y;
        const date = format(parseISO(point.date), 'MMM d, yyyy');
        
        return `<div class="apexcharts-tooltip-custom">
                  <span>${date}: <b>${practiceCount}</b> practices</span>
                </div>`;
      }
    } 
  };
  
  const difficultyChartOptions = { chart: { type: "donut", background: "transparent" }, labels: chartData.difficultyChart.levels, colors: ["#67e8f9", "#38bdf8", "#0ea5e9", "#0284c7"], legend: { position: "bottom" }, dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + "%" }, plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: "Total Practices" } } } } } };

  if (isLoadingRecords || isLoadingPhoneme) {
    return <main className="main-content width-records"><h1 className="page-title">{t('recordsPage.title')}</h1><Loader /></main>;
  }
  if (isRecordsError || isPhonemeError) {
    return <main className="main-content width-records"><p>Error loading records.</p></main>;
  }
  
  // 修改無數據時的判斷，確保即使 records 為空，圖表也能渲染
  const hasAnyData = rawRecords && rawRecords.length > 0;

  return (
    <main className="main-content width-records">
      <h1 className="page-title">{t('recordsPage.title')}</h1>
      <div className="dashboard-grid">
        <div className="chart-card"><h3 className="chart-title">{t('recordsPage.overallProgress')}</h3><Chart options={progressChartOptions} series={[{ name: "Avg Error Rate", data: chartData.progressChart.errorRates }]} type="line" height={300} /></div>
        <div className="chart-card"><h3 className="chart-title">{t('recordsPage.frequentErrors')}</h3><Chart options={phonemeChartOptions} series={[{ name: "Errors", data: chartData.phonemeChart.errorCounts }]} type="bar" height={300} /></div>
        <div className="chart-card"><h3 className="chart-title">{t('recordsPage.weeklyFrequency')}</h3><Chart options={heatmapChartOptions} series={chartData.heatmapChart} type="heatmap" height={300} /></div>
        <div className="chart-card"><h3 className="chart-title">{t('recordsPage.difficultyDistribution')}</h3><Chart options={difficultyChartOptions} series={chartData.difficultyChart.counts} type="donut" height={300} /></div>
      </div>
      
      {hasAnyData ? (
        <div className="records-section">
          <h2 className="page-title" style={{ fontSize: "1.8rem", marginBottom: "1.5rem" }}>{t('recordsPage.detailedHistory')}</h2>
          <table className="records-table">
            <thead>
              <tr>
                <th className={getSortClassName("created_at")} onClick={() => handleSort("created_at")}>{t('recordsPage.table.date')}</th>
                <th>{t('recordsPage.table.targetWord')}</th>
                <th>{t('recordsPage.table.difficulty')}</th>
                <th className={getSortClassName("error_rate")} onClick={() => handleSort("error_rate")}>{t('recordsPage.table.errorRate')}</th>
                <th>{t('recordsPage.table.errorPhonemes')}</th>
                <th>{t('recordsPage.table.details')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRecords.map((record) => (
                <React.Fragment key={record.psid}>
                  <tr>
                    <td>{format(toDate(parseISO(record.created_at), { timeZone }), 'yyyy-MM-dd HH:mm')}</td>
                    <td>{record.target_word}</td>
                    <td>{record.diffi_level}</td>
                    <td>{`${((record.error_rate || 0) * 100).toFixed(2)}%`}</td>
                    <td>{safeJsonParse(record.full_log)?.errorSummary?.join(', ') || 'N/A'}</td>
                    <td><button className="details-btn" onClick={() => setExpandedRow(expandedRow === record.psid ? null : record.psid)}>{expandedRow === record.psid ? t('recordsPage.table.hide') : t('recordsPage.table.details')}</button></td>
                  </tr>
                  {expandedRow === record.psid && (
                    <tr className="details-row"><td colSpan="6"><div className="details-content"><pre>{record.full_log}</pre></div></td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No practice records found yet. Start practicing to see your progress!</p>
      )}
    </main>
  );
}
