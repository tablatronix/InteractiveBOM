
/*
    Create a checkbox entry for layer table. 

    When checked (visible) an eye icon will be used
    and when unselected (not visible) an eye icon will 
    slash will be used.
*/
function CreateCheckbox_Visible(layer_index)
{
    let newlabelF   = document.createElement("Label");
    let td          = document.createElement("TD");
    let input_front = document.createElement("input");
    
    input_front.type = "checkbox";
    newlabelF.classList.add("check_box_bom")

    // Assumes that all layers are visible by default.
    if (    (globalData.readStorage( "checkbox_layer_front_" + String(layer_index) + "_visible" ) == "true")
         || (globalData.readStorage( "checkbox_layer_front_" + String(layer_index) + "_visible" ) == null)
    )
    {
        input_front.checked = true;
    }
    else
    {
        input_front.checked = false;
    }

    input_front.onchange = function(){console.log("HERE")}//createLayerCheckboxChangeHandler(layer, true);

    var spanF = document.createElement("Span");
    spanF.classList.add("checkmark")

    newlabelF.appendChild(input_front);
    newlabelF.appendChild(spanF);

    return td.appendChild(newlabelF);
}