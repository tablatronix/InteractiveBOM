"use strict";
var pcb        = require("../pcb.js");
var globalData = require("../global.js");


function prepareCanvas(canvas, flip, transform) 
{
    let ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(transform.zoom, transform.zoom);
    ctx.translate(transform.panx, transform.pany);
    if (flip) 
    {
        ctx.scale(-1, 1);
    }
    ctx.translate(transform.x, transform.y);
    ctx.rotate(globalData.GetBoardRotation()*Math.PI/180);
    ctx.scale(transform.s, transform.s);
}

function rotateVector(v, angle) 
{
    angle = angle*Math.PI/180;
    return [
        v[0] * Math.cos(angle) - v[1] * Math.sin(angle),
        v[0] * Math.sin(angle) + v[1] * Math.cos(angle)
    ];
}

function recalcLayerScale(canvasdict, canvas) 
{
    let layerID = (canvasdict.layer === "F") ? "frontcanvas" : "backcanvas" ;
    let width   = document.getElementById(layerID).clientWidth * 2;
    let height  = document.getElementById(layerID).clientHeight * 2;
    let bbox    = applyRotation(pcbdata.board.pcb_shape.bounding_box);
    let scalefactor = 0.98 * Math.min( width / (bbox.x1 - bbox.x0), height / (bbox.y1 - bbox.y0));

    if (scalefactor < 0.1)
    {
        //scalefactor = 1;
    }

    canvasdict.transform.s = scalefactor;

    if ((canvasdict.layer != "B"))
    {
        canvasdict.transform.x = -((bbox.x1 + bbox.x0) * scalefactor + width) * 0.5;
    }
    else
    {
        canvasdict.transform.x = -((bbox.x1 + bbox.x0) * scalefactor - width) * 0.5;
    }
    canvasdict.transform.y = -((bbox.y1 + bbox.y0) * scalefactor - height) * 0.5;

    if(canvasdict.layer ==="F")
    {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = (width / 2) + "px";
        canvas.style.height = (height / 2) + "px";
    }
    else
    {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = (width / 2) + "px";
        canvas.style.height = (height / 2) + "px";
    }
}

function applyRotation(bbox) 
{
    let corners = [
        [bbox.x0, bbox.y0],
        [bbox.x0, bbox.y1],
        [bbox.x1, bbox.y0],
        [bbox.x1, bbox.y1],
    ];
    corners = corners.map((v) => rotateVector(v, globalData.GetBoardRotation()));
    return {
        x0: corners.reduce((a, v) => Math.min(a, v[0]), Infinity),
        y0: corners.reduce((a, v) => Math.min(a, v[1]), Infinity),
        x1: corners.reduce((a, v) => Math.max(a, v[0]), -Infinity),
        y1: corners.reduce((a, v) => Math.max(a, v[1]), -Infinity),
    };
}


function ClearHighlights(canvasdict)
{
    let canvas = pcb.GetLayerCanvas("highlights", (canvasdict.layer === "F"));
    ClearCanvas(canvas);
}

function ClearCanvas(canvas) 
{
    let ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function prepareLayer(canvasdict, canvas)
{
    let flip = (canvasdict.layer != "B");

    if(canvasdict.layer === "F")
    {
        prepareCanvas(canvas, flip, canvasdict.transform);
    }
    else
    {
        prepareCanvas(canvas, flip, canvasdict.transform);
    }
}

function RedrawCanvas(layerdict)
{
    let pcbLayers = pcb.GetLayers();

    if(layerdict.layer === "F")
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].front_id);
            prepareLayer(layerdict, canvas);
            ClearCanvas(canvas);
        }
    }
    else
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].back_id);
            prepareLayer(layerdict, canvas);
            ClearCanvas(canvas);
        }
    }
}

function ResizeCanvas(layerdict)
{
    let flip = (layerdict.layer != "B");
    let pcbLayers = pcb.GetLayers();
    
    if(layerdict.layer === "F")
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].front_id);
            recalcLayerScale(layerdict, canvas);
            prepareCanvas(canvas, flip, layerdict.transform);
            ClearCanvas(canvas);
        }
    }
    else
    {
        let canvas = undefined;
        for (let i = 0; i < pcbLayers.length; i++) 
        {
            canvas = document.getElementById(pcbLayers[i].back_id);
            recalcLayerScale(layerdict, canvas);
            prepareCanvas(canvas, flip, layerdict.transform);
            ClearCanvas(canvas);
        }
    }
}


module.exports = {
    ResizeCanvas, RedrawCanvas, rotateVector, ClearHighlights
};


