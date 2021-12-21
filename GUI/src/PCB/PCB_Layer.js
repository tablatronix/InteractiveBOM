"use strict";

var Segment_Arc  = require("./Segment_Arc.js").Segment_Arc;
var Segment_Line = require("./Segment_Line.js").Segment_Line;

var Segment_Via_Round   = require("./Segment_Via_Round.js").Segment_Via_Round;
var Segment_Via_Square  = require("./Segment_Via_Square.js").Segment_Via_Square;
var Segment_Via_Octagon = require("./Segment_Via_Octagon.js").Segment_Via_Octagon;

var Segment_Polygon = require("./Segment_Polygon.js").Segment_Polygon;

var pcb                = require("../pcb.js");
class PCB_Layer
{
    constructor(iPCB_JSON_Layer)
    {
        this.name        = iPCB_JSON_Layer.name;
        this.layerNumber = iPCB_JSON_Layer.layerNumber;
        this.paths       = [];

        for(let segment of iPCB_JSON_Layer.paths)
        {
            if(segment.type == "arc")
            {
                this.paths.push(new Segment_Arc(segment));
            }
            else if(segment.type == "line")
            {
                this.paths.push(new Segment_Line(segment));
            }
            else
            {
                console.log("ERROR: Unsupported segment type, ", segment.type);
            }
        }
    }

    Render(isViewFront, scalefactor)
    {
        for(let path of this.paths)
        {
            let ctx = pcb.GetLayerCanvas(path.layer, isViewFront).getContext("2d")
            path.Render(ctx, scalefactor);
        }
    }
}

module.exports = {
    PCB_Layer
};
