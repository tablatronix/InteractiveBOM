"use strict";

var Point    = require("../render/point.js").Point
var Segment  = require("./Segment.js").Segment
var render_lowlevel = require("../render/render_lowlevel.js");
var colorMap = require("../colormap.js");

class Segment_Via_Round extends Segment
{
    constructor(iPCB_JSON_Segment)
    {
        super(iPCB_JSON_Segment);
        this.centerPoint        = new Point(iPCB_JSON_Segment.x, iPCB_JSON_Segment.y);
        this.diameter           = iPCB_JSON_Segment.diameter;
        this.drillDiameter      = iPCB_JSON_Segment.drill;
        this.layer       = iPCB_JSON_Segment.layer;
    }

    Render(guiContext, scalefactor)
    {
        guiContext.save();
        let renderOptions = {
            color: colorMap.GetViaColor(),
            fill: true,
        };

        render_lowlevel.Circle( 
            guiContext,
            this.centerPoint,
            this.diameter/2, 
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

        // Restores context to state prior to this rendering function being called. 
        guiContext.restore();
    }
}

module.exports = {
    Segment_Via_Round
};