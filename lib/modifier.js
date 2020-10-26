const { dir } = require('console');
const Fs = require('fs');
const Path = require('path');

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
     * Constructor.
     * Will read a directory recursively and synchronously if the
     * contents.directory parameter is passed as a valid directory string. 
     * @param {String} action - The modifier action
     * @param {Buffer|String} match - What to find in some data
     * @param {Object|Object[]} contents 
     * @param {Buffer} [contents.buffer] - Buffer of data
     * @param {String} [contents.directory] - Readable file directory
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

        // Convert contents to array
        if(contents){
            if(!Array.isArray(contents)){
                contents = [contents];
            }
        }
        else {
            contents = [];
        }

        // Special check if contents is a directory
        if(contents.length){
            for(let i = 0; i < contents.length; i++){
                let directory = contents[i].directory;
                if(typeof directory === "string" && directory.length){
                    this.directoryToFiles(directory, contents);
                }
            }
        }

        /**
         * Contents to replace/append/prepend with matched string.
         * @type {Null|Object[]}
         */
        this.contents = contents 
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

    /**
     * Convert a directory into an array of file name objects.
     * This is a helper function for processing the constructor arguments.
     * @param {String} directory 
     * @param {Object[]} files
     */
    directoryToFiles(directory, files){
        const dir = Fs.opendirSync(directory);
        let dirent = null;
        while ((dirent = dir.readSync()) !== null) {
            if(dirent.isDirectory()){
                Path.join(directory, dirent.name);
                this.directoryToFiles(directory, files);
            }
            else if(dirent.isFile()){
                files.push({file: Path.join(directory, dirent.name)});
            }
        }
        dir.closeSync()
    }
}

module.exports = Modifier;