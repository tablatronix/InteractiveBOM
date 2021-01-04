/* PCB rendering code */

var globalData        = require('./global.js')
var render_pads       = require('./render/render_pad.js')
var render_via        = require('./render/render_via.js')
var render_trace      = require('./render/render_trace.js')
var render_boardedge  = require('./render/render_boardedge.js')
var render_silkscreen = require('./render/render_silkscreen.js')
var render_canvas     = require('./render/render_canvas.js')
var render_boundingbox = require('./render/render_boundingbox.js')
var Point             = require('./render/point.js').Point
var pcb               = require('./pcb.js')
var colorMap          = require('./colormap.js')


//REMOVE: Using to test alternate placed coloring
var isPlaced = false;

function DrawPad(ctx, pad, color) 
{
    if (pad.shape == "rect") 
    {
        render_pads.Rectangle(ctx, pad, color);
    } 
    else if (pad.shape == "oblong") 
    {
        render_pads.Oblong(ctx, pad, color);
    } 
    else if (pad.shape == "round") 
    {
         render_pads.Round(ctx, pad, color);
    } 
    else if (pad.shape == "octagon") 
    {
      render_pads.Octagon(ctx, pad, color);
    } 
    else
    {
        console.log("ERROR: Unsupported pad type ", pad.shape)
    }
}

function DrawPCBEdges(isViewFront, scalefactor) 
{
    let ctx = pcb.GetLayerCanvas("edges", isViewFront).getContext("2d")
    let color = colorMap.GetPCBEdgeColor();

    for (let edge of pcbdata.board.pcb_shape.edges) 
    {
        if(edge.pathtype == "line")
        {
            let lineWidth = Math.max(1 / scalefactor, edge.width);
            render_boardedge.Line(ctx, edge, lineWidth, color);
        }
        else if(edge.pathtype == "arc")
        {
            let lineWidth = Math.max(1 / scalefactor, edge.width);
            render_boardedge.Arc(ctx, edge, lineWidth, color);
        }
        else
        {
            console.log("unsupported board edge segment type", edge.pathtype);
        }
    }
}

function DrawTraces(isViewFront, scalefactor)
{
    // Iterate over all traces in the design
    for (let trace of pcbdata.board.traces)
    {
        // iterate over all segments in a trace 
        for (let segment of trace.segments)
        {
            var ctx = pcb.GetLayerCanvas(segment.layer, isViewFront).getContext("2d")

            if(segment.pathtype == "line")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                render_trace.Line(ctx, segment, lineWidth, colorMap.GetTraceColor(segment.layer-1));
            }
            else if(segment.pathtype == "arc")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                render_trace.Arc(ctx, segment, lineWidth, colorMap.GetTraceColor(segment.layer-1));
            }
            else if (segment.pathtype == "polygon")
            {
                let lineWidth = Math.max(1 / scalefactor, segment.width);
                // Need to specify a color at full transparency so that a negative polygon 
                // can be subtracted from a positive polygon.
                let color = (segment.positive == 1) ? colorMap.GetTraceColor(segment.layer-1) : "#000000FF";
                render_trace.Polygon(ctx, segment.segments, lineWidth, color, segment.positive === "1");
            }
            else if( segment.pathtype == "via_round")
            {
                let centerPoint = new Point(segment.x, segment.y);
                render_via.Round(   ctx
                                  , centerPoint
                                  , segment.diameter
                                  , segment.drill
                                  , colorMap.GetViaColor()
                                  , colorMap.GetDrillColor()
                                );
            }
            else if( segment.pathtype == "via_octagon")
            {
              let centerPoint = new Point(segment.x, segment.y);
              render_via.Octagon(   ctx
                                  , centerPoint
                                  , segment.diameter
                                  , segment.drill
                                  , colorMap.GetViaColor()
                                  , colorMap.GetDrillColor()
                                );
            }
            else if( segment.pathtype == "via_square")
            {
              let centerPoint = new Point(segment.x, segment.y);
              render_via.Square(   ctx
                                 , centerPoint
                                 , segment.diameter
                                 , segment.drill
                                 , colorMap.GetViaColor()
                                 , colorMap.GetDrillColor()
                               );
            }
            else
            {
                console.log("unsupported trace segment type");
            }
        }
    }
}

function DrawSilkscreen(isViewFront, scalefactor)
{
    let color = "#aa4";
    
    for (let layer of pcbdata.board.layers)
    {
        var ctx = pcb.GetLayerCanvas(layer.name, isViewFront).getContext("2d")
        for (let path of layer.paths)
        {
            if(path.pathtype == "line")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Line(ctx, path, lineWidth, color);
            }
            else if(path.pathtype == "arc")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Arc(ctx, path, lineWidth, color);
            }
            else if(path.pathtype == "circle")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Circle(ctx, path, lineWidth, color);
            }
            else
            {
                console.log("unsupported silkscreen path segment type", path.pathtype);
            }
        }
    }
}

function DrawModule(isViewFront, layer, scalefactor, part, highlight) 
{
    if (highlight || globalData.getDebugMode())
    {
        // draw bounding box
        if (part.location == layer)
        {
            let color_BoundingBox = colorMap.GetBoundingBoxColor(highlight, isPlaced);
            var ctx = pcb.GetLayerCanvas("highlights", isViewFront).getContext("2d")
            render_boundingbox.Rectangle(ctx, part.package.bounding_box, color_BoundingBox);
        }
        // draw pads
        for (let pad of part.package.pads) 
        {
            /*
                Check that part on layer should be drawn. Will draw when requested layer 
                matches the parts layer.
            
              If the part is through hole it needs to be drawn on each layer
              otherwise the part is an smd and should only be drawn on a the layer it belongs to.
            */
            if (    (pad.pad_type == "tht")
                 || ((pad.pad_type == "smd") && (part.location == layer))
               )
            {
                let highlightPin1 = ((pad.pin1 == "yes")  && globalData.getHighlightPin1());
                let color_pad = colorMap.GetPadColor(highlightPin1, highlight, isPlaced);
                var ctx = pcb.GetLayerCanvas("highlights", isViewFront).getContext("2d")
                DrawPad(ctx, pad, color_pad);
            }
        }

    }

    // draw pads
    for (let pad of part.package.pads) 
    {
        /*
            Check that part on layer should be drawn. Will draw when requested layer 
            matches the parts layer.
        
          If the part is through hole it needs to be drawn on each layer
          otherwise the part is an smd and should only be drawn on a the layer it belongs to.
        */
        if (    (pad.pad_type == "tht")
             || ((pad.pad_type == "smd") && (part.location == layer))
           )
        {
            let highlightPin1 = ((pad.pin1 == "yes")  && globalData.getHighlightPin1());
            let color_pad = colorMap.GetPadColor(highlightPin1, false, isPlaced);
            var ctx = pcb.GetLayerCanvas("pads", isViewFront).getContext("2d")
            DrawPad(ctx, pad, color_pad);
        }
    }
}

function DrawModules(isViewFront, layer, scalefactor, highlightedRefs)
{
    let style = getComputedStyle(topmostdiv);

    for (let part of pcbdata.parts) 
    {
        let highlight = highlightedRefs.includes(part.name);
        if (highlightedRefs.length == 0 || highlight) 
        {
            DrawModule(isViewFront, layer, scalefactor, part, highlight);
        }
    }
}

function drawCanvas(canvasdict)
{
    render_canvas.RedrawCanvas(canvasdict)
    let isViewFront = (canvasdict.layer === "F")
    DrawPCBEdges  (isViewFront, canvasdict.transform.s)
    DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, []);
    DrawSilkscreen(isViewFront, canvasdict.transform.s);
    DrawTraces    (isViewFront, canvasdict.transform.s)
}

function RotateVector(v, angle)
{
    return render_canvas.rotateVector(v, angle);
}



function initRender() {
  allcanvas = {
    front: {
      transform: {
        x: 0,
        y: 0,
        s: 1,
        panx: 0,
        pany: 0,
        zoom: 1,
        mousestartx: 0,
        mousestarty: 0,
        mousedown: false,
      },
      layer: "F",
    },
    back: {
      transform: {
        x: 0,
        y: 0,
        s: 1,
        panx: 0,
        pany: 0,
        zoom: 1,
        mousestartx: 0,
        mousestarty: 0,
        mousedown: false,
      },
      layer: "B",
    }
  };
}

function drawHighlightsOnLayer(canvasdict) 
{
  let isViewFront = (canvasdict.layer === "F")
  render_canvas.ClearHighlights(canvasdict);
  DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, globalData.getHighlightedRefs());
}

function drawHighlights(passed) 
{
  isPlaced=passed;
  drawHighlightsOnLayer(allcanvas.front);
  drawHighlightsOnLayer(allcanvas.back);
}

function resizeAll() 
{
  render_canvas.ResizeCanvas(allcanvas.front);
  render_canvas.ResizeCanvas(allcanvas.back);
  drawCanvas(allcanvas.front)
  drawCanvas(allcanvas.back)
}

module.exports = {
  initRender, resizeAll, drawCanvas, drawHighlights, RotateVector
};