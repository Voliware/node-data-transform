/**
 * An object defining how to modify a set of data.
 * @example
 * // replace all "<div>"s with "<span>"
 * let modifier_a = new Modifier("replace", "<div>", {string: "<span>"};
 * // append [0xff] after every [0xaa]
 * let modifier_b = new Modifier("append", Buffer.from([0xaa]), {buffer: Buffer.from([0xff])});
 * // append contents of "filepath" after every "<!--template-->"
 * let modifier_c = new Modifier("append", "<!--template-->", {file: filepath});
 */
class Modifier {

    /**
     * Constructor
     * @param {String} action - The modifier action
     * @param {Buffer|String} match - What to find in some data
     * @param {Object|Object[]} contents 
     * @param {Buffer} [contents.buffer] - Buffer of data
     * @param {String} [contents.file] - Readable file path
     * @param {String} [contents.string] - String data
     */
    constructor(action, match, contents){

        /**
         * Action to perform.
         * Supports "append", "prepend", "replace", "erase", "compare"
         * @type {String}
         */
        this.action = action || "";

        /**
         * String converted to look for, converted to char code array
         * @type {Number[]}
         */
        this.match = match || "";
        // Convert numbers to strings
        if(typeof this.match === "number"){
            this.match = `${this.match}`;
        }
        // Convert strings to buffers
        if(typeof this.match === "string"){
            this.match = this.getStringAsCharChode(this.match);
        }

        /**
         * Contents to replace/append/prepend with matched string.
         * @type {Null|Object[]}
         */
        this.contents = contents 
            ? Array.isArray(contents) ? contents : [contents]
            : null;
    }

    /**
     * Convert a string to an array of char codes.
     * IE would turn "buffer" into [98, 117, 102, 102, 101, 114]
     * @param {String} str 
     * @returns {Number[]}
     */
    getStringAsCharChode(str){
        return str.split('').map((c) => {
            return c.charCodeAt(0); 
        });
    }
}

module.exports = Modifier;