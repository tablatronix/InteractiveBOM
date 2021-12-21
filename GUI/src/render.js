/* PCB rendering code */

"use strict";

var globalData         = require("./global.js");
var render_pads        = require("./render/render_pad.js");
var render_silkscreen  = require("./render/render_silkscreen.js");
var render_canvas      = require("./render/render_Canvas.js");
var render_boundingbox = require("./render/render_boundingbox.js");
var Point              = require("./render/point.js").Point;
var pcb                = require("./pcb.js");
var colorMap           = require("./colormap.js");


//REMOVE: Using to test alternate placed coloring
let isPlaced = false;


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
        console.log("ERROR: Unsupported pad type ", pad.shape);
    }
}

function DrawTraces(isViewFront, scalefactor)
{
    for (let trace of globalData.pcb_traces)
    {
        trace.Render(isViewFront, scalefactor);
    }
}

function DrawSilkscreen(isViewFront, scalefactor)
{
    let color = "#aa4";

    for (let layer of pcbdata.board.layers)
    {
        let ctx = pcb.GetLayerCanvas(layer.name, isViewFront).getContext("2d");

       if(layer.layerNumber-1 < 16)
        {
            color = colorMap.GetTraceColor(layer.layerNumber-1);
        }
        else
        {
            color = "#aa4"
        }
        
        for (let path of layer.paths)
        {
            if(path.type == "line")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Line(ctx, path, lineWidth, color);
            }
            else if(path.type == "arc")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Arc(ctx, path, lineWidth, color);
            }
            else if(path.type == "circle")
            {
                let lineWidth = Math.max(1 / scalefactor, path.width);
                render_silkscreen.Circle(ctx, path, lineWidth, color);
            }
            else
            {
                console.log("unsupported silkscreen path segment type", path.type);
            }
        }
    }
}

function DrawModule(isViewFront, layer, scalefactor, part, highlight) 
{
    if (highlight || globalData.getDebugMode())
    {
        let ctx = pcb.GetLayerCanvas("highlights", isViewFront).getContext("2d");
        // draw bounding box
        if (part.location == layer)
        {
            let color_BoundingBox = colorMap.GetBoundingBoxColor(highlight, isPlaced);
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
            let ctx = pcb.GetLayerCanvas("pads", isViewFront).getContext("2d");
            DrawPad(ctx, pad, color_pad);
        }
    }
}

function DrawModules(isViewFront, layer, scalefactor, highlightedRefs)
{
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
    render_canvas.RedrawCanvas(canvasdict);
    let isViewFront = (canvasdict.layer === "F");
    DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, []);
    DrawTraces    (isViewFront, canvasdict.transform.s);
    // Draw last so that text is not erased when drawing polygons.
    DrawSilkscreen(isViewFront, canvasdict.transform.s);
}

function ClearCanvas(canvasdict)
{
   initRender();
}

function RotateVector(v, angle)
{
    return render_canvas.rotateVector(v, angle);
}

function initRender()
{
    let allcanvas = {
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
    // Sets the data strucure to a default value. 
    globalData.SetAllCanvas(allcanvas);
    // Set the scale so the PCB will be scaled and centered correctly.
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().front);
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().back);
}

function drawHighlightsOnLayer(canvasdict) 
{
    let isViewFront = (canvasdict.layer === "F");
    render_canvas.ClearHighlights(canvasdict);
    DrawModules   (isViewFront, canvasdict.layer, canvasdict.transform.s, globalData.getHighlightedRefs());
}

function drawHighlights(passed) 
{
    isPlaced=passed;
    drawHighlightsOnLayer(globalData.GetAllCanvas().front);
    drawHighlightsOnLayer(globalData.GetAllCanvas().back);
}

function resizeAll() 
{
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().front);
    render_canvas.ResizeCanvas(globalData.GetAllCanvas().back);
    drawCanvas(globalData.GetAllCanvas().front);
    drawCanvas(globalData.GetAllCanvas().back);
}

function SetBoardRotation(value) 
{
    /*
        The board when drawn by default is show rotated -180 degrees. 
        The following will add 180 degrees to what the user calculates so that the PCB
        will be drawn in the correct orientation, i.e. displayed as shown in ECAD program. 
        Internally the range of degrees is stored as 0 -> 360
    */
    globalData.SetBoardRotation((value * 5)+180);
    globalData.writeStorage("boardRotation", globalData.GetBoardRotation());
    /*
        Display the correct range of degrees which is -180 -> 180. 
        The following just remaps 360 degrees to be in the range -180 -> 180.
    */
    document.getElementById("rotationDegree").textContent = (globalData.GetBoardRotation()-180);
    resizeAll();
}

module.exports = {
    initRender, resizeAll, drawCanvas, drawHighlights, RotateVector, SetBoardRotation, ClearCanvas
};