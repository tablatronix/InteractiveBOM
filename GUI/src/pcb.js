/*
    This file contains all of the definitions for working with pcbdata.json. 
    This file declares all of the access functions and interfaces for converting 
    the json file into an internal data structure. 
*/

"use strict";

/***************************************************************************************************
                                         PCB Part Interfaces
**************************************************************************************************/
// Read the ecad property. This property lets the application know what 
// ecad software generated the json file. 
function GetCADType(pcbdataStructure)
{
    if(pcbdataStructure.hasOwnProperty("ecad"))
    {
        return pcbdataStructure.ecad;
    }
}

// This will hold the part objects. There is one entry per part
// Format of a part is as follows
// [VALUE,PACKAGE,REFRENECE DESIGNATOR, ,LOCATION, ATTRIBUTE],
// where ATTRIBUTE is a dict of ATTRIBUTE NAME : ATTRIBUTE VALUE
let BOM = [];

// Constructor for creating a part.
function Part(value, footprint, reference, location, attributes, checkboxes)
{
    this.quantity   = 1;
    this.value      = value;
    this.foorptint  = footprint;
    this.reference  = reference;
    this.location   = location;
    this.attributes = attributes;
    this.checkboxes = checkboxes;
}

function CopyPart(inputPart)
{
    // XXX: This is not performing a deep copy, attributes is a map and this is being copied by 
    //      reference which is not quite what we want here. It should be a deep copy so once called
    //      this will result in a completely new object that will not reference one another
    return new Part(inputPart.value, inputPart.package, inputPart.reference, inputPart.location, inputPart.attributes, inputPart.checkboxes);
}

//TODO: There should be steps here for validating the data and putting it into a 
//      format that is valid for our application
function CreateBOM(pcbdataStructure)
{
    // For every part in the input file, convert it to our internal 
    // representation data structure.
    for(let part of pcbdataStructure.parts)
    {
        // extract the part data. This is here so I can iterate the design 
        // when I make changes to the underlying json file.
        let value     = part.value;
        let footprint = "";
        let reference = part.name;
        let location  = part.location;

        // AttributeName and AttributeValue are two strings that are deliminated by ';'. 
        // Split the strings by ';' and then zip them together
        let attributeNames  = part.attributes.name.split(";");
        let attributeValues = part.attributes.value.split(";");

        let checkboxes = new Map();

        //XXX: ASSUMTION that attributeNames is the same length as attributeValues
        let attributes = new Map(); // Create a empty dictionary
        for(let i in attributeNames)
        {
            attributes.set(attributeNames[i].toLowerCase(),attributeValues[i].toLowerCase());
        }
        // Add the par to the global part array
        BOM.push(new Part(value, footprint, reference, location, attributes, checkboxes));
    }
}

function GetBOM()
{
    return BOM;
}

// TAkes a BOM table and a filter function. The filter 
// function is used onthe provided table to remove 
// any part that satisfy the filter
function filterBOMTable(bomtable, filterFunction)
{
    let result = [];

    // Makes sure that thE filter function is defined. 
    // if not defined then nothing should be filtered. 
    if(filterFunction != null)
    {
        for(let i in bomtable)
        {
            // If the filter returns false -> do not remove part, it does not need to be filtered
            if(!filterFunction(bomtable[i]))
            {
                result.push(CopyPart(bomtable[i]));
            }
        }
    }
    else
    {
        result = bomtable;
    }
    return result;
}

// Takes a bom table and combines entries that are the same
function GetBOMCombinedValues(bomtableTemp)
{
    let result = [];

    // TODO: sort bomtableTemp. Assumption here is that the bomtableTemp is presorted

    if(bomtableTemp.length>0)
    {
        // XXX: Assuming that the input json data has bom entries presorted
        // TODO: Start at index 1, and compare the current to the last, this should simplify the logic
        // Need to create a new object by deep copy. this is because objects by default are passed by reference and i dont 
        // want to modify them.
        result.push(CopyPart(bomtableTemp[0]));
        let count = 0;
        for (let n = 1; n < bomtableTemp.length;n++)
        {
            if(result[count].value == bomtableTemp[n].value)
            {
                // For parts that are listed as combined, store the references as an array.
                // This is because the logic for highlighting needs to match strings and 
                // If an appended string is used it might not work right
                let refString = result[count].reference + "," + bomtableTemp[n].reference;
                result[count].quantity += 1;
                result[count].reference = refString;
            }
            else
            {
                result.push(CopyPart(bomtableTemp[n]));
                count++;
            }
        }
    }
    return result;
}

function getAttributeValue(part, attributeToLookup)
{
    let attributes = part.attributes;
    let result = "";

    if(attributeToLookup == "name")
    {
        result = part.reference;
    }
    else
    {
        result = (attributes.has(attributeToLookup) ? attributes.get(attributeToLookup) : "");
    }
    // Check that the attribute exists by looking up its name. If it exists
    // the return the value for the attribute, otherwise return an empty string. 
    return result;
}


/***************************************************************************************************
                                         PCB Metadata Interfaces
***************************************************************************************************/
let metadata;
// Constructor for creating a part.
function Metadata(title, revision, company, date) 
{
    this.title    = title;
    this.revision = revision;
    this.company  = company;
    this.date     = date;
}

function CreateMetadata(pcbdataStructure)
{
    metadata = new Metadata( 
        pcbdataStructure.metadata.title, pcbdataStructure.metadata.revision,
        pcbdataStructure.metadata.company, pcbdataStructure.metadata.date
    );
}

function GetMetadata()
{
    return metadata;
}

/***************************************************************************************************
                                         PCB Layers Interfaces
***************************************************************************************************/
let Layers = [];
let layer_Zindex = 0;

function GetLayers()
{
    return Layers;
}


function PCBLayer(name)
{
    this.name    = name;
    this.visible_front = true;
    this.visible_back = true;


    this.front_id = "layer_front_" + name;
    this.back_id  = "layer_rear_" + name;

    let canvas_front = document.getElementById("front-canvas-list");
    let layer_front = document.createElement("canvas");
    layer_front.id = this.front_id;
    layer_front.style.zIndex = layer_Zindex;
    layer_front.style.position = "absolute";
    layer_front.style.left = 0;
    layer_front.style.top = 0;
    canvas_front.appendChild(layer_front);


    let canvas_back = document.getElementById("back-canvas-list");
    let layer_back = document.createElement("canvas");
    layer_back.id = this.back_id;
    layer_back.style.zIndex = layer_Zindex;
    layer_back.style.position = "absolute";
    layer_back.style.left = 0;
    layer_back.style.top = 0;

    canvas_back.appendChild(layer_back);

    layer_Zindex = layer_Zindex + 1;
}

function SetLayerVisibility(layerName, isFront, visible)
{
    let layerIndex = Layers.findIndex(i => i.name === layerName);
    if(isFront)
    {
        // If item is not in the list 
        if( layerIndex !== -1)
        {
            // Layer exists. Check if visible
            Layers[layerIndex].visible_front = visible;

            // TODO: Refactor this. below is used to interface between the different layer 
            // setups that are currently being used but once switched to the new layer format
            // then the above will not be needed.
            let canvas = undefined; 
            if(visible)
            {
                canvas = document.getElementById(Layers[layerIndex].front_id);
                canvas.style.display="";
            }
            else
            {
                canvas = document.getElementById(Layers[layerIndex].front_id);
                canvas.style.display="none";
            }
        }
    }
    else
    {
        // If item is not in the list 
        if( layerIndex !== -1)
        {
            // Layer exists. Check if visible
            Layers[layerIndex].visible_back = visible;

            // TODO: Refactor this. below is used to interface between the different layer 
            // setups that are currently being used but once switched to the new layer format
            // then the above will not be needed.
            let canvas = undefined;
            if(visible)
            {
                canvas= document.getElementById(Layers[layerIndex].back_id);
                canvas.style.display="";
            }
            else
            {
                canvas= document.getElementById(Layers[layerIndex].back_id);
                canvas.style.display="none";
            }
        }
    }
}

function GetLayerCanvas(layerName, isFront)
{
    // Get the index of the PCB layer 
    // MAp used here to create a list of just the layer names, which indexOf can then  be used against.
    let index = Layers.map(function(e) { return e.name; }).indexOf(layerName);
    // Requested layer does not exist. Create new layer
    if(index === -1)
    {
        // Adds layer to layer stack
        Layers.push(new PCBLayer(layerName));
        index = Layers.length-1;
    }

    // Return the canvas instance
    if(isFront)
    {
        return document.getElementById(Layers[index].front_id);
    } 
    else
    {
        return document.getElementById(Layers[index].back_id);
    }
}

function CreateLayers(pcbdataStructure)
{
    // Extract layers from the trace section
    for( let trace of pcbdataStructure.board.traces)
    {
        for(let segment of trace.segments)
        {
            // Check that segment contains a layer definition
            if(segment.layer)
            {
                // If item is not in the list 
                if(Layers.findIndex(i => i.name === segment.layer) === -1)
                {
                    Layers.push(new PCBLayer(segment.layer));
                }
            }
        }
    }

    // Extract layers form the layers section
    for(let layer of pcbdataStructure.board.layers)
    {
        // If item is not in the list 
        if(Layers.findIndex(i => i.name === layer.name) === -1)
        {
            // Add the par to the global part array
            Layers.push(new PCBLayer(layer.name));
        }
    }

    // XXX: Need another way to extract all layers from input
    Layers.push(new PCBLayer("edges"));
    Layers.push(new PCBLayer("pads"));
    Layers.push(new PCBLayer("highlights"));
}


function IsLayerVisible(layerName, isFront)
{
    let result = true;
    let layerIndex = Layers.findIndex(i => i.name === layerName);

    // This means that the layer is always visible. 
    if(layerName == "all")
    {
        result = true;
    }
    else if(isFront)
    {
        // If item is not in the list 
        if( layerIndex === -1)
        {
            result = false;
        }
        else
        {
            // Layer exists. Check if visible
            result = Layers[layerIndex].visible_front;
        }
    }
    else
    {
        // If item is not in the list 
        if( layerIndex === -1)
        {
            result = false;
        }
        else
        {
            // Layer exists. Check if visible
            result = Layers[layerIndex].visible_back;
        }
    }

    return result;
}

function OpenPcbData(pcbdata)
{
    CreateBOM(pcbdata);
    CreateMetadata(pcbdata);
    CreateLayers(pcbdata);
}

module.exports = {
    OpenPcbData, GetBOM, getAttributeValue, GetBOMCombinedValues, filterBOMTable, GetMetadata, 
    GetLayers, IsLayerVisible, SetLayerVisibility, GetLayerCanvas, GetCADType
};