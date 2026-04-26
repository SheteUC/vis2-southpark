import * as d3 from 'd3';
import { charColor } from '../shared/chart-helpers.js';

const LEVEL3_TEMPLATE = `
  <section id="level-3-network" class="level-shell">
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

    <div class="chart-area chart-area--network" id="chart-network" aria-label="Chord diagram: character relationships">
      <div class="chart-loading">Loading…</div>
    </div>

    <div class="chart-note">
      <strong>Chord diagram</strong> — ribbons represent interactions between characters (consecutive dialogue turns).
      Hover over ribbons to see interaction counts.
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

    chartEl.style.position = 'relative';

    function positionTooltip(event) {
      const tooltipNode = tooltip.node();
      const tooltipRect = tooltipNode.getBoundingClientRect();
      const chartRect = chartEl.getBoundingClientRect();
      const chartWidth = chartEl.clientWidth;
      const chartHeight = chartEl.clientHeight;
      const offset = 12;
      const margin = 8;
      const tooltipWidth = tooltipRect.width || tooltipNode.offsetWidth;
      const tooltipHeight = tooltipRect.height || tooltipNode.offsetHeight;
      const mouseX = event.clientX - chartRect.left;
      const mouseY = event.clientY - chartRect.top;
      let x = mouseX + offset;
      let y = mouseY + offset;

      if (x + tooltipWidth > chartWidth - margin) {
        x = mouseX - tooltipWidth - offset;
      }
      if (y + tooltipHeight > chartHeight - margin) {
        y = mouseY - tooltipHeight - offset;
      }
      if (x + tooltipWidth > chartWidth - margin) {
        x = chartWidth - tooltipWidth - margin;
      }
      if (y + tooltipHeight > chartHeight - margin) {
        y = chartHeight - tooltipHeight - margin;
      }
      if (x < margin) x = margin;
      if (y < margin) y = margin;
      tooltip.style('left', `${x}px`).style('top', `${y}px`);
    }

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
          tooltip.style('visibility', 'visible')
            .text(`${processedData.nodes[d.index]}: ${d.value} total interactions`);
        })
        .on('mousemove', function(event) {
          positionTooltip(event);
        })
        .on('mouseout', function(event) {
          tooltip.style('visibility', 'hidden');
        });

      group.append('text')
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '.35em')
        .attr('transform', d => `
          rotate(${(d.angle * 180 / Math.PI - 90)})
          translate(${outerRadius + 10})
          ${d.angle > Math.PI ? 'rotate(180)' : ''}
        `)
        .attr('text-anchor', d => d.angle > Math.PI ? 'end' : null)
        .text(d => processedData.nodes[d.index])
        .style('font-size', '10px');

      // Ribbons
      svg.append('g')
        .attr('fill-opacity', 0.67)
        .selectAll('path')
        .data(chords)
        .join('path')
        .classed('chord-ribbon', true)
        .attr('d', ribbon)
        .attr('fill', d => colorFor(processedData.nodes[d.source.index]))
        .attr('stroke', d => d3.rgb(colorFor(processedData.nodes[d.source.index])).darker());

      // Tooltip
      const tooltip = d3.select(chartEl)
        .append('div')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('pointer-events', 'none')
        .style('background', 'rgba(0,0,0,0.8)')
        .style('color', 'white')
        .style('padding', '5px')
        .style('border-radius', '3px')
        .style('font-size', '12px');

      svg.selectAll('.chord-ribbon')
        .on('mouseover', function(event, d) {
          tooltip.style('visibility', 'visible')
            .text(`${processedData.nodes[d.source.index]} ↔ ${processedData.nodes[d.target.index]}: ${d.source.value} interactions`);
        })
        .on('mousemove', function(event) {
          positionTooltip(event);
        })
        .on('mouseout', function() {
          tooltip.style('visibility', 'hidden');
        });
    }
  },
  destroy(ctx) {
    ctx.container.innerHTML = '';
  },
};
