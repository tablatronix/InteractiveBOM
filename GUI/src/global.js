"use strict";

/*************************************************
              Board Rotation                    
*************************************************/
let storage = undefined;
const storagePrefix = "INTERACTIVE_PCB__" + pcbdata.metadata.title + "__" + pcbdata.metadata.revision + "__"

function initStorage ()
{
    try
    {
        window.localStorage.getItem("blank");
        storage = window.localStorage;
    }
    catch (e)
    {
        console.log("ERROR: Storage init error");
    }

    if (!storage)
    {
        try
        {
            window.sessionStorage.getItem("blank");
            storage = window.sessionStorage;
        }
        catch (e)
        {
            console.log("ERROR: Session storage not available");
            // sessionStorage also not available
        }
    }
}

function readStorage(key)
{
    if (storage)
    {
        return storage.getItem(storagePrefix + "#" + key);
    }
    else
    {
        return null;
    }
}

function writeStorage(key, value)
{
    if (storage)
    {
        storage.setItem(storagePrefix + "#" + key, value);
    }
}

/************************************************/

/*************************************************
              Highlighted Refs                    
*************************************************/
let highlightedRefs = [];

function setHighlightedRefs(refs)
{
    highlightedRefs = refs.split(",");
}

function getHighlightedRefs()
{
    return highlightedRefs;
}
/************************************************/

/*************************************************
              Redraw On Drag                      
*************************************************/
let redrawOnDrag = true;

function setRedrawOnDrag(value)
{
    redrawOnDrag = value;
    writeStorage("redrawOnDrag", value);
}

function getRedrawOnDrag()
{
    return redrawOnDrag;
}

/************************************************/


/*************************************************
                 Debug Mode                       
*************************************************/
let debugMode = false;

function setDebugMode(value)
{
    debugMode = value;
    writeStorage("debugMode", value);
}

function getDebugMode()
{
    return debugMode;
}

/************************************************/

/*************************************************
layer Split
*************************************************/
let layersplit;

function setLayerSplit(value)
{
    layersplit = value;
}

function getLayerSplit()
{
    return layersplit;
}

function destroyLayerSplit()
{
    layersplit.destroy();
}

/*************************************************
BOM Split
*************************************************/
let bomsplit;

function setBomSplit(value)
{
    bomsplit = value;
}

function getBomSplit()
{
    return bomsplit;
}

function destroyBomSplit()
{
    bomsplit.destroy();
}

/************************************************/

/*************************************************
Canvas Split
*************************************************/
let canvassplit;

function setCanvasSplit(value)
{
    canvassplit = value;
}

function getCanvasSplit()
{
    return canvassplit;
}

function destroyCanvasSplit()
{
    canvassplit.destroy();
}

function collapseCanvasSplit(value)
{
    canvassplit.collapse(value);
}

function setSizesCanvasSplit()
{
    canvassplit.setSizes([50, 50]);
}

/************************************************/

/*************************************************
Canvas Layout
*************************************************/
let canvaslayout = "FB";

/*XXX Found a bug at startup. Code assumes that canvas layout 
is in one of three states. then system fails. he bug was that the 
canvasLayout was being set to 'default' which is not a valid state. 
So no is check that if default is sent in then set the layout to FB mode.
*/
/* TODO: Make the default check below actually check that the item 
is in one of the three valid states. If not then set to FB, otherwise set to one of
the three valid states
*/
function setCanvasLayout(value)
{
    if(value == "default")
    {
        canvaslayout = "FB";
    }
    else
    {
        canvaslayout = value;
    }
}

function getCanvasLayout()
{
    return canvaslayout;
}

/************************************************/

/*************************************************
BOM Layout
*************************************************/
let bomlayout = "default";

function setBomLayout(value)
{
    bomlayout = value;
}

function getBomLayout()
{
    return bomlayout;
}

/************************************************/

/*************************************************
BOM Sort Function
*************************************************/
let bomSortFunction = null;

function setBomSortFunction(value)
{
    bomSortFunction = value;
}

function getBomSortFunction()
{
    return bomSortFunction;
}

/************************************************/

/*************************************************
Current Sort Column
*************************************************/
let currentSortColumn = null;

function setCurrentSortColumn(value)
{
    currentSortColumn = value;
}

function getCurrentSortColumn()
{
    return currentSortColumn;
}

/************************************************/

/*************************************************
Current Sort Order
*************************************************/
let currentSortOrder = null;

function setCurrentSortOrder(value)
{
    currentSortOrder = value;
}

function getCurrentSortOrder()
{
    return currentSortOrder;
}

/************************************************/

/*************************************************
Current Highlighted Row ID
*************************************************/
let currentHighlightedRowId;

function setCurrentHighlightedRowId(value)
{
    currentHighlightedRowId = value;
}

function getCurrentHighlightedRowId()
{
    return currentHighlightedRowId;
}

/************************************************/

/*************************************************
Highlight Handlers
*************************************************/
let highlightHandlers = [];

function setHighlightHandlers(values)
{
    highlightHandlers = values;
}

function getHighlightHandlers(){
    return highlightHandlers;
}

function pushHighlightHandlers(value)
{
    highlightHandlers.push(value);
}

/************************************************/

/*************************************************
Checkboxes
*************************************************/
let checkboxes = [];

function setCheckboxes(values)
{
    checkboxes = values;
}

function getCheckboxes()
{
    return checkboxes;
}

/************************************************/

/*************************************************
BOM Checkboxes
*************************************************/
let bomCheckboxes = "";

function setBomCheckboxes(values)
{
    bomCheckboxes = values;
}

function getBomCheckboxes()
{
    return bomCheckboxes;
}
/************************************************/

/*************************************************
Remove BOM Entries
*************************************************/
let removeBOMEntries = "";

function setRemoveBOMEntries(values)
{
    removeBOMEntries = values;
}

function getRemoveBOMEntries()
{
    return removeBOMEntries;
}
/************************************************/


/*************************************************
Remove BOM Entries
*************************************************/
let additionalAttributes = "";

function setAdditionalAttributes(values)
{
    additionalAttributes = values;
}

function getAdditionalAttributes(){
    return additionalAttributes;
}
/************************************************/


/*************************************************
Highlight Pin 1
*************************************************/
let highlightpin1 = false;

function setHighlightPin1(value)
{
    writeStorage("highlightpin1", value);
    highlightpin1 = value;
}

function getHighlightPin1(){
    return highlightpin1;
}

/************************************************/

/*************************************************
Last Clicked Ref
*************************************************/
let lastClickedRef;

function setLastClickedRef(value)
{
    lastClickedRef = value;
}

function getLastClickedRef()
{
    return lastClickedRef;
}

/************************************************/


/*************************************************
Combine Values
*************************************************/
let combineValues = false;

function setCombineValues(value)
{
    writeStorage("combineValues", value);
    combineValues = value;
}

function getCombineValues()
{
    return combineValues;
}
/************************************************/



/*************************************************
Combine Values
*************************************************/
let hidePlacedParts = false;

function setHidePlacedParts(value)
{
    writeStorage("hidePlacedParts", value);
    hidePlacedParts = value;
}

function getHidePlacedParts()
{
    return hidePlacedParts;
}
/************************************************/

let allcanvas =  undefined;

function SetAllCanvas(value)
{
    allcanvas = value;
}

function GetAllCanvas()
{
    return allcanvas;
}


let boardRotation = 0;
function SetBoardRotation(value)
{
    boardRotation = value;
}

function GetBoardRotation()
{
    return boardRotation;
}


module.exports = {
    initStorage                , readStorage                , writeStorage          ,
    setHighlightedRefs         , getHighlightedRefs         ,
    setRedrawOnDrag            , getRedrawOnDrag            ,
    setDebugMode               , getDebugMode               ,
    setBomSplit                , getBomSplit                , destroyBomSplit       ,
    setLayerSplit              , getLayerSplit              , destroyLayerSplit     ,
    setCanvasSplit             , getCanvasSplit             , destroyCanvasSplit    , collapseCanvasSplit , setSizesCanvasSplit ,
    setCanvasLayout            , getCanvasLayout            ,
    setBomLayout               , getBomLayout               ,
    setBomSortFunction         , getBomSortFunction         ,
    setCurrentSortColumn       , getCurrentSortColumn       ,
    setCurrentSortOrder        , getCurrentSortOrder        ,
    setCurrentHighlightedRowId , getCurrentHighlightedRowId ,
    setHighlightHandlers       , getHighlightHandlers       , pushHighlightHandlers ,
    setCheckboxes              , getCheckboxes              ,
    setBomCheckboxes           , getBomCheckboxes           ,
    setRemoveBOMEntries        , getRemoveBOMEntries        ,
    setAdditionalAttributes    , getAdditionalAttributes    ,
    setHighlightPin1           , getHighlightPin1           ,
    setLastClickedRef          , getLastClickedRef          ,
    setCombineValues           , getCombineValues           ,
    setHidePlacedParts         , getHidePlacedParts         ,
    SetAllCanvas               , GetAllCanvas               ,
    SetBoardRotation           , GetBoardRotation

};