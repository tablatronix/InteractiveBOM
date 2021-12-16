"use strict";

/*
    Create a class to hold project metadata. 

    Class is defined as a singleton as there should only ever be one instance 
    of this class active at a time.

    By default at construction, all values are unknown, user must call Set() in 
    order to set metadata for the project.
*/
class Metadata
{
    constructor()
    {
        if (!Metadata.instance)
        {
            Metadata.instance = this;
            this.protocolVersion = 0;
            this.ecad            = "Unknown"
            this.company         = "Unknown"
            this.project_name    = "Unknown"
            this.revision        = "Unknown"
            this.date            = "Unknown"
            this.numTopParts     = 0;
            this.numTBottomParts = 0;
        }
        return Metadata.instance;
    }

    static GetInstance()
    {
        return this.instance;
    }

    Set(iPCB_JSON_Metadata)
    {
        this.protocolVersion = iPCB_JSON_Metadata.protocol_version;
        this.ecad            = iPCB_JSON_Metadata.ecad;
        this.company         = iPCB_JSON_Metadata.company;
        this.project_name    = iPCB_JSON_Metadata.project_name;
        this.revision        = iPCB_JSON_Metadata.revision;
        this.date            = iPCB_JSON_Metadata.date;
        this.numTopParts     = iPCB_JSON_Metadata.number_parts.top;
        this.numTBottomParts = iPCB_JSON_Metadata.number_parts.bottom;
    }
}

/*
    Create a new instance of MEtadata class. This will be the single
    instance that will be used throughout the program. Note that const is 
    used since the instance reference will never change BUT the internal
    data may change.
*/
const instance_Metadata = new Metadata();


module.exports = {
    Metadata
};
