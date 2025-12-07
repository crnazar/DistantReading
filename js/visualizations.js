/**
 * Distant Reading Analysis - D3.js Visualizations
 * Interactive visualizations for utopian novels corpus analysis
 */

// Global data storage
let analysisData = null;

// Color schemes
const colors = {
    primary: '#4a6fa5',
    secondary: '#6b8cae',
    accent: '#e07a5f',
    positive: '#27ae60',
    negative: '#e74c3c',
    neutral: '#95a5a6',
    palette: ['#4a6fa5', '#e07a5f', '#27ae60', '#9b59b6', '#f39c12', '#1abc9c', '#e74c3c']
};

// Utility functions
function formatNumber(num) {
    return num.toLocaleString();
}

function getShortTitle(title) {
    const parts = title.split(':');
    return parts[0].trim();
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadData();
});

// Load JSON data
async function loadData() {
    try {
        const response = await fetch('analysis_results.json');
        analysisData = await response.json();
        initializeVisualizations();
    } catch (error) {
        console.error('Error loading data:', error);
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger">
                    <h4>Error Loading Data</h4>
                    <p>Could not load analysis_results.json. Please ensure the file exists and you're running from a web server.</p>
                    <p><small>Try: python -m http.server 8000</small></p>
                </div>
            </div>
        `;
    }
}

// Initialize all visualizations
function initializeVisualizations() {
    updateOverview();
    populateSelectors();
    createWordCloud(0);
    createWordFrequencyChart(0);
    createSentimentCharts();
    createStyleMetricsCharts();
    createTopicVisualization();
    initializeComparison();

    // Add event listeners
    document.getElementById('wordcloudSelect').addEventListener('change', function() {
        const idx = parseInt(this.value);
        createWordCloud(idx);
        createWordFrequencyChart(idx);
    });

    document.getElementById('compareSelect1').addEventListener('change', updateComparison);
    document.getElementById('compareSelect2').addEventListener('change', updateComparison);
}

// Update overview statistics
function updateOverview() {
    const data = analysisData;

    document.getElementById('totalTexts').textContent = data.corpus_info.text_count;
    document.getElementById('totalTokens').textContent = formatNumber(data.corpus_info.total_tokens);

    const years = data.texts.map(t => t.metadata.year).filter(y => y > 0);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    document.getElementById('yearRange').textContent = `${minYear} - ${maxYear}`;

    // Populate corpus table
    const tbody = document.querySelector('#corpusTable tbody');
    tbody.innerHTML = '';

    data.texts.forEach(text => {
        const sentiment = text.sentiment.compound;
        let sentimentClass = 'sentiment-neutral';
        if (sentiment > 0.05) sentimentClass = 'sentiment-positive';
        else if (sentiment < -0.05) sentimentClass = 'sentiment-negative';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${text.metadata.title}</strong></td>
            <td>${text.metadata.author}</td>
            <td>${text.metadata.year || 'Unknown'}</td>
            <td>${formatNumber(text.style_metrics.total_tokens)}</td>
            <td>${formatNumber(text.style_metrics.vocabulary_size)}</td>
            <td><span class="${sentimentClass}">${sentiment.toFixed(3)}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Populate dropdown selectors
function populateSelectors() {
    const selectors = ['wordcloudSelect', 'compareSelect1', 'compareSelect2', 'radarSelect'];

    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return;

        select.innerHTML = '';
        analysisData.texts.forEach((text, idx) => {
            const option = document.createElement('option');
            option.value = idx;
            option.textContent = getShortTitle(text.metadata.title);
            select.appendChild(option);
        });
    });

    // Set default comparison selections
    if (document.getElementById('compareSelect2') && analysisData.texts.length > 1) {
        document.getElementById('compareSelect2').value = 1;
    }
}

// Word Cloud Visualization
function createWordCloud(textIndex) {
    const container = document.getElementById('wordcloudContainer');
    container.innerHTML = '';

    const text = analysisData.texts[textIndex];
    const words = text.word_frequencies.slice(0, 50);

    const width = container.clientWidth || 800;
    const height = 400;

    const maxCount = Math.max(...words.map(w => w.count));
    const fontScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range([14, 60]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const layout = d3.layout.cloud()
        .size([width, height])
        .words(words.map(w => ({
            text: w.word,
            size: fontScale(w.count),
            count: w.count
        })))
        .padding(5)
        .rotate(() => (Math.random() > 0.5 ? 0 : 90) * (Math.random() > 0.8 ? 1 : 0))
        .fontSize(d => d.size)
        .on('end', draw);

    layout.start();

    function draw(words) {
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Create tooltip
        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        svg.append('g')
            .attr('transform', `translate(${width/2},${height/2})`)
            .selectAll('text')
            .data(words)
            .enter().append('text')
            .attr('class', 'wordcloud-word')
            .style('font-size', d => `${d.size}px`)
            .style('fill', (d, i) => colorScale(i))
            .style('font-family', 'Impact, sans-serif')
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text(d => d.text)
            .on('mouseover', function(event, d) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`<strong>${d.text}</strong><br/>Count: ${d.count}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    }
}

// Word Frequency Bar Chart
function createWordFrequencyChart(textIndex) {
    const container = document.getElementById('wordFreqChart');
    container.innerHTML = '';

    const text = analysisData.texts[textIndex];
    const words = text.word_frequencies.slice(0, 30);

    const margin = {top: 20, right: 30, bottom: 100, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(words.map(w => w.word))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(words, w => w.count)])
        .nice()
        .range([height, 0]);

    // Add grid lines
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat(''));

    // Add bars
    svg.selectAll('.bar')
        .data(words)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.word))
        .attr('y', d => y(d.count))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.count));

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -50)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('Frequency');
}

// Sentiment Charts
function createSentimentCharts() {
    createSentimentCompoundChart();
    createSentimentComponentsChart();
    createSentimentDistributionChart();
    createSentimentTimelineChart();
}

function createSentimentCompoundChart() {
    const container = document.getElementById('sentimentCompoundChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        compound: t.sentiment.compound
    })).sort((a, b) => b.compound - a.compound);

    const margin = {top: 20, right: 30, bottom: 100, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.title))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.compound) - 0.05, d3.max(data, d => d.compound) + 0.05])
        .range([height, 0]);

    // Add zero line
    svg.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', y(0))
        .attr('y2', y(0))
        .attr('stroke', '#999')
        .attr('stroke-dasharray', '4');

    // Add bars
    svg.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.title))
        .attr('y', d => d.compound >= 0 ? y(d.compound) : y(0))
        .attr('width', x.bandwidth())
        .attr('height', d => Math.abs(y(d.compound) - y(0)))
        .attr('fill', d => d.compound >= 0 ? colors.positive : colors.negative);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('Compound Score');
}

function createSentimentComponentsChart() {
    const container = document.getElementById('sentimentComponentsChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        positive: t.sentiment.positive,
        negative: t.sentiment.negative,
        neutral: t.sentiment.neutral
    }));

    const margin = {top: 20, right: 100, bottom: 100, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const keys = ['positive', 'negative', 'neutral'];
    const stack = d3.stack().keys(keys);
    const stackedData = stack(data);

    const x = d3.scaleBand()
        .domain(data.map(d => d.title))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .range([height, 0]);

    const colorMap = {
        positive: colors.positive,
        negative: colors.negative,
        neutral: colors.neutral
    };

    // Add stacked bars
    svg.selectAll('.layer')
        .data(stackedData)
        .enter().append('g')
        .attr('class', 'layer')
        .attr('fill', d => colorMap[d.key])
        .selectAll('rect')
        .data(d => d)
        .enter().append('rect')
        .attr('x', d => x(d.data.title))
        .attr('y', d => y(d[1]))
        .attr('width', x.bandwidth())
        .attr('height', d => y(d[0]) - y(d[1]));

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y).tickFormat(d3.format('.0%')));

    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width + 10}, 0)`);

    keys.forEach((key, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);

        g.append('rect')
            .attr('width', 18)
            .attr('height', 18)
            .attr('fill', colorMap[key]);

        g.append('text')
            .attr('x', 24)
            .attr('y', 14)
            .style('font-size', '12px')
            .text(key.charAt(0).toUpperCase() + key.slice(1));
    });
}

function createSentimentDistributionChart() {
    const container = document.getElementById('sentimentDistributionChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        positive: t.sentiment.distribution.positive,
        negative: t.sentiment.distribution.negative,
        neutral: t.sentiment.distribution.neutral,
        total: t.sentiment.sentence_count
    }));

    const margin = {top: 20, right: 120, bottom: 100, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const subgroups = ['positive', 'negative', 'neutral'];
    const groups = data.map(d => d.title);

    const x0 = d3.scaleBand()
        .domain(groups)
        .range([0, width])
        .padding(0.2);

    const x1 = d3.scaleBand()
        .domain(subgroups)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => Math.max(d.positive, d.negative, d.neutral))])
        .nice()
        .range([height, 0]);

    const colorMap = {
        positive: colors.positive,
        negative: colors.negative,
        neutral: colors.neutral
    };

    // Add bars
    svg.selectAll('.group')
        .data(data)
        .enter().append('g')
        .attr('class', 'group')
        .attr('transform', d => `translate(${x0(d.title)},0)`)
        .selectAll('rect')
        .data(d => subgroups.map(key => ({key, value: d[key]})))
        .enter().append('rect')
        .attr('x', d => x1(d.key))
        .attr('y', d => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', d => colorMap[d.key]);

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('Number of Sentences');

    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width + 10}, 0)`);

    subgroups.forEach((key, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);

        g.append('rect')
            .attr('width', 18)
            .attr('height', 18)
            .attr('fill', colorMap[key]);

        g.append('text')
            .attr('x', 24)
            .attr('y', 14)
            .style('font-size', '12px')
            .text(key.charAt(0).toUpperCase() + key.slice(1));
    });
}

function createSentimentTimelineChart() {
    const container = document.getElementById('sentimentTimelineChart');
    container.innerHTML = '';

    const data = analysisData.texts
        .filter(t => t.metadata.year > 0)
        .map(t => ({
            title: getShortTitle(t.metadata.title),
            year: t.metadata.year,
            compound: t.sentiment.compound
        }))
        .sort((a, b) => a.year - b.year);

    const margin = {top: 20, right: 100, bottom: 50, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.year) - 20, d3.max(data, d => d.year) + 20])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([d3.min(data, d => d.compound) - 0.05, d3.max(data, d => d.compound) + 0.05])
        .range([height, 0]);

    // Add zero line
    svg.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', y(0))
        .attr('y2', y(0))
        .attr('stroke', '#999')
        .attr('stroke-dasharray', '4');

    // Add line
    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.compound));

    svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', colors.primary)
        .attr('stroke-width', 2)
        .attr('d', line);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Add points
    svg.selectAll('.point')
        .data(data)
        .enter().append('circle')
        .attr('class', 'point')
        .attr('cx', d => x(d.year))
        .attr('cy', d => y(d.compound))
        .attr('r', 8)
        .attr('fill', d => d.compound >= 0 ? colors.positive : colors.negative)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            tooltip.html(`<strong>${d.title}</strong><br/>Year: ${d.year}<br/>Sentiment: ${d.compound.toFixed(3)}`)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('d')));

    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .text('Publication Year');

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -height / 2)
        .attr('text-anchor', 'middle')
        .text('Compound Score');
}

// Style Metrics Charts
function createStyleMetricsCharts() {
    createTTRChart();
    createHapaxChart();
    createSentenceLengthChart();
    createWordLengthChart();
}

function createTTRChart() {
    const container = document.getElementById('ttrChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        value: t.style_metrics.type_token_ratio
    })).sort((a, b) => b.value - a.value);

    createHorizontalBarChart(container, data, 'Type-Token Ratio', colors.primary);
}

function createHapaxChart() {
    const container = document.getElementById('hapaxChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        value: t.style_metrics.hapax_ratio
    })).sort((a, b) => b.value - a.value);

    createHorizontalBarChart(container, data, 'Hapax Ratio', colors.accent);
}

function createSentenceLengthChart() {
    const container = document.getElementById('sentenceLengthChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        value: t.style_metrics.sentence_stats.mean_length
    })).sort((a, b) => b.value - a.value);

    createHorizontalBarChart(container, data, 'Mean Words per Sentence', colors.secondary);
}

function createWordLengthChart() {
    const container = document.getElementById('wordLengthChart');
    container.innerHTML = '';

    const data = analysisData.texts.map(t => ({
        title: getShortTitle(t.metadata.title),
        value: t.style_metrics.word_stats.mean_length
    })).sort((a, b) => b.value - a.value);

    createHorizontalBarChart(container, data, 'Mean Characters per Word', '#9b59b6');
}

function createHorizontalBarChart(container, data, label, color) {
    const margin = {top: 20, right: 30, bottom: 40, left: 150};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
        .domain(data.map(d => d.title))
        .range([0, height])
        .padding(0.2);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) * 1.1])
        .range([0, width]);

    // Add bars
    svg.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('y', d => y(d.title))
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('width', d => x(d.value))
        .attr('fill', color);

    // Add value labels
    svg.selectAll('.label')
        .data(data)
        .enter().append('text')
        .attr('class', 'label')
        .attr('y', d => y(d.title) + y.bandwidth() / 2)
        .attr('x', d => x(d.value) + 5)
        .attr('dy', '0.35em')
        .style('font-size', '11px')
        .text(d => d.value.toFixed(3));

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));
}

// Topic Modeling Visualization
function createTopicVisualization() {
    const topicCards = document.getElementById('topicCards');
    topicCards.innerHTML = '';

    const topics = analysisData.topic_modeling.topics;

    topics.forEach((topic, idx) => {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-3 mb-4';

        const words = topic.words.map(w =>
            `<span class="topic-word">${w[0]}<span class="topic-word-weight">${w[1].toFixed(1)}</span></span>`
        ).join('');

        col.innerHTML = `
            <div class="card topic-card h-100">
                <div class="card-header">
                    <h5 style="color: ${colors.palette[idx]}">Topic ${idx + 1}</h5>
                </div>
                <div class="card-body">
                    ${words}
                </div>
            </div>
        `;

        topicCards.appendChild(col);
    });

    createTopicHeatmap();
}

function createTopicHeatmap() {
    const container = document.getElementById('topicHeatmap');
    container.innerHTML = '';

    const texts = analysisData.texts;
    const nTopics = analysisData.topic_modeling.n_topics;

    const margin = {top: 50, right: 30, bottom: 100, left: 150};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const titles = texts.map(t => getShortTitle(t.metadata.title));
    const topicLabels = Array.from({length: nTopics}, (_, i) => `Topic ${i + 1}`);

    const x = d3.scaleBand()
        .domain(topicLabels)
        .range([0, width])
        .padding(0.05);

    const y = d3.scaleBand()
        .domain(titles)
        .range([0, height])
        .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, 1]);

    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

    // Create cells
    texts.forEach((text, textIdx) => {
        text.topic_distribution.forEach((value, topicIdx) => {
            svg.append('rect')
                .attr('class', 'heatmap-cell')
                .attr('x', x(topicLabels[topicIdx]))
                .attr('y', y(titles[textIdx]))
                .attr('width', x.bandwidth())
                .attr('height', y.bandwidth())
                .attr('fill', colorScale(value))
                .on('mouseover', function(event) {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    tooltip.html(`<strong>${titles[textIdx]}</strong><br/>Topic ${topicIdx + 1}: ${(value * 100).toFixed(1)}%`)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });
        });
    });

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 15;

    const legendScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format('.0%'));

    const legend = svg.append('g')
        .attr('transform', `translate(${(width - legendWidth) / 2}, ${height + 50})`);

    // Create gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
        .attr('id', 'heatmapGradient');

    gradient.selectAll('stop')
        .data(d3.range(0, 1.1, 0.1))
        .enter().append('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => colorScale(d));

    legend.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#heatmapGradient)');

    legend.append('g')
        .attr('transform', `translate(0, ${legendHeight})`)
        .call(legendAxis);
}

// Comparison View
function initializeComparison() {
    updateComparison();
}

function updateComparison() {
    const idx1 = parseInt(document.getElementById('compareSelect1').value);
    const idx2 = parseInt(document.getElementById('compareSelect2').value);

    const text1 = analysisData.texts[idx1];
    const text2 = analysisData.texts[idx2];

    updateCompareCard(text1, 1);
    updateCompareCard(text2, 2);
    createCompareMetricsChart(text1, text2);
}

function updateCompareCard(text, num) {
    document.getElementById(`compareTitle${num}`).textContent =
        `${text.metadata.title} (${text.metadata.year || 'Unknown'})`;

    const stats = document.getElementById(`compareStats${num}`);
    stats.innerHTML = `
        <div class="compare-stat-item">
            <div class="compare-stat-value">${formatNumber(text.style_metrics.total_tokens)}</div>
            <div class="compare-stat-label">Total Tokens</div>
        </div>
        <div class="compare-stat-item">
            <div class="compare-stat-value">${formatNumber(text.style_metrics.vocabulary_size)}</div>
            <div class="compare-stat-label">Vocabulary</div>
        </div>
        <div class="compare-stat-item">
            <div class="compare-stat-value">${text.sentiment.compound.toFixed(3)}</div>
            <div class="compare-stat-label">Sentiment</div>
        </div>
        <div class="compare-stat-item">
            <div class="compare-stat-value">${text.style_metrics.type_token_ratio.toFixed(3)}</div>
            <div class="compare-stat-label">TTR</div>
        </div>
    `;

    // Create mini word cloud
    createMiniWordCloud(text, `compareWordcloud${num}`);
}

function createMiniWordCloud(text, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const words = text.word_frequencies.slice(0, 25);
    const width = container.clientWidth || 300;
    const height = 200;

    const maxCount = Math.max(...words.map(w => w.count));
    const fontScale = d3.scaleLinear()
        .domain([0, maxCount])
        .range([10, 35]);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const layout = d3.layout.cloud()
        .size([width, height])
        .words(words.map(w => ({
            text: w.word,
            size: fontScale(w.count)
        })))
        .padding(3)
        .rotate(0)
        .fontSize(d => d.size)
        .on('end', draw);

    layout.start();

    function draw(words) {
        d3.select(`#${containerId}`)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width/2},${height/2})`)
            .selectAll('text')
            .data(words)
            .enter().append('text')
            .style('font-size', d => `${d.size}px`)
            .style('fill', (d, i) => colorScale(i))
            .style('font-family', 'Impact, sans-serif')
            .attr('text-anchor', 'middle')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .text(d => d.text);
    }
}

function createCompareMetricsChart(text1, text2) {
    const container = document.getElementById('compareMetricsChart');
    container.innerHTML = '';

    const metrics = [
        {name: 'TTR', t1: text1.style_metrics.type_token_ratio, t2: text2.style_metrics.type_token_ratio},
        {name: 'Hapax Ratio', t1: text1.style_metrics.hapax_ratio, t2: text2.style_metrics.hapax_ratio},
        {name: 'Sentiment', t1: (text1.sentiment.compound + 1) / 2, t2: (text2.sentiment.compound + 1) / 2},
        {name: 'Avg Sentence Len (norm)', t1: text1.style_metrics.sentence_stats.mean_length / 50, t2: text2.style_metrics.sentence_stats.mean_length / 50},
        {name: 'Avg Word Len (norm)', t1: text1.style_metrics.word_stats.mean_length / 10, t2: text2.style_metrics.word_stats.mean_length / 10}
    ];

    const margin = {top: 20, right: 120, bottom: 40, left: 120};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const svg = d3.select(container)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
        .domain(metrics.map(m => m.name))
        .range([0, height])
        .padding(0.3);

    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, width]);

    const barHeight = y.bandwidth() / 2 - 2;

    // Add bars for text 1
    svg.selectAll('.bar1')
        .data(metrics)
        .enter().append('rect')
        .attr('class', 'bar1')
        .attr('y', d => y(d.name))
        .attr('x', 0)
        .attr('height', barHeight)
        .attr('width', d => x(Math.min(d.t1, 1)))
        .attr('fill', colors.primary);

    // Add bars for text 2
    svg.selectAll('.bar2')
        .data(metrics)
        .enter().append('rect')
        .attr('class', 'bar2')
        .attr('y', d => y(d.name) + barHeight + 4)
        .attr('x', 0)
        .attr('height', barHeight)
        .attr('width', d => x(Math.min(d.t2, 1)))
        .attr('fill', colors.accent);

    // Add Y axis
    svg.append('g')
        .call(d3.axisLeft(y));

    // Add X axis
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format('.0%')));

    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width + 10}, 0)`);

    const titles = [
        getShortTitle(text1.metadata.title),
        getShortTitle(text2.metadata.title)
    ];
    const legendColors = [colors.primary, colors.accent];

    titles.forEach((title, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`);

        g.append('rect')
            .attr('width', 18)
            .attr('height', 18)
            .attr('fill', legendColors[i]);

        g.append('text')
            .attr('x', 24)
            .attr('y', 14)
            .style('font-size', '11px')
            .text(title.substring(0, 15) + (title.length > 15 ? '...' : ''));
    });
}
