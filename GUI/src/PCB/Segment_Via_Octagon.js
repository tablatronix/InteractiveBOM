"use strict";

var Point               = require("../render/point.js").Point
var Segment             = require("./Segment.js").Segment
var GetPolygonVerticies = require("./Helper.js").GetPolygonVerticies;
var render_lowlevel = require("../render/render_lowlevel.js");
var colorMap            = require("../colormap.js");

class Segment_Via_Octagon extends Segment
{
    constructor(iPCB_JSON_Segment)
    {
        super(iPCB_JSON_Segment);
        this.centerPoint   = new Point(iPCB_JSON_Segment.x, iPCB_JSON_Segment.y);
        this.diameter      = iPCB_JSON_Segment.diameter;
        this.drillDiameter = iPCB_JSON_Segment.drill;
        this.verticies     = GetPolygonVerticies(iPCB_JSON_Segment.diameter/2, 8);
    }

    Render(guiContext, scalefactor)
    {
        guiContext.save();
        
        let angle = (45/2);

        let renderOptions = { 
            color: colorMap.GetViaColor(),
            fill: true,
        };

        render_lowlevel.RegularPolygon( 
            guiContext,
            this.centerPoint, 
            this.verticies,
            angle,
            renderOptions
        );

        // Draw drill hole
        renderOptions = {
            color: colorMap.GetDrillColor(),
            fill: true,
        };

        render_lowlevel.Circle( 
            guiContext,
            this.centerPoint,
            this.drillDiameter/2, 
            renderOptions
        ); 

        guiContext.restore();
    }
}

module.exports = {
    Segment_Via_Octagon
};
