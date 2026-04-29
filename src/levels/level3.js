import * as d3 from 'd3';
import {
  charColor,
  fmt,
  hideTooltip,
  positionTooltip,
  showTooltip,
} from '../shared/chart-helpers.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const LEVEL3_TEMPLATE = `
  <section id="level-3-intro" class="level-shell">
    <div class="section-inner level-hero">
      <div class="level-hero__copy">
        <span class="level-hero__eyebrow">Level 3</span>
        <h1 class="level-hero__title">Character Relationships</h1>
        <p class="level-hero__lede">
          Who speaks to each other? Explore character interactions through network visualizations.
        </p>
      </div>
      <div class="level-hero__controls">
        <div class="scope-control level-scope-control" role="group" aria-label="Season filter">
          <button class="scope-btn active" data-season="all" title="All seasons combined">
            All Seasons
          </button>
          ${Array.from({length: 18}, (_, i) => i + 1).map(season => `
            <button class="scope-btn" data-season="${season}" title="Season ${season} only">
              Season ${season}
            </button>
          `).join('')}
        </div>
        <p class="level-hero__note">
          Select a season to see relationships within that season, or view all seasons combined.
        </p>
      </div>
    </div>
  </section>

  <section id="level-3-network" class="page-section">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-num">01</span>
        <h2 class="section-title">Interaction network</h2>
        <p class="section-lede">
          Outer arcs group dialogue-linked turns by character; ribbons connect pairs. Thicker ribbons mean more
          consecutive exchanges in the selected scope.
        </p>
      </div>
      <div class="chart-area chart-area--network" id="chart-network" aria-label="Chord diagram: character relationships">
        <div class="chart-loading">Loading…</div>
      </div>
      <p class="chart-note chart-note--level3">
        <strong>How to read</strong> — Hover arcs for each character’s total linked turns in this view.
        Hover ribbons for counts between two characters (including aggregated “Other”). Metric = consecutive dialogue turns in the same scene.
      </p>
    </div>
  </section>
`;

export const level3View = {
  id: 'level-3',
  label: 'Level 3: Character Relationships',
  shortLabel: 'Level 3',
  defaultSection: 'level-3-network',
  sections: [
    { id: 'level-3-network', label: 'Network' },
  ],
  render(ctx) {
    ctx.container.innerHTML = LEVEL3_TEMPLATE;

    const chartEl = ctx.container.querySelector('#chart-network');
    const seasonBtns = ctx.container.querySelectorAll('.scope-btn');

    let networkData = null;
    let hierarchyData = null;
    let currentSeason = 'all';

    // Load data
    Promise.all([
      ctx.loadDataset('network'),
      ctx.loadDataset('hierarchy')
    ]).then(([network, hierarchy]) => {
      networkData = network;
      hierarchyData = hierarchy;
      drawChart();
    });

    // Season selection
    seasonBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        seasonBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSeason = btn.dataset.season;
        drawChart();
      });
    });

    function drawChart() {
      if (!networkData || !hierarchyData) return;

      const data = networkData[currentSeason];
      if (!data) return;

      // Get the 4 main boys and major characters with >25% screentime (episode presence)
      const mainBoys = ['Cartman', 'Stan', 'Kyle', 'Kenny'];
      const totalEpisodes = 257; // from meta
      const screentimeThreshold = 0.40 * totalEpisodes; // >102 episodes
      const majorOthers = hierarchyData
        .filter(d => d.episodeCount > screentimeThreshold && !mainBoys.includes(d.character))
        .map(d => d.character);
      const allTop = [...mainBoys, ...majorOthers];
      const topSet = new Set(allTop);
      const otherIndex = allTop.length;
      const newNodes = [...allTop, 'Other'];

      // Aggregate links
      const linkMap = new Map();
      data.links.forEach(link => {
        const s = data.nodes[link.source];
        const t = data.nodes[link.target];
        const sIn = topSet.has(s);
        const tIn = topSet.has(t);
        let newS, newT;
        if (sIn && tIn) {
          newS = allTop.indexOf(s);
          newT = allTop.indexOf(t);
        } else if (sIn) {
          newS = allTop.indexOf(s);
          newT = otherIndex;
        } else if (tIn) {
          newS = otherIndex;
          newT = allTop.indexOf(t);
        } else {
          newS = otherIndex;
          newT = otherIndex;
        }
        const key = `${newS}-${newT}`;
        if (!linkMap.has(key)) linkMap.set(key, 0);
        linkMap.set(key, linkMap.get(key) + link.value);
      });

      const newLinks = Array.from(linkMap, ([key, value]) => {
        const [s, t] = key.split('-').map(Number);
        return { source: s, target: t, value };
      });

      // Now use newNodes and newLinks
      const processedData = { nodes: newNodes, links: newLinks };

      chartEl.innerHTML = '';

      const containerWidth = Math.max(chartEl.clientWidth - 32, 320);
      const width = Math.min(containerWidth, 800);
      const height = width;
      const outerRadius = Math.min(width, height) * 0.5 - 40;
      const innerRadius = outerRadius - 30;

      const svg = d3.select(chartEl)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height]);

      const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending)
        .sortChords(d3.descending);

      // Build matrix from links
      const n = processedData.nodes.length;
      const matrix = Array.from({length: n}, () => Array(n).fill(0));
      processedData.links.forEach(link => {
        matrix[link.source][link.target] = link.value;
      });

      function scopeLabel() {
        return currentSeason === 'all' ? 'All seasons' : `Season ${currentSeason}`;
      }

      function arcTooltipHtml(d) {
        const name = processedData.nodes[d.index];
        return `
    <strong>${escapeHtml(name)}</strong>
    <div class="t-row"><span class="t-label">Total linked turns</span><span class="t-val">${fmt(d.value)}</span></div>
    <div class="t-row"><span class="t-label">Scope</span><span class="t-val">${escapeHtml(scopeLabel())}</span></div>
    <p class="t-caption">Sum of directed dialogue-linked turns with others in this view.</p>`;
      }

      function ribbonTooltipHtml(d) {
        const a = processedData.nodes[d.source.index];
        const b = processedData.nodes[d.target.index];
        const forward = d.source.value;
        const reverse = matrix[d.target.index][d.source.index];
        let rowHtml;
        if (reverse > 0 && reverse !== forward) {
          rowHtml = `
    <div class="t-row"><span class="t-label">${escapeHtml(a)} → ${escapeHtml(b)}</span><span class="t-val">${fmt(forward)}</span></div>
    <div class="t-row"><span class="t-label">${escapeHtml(b)} → ${escapeHtml(a)}</span><span class="t-val">${fmt(reverse)}</span></div>`;
        } else {
          rowHtml = `
    <div class="t-row"><span class="t-label">Interactions</span><span class="t-val">${fmt(forward)}</span></div>`;
        }
        return `
    <strong>${escapeHtml(a)} ↔ ${escapeHtml(b)}</strong>
    ${rowHtml}
    <div class="t-row"><span class="t-label">Scope</span><span class="t-val">${escapeHtml(scopeLabel())}</span></div>
    <p class="t-caption">Directed counts between nodes; minor speakers are grouped under Other.</p>`;
      }

      const chords = chord(matrix);

      const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

      const ribbon = d3.ribbon()
        .radius(innerRadius);

      const otherColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--cluster-other').trim() || '#6e7490';

      const colorFor = name => name === 'Other'
        ? otherColor
        : charColor(name);

      // Groups
      const group = svg.append('g')
        .selectAll('g')
        .data(chords.groups)
        .join('g');

      group.append('path')
        .classed('chord-arc', true)
        .style('pointer-events', 'all')
        .attr('fill', d => colorFor(processedData.nodes[d.index]))
        .attr('d', arc)
        .on('mouseover', function(event, d) {
          showTooltip(arcTooltipHtml(d), event);
        })
        .on('mousemove', function(event) {
          positionTooltip(event);
        })
        .on('mouseout', function() {
          hideTooltip();
        });

      group.append('text')
        .attr('class', 'chord-sector-label')
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '.35em')
        .attr('transform', d => `
          rotate(${(d.angle * 180 / Math.PI - 90)})
          translate(${outerRadius + 10})
          ${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
        .attr('text-anchor', d => d.angle > Math.PI ? 'end' : null)
        .text(d => processedData.nodes[d.index]);

      // Ribbons
      svg.append('g')
        .attr('class', 'chord-ribbon-layer')
        .attr('fill-opacity', 0.67)
        .selectAll('path')
        .data(chords)
        .join('path')
        .classed('chord-ribbon', true)
        .attr('d', ribbon)
        .attr('fill', d => colorFor(processedData.nodes[d.source.index]))
        .attr('stroke', d => d3.rgb(colorFor(processedData.nodes[d.source.index])).darker());

      svg.selectAll('.chord-ribbon')
        .on('mouseover', function(event, d) {
          showTooltip(ribbonTooltipHtml(d), event);
        })
        .on('mousemove', function(event) {
          positionTooltip(event);
        })
        .on('mouseout', function() {
          hideTooltip();
        });
    }
  },
  destroy(ctx) {
    hideTooltip();
    ctx.container.innerHTML = '';
  },
};
