"use strict";


var Point = require("./render/point.js").Point

class PCB_Trace
{
    constructor(iPCB_JSON_Trace)
    {
        this.name = iPCB_JSON_Trace.name;
    }

}

module.exports = {
    PCB_Trace
};
