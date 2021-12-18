"use strict";


var Point           = require("../render/point.js").Point
var Segment         = require("./Segment.js").Segment
var render_lowlevel = require("../render/render_lowlevel.js");
var colorMap        = require("../colormap.js");

class Segment_Arc extends Segment
{
    constructor(iPCB_JSON_Segment)
    {
        super(iPCB_JSON_Segment);
        this.centerPoint = new Point(iPCB_JSON_Segment.cx0, iPCB_JSON_Segment.cy0);
        this.layer       = iPCB_JSON_Segment.layer;
        this.radius      = iPCB_JSON_Segment.radius;
        this.angle0      = iPCB_JSON_Segment.angle0;
        this.angle1      = iPCB_JSON_Segment.angle1;
        this.width       = iPCB_JSON_Segment.width;
        this.direction   = iPCB_JSON_Segment.direction;
    }

    Render(guiContext, scalefactor)
    {
        guiContext.save();

        let renderOptions = { 
            color    : colorMap.GetTraceColor(this.layer-1),
            fill     : false,
            lineWidth: Math.max(1 / scalefactor, this.width),
            lineCap  : "round" 
        };

        render_lowlevel.Arc( 
            guiContext,
            this.centerPoint,
            this.radius,
            this.angle0,
            this.angle1,
            renderOptions
        );

        guiContext.restore();
    }

}

module.exports = {
    Segment_Arc
};

