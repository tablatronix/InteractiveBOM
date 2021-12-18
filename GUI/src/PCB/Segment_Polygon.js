"use strict";

var Point        = require("../render/point.js").Point
var Segment      = require("./Segment.js").Segment
var Segment_Arc  = require("./Segment_Arc.js").Segment_Arc
var Segment_Line = require("./Segment_Line.js").Segment_Line
var colorMap     = require("../colormap.js");

class Segment_Polygon extends Segment
{
    constructor(iPCB_JSON_Polygon)
    {
        super(iPCB_JSON_Polygon);
        this.segments = [];
        this.positive = iPCB_JSON_Polygon.positive;

        for(let segment of iPCB_JSON_Polygon.segments)
        {
            if(segment.type == "arc")
            {
                this.segments.push(new Segment_Arc(segment));
            }
            else if(segment.type == "line")
            {
                this.segments.push(new Segment_Line(segment));
            }
            else
            {
                console.log("ERROR: Unsupported polygon segment type, ", segment.type);
            }
        }
    }

    Render(guiContext, scalefactor)
    {
        guiContext.save();


        guiContext.restore();
    }
}

module.exports = {
    Segment_Polygon
};