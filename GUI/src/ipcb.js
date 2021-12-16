/* DOM manipulation and misc code */

"use strict";
var Split      = require("split.js");
var globalData = require("./global.js");
var render     = require("./render.js");
var pcb        = require("./pcb.js");
var handlers_mouse    = require("./handlers_mouse.js");
var layerTable        = require("./layer_table.js")
var bomTable          = require("./bom_table.js")
var Metadata = require("./Metadata.js").Metadata;

//TODO: GLOBAL VARIABLES
let layerBody = undefined;
let layerHead = undefined;
let bomhead   = undefined;
let topmostdiv = undefined;
let bom = undefined;
let bomtable = undefined;



function setDarkMode(value)
{
    if (value)
    {
        topmostdiv.classList.add("dark");
    }
    else
    {
        topmostdiv.classList.remove("dark");
    }
    globalData.writeStorage("darkmode", value);
    render.drawCanvas(globalData.GetAllCanvas().front);
    render.drawCanvas(globalData.GetAllCanvas().back);
}





function entryMatches(part)
{
    // check refs
    if (part.reference.toLowerCase().indexOf(getFilterBOM()) >= 0)
    {
        return true;
    }
    // check value
    if (part.value.toLowerCase().indexOf(getFilterBOM())>= 0)
    {
        return true;
    } 
    // check footprint
    if (part.package.toLowerCase().indexOf(getFilterBOM())>= 0)
    {
        return true;
    }

    // Check the displayed attributes
    let additionalAttributes = globalData.getAdditionalAttributes().split(",");
    additionalAttributes     = additionalAttributes.filter(function(e){return e;});
    for (let x of additionalAttributes)
    {
        // remove beginning and trailing whitespace
        x = x.trim();
        if (part.attributes.has(x))
        {
            if(part.attributes.get(x).indexOf(getFilterBOM()) >= 0)
            {
                return true;
            }
        }
    }

    return false;
}

function entryMatchesLayer(layer) 
{
    // check refs
    if (layer.name.toLowerCase().indexOf(getFilterLayer()) >= 0) 
    {
        return true;
    }
    return false;
}




////////////////////////////////////////////////////////////////////////////////
function highlightPreviousRow()
{
    if (!globalData.getCurrentHighlightedRowId())
    {
        globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].handler();
    }
    else
    {
        if (    (globalData.getHighlightHandlers().length > 1)
             && (globalData.getHighlightHandlers()[0].id == globalData.getCurrentHighlightedRowId())
        )
        {
            globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].handler();
        }
        else
        {
            for (let i = 0; i < globalData.getHighlightHandlers().length - 1; i++)
            {
                if (globalData.getHighlightHandlers()[i + 1].id == globalData.getCurrentHighlightedRowId())
                {
                    globalData.getHighlightHandlers()[i].handler();
                    break;
                }
            }
        }
    }
    render.smoothScrollToRow(globalData.getCurrentHighlightedRowId());
}

function highlightNextRow()
{
    if (!globalData.getCurrentHighlightedRowId())
    {
        globalData.getHighlightHandlers()[0].handler();
    }
    else
    {
        if (    (globalData.getHighlightHandlers().length > 1)
             && (globalData.getHighlightHandlers()[globalData.getHighlightHandlers().length - 1].id == globalData.getCurrentHighlightedRowId())
        )
        {
            globalData.getHighlightHandlers()[0].handler();
        }
        else
        {
            for (let i = 1; i < globalData.getHighlightHandlers().length; i++)
            {
                if (globalData.getHighlightHandlers()[i - 1].id == globalData.getCurrentHighlightedRowId())
                {
                    globalData.getHighlightHandlers()[i].handler();
                    break;
                }
            }
        }
    }
    smoothScrollToRow(globalData.getCurrentHighlightedRowId());
}





function modulesClicked(references)
{
    let lastClickedIndex = references.indexOf(globalData.getLastClickedRef());
    let ref = references[(lastClickedIndex + 1) % references.length];
    for (let handler of globalData.getHighlightHandlers()) 
    {
        if (handler.refs.indexOf(ref) >= 0)
        {
            globalData.setLastClickedRef(ref);
            handler.handler();
            smoothScrollToRow(globalData.getCurrentHighlightedRowId());
            break;
        }
    }
}

function silkscreenVisible(visible)
{
    if (visible)
    {
        globalData.GetAllCanvas().front.silk.style.display = "";
        globalData.GetAllCanvas().back.silk.style.display = "";
        globalData.writeStorage("silkscreenVisible", true);
    }
    else
    {
        globalData.GetAllCanvas().front.silk.style.display = "none";
        globalData.GetAllCanvas().back.silk.style.display = "none";
        globalData.writeStorage("silkscreenVisible", false);
    }
}

function changeCanvasLayout(layout) 
{
    document.getElementById("fl-btn").classList.remove("depressed");
    document.getElementById("fb-btn").classList.remove("depressed");
    document.getElementById("bl-btn").classList.remove("depressed");

    switch (layout) 
    {
    case "F":
        document.getElementById("fl-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.collapseCanvasSplit(1);
        }
        break;
    case "B":
        document.getElementById("bl-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.collapseCanvasSplit(0);
        }
        break;
    default:
        document.getElementById("fb-btn").classList.add("depressed");
        if (globalData.getBomLayout() != "BOM") 
        {
            globalData.setSizesCanvasSplit([50, 50]);
        }
        break;
    }

    globalData.setCanvasLayout(layout);
    globalData.writeStorage("canvaslayout", layout);
    render.resizeAll();
    bomTable.populateBomTable();
}

function populateMetadata()
{
    let metadata = Metadata.GetInstance();
    metadata.Set(pcbdata.metadata);

    if(metadata.revision == undefined)
    {
        document.getElementById("revision").innerHTML = "";
    }
    else
    {
        document.getElementById("revision").innerHTML = "Revision: " + metadata.revision.toString();;
    }

    if(metadata.company == undefined)
    {
        document.getElementById("company").innerHTML = "";
    }
    else
    {
        document.getElementById("company").innerHTML  = metadata.company;
    }

    if(metadata.project_name == undefined)
    {
         document.getElementById("title").innerHTML = "";
    }
    else
    {
         document.getElementById("title").innerHTML = metadata.project_name;
    }

    if(metadata.date == undefined)
    {
         document.getElementById("filedate").innerHTML = "";
    }
    else
    {
         document.getElementById("filedate").innerHTML = metadata.date;
    }
}

function focusInputField(input)
{
    input.scrollIntoView(false);
    input.focus();
    input.select();
}

function focusBOMFilterField()
{
    focusInputField(document.getElementById("bom-filter"));
}

function toggleBomCheckbox(bomrowid, checkboxnum)
{
    if (!bomrowid || checkboxnum > globalData.getCheckboxes().length)
    {
        return;
    }
    let bomrow = document.getElementById(bomrowid);
    let checkbox = bomrow.childNodes[checkboxnum].childNodes[0];
    checkbox.checked = !checkbox.checked;
    checkbox.indeterminate = false;
    checkbox.onchange();
}


function removeGutterNode(node)
{
    for (let i = 0; i < node.childNodes.length; i++)
    {
        if (    (node.childNodes[i].classList )
             && (node.childNodes[i].classList.contains("gutter")) 
        )
        {
            node.removeChild(node.childNodes[i]);
            break;
        }
    }
}

function cleanGutters()
{
    removeGutterNode(document.getElementById("bot"));
    removeGutterNode(document.getElementById("canvasdiv"));
}



function setAdditionalAttributes(value)
{
    globalData.setAdditionalAttributes(value);
    globalData.writeStorage("additionalAttributes", value);
    bomTable.populateBomTable();
}

// XXX: None of this seems to be working. 
document.onkeydown = function(e)
{
    switch (e.key)
    {
    case "n":
        if (document.activeElement.type == "text")
        {
            return;
        }
        if (globalData.getCurrentHighlightedRowId() !== null)
        {
            // XXX: Why was the following line in the software
            //checkBomCheckbox(globalData.getCurrentHighlightedRowId(), "placed");
            highlightNextRow();
            e.preventDefault();
        }
        break;
    case "ArrowUp":
        highlightPreviousRow();
        e.preventDefault();
        break;
    case "ArrowDown":
        highlightNextRow();
        e.preventDefault();
        break;
    default:
        break;
    }

    if (e.altKey)
    {
        switch (e.key)
        {
        case "f":
            focusBOMFilterField();
            e.preventDefault();
            break;
        case "z":
            changeBomLayout("BOM");
            e.preventDefault();
            break;
        case "x":
            changeBomLayout("LR");
            e.preventDefault();
            break;
        case "c":
            changeBomLayout("TB");
            e.preventDefault();
            break;
        case "v":
            changeCanvasLayout("F");
            e.preventDefault();
            break;
        case "b":
            changeCanvasLayout("FB");
            e.preventDefault();
            break;
        case "n":
            changeCanvasLayout("B");
            e.preventDefault();
            break;
        default:
            break;
        }
    }
};

function changeBomLayout(layout)
{
    document.getElementById("bom-btn").classList.remove("depressed");
    document.getElementById("bom-lr-btn").classList.remove("depressed");
    document.getElementById("bom-tb-btn").classList.remove("depressed");
    document.getElementById("pcb-btn").classList.remove("depressed");
    switch (layout) 
    {
    case "BOM":
        document.getElementById("bom-btn").classList.add("depressed");
        if (globalData.getBomSplit()) 
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "none";
        document.getElementById("backcanvas").style.display = "none";
        document.getElementById("layerdiv").style.display = "none";
        document.getElementById("bot").style.height = "";
        break;
    case "PCB":
        document.getElementById("pcb-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "none";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";
        
        document.getElementById("datadiv"   ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.remove(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.remove(   "split-horizontal");
        document.getElementById("frontcanvas").classList.add(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.add(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");


        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            direction: "vertical",
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));

        document.getElementById("canvasdiv"  ).style.height = "calc(100% - 2.5px)";
        break;
    case "TB":
        document.getElementById("bom-tb-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";

        document.getElementById("datadiv"   ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.remove(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.remove(   "split-horizontal");
        document.getElementById("frontcanvas").classList.add(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.add(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");


        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            direction: "vertical",
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));


        break;
    case "LR":
        document.getElementById("bom-lr-btn"     ).classList.add("depressed");
        document.getElementById("bomdiv").style.display = "";
        document.getElementById("frontcanvas").style.display = "";
        document.getElementById("backcanvas" ).style.display = "";
        document.getElementById("layerdiv"   ).style.display = "";
        document.getElementById("bot"        ).style.height = "calc(100% - 80px)";

        document.getElementById("datadiv"    ).classList.add(   "split-horizontal");
        document.getElementById("bomdiv"     ).classList.add(   "split-horizontal");
        document.getElementById("canvasdiv"  ).classList.add(   "split-horizontal");
        document.getElementById("frontcanvas").classList.remove(   "split-horizontal");
        document.getElementById("backcanvas" ).classList.remove(   "split-horizontal");
        document.getElementById("layerdiv"   ).classList.add(   "split-horizontal");

        if (globalData.getBomSplit())
        {
            globalData.destroyLayerSplit();
            globalData.setLayerSplit(null);
            globalData.destroyBomSplit();
            globalData.setBomSplit(null);
            globalData.destroyCanvasSplit();
            globalData.setCanvasSplit(null);
        }

        globalData.setLayerSplit(Split(["#datadiv", "#layerdiv"], {
            sizes: [80, 20],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "col-resize"
        }));

        globalData.setBomSplit(Split(["#bomdiv", "#canvasdiv"], {
            sizes: [50, 50],
            onDragEnd: render.resizeAll,
            gutterSize: 5,
            cursor: "row-resize"
        }));

        globalData.setCanvasSplit(Split(["#frontcanvas", "#backcanvas"], {
            sizes: [50, 50],
            direction: "vertical",
            gutterSize: 5,
            onDragEnd: render.resizeAll,
            cursor: "row-resize"
        }));
        break;
    }
    globalData.setBomLayout(layout);
    globalData.writeStorage("bomlayout", layout);
    changeCanvasLayout(globalData.getCanvasLayout());
}


//XXX: I would like this to be in the html functions js file. But this function needs to be 
//     placed here, otherwise the application rendering becomes very very weird.
window.onload = function(e)
{
    console.time("on load");
    // This function makes so that the user data for the pcb is converted to our internal structure
    pcb.OpenPcbData(pcbdata)

    // Create canvas layers. One canvas per pcb layer

    globalData.initStorage();
    cleanGutters();
    // Must be called after loading PCB as rendering required the bounding box information for PCB
    render.initRender();

    // Set up mouse event handlers
    handlers_mouse.addMouseHandlers(document.getElementById("frontcanvas"), globalData.GetAllCanvas().front);
    handlers_mouse.addMouseHandlers(document.getElementById("backcanvas"), globalData.GetAllCanvas().back);

    bom = document.getElementById("bombody");
    layerBody = document.getElementById("layerbody");
    layerHead = document.getElementById("layerhead");
    bomhead = document.getElementById("bomhead");
    globalData.setBomLayout(globalData.readStorage("bomlayout"));
    if (!globalData.getBomLayout())
    {
        globalData.setBomLayout("LR");
    }
    globalData.setCanvasLayout(globalData.readStorage("canvaslayout"));
    if (!globalData.getCanvasLayout())
    {
        globalData.setCanvasLayout("FB");
    }

    layerTable.populateLayerTable();

    populateMetadata();
    globalData.setBomCheckboxes(globalData.readStorage("bomCheckboxes"));
    if (globalData.getBomCheckboxes() === null)
    {
        globalData.setBomCheckboxes("Placed");
    }
    globalData.setRemoveBOMEntries(globalData.readStorage("removeBOMEntries"));
    if (globalData.getRemoveBOMEntries() === null)
    {
        globalData.setRemoveBOMEntries("");
    }
    globalData.setAdditionalAttributes(globalData.readStorage("additionalAttributes"));
    if (globalData.getAdditionalAttributes() === null)
    {
        globalData.setAdditionalAttributes("");
    }
    document.getElementById("bomCheckboxes").value = globalData.getBomCheckboxes();
    if (globalData.readStorage("silkscreenVisible") === "false")
    {
        document.getElementById("silkscreenCheckbox").checked = false;
        silkscreenVisible(false);
    }
    if (globalData.readStorage("redrawOnDrag") === "false")
    {
        document.getElementById("dragCheckbox").checked = false;
        globalData.setRedrawOnDrag(false);
    }
    if (globalData.readStorage("darkmode") === "true")
    {
        document.getElementById("darkmodeCheckbox").checked = true;
        setDarkMode(true);
    }
    if (globalData.readStorage("hidePlacedParts") === "true")
    {
        document.getElementById("hidePlacedParts").checked = true;
        globalData.setHidePlacedParts(true);
    }
    if (globalData.readStorage("highlightpin1") === "true")
    {
        document.getElementById("highlightpin1Checkbox").checked = true;
        globalData.setHighlightPin1(true);
        render.drawCanvas(globalData.GetAllCanvas().front);
        render.drawCanvas(globalData.GetAllCanvas().back);
    }
    // If this is true then combine parts and display quantity
    if (globalData.readStorage("combineValues") === "true")
    {
        document.getElementById("combineValues").checked = true;
        globalData.setCombineValues(true);
    }
    if (globalData.readStorage("debugMode") === "true")
    {
        document.getElementById("debugMode").checked = true;
        globalData.setDebugMode(true);
    }
    // Read the value of board rotation from local storage
    let boardRotation = globalData.readStorage("boardRotation");
    /*
      Adjusted to match how the update rotation angle is calculated.
    
        If null, then angle not in local storage, set to 180 degrees.
      */
    if (boardRotation === null)
    {
        boardRotation = 180;
    }
    else
    {
        boardRotation = parseInt(boardRotation);
    }
    // Set internal global variable for board rotation.
    globalData.SetBoardRotation(boardRotation);
    document.getElementById("boardRotation").value = (boardRotation-180) / 5;
    document.getElementById("rotationDegree").textContent = (boardRotation-180);

    // Triggers render
    changeBomLayout(globalData.getBomLayout());
    console.timeEnd("on load");
};

window.onresize = render.resizeAll;
window.matchMedia("print").addListener(render.resizeAll);

module.exports = {
    changeBomLayout, setDarkMode        , silkscreenVisible , changeCanvasLayout,
    setAdditionalAttributes
};
