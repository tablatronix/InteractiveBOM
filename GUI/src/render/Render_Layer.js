"use strict";


class Render_Layer
{
    // Render should take as an argument the model not the raw JSON data
    constructor(iPCB_JSON_Layer)
    {
        this.visible_front = true;
        this.visible_back  = true;
        this.front_id      = "layer_front_" + iPCB_JSON_Layer.name;
        this.back_id       = "layer_rear_"  + iPCB_JSON_Layer.name;

        // TODO: Remove the following. This data is is the model
        this.layerName = iPCB_JSON_Layer.name;


        let canvas_front = document.getElementById("front-canvas-list");
        let layer_front   = document.createElement("canvas");
        layer_front.id             = this.front_id;
        layer_front.style.zIndex   = iPCB_JSON_Layer.layerNumber;
        layer_front.style.position = "absolute";
        layer_front.style.left      = 0;
        layer_front.style.top      = 0;
        canvas_front.appendChild(layer_front);

        let canvas_back           = document.getElementById("back-canvas-list");
        let layer_back            = document.createElement("canvas");
        layer_back.id             = this.back_id;
        layer_back.style.zIndex   = iPCB_JSON_Layer.layerNumber;
        layer_back.style.position = "absolute";
        layer_back.style.left     = 0;
        layer_back.style.top      = 0;
        canvas_back.appendChild(layer_back);


        this.canvas_front = document.getElementById(this.front_id);
        this.canvas_back  = document.getElementById(this.back_id);
    }

    SetVisability(isFront, visability)
    {
        if(isFront)
        {
            this.visible_front = visability;
            if(visible)
            {
                this.canvas_front.style.display="";
            }
            else
            {
                this.canvas_front.style.display="none";
            }
        }
        else
        {
            this.visible_back  = visability;
            if(visible)
            {
                this.canvas_back.style.display="";
            }
            else
            {
                this.canvas_back.style.display="none";
            }
        }
    }

    IsVisible(isFront)
    {
        if(isFront)
        {
            return this.visible_front;
        }
        else
        {
            return this.visible_back;
        }
    }

    GetCanvas(isFront)
    {
        if(isFront)
        {
            return this.canvas_front;
        }
        else
        {
            return this.canvas_back;
        }
    }
}



module.exports =
{
    Render_Layer
};