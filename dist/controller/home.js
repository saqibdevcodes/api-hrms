"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const home = (req, res) => {
    let name = 'Saqib Javaid';
    let age = 22;
    res.json({ name, age });
};
exports.default = home;
