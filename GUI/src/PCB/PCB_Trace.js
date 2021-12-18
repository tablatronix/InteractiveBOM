"use strict";


var Point = require("../render/point.js").Point

var Segment_Arc  = require("./Segment_Arc.js").Segment_Arc
var Segment_Line = require("./Segment_Line.js").Segment_Line

var Segment_Via_Round   = require("./Segment_Via_Round.js").Segment_Via_Round
var Segment_Via_Square  = require("./Segment_Via_Square.js").Segment_Via_Square
var Segment_Via_Octagon = require("./Segment_Via_Octagon.js").Segment_Via_Octagon

var Segment_Polygon = require("./Segment_Polygon.js").Segment_Polygon

var pcb                = require("../pcb.js");

class PCB_Trace
{
    constructor(iPCB_JSON_Trace)
    {
        this.name = iPCB_JSON_Trace.name;
        this.segments = [];

        for(let segment of iPCB_JSON_Trace.segments)
        {
            if(segment.type == "arc")
            {
                this.segments.push(new Segment_Arc(segment));
            }
            else if(segment.type == "line")
            {
                this.segments.push(new Segment_Line(segment));
            }
            else if(segment.type == "via_round")
            {
                this.segments.push(new Segment_Via_Round(segment));
            }
            else if(segment.type == "via_square")
            {
                this.segments.push(new Segment_Via_Square(segment));
            }
            else if(segment.type == "via_octagon")
            {
                this.segments.push(new Segment_Via_Octagon(segment));
            }
            else if(segment.type == "polygon")
            {
                this.segments.push(new Segment_Polygon(segment));
            }
            else
            {
                console.log("ERROR: Unsupported segment type, ", segment.type);
            }
        }
    }

    Render(isViewFront, scalefactor)
    {
        for(let segment of this.segments)
        {
            let ctx = pcb.GetLayerCanvas(segment.layer, isViewFront).getContext("2d")
            segment.Render(ctx, scalefactor);
        }
    }

}

module.exports = {
    PCB_Trace
};
