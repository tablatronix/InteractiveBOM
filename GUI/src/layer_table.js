/*
    Layer table forms the right half of display. The table contains each of the 
    used layers in the design along with check boxes to show/hide the layer.

    The following function interfaces the layers for the project to the GUI.
*/
"use strict";

var pcb        = require("./pcb.js");
var globalData = require("./global.js");

function populateLayerTable()
{
    populateLayerHeader();
    populateLayerBody();
}

function setFilterLayer(input) 
{
    filterLayer = input.toLowerCase();
    populateLayerTable();
}

let filterLayer = "";
function getFilterLayer() 
{
    return filterLayer;
}

function populateLayerHeader()
{
    let layerHead = document.getElementById("layerhead");
    while (layerHead.firstChild) 
    {
        layerHead.removeChild(layerHead.firstChild);
    }

    // Header row
    let tr = document.createElement("TR");
    // Defines the
    let th = document.createElement("TH");

    th.classList.add("visiableCol");

    let tr2 = document.createElement("TR");
    let thf = document.createElement("TH");
    let thb = document.createElement("TH");

    thf.innerHTML = "Front"
    thb.innerHTML = "Back"
    tr2.appendChild(thf)
    tr2.appendChild(thb)

    th.innerHTML = "Visible";
    th.colSpan = 2
    let span = document.createElement("SPAN");
    span.classList.add("none");
    th.appendChild(span);
    tr.appendChild(th);

    th = document.createElement("TH");
    th.innerHTML = "Layer";
    th.rowSpan = 2;
    span = document.createElement("SPAN");
    span.classList.add("none");
    th.appendChild(span);
    tr.appendChild(th);

    layerHead.appendChild(tr);
    layerHead.appendChild(tr2);
}

function populateLayerBody() 
{
    let layerBody = document.getElementById("layerbody");
    while (layerBody.firstChild) 
    {
        layerBody.removeChild(layerBody.firstChild);
    }
    let layertable =  pcb.GetLayers();

    // remove entries that do not match filter
    for (let i of layertable) 
    {

        if (getFilterLayer() != "")
        {
            if(!entryMatchesLayer(i))
            {
                continue;
            }
        }

        var newlabelF = document.createElement("Label");
        var newlabelR = document.createElement("Label");
        
        let tr = document.createElement("TR");
        let td = document.createElement("TD");
        let input_front = document.createElement("input");
        let input_back = document.createElement("input");
        
        input_front.type = "checkbox";
        input_back.type = "checkbox";
        newlabelF.classList.add("check_box_bom")
        newlabelR.classList.add("check_box_bom")




        // Assumes that all layers are visible by default.
        if (    (globalData.readStorage( "checkbox_layer_front_" + i.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_front_" + i.name + "_visible" ) == null)
        )
        {
            pcb.SetLayerVisibility(i.name, true, true);
            input_front.checked = true;
        }
        else
        {
            pcb.SetLayerVisibility(i.name, true, false);
            input_front.checked = false;
        }


        if (    (globalData.readStorage( "checkbox_layer_back_" + i.name + "_visible" ) == "true")
             || (globalData.readStorage( "checkbox_layer_back_" + i.name + "_visible" ) == null)
        )
        {
            pcb.SetLayerVisibility(i.name, false, true);
            input_back.checked = true;
        }
        else
        {
            pcb.SetLayerVisibility(i.name, false, false);
            input_back.checked = false;
        }

        
        input_front.onchange = createLayerCheckboxChangeHandler(i, true);
        input_back.onchange  = createLayerCheckboxChangeHandler(i, false);

        //newlabelF.innerHTML = input_front;
        //newlabelR.innerHTML = input_back;
        var spanF = document.createElement("Span");
        var spanR = document.createElement("Span");
        spanF.classList.add("checkmark")
        spanR.classList.add("checkmark")

        newlabelF.appendChild(input_front);
        newlabelR.appendChild(input_back);
        newlabelF.appendChild(spanF);
        newlabelR.appendChild(spanR);

        td.appendChild(newlabelF);
        tr.appendChild(td);

        td = document.createElement("TD");
        td.appendChild(newlabelR);
        tr.appendChild(td);

        // Layer
        td = document.createElement("TD");
        td.innerHTML =highlightFilterLayer(i.name);
        tr.appendChild(td);

        layerbody.appendChild(tr);
    }
}

function createLayerCheckboxChangeHandler(layerEntry, isFront) {
    return function() 
    {
        if(isFront)
        {
            if(layerEntry.visible_front)
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_front_" + layerEntry.name + "_visible", "false");
            }
            else
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_front_" + layerEntry.name + "_visible", "true");
            }
        }
        else
        {
            if(layerEntry.visible_back)
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, false);
                globalData.writeStorage("checkbox_layer_back_" + layerEntry.name + "_visible", "false");
            }
            else
            {
                pcb.SetLayerVisibility(layerEntry.name, isFront, true);
                globalData.writeStorage("checkbox_layer_back_" + layerEntry.name + "_visible", "true");
            }
        }
    }
}

function highlightFilterLayer(s) 
{
    if (!getFilterLayer()) 
    {
        return s;
    }
    let parts = s.toLowerCase().split(getFilterLayer());
    if (parts.length == 1) 
    {
        return s;
    }
    let r = "";
    let pos = 0;
    for (let i in parts) 
    {
        if (i > 0) 
        {
            r += "<mark class=\"highlight\">" + s.substring(pos, pos + getFilterLayer().length) + "</mark>";
            pos += getFilterLayer().length;
        }
        r += s.substring(pos, pos + parts[i].length);
        pos += parts[i].length;
    }
    return r;
}


function clearLayerTable()
{
    while (layerBody.firstChild) 
    {
        layerBody.removeChild(layerBody.firstChild);
    }
}

module.exports = {
    setFilterLayer , getFilterLayer, populateLayerTable, populateLayerHeader, populateLayerBody,
    clearLayerTable
};
