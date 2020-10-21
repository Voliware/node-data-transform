const {Transform} = require('stream');
const Fs = require('fs');
const Logger = require('@voliware/logger');
const Modifier = require('./modifier');

/**
 * A transform that modifies stream data with Modifier objects.
 * @extends {Transform}
 */
class DataTransform extends Transform {

    /**
     * Constructor
     * @param {Object} [options] 
     * @param {Boolean} [options.concat=true] - If true, all chunks are concatenated
     * before processing. If false, chunks will be processed and sent down stream as
     * they arrive. 
     * @param {Modifier[]} [options.modifiers]
     */
    constructor(options = {}) {
        super(options);

        /**
         * Whehter to concat all chunks as they arrive before modifications.
         * @type {Boolean}
         */
        this.concat = (typeof options.concat !== "undefined") ? options.concat : true;

        /**
         * Final data of modified chunks
         * @type {Buffer}
         */
        this.data = Buffer.from([]);

        /**
         * Number of chunks processed
         * @type {Number}
         */
        this.chunk_count = 0;

        /**
         * Possible leftover data from last chunk process
         * @type {Buffer}
         */
        this.leftover_data = null;

        /**
         * Array of Modifier objects
         * @type {Array<Modifier>}
         */
        this.modifiers = options.modifiers || [];

        /**
         * End position of a chunk of the last match
         * @type {Number}
         */
        this.end_of_last_match = 0;

        /**
         * Logger
         * @type {Logger}
         */
        this.logger = new Logger("DATA", {level: "error"});
    }

    /**
     * Add a data modifier
     * @param {Modifier} modifier
     * @returns {DataTransform}
     */
    modify(modifier){
        this.modifiers.push(modifier);
        return this;
    }

    /**
     * Add an append data modifier.
     * Appends data after the match if found.
     * @param {Buffer|String} match - Buffer or string to match with
     * @param {Object|Object[]} contents 
     * @param {Buffer} [contents.buffer] - Buffer of data
     * @param {String} [contents.file] - Readable file path
     * @param {String} [contents.string] - String data
     * @returns {DataTransform}
     */
    append(match, contents){
        let modifier = new Modifier("append", match, contents);
        return this.modify(modifier);
    }

    /**
     * Add a compare data modifier.
     * Emits an event "compare" if match is found.
     * @param {Buffer|String} match - Buffer or string to match with
     * @returns {DataTransform}
     */
    compare(match){
        let modifier = new Modifier("compare", match);
        return this.modify(modifier);
    }

    /**
     * Add an erase data modifier.
     * Erases the matched data if found.
     * @param {Buffer|String} match - Buffer or string to match with
     * @returns {DataTransform}
     */
    erase(match){
        let modifier = new Modifier("erase", match);
        return this.modify(modifier);
    }

    /**
     * Add a prepend data modifier.
     * Prepends data before the match if found.
     * @param {Buffer|String} match - Buffer or string to match with
     * @param {Object|Object[]} contents 
     * @param {Buffer} [contents.buffer] - Buffer of data
     * @param {String} [contents.file] - Readable file path
     * @param {String} [contents.string] - String data
     * @returns {DataTransform}
     */
    prepend(match, contents){
        let modifier = new Modifier("prepend", match, contents);
        return this.modify(modifier);
    }

    /**
     * Add a replace data modifier
     * @param {Buffer|String} match - Buffer or string to match with
     * @param {Object|Object[]} contents 
     * @param {Buffer} [contents.buffer] - Buffer of data
     * @param {String} [contents.file] - Readable file path
     * @param {String} [contents.string] - String data
     * @returns {DataTransform}
     */
    replace(match, contents){
        let modifier = new Modifier("replace", match, contents);
        return this.modify(modifier);
    }

    /**
     * Splits data in a stream using delimiters
     * @param {Buffer|Object|String} match - Buffer or string to match with,
     * or a set of start/end delimeters
     * @returns {DataTransform}
     */
    split(match){
        let modifier = new Modifier("split", match);
        return this.modify(modifier);
    }

    /**
     * Append to a buffer from a file.
     * @param {Buffer} buffer 
     * @param {String} filepath 
     * @returns {Promise}
     */
    appendFromFile(buffer, filepath){
        let readable = Fs.createReadStream(filepath);
        return new Promise((resolve, reject) => {
            readable.on('data', async (chunk) => {
                let length = buffer.length + chunk.length;
                buffer = Buffer.concat([buffer, chunk], length);
            });
            readable.on('end', () => {
                resolve(buffer);
            });
            readable.on('error', (e) => {
                reject(e);
            });
        });
    }

    /**
     * Transform a chunk.
     * If concat is true, all chunks will be concatenated before they are 
     * processed. Otherwise, chunks are processed as they are received.
     * @param {Buffer|String|Any} chunk 
     * @param {String} encoding 
     * @param {Function} callback 
     * @async
     */
    async _transform(chunk, encoding, callback){
        // New chunk of data
        this.chunk_count++;
        this.logger.debug(`Read chunk ${this.chunk_count} with length ${chunk.length}`);
        this.logger.verbose("Printing original chunk:\n" + chunk.toString());

        if(this.concat){
            let length = this.data.length + chunk.length;
            this.data = Buffer.concat([this.data, chunk], length);
            callback();
        }
        else {
            // If there was leftover data, prepend it to this chunk
            if(this.leftover_data){
                this.logger.debug(`Prepended leftover data`);
                let length = this.leftover_data.length + chunk.length;
                chunk = Buffer.concat([this.leftover_data, chunk], length);
                this.leftover_data = null;
            }
            chunk = await this.processChunk(chunk);
            this.logger.verbose("Printing modified chunk:\n" + chunk.toString());
            this.last_chunk = chunk;
            callback(null, chunk);
        }
    }

    /**
     * Flush data.
     * Called when read stream ends.
     * If concat is true, this is where the processing occurs.
     * @param {Function} callback 
     */
    async _flush(callback){
        if(this.concat){
            this.data = await this.processChunk(this.data);
            this.logger.verbose("Printing modified chunk:\n" + this.data.toString());
            callback(null, this.data);
        }
        else {
            callback();
        }
    }

    /**
     * Modify a chunk with a modifier.
     * Async as it may read from a file stream.
     * @param {Buffer|String|Any} chunk 
     * @param {Object} modifier 
     * @param {Object|Object[]} modifier.contents 
     * @param {Buffer} [modifier.contents.buffer] - Buffer of data
     * @param {String} [modifier.contents.file] - Readable file path
     * @param {String} [modifier.contents.string] - String data
     * @async
     * @returns {Buffer|String|Any} Modified chunk 
     */
    async modifyChunk(chunk, modifier){
        // No modification
        if(typeof modifier.contents === "undefined" || modifier.contents === null) {
            return chunk;
        }

        // Convert to an array of contents if not already
        if(!Array.isArray(modifier.contents)){
            modifier.contents = [modifier.contents];
        }

        for(let i = 0; i < modifier.contents.length; i++){
            let content = modifier.contents[i];
            // String modification
            if(typeof content.string === "string"){
                let buffer = Buffer.from(content.string);
                let length = chunk.length + buffer.length;
                chunk = Buffer.concat([chunk, buffer], length);
            }
            // Buffer modification
            else if (typeof content.buffer === "Buffer"){
                let length = chunk.length + content.buffer.length;
                chunk = Buffer.concat([chunk, content.buffer], length);
            }
            // File modification
            else if(typeof content.file === "string"){
                try {
                    Fs.accessSync(content.file);
                    chunk = await this.appendFromFile(chunk, content.file);
                }
                catch (error) {
                    this.logger.error("Modifying chunk failed");
                    this.logger.error(error);
                }
            }
        }
        return chunk;
    }

    /**
     * Process a chunk.
     * @param {Buffer|String|Any} chunk 
     * @async
     * @returns {Buffer|String|Any} Chunk 
     */
    async processChunk(chunk){
        if(!this.modifiers.length){
            return chunk;
        }

        let new_chunk = Buffer.from([]);
        this.end_of_last_match = 0;
        this.logger.debug("Processing chunk");
        // Loop through every value in the chunk
        for(let i = 0; i < chunk.length; i++){
            let chunk_remaining = chunk.length - 1 - i;
            // Loop through every modifier to test if the current
            // chunk value is the start of a modifier.match
            for(let k = 0; k < this.modifiers.length; k++){
                const modifier = this.modifiers[k];
                // See how far we are able to look ahead when testing this match
                // If the length of the match is longer than the number of 
                // values left in the chunk, than only look as far as the end 
                // of the chunk
                let seek_length = modifier.match.length > chunk_remaining 
                    ? (chunk_remaining + 1) 
                    : modifier.match.length;
                let found = true;
                let x = 0;
                // Loop through the match from start and from the chunk from i
                for(x; x < seek_length; x++){
                    if(modifier.match[x] !== chunk[i + x]){
                        if(x > 0){
                            this.logger.debug(`Matched ${x}/${seek_length} with [${modifier.match.toString()}]`);
                        }
                        found = false;
                        break;
                    }
                }
                // The match failed completely, just move on
                if(!found){
                    continue;
                }
                // Full match found
                if(x === modifier.match.length){
                    this.logger.info(`Found match [${modifier.match.toString()}]`)

                    // If in compare mode, emit found and move on to the next modifier 
                    if(modifier.action === "compare"){
                        this.emit('compare', {modifier, index: i});
                        continue;
                    }

                    // Copy from the original chunk start->end
                    // start: the position in the chunk at the end of the last
                    //        found match, or 0
                    //  end:  the beginning of this found match (i)
                    let start = this.end_of_last_match;
                    let end = i;

                    // The modifier action will affect the end of the slice
                    // append: move to the end of the match
                    if(modifier.action === "append"){
                        end += modifier.match.length;
                    }
                    let slice = chunk.slice(start, end);
                    let length = new_chunk.length + slice.length;
                    new_chunk = Buffer.concat([new_chunk, slice], length);
                    this.logger.debug(`Appended from chunk ${start}->${end}`);

                    // Write the modifier data
                    new_chunk = await this.modifyChunk(new_chunk, modifier);

                    // If in prepend, write the match as well
                    if(modifier.action === "prepend"){
                        let slice = Buffer.from(modifier.match);
                        let length = new_chunk.length + slice.length;
                        new_chunk = Buffer.concat([new_chunk, slice], length);
                    }

                    // Save the index at the end of the found match
                    this.end_of_last_match = i + modifier.match.length;

                    // Push i passed the end of this match, otherwise we'll
                    // just read most of it again
                    i = this.end_of_last_match - 1;
                }
                // Partial match found at end of the chunk.
                // We couldnt search through the whole match because there
                // wasnt enough data left
                else if(chunk_remaining < modifier.match.length){
                    this.logger.debug(`Unfinished match at EOF ${x}/${seek_length}`);
                    // Save this data 
                    // We'll prepend it to the next chunk should one arrive
                    this.leftover_data = chunk.slice(i, chunk.length);
                    
                    // Copy data from the end of the last found match to the
                    // previous character
                    let slice = chunk.slice(this.end_of_last_match, i);
                    let length = new_chunk.length + slice.length;
                    new_chunk = Buffer.concat([new_chunk, slice], length);
                    this.logger.debug(`Appended from chunk ${this.end_of_last_match}->${i}`);
                    break;
                }
            }

            // If there may be a match lurking at the end of this 
            if(this.leftover_data){
                break;
            }
        
            // If at the end of the chunk, 
            if(!chunk_remaining){
                let slice = chunk.slice(this.end_of_last_match, chunk.length);
                let length = new_chunk.length + slice.length;
                new_chunk = Buffer.concat([new_chunk, slice], length);
                this.logger.debug(`Appended from chunk ${this.end_of_last_match}->${i}`);
            }
        }

        return new_chunk;
    }
}

module.exports = DataTransform;