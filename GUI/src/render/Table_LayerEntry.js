"use strict";

var globalData = require("../global.js");

function createLayerCheckboxChangeHandler(layerName, isFront)
{
    return function()
    {
        /*
            The following will correctly signal to the canvas what PCB layers should be displayed.
        */
        if(isFront)
        {
            if(globalData.readStorage( "checkbox_layer_front_" + layerName + "_visible" ) == "true")
            {
                //pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_front_" + layerName + "_visible", "false");
            }
            else
            {
                //pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_front_" + layerName + "_visible", "true");
            }
        }
        else
        {
            if(globalData.readStorage( "checkbox_layer_back_" + layerName + "_visible" ) == "true")
            {
                //pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_back_" + layerName + "_visible", "false");
            }
            else
            {
                //pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_back_" + layerName + "_visible", "true");
            }
        }
    }
}

class Table_LayerEntry
{
    constructor(layer)
    {
        this.visible_front = true;
        this.visible_back  = true;

        // Assumes that all layers are visible by default.
        if (    (globalData.readStorage( "checkbox_layer_front_" + layer.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_front_" + layer.name + "_visible" ) == null)
        )
        {
            this.visible_front = true;
            globalData.writeStorage("checkbox_layer_front_" + layer.name + "_visible", "true");
        }
        else
        {
            this.visible_front = false;
        }

        // Assumes that all layers are visible by default.
        if (    (globalData.readStorage( "checkbox_layer_back_" + layer.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_back_" + layer.name + "_visible" ) == null)
        )
        {
            this.visible_back = true;
            globalData.writeStorage("checkbox_layer_back_" + layer.name + "_visible", "true");
        }
        else
        {
            this.visible_back = false;
        }


        let tr = document.createElement("TR");
        tr.appendChild(this.CreateCheckbox_Visible(layer.name, true));
        tr.appendChild(this.CreateCheckbox_Visible(layer.name, false));

        // Layer
        let td = document.createElement("TD");
        td.innerHTML = layer.name;
        tr.appendChild(td);
        return tr;
    }

    /*
        Create a checkbox entry for layer table. 

        When checked (visible) an eye icon will be used
        and when unselected (not visible) an eye icon will 
        slash will be used.
    */
    CreateCheckbox_Visible(layerName, isFront)
    {
        let newlabel = document.createElement("Label");
        let td       = document.createElement("TD");
        let input    = document.createElement("input");
        
        input.type = "checkbox";
        newlabel.classList.add("check_box_bom")

        if(isFront)
        {
            input.checked = this.visible_front;
        }
        else
        {
            input.checked = this.visible_back;
        }

        input.onchange = createLayerCheckboxChangeHandler(layerName, isFront);

        var span = document.createElement("Span");
        span.classList.add("checkmark")

        newlabel.appendChild(input);
        newlabel.appendChild(span);
        td.appendChild(newlabel);
        return td;
    }
}

module.exports = {
    Table_LayerEntry
};
