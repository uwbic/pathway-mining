var PIE_CHART_SIZE = 20;

var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");


var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody().strength(-500))
    .force("center", d3.forceCenter(width / 2, height / 2));

/**
 *
 * given
 { 
  "nodes": [
    {"id": "A", "type": "compound","bin": 1},
    {"id": "B", "type": "ortholog","bin": 1},
    {"id": "C", "type": "ortholog","bin": 2},
    {"id": "D", "type": "ortholog","bin": 2},
    {"id": "E", "type": "compound","bin": 3}
  ],
  "links": [
    {"source": "A", "target": "B", "value": 1},
    {"source": "A", "target": "C", "value": 1},
    {"source": "C", "target": "D", "value": 1},
    {"source": "C", "target": "E", "value": 1},
    {"source": "B", "target": "E", "value": 1}
  ]
}
 *
 */

var node; // global variable node, all g.node svg elements, includes all reactions and compounds

function drawGraph(graph){
  // binSelections = initSelections(graph);
  // generateCheckboxes(binSelections);

  //Directed edges
  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("orient", "auto")
  .append("svg:path")
    .attr("d", "M0,-2L7,0L0,2");

  var link = svg.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");


  node = svg.append("g")
      .attr("class", "nodes")
    .selectAll("circle")
    .data(graph.nodes)
    .enter().append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

  var circle = node
    .filter(function(d){
      return d.type !== REACTION;
    })
    .append('circle')
    .attr('r', PIE_CHART_SIZE/2)
    .attr('fill','#999');



  var text = node.append("text")
    .attr("dx", 12)
    .attr("dy", ".35em")
    .text(function(d) { return d.id; });


  simulation
      .nodes(graph.nodes)
      .on("tick", ticked);

  simulation.force("link")
      .links(graph.links);

  function ticked() {
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  }
}

function updatePieCharts(){
  var color = d3.scaleOrdinal(d3.schemeCategory10);  
  var pie = d3.pie()
    .sort(null)
    .value(function(d) { return d.count; });

  var path = d3.arc()
      .outerRadius(PIE_CHART_SIZE)
      .innerRadius(0);
  if (!node){
    throw Exception('Node should be non null, call drawGraph first');
  }
  node.filter(function(d){
    return d.type === REACTION;
  }).each(function(nodeData){
    var nodeElement = d3.select(this);
    nodeElement.selectAll('.arc').remove(); // delete any existing one, redraw new ones
    if (!nodeData.bins) return;
    // we only want selected bins
    var nodeBins = nodeData.bins.filter(function(b){return selectedBins[b.name];});
    nodeElement.selectAll('.arc')
    .data(pie(nodeBins))
    .enter()
    .append('g')
    .attr('class','arc')
    .append('path')
    .attr('d',path)
    .attr('fill',function(d){return color(d.data.name);});
  });
  $('div.circle').each(function(){
    var bin = $(this).attr('data-bin');
    var colorCode;
    if (selectedBins[bin]){
      colorCode = color(bin);
    }else{
      colorCode = '#999';
    }
    $(this).css({'background-color':colorCode});
  });
}

function dragstarted(d) {
  if (!d3.event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(d) {
  d.fx = d3.event.x;
  d.fy = d3.event.y;
}

function dragended(d) {
  if (!d3.event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}




