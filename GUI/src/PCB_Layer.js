"use strict";


class PCB_Layer
{
    constructor(iPCB_JSON_Layer)
    {
        this.name        = iPCB_JSON_Layer.name;
        this.layerNumber = iPCB_JSON_Layer.layerNumber;
    }
}

module.exports = {
    PCB_Layer
};
