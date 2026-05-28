const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'money-cash-state.json');
const publicStatePath = path.join(root, 'public', 'outputs', 'money-cash-state.json');
const libraryPath = path.join(root, 'config', 'historical-set-points.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function rounded(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (!Number.isFinite(da.getTime()) || !Number.isFinite(db.getTime())) return null;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function nearestObservation(rows, targetDate, maxDistanceDays = 45) {
  const valid = [...(rows || [])].filter(row => row.date && Number.isFinite(row.value));
  if (!valid.length || !targetDate) return null;
  let best = null;
  for (const row of valid) {
    const distance = dateDistanceDays(row.date, targetDate);
    if (!Number.isFinite(distance)) continue;
    if (!best || distance < best.distance_days) best = { ...row, distance_days: distance };
  }
  return best && best.distance_days <= maxDistanceDays ? best : null;
}

function rowsBetween(rows, start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = end ? new Date(`${end}T00:00:00Z`) : new Date();
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return [];
  return [...(rows || [])].filter(row => {
    const d = new Date(`${row.date}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d >= startDate && d <= endDate && Number.isFinite(row.value);
  });
}

function summarizeRange(rows) {
  const values = rows.map(row => row.value).filter(Number.isFinite);
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    start_date: rows[0]?.date || null,
    end_date: rows[rows.length - 1]?.date || null,
    observations: values.length,
    min: rounded(Math.min(...values)),
    max: rounded(Math.max(...values)),
    average: rounded(avg),
    start_value: rounded(rows[0]?.value),
    end_value: rounded(rows[rows.length - 1]?.value)
  };
}

function currentValueFor(seriesId, state) {
  if (state?.derived?.[seriesId] && Number.isFinite(state.derived[seriesId].value)) return state.derived[seriesId].value;
  if (state?.datasets?.[seriesId] && Number.isFinite(state.datasets[seriesId].latest_value)) return state.datasets[seriesId].latest_value;
  return null;
}

function relevantSetPoints(library, assetClass) {
  return (library?.setPoints || []).filter(point => (point.relevant_asset_classes || []).includes(assetClass));
}

function buildAnnotationForPoint({ point, chartId, chart, state }) {
  const series = chart?.series || {};
  const values = {};
  const currentComparison = {};
  let supported = false;

  for (const [seriesId, rows] of Object.entries(series)) {
    const currentValue = currentValueFor(seriesId, state);

    if (point.annotation_type === 'regime_band' || point.date_end) {
      const rangeRows = rowsBetween(rows, point.date_start, point.date_end);
      const summary = summarizeRange(rangeRows);
      values[seriesId] = summary;
      if (summary) {
        supported = true;
        currentComparison[seriesId] = Number.isFinite(currentValue) ? {
          current_value: rounded(currentValue),
          regime_average: summary.average,
          difference_from_regime_average: rounded(currentValue - summary.average),
          comparison_basis: 'current minus historical regime average'
        } : null;
      } else {
        currentComparison[seriesId] = null;
      }
    } else {
      const eventValue = nearestObservation(rows, point.date_start);
      values[seriesId] = eventValue ? {
        date: eventValue.date,
        value: rounded(eventValue.value),
        distance_days: eventValue.distance_days
      } : null;
      if (eventValue) {
        supported = true;
        currentComparison[seriesId] = Number.isFinite(currentValue) ? {
          current_value: rounded(currentValue),
          event_value: rounded(eventValue.value),
          difference_from_event: rounded(currentValue - eventValue.value),
          comparison_basis: 'current minus historical set-point value'
        } : null;
      } else {
        currentComparison[seriesId] = null;
      }
    }
  }

  if (!supported) {
    return {
      supported: false,
      suppressed: {
        id: `${chartId}_${point.id}`,
        chart_id: chartId,
        historical_set_point_id: point.id,
        label: point.label,
        reason: 'No chart series had data covering this historical set point or regime window.'
      }
    };
  }

  return {
    supported: true,
    annotation: {
      id: `${chartId}_${point.id}`,
      chart_id: chartId,
      type: point.annotation_type || 'historical_set_point',
      historical_set_point_id: point.id,
      label: point.label,
      date_start: point.date_start,
      date_end: point.date_end || null,
      era: point.era,
      category: point.category,
      confidence: point.confidence,
      why_it_matters: point.why_it_matters,
      values,
      current_comparison: currentComparison,
      render_hint: point.date_end ? 'regime band with range values and current comparison' : 'vertical marker with values and current comparison'
    }
  };
}

function main() {
  const state = readJson(statePath);
  const library = readJson(libraryPath);
  if (!state) throw new Error(`Missing ${statePath}; run generate-money-cash-state first.`);
  if (!library) throw new Error(`Missing ${libraryPath}.`);

  const chartSeries = state.chart_series || {};
  const setPoints = relevantSetPoints(library, 'Money / Cash');
  const charts = {};
  const suppressed = [];

  for (const [chartId, chart] of Object.entries(chartSeries)) {
    charts[chartId] = [];
    for (const point of setPoints) {
      const result = buildAnnotationForPoint({ point, chartId, chart, state });
      if (result.supported) charts[chartId].push(result.annotation);
      else suppressed.push(result.suppressed);
    }
  }

  const updated = {
    ...state,
    version: Math.max(Number(state.version || 0), 4),
    annotation_spec: {
      source: 'config/historical-set-points.json',
      policy: library.rule,
      historical_set_points_considered: setPoints.map(point => point.id),
      charts,
      suppressed,
      current_markers: Object.entries(state.web_summary?.current_reading || {}).map(([seriesId, value]) => ({
        id: `current_${seriesId}`,
        type: 'current_value_marker',
        series_id: seriesId,
        value: rounded(value),
        label: `Current ${seriesId}: ${Number.isFinite(value) ? rounded(value) : 'n/a'}`
      }))
    },
    generator: {
      ...(state.generator || {}),
      annotation_source: 'config/historical-set-points.json',
      annotation_policy: 'Annotate every relevant historical set point that is backed by the chart dataset; suppress unsupported set points rather than hallucinating values.'
    }
  };

  writeJson(statePath, updated);
  writeJson(publicStatePath, updated);
  console.log(`generated money-cash annotations: ${setPoints.length} set points considered, ${suppressed.length} unsupported chart annotations suppressed`);
}

main();
