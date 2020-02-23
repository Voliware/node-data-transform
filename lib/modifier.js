/**
 * An object defining how to modify a set of data.
 * @example
 * // replace all "<div>"s with "<span>"
 * let modifier_a = new Modifier("replace", "<div>", {string: "<span>"};
 * // append [0xff] after every [0xaa]
 * let modifier_b = new Modifier("append", Buffer.from([0xaa]), {buffer: Buffer.from([0xff])});
 */
class Modifier {

    /**
     * Constructor
     * @param {String} action - the modifier action
     * @param {Buffer|String} match - what to find in some data
     * @param {Object} contents - data to modify the chunk with - buffer, file, or string
     * @param {Buffer} [contents.buffer] - a buffer to modify the data with
     * @param {String} [contents.file] - a string to modify the data with
     * @param {String} [contents.string] - a file path to modify the data with
     */
    constructor(action, match, contents){
        this.action = action || "";
        this.match = match || "";
        this.contents = contents || {};
        return this;
    }
}

module.exports = Modifier;