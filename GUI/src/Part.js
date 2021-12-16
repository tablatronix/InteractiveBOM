"use strict";

class Part {
    constructor(value, footprint, reference, location, attributes, checkboxes)
    {
        this.quantity   = 1;
        this.value      = value;
        this.foorptint  = footprint;
        this.reference  = reference;
        this.location   = location;
        this.attributes = attributes;
        this.checkboxes = checkboxes;
    }

    CopyPart()
    {
        // XXX: This is not performing a deep copy, attributes is a map and this is being copied by 
        //      reference which is not quite what we want here. It should be a deep copy so once called
        //      this will result in a completely new object that will not reference one another
        return new Part(this.value, this.package, this.reference, this.location, this.attributes, this.checkboxes);
    }
}

module.exports = {
    Part
};
