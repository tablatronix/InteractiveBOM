"use strict";

var Point        = require("../render/point.js").Point
var Segment      = require("./Segment.js").Segment
var Segment_Arc  = require("./Segment_Arc.js").Segment_Arc
var Segment_Line = require("./Segment_Line.js").Segment_Line
var colorMap     = require("../colormap.js");
var render_lowlevel = require("../render/render_lowlevel.js");

class Segment_Polygon extends Segment
{
    constructor(iPCB_JSON_Polygon)
    {
        super(iPCB_JSON_Polygon);
        this.points = [];
        this.positive = iPCB_JSON_Polygon.positive;
        
        
//        for(let segment of iPCB_JSON_Polygon.segments)
//        {
//            if(segment.type == "arc")
//            {
//
//            }
//            else if(segment.type == "line")
//            {
//                /*
//                    Following only works for eagle as polygons are composed solely of 
//                    lines. If this is not true then the verticies array must be modified.
//                */
//                let point1 = (segment.x0, segment.x1);
//                this.vertices.push(point1);
//            }
//            else
//            {
//                console.log("ERROR: Unsupported polygon segment type, ", segment.type);
//            }
//        }

    }

    Render(guiContext, scalefactor)
    {
        guiContext.save();

//        let compositionType = (this.positive) ? "source-over" : "destination-out";
//        let renderOptions = {
//            color: colorMap.GetTraceColor(this.layer-1),
//            fill: true,
//            compositionType: compositionType
//        };

//        render_lowlevel.IrregularPolygon(
//            guiContext,
//            this.vertices,
//            renderOptions
//        );
        guiContext.restore();
    }
}

module.exports = {
    Segment_Polygon
};