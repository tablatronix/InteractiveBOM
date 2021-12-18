"use strict";

var Point           = require("../render/point.js").Point
var Segment         = require("./Segment.js").Segment
var render_lowlevel = require("../render/render_lowlevel.js");
var colorMap        = require("../colormap.js");

class Segment_Line extends Segment
{
    constructor(iPCB_JSON_Segment)
    {
        super(iPCB_JSON_Segment);
        this.startPoint  = new Point(iPCB_JSON_Segment.x0, iPCB_JSON_Segment.y0);
        this.endPoint    = new Point(iPCB_JSON_Segment.x1, iPCB_JSON_Segment.y1);
        this.layer       = iPCB_JSON_Segment.layer;
        this.width       = iPCB_JSON_Segment.width;
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

        render_lowlevel.Line(
            guiContext,
            this.startPoint,
            this.endPoint,
            renderOptions
        );

        guiContext.restore();
    }
}

module.exports = {
    Segment_Line
};