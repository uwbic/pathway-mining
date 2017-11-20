var PIE_CHART_SIZE = 20;

var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
var binRadius = 500;
var forceGraphRadius = 450;
var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) { return d.id; }))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(0,0));

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


function drawGraph(graph, bins){


  // circle layout
  function circleLayout(bins){
    var length = bins.length;
    bins.forEach(function(b,index){
      var radian = index * 1.0 /length * 2 * Math.PI;
      var angle = index * 1.0 / length * 360;
      var x = binRadius * Math.cos(radian);
      var y = binRadius * Math.sin(radian);
      b.x = x;
      b.y = y;
      b.angle = angle;
    });
  }
  circleLayout(bins, binRadius);
  var nameToBin = {};
  bins.forEach(function(b){
    nameToBin[b.name] = b;
  });
  //Directed edges
  svg
    .append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 10)
    .attr("refY", 0)
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("orient", "auto")
  .append("svg:path")
    .attr("d", "M0,-2L7,0L0,2")
    ;
  var mainGroup = svg
    .append('g')
    .attr('transform','translate('+width/2 + ',' + height/2 +')')
    .attr('width', svg.attr('width'))
    .attr('height', svg.attr('height'))
    ;

  // drawing all bins around force directed graph
  var texts = mainGroup
    .append('g')
    .classed('bin-label-group',true)
    .selectAll('g.bin-label')
    .data(bins)
    .enter()
    .append('g')
    .classed('bin-label',true)
    .attr('transform', function(d){
      return 'rotate(' + (d.angle - 90) + ')translate('+binRadius+',0)' + 
        (d.angle < 180?'':'rotate(180)')
    })
    .append('text')
    .text(function(d){return d.name})
    .style('text-anchor', function(d){return d.angle < 180? 'start':'end'})
    ;

  // need data bin <-> node
  var binNodes = [];
  function getBinLengthCutOff(nodes){
    var lengths = graph
      .nodes
      .filter(function(n){return n.type === REACTION && n.bins && n.bins.length > 0;})
      .map(function(n){return n.bins.length})
      .sort()
      .reverse();
    return lengths[Math.floor(lengths.length * 0.1)];
  }
  var cutoff = getBinLengthCutOff(graph.nodes);
  console.log('bin length cutoff', cutoff);
  graph.nodes
    .filter(function(n){return n.type === REACTION && n.bins;})
    .forEach(function(n){
      if (n.bins.length > 20) return;
      n.bins.forEach(function(b){
        binNodes.push({
          'node': n,
          'bin': nameToBin[b.name]
        });
      });
    });

  var binNodeLine = mainGroup
    .append('g')
    .classed('binNode',true)
    .selectAll('g.binNodeLine')
    .data(binNodes)
    .enter()
    .append('path')
    .classed('binNodeLine',true)
    .attr('d',function(d){
      var b = d.bin;
      var n = d.node;
      return lineTo(b,n);
    })

    .attr('style','stroke:#eee; stroke-width: 1px;')
  var link = mainGroup.append("g")
      .attr("class", "links")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");


  node = mainGroup.append("g")
      .attr("class", "nodes")
    .selectAll("circle")
    .data(graph.nodes)
    .enter().append("g")
      .attr("class", "node")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on('mouseover',function(n){
        d3
          .selectAll('path.binNodeLine')
          // get all binNodeLines corresponding to this node
          .filter(function(d){
            if (d.node === n){console.log(d);}
            return d.node === n;
          })
          .attr('style','stroke:#aaa; stroke-width: 2.5px;')
      })
      .on('mouseout',function(n){
        d3
          .selectAll('path.binNodeLine')
          // get all binNodeLines corresponding to this node
          .filter(function(d){
            return d.node === n;
          })
          .attr('style','stroke:#eee; stroke-width: 1px;')
      });

  var circle = node
    // .filter(function(d){
    //   return d.type !== REACTION;
    // })
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
        .attr("x1", function(d) { return d.source.x = Math.sign(d.source.x) * Math.min(Math.abs(d.source.x), forceGraphRadius); })
        .attr("y1", function(d) { return d.source.y = Math.sign(d.source.y) * Math.min(Math.abs(d.source.y), forceGraphRadius); })
        .attr("x2", function(d) { return d.target.x = Math.sign(d.target.x) * Math.min(Math.abs(d.target.x), forceGraphRadius); })
        .attr("y2", function(d) { return d.target.y = Math.sign(d.target.y) * Math.min(Math.abs(d.target.y), forceGraphRadius); });

    node.attr("transform", function(d) {
      // var radian = Math.atan(d.y/d.x);
      // var radius = Math.sqrt(d.x*d.x + d.y*d.y);
      // radius = Math.min(forceGraphRadius, radius);
      // var x = Math.cos(radian) * radius;
      // var y = Math.sin(radian) * radius;
      var x =  Math.sign(d.x) * Math.min(Math.abs(d.x), forceGraphRadius)
      d.x = x;
      var y =  Math.sign(d.y) * Math.min(Math.abs(d.y), forceGraphRadius)
      d.y = y;
      return "translate(" + x + "," + y + ")"; 
    });
    binNodeLine.attr('d',function(d){
      return lineTo(d.bin,d.node);
    });
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

function lineTo(src,target){
    var sx = src.x,
      sy = src.y,
      tx = target.x,
      ty = target.y;
    return formatStr('M {0},{1} L {2},{3}',sx,sy,tx,ty);
}

function formatStr(format) {
    var args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number] 
        : match
      ;
    });
}

