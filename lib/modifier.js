const Fs = require('fs');
const Path = require('path');
const Glob = require('glob');
const { dir } = require('console');

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
     * @param {String} [contents.directory] - Readable file directory. Supports
     * regex based search such as /path/to/files/*.js, /path/to/files/*.*, etc
     * @param {Boolean} [contents.directory_options] - Option to path when 
     * using the directroy string. These are the options for the glob module.
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
        // No contents supplied
        else {
            contents = [];
        }

        /**
         * Options for the glob module for directory searching
         * @type {Boolean}
         */
        this.directory_options = contents.directory_options || {};

        // If "directory" option was passed, convert to file paths
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
         * @type {Object[]}
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
        // If the directory was passed as a directory path, such as 
        // path/to/files or path/to/files/, add a final slash if 
        // necessary and a *.*. IE /path/to/files/*.*
        try {
            const dir = Fs.opendirSync(directory);
            if(directory[directory.length - 1] !== "/"){
                directory += "/";
            }
            directory += "*.*";
            dir.closeSync()
        }
        catch(error){
            // Not a dir
        }

        Glob(directory, this.directory_options, (error, result) => {
            if(error){
                console.error(error);
                return;
            }
            for(let i = 0; i < result.length; i++){
                files.push({file: result[i]});
            }
          });
    }
}

module.exports = Modifier;