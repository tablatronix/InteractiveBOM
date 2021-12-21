/*
    This file contains all of the definitions for working with pcbdata.json. 
    This file declares all of the access functions and interfaces for converting 
    the json file into an internal data structure. 
*/

"use strict";
var Part     = require("./Part.js");
var Metadata = require("./Metadata.js").Metadata;
var globalData = require("./global.js");


/***************************************************************************************************
                                         PCB Part Interfaces
**************************************************************************************************/
// This will hold the part objects. There is one entry per part
// Format of a part is as follows
// [VALUE,PACKAGE,REFRENECE DESIGNATOR, ,LOCATION, ATTRIBUTE],
// where ATTRIBUTE is a dict of ATTRIBUTE NAME : ATTRIBUTE VALUE
let BOM = [];

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
        BOM.push(new Part.Part(value, footprint, reference, location, attributes, checkboxes));
    }
}

function GetBOM()
{
    return BOM;
}

// Takes a BOM table and a filter function. The filter 
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
                result.push(bomtable[i].CopyPart());
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
        result.push(bomtableTemp[0].CopyPart());
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
                result.push(bomtableTemp[n].CopyPart());
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
                                         PCB Layers Interfaces
***************************************************************************************************/

function GetLayerCanvas(layerNumber, isFront)
{
    return (globalData.layer_list.get(layerNumber)[globalData.render_layers].GetCanvas(isFront));

}

function OpenPcbData(pcbdata)
{
    CreateBOM(pcbdata);

    let metadata = Metadata.GetInstance();
    metadata.Set(pcbdata.metadata);

    //CreateLayers(pcbdata);
}

module.exports = {
    OpenPcbData, GetBOM, getAttributeValue, GetBOMCombinedValues, filterBOMTable, GetLayerCanvas
};