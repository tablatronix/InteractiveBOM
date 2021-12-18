"use strict";

class PCB_Board
{
    constructor()
    {
        if (!PCB_Board.instance)
        {
            PCB_Board.instance = this;
        }
        return PCB_Board.instance;
    }

    static GetInstance()
    {
        return this.instance;
    }
}

const instance_PCB_Board = new PCB_Board();

module.exports = {
    PCB_Board
};
