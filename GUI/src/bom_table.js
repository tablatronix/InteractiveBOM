var globalData = require("./global.js");
var pcb        = require("./pcb.js");
var render     = require("./render.js");

//TODO:  GLOBAL VARIABLE REFACTOR
let filterBOM = "";
function getFilterBOM() 
{
    return filterBOM;
}

function setFilterBOM(input) 
{
    filterBOM = input.toLowerCase();
    populateBomTable();
}
function createCheckboxChangeHandler(checkbox, bomentry)
{
    return function() 
    {
        if(bomentry.checkboxes.get(checkbox))
        {
            bomentry.checkboxes.set(checkbox,false);
            globalData.writeStorage("checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference, "false");
        }
        else
        {
            bomentry.checkboxes.set(checkbox,true);
            globalData.writeStorage("checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference, "true");
        }
        // Save currently highlited row
        let rowid = globalData.getCurrentHighlightedRowId();
        // Redraw the canvas
        render.drawCanvas(globalData.GetAllCanvas().front);
        render.drawCanvas(globalData.GetAllCanvas().back);
        // Redraw the BOM table
        populateBomTable();
        // Render current row so its highlighted
        document.getElementById(rowid).classList.add("highlighted");
        // Set current selected row global variable
        globalData.setCurrentHighlightedRowId(rowid);
        // If highlighted then a special color will be used for the part.
        render.drawHighlights(IsCheckboxClicked(globalData.getCurrentHighlightedRowId(), "placed"));
    };
}
function IsCheckboxClicked(bomrowid, checkboxname) 
{
    let checkboxnum = 0;
    while (checkboxnum < globalData.getCheckboxes().length && globalData.getCheckboxes()[checkboxnum].toLowerCase() != checkboxname.toLowerCase()) 
    {
        checkboxnum++;
    }
    if (!bomrowid || checkboxnum >= globalData.getCheckboxes().length) 
    {
        return;
    }
    let bomrow = document.getElementById(bomrowid);
    let checkbox = bomrow.childNodes[checkboxnum + 1].childNodes[0];
    return checkbox.checked;
}

function GenerateBOMTable()
{
    // Get bom table with elements for the side of board the user has selected
    let bomtableTemp = GetBOMForSideOfBoard(globalData.getCanvasLayout());

    // Apply attribute filter to board
    bomtableTemp = pcb.filterBOMTable(bomtableTemp, filterBOM_ByAttribute);

    // If the parts are displayed one per line (not combined values), then the the bom table needs to be flattened. 
    // By default the data in the json file is combined
    bomtable = globalData.getCombineValues() ? pcb.GetBOMCombinedValues(bomtableTemp) : bomtableTemp;

    return bomtable;
}

function clearBOMTable()
{
    bom = document.getElementById("bombody");

    while (bom.firstChild)
    {
        bom.removeChild(bom.firstChild);
    }
}

function populateBomBody()
{
    bom = document.getElementById("bombody");

    while (bom.firstChild)
    {
        bom.removeChild(bom.firstChild);
    }

    globalData.setHighlightHandlers([]);
    globalData.setCurrentHighlightedRowId(null);
    let first = true;

    bomtable = GenerateBOMTable();

    if (globalData.getBomSortFunction())
    {
        bomtable = bomtable.slice().sort(globalData.getBomSortFunction());
    }
    for (let i in bomtable)
    {
        let bomentry = bomtable[i];
        let references = bomentry.reference;

        // remove entries that do not match filter
        if (getFilterBOM() != "")
        {
            if(!entryMatches(bomentry))
            {
                continue;
            }
        }

        // Hide placed parts option is set
        if(globalData.getHidePlacedParts())
        {
            // Remove entries that have been placed. Check the placed parameter
            if(globalData.readStorage( "checkbox" + "_" + "placed" + "_" + bomentry.reference ) == "true")
            {
                continue;
            }
        }

        let tr = document.createElement("TR");
        let td = document.createElement("TD");
        let rownum = +i + 1;
        tr.id = "bomrow" + rownum;
        td.textContent = rownum;
        tr.appendChild(td);

        // Checkboxes
        let additionalCheckboxes = globalData.getBomCheckboxes().split(",");
        for (let checkbox of additionalCheckboxes) 
        {
            checkbox = checkbox.trim();
            if (checkbox) 
            {
                td = document.createElement("TD");
                let input = document.createElement("input");
                input.type = "checkbox";
                input.onchange = createCheckboxChangeHandler(checkbox, bomentry);
                // read the value in from local storage

                if(globalData.readStorage( "checkbox" + "_" + checkbox.toLowerCase() + "_" + bomentry.reference ) == "true")
                {
                    bomentry.checkboxes.set(checkbox,true)
                }
                else
                {
                    bomentry.checkboxes.set(checkbox,false)
                }

                if(bomentry.checkboxes.get(checkbox))
                {
                    input.checked = true;
                }
                else
                {
                    input.checked = false;
                }

                td.appendChild(input);
                tr.appendChild(td);
            }
        }



        //INFO: The lines below add the control the columns on the bom table
        // References
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(references);
        tr.appendChild(td);
        // Value
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(bomentry.value);
        tr.appendChild(td);
        // Footprint
        td = document.createElement("TD");
        td.innerHTML = highlightFilter(bomentry.package);
        tr.appendChild(td);
        
        // Attributes
        let additionalAttributes = globalData.getAdditionalAttributes().split(",");
        for (let x of additionalAttributes)
        {
            x = x.trim()
            if (x)
            {
                td = document.createElement("TD");
                td.innerHTML = highlightFilter(pcb.getAttributeValue(bomentry, x.toLowerCase()));
                tr.appendChild(td);
            }
        }

        if(globalData.getCombineValues())
        {
            td = document.createElement("TD");
            td.textContent = bomentry.quantity;
            tr.appendChild(td);
        }
        bom.appendChild(tr);


        bom.appendChild(tr);
        let handler = createRowHighlightHandler(tr.id, references);
        tr.onmousemove = handler;
        globalData.pushHighlightHandlers({
            id: tr.id,
            handler: handler,
            refs: references
        });

        if (getFilterBOM() && first)
        {
            handler();
            first = false;
        }
    }
}

function createRowHighlightHandler(rowid, refs)
{
    return function()
    {
        if (globalData.getCurrentHighlightedRowId())
        {
            if (globalData.getCurrentHighlightedRowId() == rowid)
            {
                return;
            }
            document.getElementById(globalData.getCurrentHighlightedRowId()).classList.remove("highlighted");
        }

        document.getElementById(rowid).classList.add("highlighted");
        globalData.setCurrentHighlightedRowId(rowid);
        globalData.setHighlightedRefs(refs);
        // If highlighted then a special color will be used for the part.
        render.drawHighlights(IsCheckboxClicked(globalData.getCurrentHighlightedRowId(), "placed"));
    }
}

function setBomCheckboxes(value)
{
    globalData.setBomCheckboxes(value);
    globalData.writeStorage("bomCheckboxes", value);
    populateBomTable();
}

function setRemoveBOMEntries(value)
{
    globalData.setRemoveBOMEntries(value);
    globalData.writeStorage("removeBOMEntries", value);
    populateBomTable();
}

function populateBomTable()
{
    populateBomHeader();
    populateBomBody();
}

function highlightFilter(s)
{
    if (!getFilterBOM()) 
    {
        return s;
    }
    let parts = s.toLowerCase().split(getFilterBOM());
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
            r += "<mark class=\"highlight\">" + s.substring(pos, pos + getFilterBOM().length) + "</mark>";
            pos += getFilterBOM().length;
        }
        r += s.substring(pos, pos + parts[i].length);
        pos += parts[i].length;
    }
    return r;
}

function populateBomHeader() 
{
    while (bomhead.firstChild)
    {
        bomhead.removeChild(bomhead.firstChild);
    }
    
    let tr = document.createElement("TR");
    let th = document.createElement("TH");
    th.classList.add("numCol");
    tr.appendChild(th);


    let additionalCheckboxes = globalData.getBomCheckboxes().split(",");
    additionalCheckboxes     = additionalCheckboxes.filter(function(e){return e});
    globalData.setCheckboxes(additionalCheckboxes);
    for (let x2 of additionalCheckboxes)
    {
        // remove beginning and trailing whitespace
        x2 = x2.trim()
        if (x2) 
        {
            tr.appendChild(createColumnHeader(x2, "Checkboxes", CheckboxCompare(x2)));
        }
    }

    tr.appendChild(createColumnHeader("References", "References", (partA, partB) => {
        if (partA.reference != partB.reference)
        {
            return partA.reference > partB.reference ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    tr.appendChild(createColumnHeader("Value", "Value", (partA, partB) => {
        if (partA.value != partB.value)
        {
            return partA.value > partB.value ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    tr.appendChild(createColumnHeader("Footprint", "Footprint", (partA, partB) => {
        if (partA.package != partB.package)
        {
            return partA.package > partB.package ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }));

    let additionalAttributes = globalData.getAdditionalAttributes().split(",");
    // Remove null, "", undefined, and 0 values
    additionalAttributes    =additionalAttributes.filter(function(e){return e});
    for (let x of additionalAttributes)
    {
        // remove beginning and trailing whitespace
        x = x.trim()
        if (x) 
        {
            tr.appendChild(createColumnHeader(x, "Attributes", AttributeCompare(x)));
        }
    }

    if(globalData.getCombineValues())
    {
            //XXX: This comparison function is using positive and negative implicit
            tr.appendChild(createColumnHeader("Quantity", "Quantity", (partA, partB) => {
            return partA.quantity - partB.quantity;
            }));
    }

    bomhead.appendChild(tr);

}

function createColumnHeader(name, cls, comparator)
{
    let th = document.createElement("TH");
    th.innerHTML = name;
    th.classList.add(cls);
    th.style.cursor = "pointer";
    let span = document.createElement("SPAN");
    span.classList.add("sortmark");
    span.classList.add("none");
    th.appendChild(span);
    th.onclick = function()
    {
        if (globalData.getCurrentSortColumn() && this !== globalData.getCurrentSortColumn()) 
        {
            // Currently sorted by another column
            globalData.getCurrentSortColumn().childNodes[1].classList.remove(globalData.getCurrentSortOrder());
            globalData.getCurrentSortColumn().childNodes[1].classList.add("none");
            globalData.setCurrentSortColumn(null);
            globalData.setCurrentSortOrder(null);
        }

        if (globalData.getCurrentSortColumn() && this === globalData.getCurrentSortColumn()) 
        {
            // Already sorted by this column
            if (globalData.getCurrentSortOrder() == "asc") 
            {
                // Sort by this column, descending order
                globalData.setBomSortFunction(function(a, b) 
                {
                    return -comparator(a, b);
                });
                globalData.getCurrentSortColumn().childNodes[1].classList.remove("asc");
                globalData.getCurrentSortColumn().childNodes[1].classList.add("desc");
                globalData.setCurrentSortOrder("desc");
            } 
            else 
            {
                // Unsort
                globalData.setBomSortFunction(null);
                globalData.getCurrentSortColumn().childNodes[1].classList.remove("desc");
                globalData.getCurrentSortColumn().childNodes[1].classList.add("none");
                globalData.setCurrentSortColumn(null);
                globalData.setCurrentSortOrder(null);
            }
        }
        else
        {
            // Sort by this column, ascending order
            globalData.setBomSortFunction(comparator);
            globalData.setCurrentSortColumn(this);
            globalData.getCurrentSortColumn().childNodes[1].classList.remove("none");
            globalData.getCurrentSortColumn().childNodes[1].classList.add("asc");
            globalData.setCurrentSortOrder("asc");
        }
        bomTable.populateBomBody();
    }
    return th;
}

// Describes how to sort checkboxes
function CheckboxCompare(stringName)
{
    return (partA, partB) => {
        if (partA.checkboxes.get(stringName) && !partB.checkboxes.get(stringName)) 
        {
            return  1;
        }
        else if (!partA.checkboxes.get(stringName) && partB.checkboxes.get(stringName)) 
        {
            return -1;
        } 
        else
        {
            return 0;
        }
    }
}

// Describes hoe to sort by attributes
function AttributeCompare(stringName)
{
    return (partA, partB) => {
        if (partA.attributes.get(stringName) != partB.attributes.get(stringName))
        {
            return  partA.attributes.get(stringName) > partB.attributes.get(stringName) ? 1 : -1;
        }
        else
        {
            return 0;
        }
    }
}


////////////////////////////////////////////////////////////////////////////////
// Filter functions are defined here. These let the application filter 
// elements out of the complete bom. 
//
// The filtering function should return true if the part should be filtered out
// otherwise it returns false
////////////////////////////////////////////////////////////////////////////////
function GetBOMForSideOfBoard(location)
{
    let result = pcb.GetBOM();
    switch (location)
    {
    case "F":
        result = pcb.filterBOMTable(result, filterBOM_Front);
        break;
    case "B":
        result = pcb.filterBOMTable(result, filterBOM_Back);
        break;
    default:
        break;
    }
    return result;
}

function filterBOM_Front(part)
{
    let result = true;
    if(part.location == "F")
    {
        result = false;
    }
    return result;
}

function filterBOM_Back(part)
{
    let result = true;
    if(part.location == "B")
    {
        result = false;
    }
    return result;
}

function filterBOM_ByAttribute(part)
{
    let result = false;
    let splitFilterString = globalData.getRemoveBOMEntries().split(",");
    // Remove null, "", undefined, and 0 values
    splitFilterString    = splitFilterString.filter(function(e){return e});

    if(splitFilterString.length > 0 )
    {
        for(let i of splitFilterString)
        {
            // removing beginning and trailing whitespace
            i = i.trim()
            if(part.attributes.has(i))
            {
                // Id the value is an empty string then dont filter out the entry. 
                // if the value is anything then filter out the bom entry
                if(part.attributes.get(i) != "")
                {
                    result = true;
                }
            }
        }
    }
    return result;
}


module.exports = {
    setBomCheckboxes, populateBomTable, setFilterBOM, getFilterBOM,
    setRemoveBOMEntries, clearBOMTable
};
