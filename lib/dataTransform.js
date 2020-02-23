const {Transform} = require('stream');
const Fs = require('fs');
const Logger = require('@voliware/logger');
const Modifier = require('./modifier');

/**
 * Data Transform.
 * A transform that modifies the stream data.
 * @extends {Transform}
 */
class DataTransform extends Transform {

    /**
     * Constructor
     * @param {Object} [options] 
     * @param {Boolean} [options.concat=true] - if true, all chunks are concatenated
     * before processing. If false, chunks will be processed and sent down stream as
     * they arrive. 
     * @param {Modifier[]} [options.modifiers]
     * @returns {DataTransform}
     */
    constructor(options = {}) {
        super(options);
        this.concat = (typeof options.concat !== "undefined") ? options.concat : true;
        this.data = Buffer.from([]);
        this.chunk_count = 0;
        this.leftover_data = null;
        this.modifiers = options.modifiers || [];
        this.end_of_last_match = 0;
        this.logger = new Logger("DATA", {level: "error"});
        return this;
    }

    /**
     * Add a data modifier
     * @param {Modifier} modifier
     * @returns {DataTransform}
     */
    modify(modifier){
        // convert numbers to strings
        if(typeof modifier.match === "number"){
            modifier.match = `${match}`;
        }
        // convert strings to buffers
        if(typeof modifier.match === "string"){
            modifier.match = this.getStringAsCharChode(modifier.match);
        }
        this.modifiers.push(modifier);
        return this;
    }

    /**
     * Add an append data modifier.
     * Appends data after the match if found.
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Object} contents 
     * @param {Buffer} [contents.buffer] - a buffer of data
     * @param {String} [contents.file] - a readable file path
     * @param {String} [contents.string] - string data
     * @returns {DataTransform}
     */
    append(match, contents){
        let modifier = new Modifier("append", match, contents);
        return this.modify(modifier);
    }

    /**
     * Add a compare data modifier.
     * Emits an event "compare" if match is found.
     * @param {Buffer|String} match - a buffer or string to match with
     * @returns {DataTransform}
     */
    compare(match){
        let modifier = new Modifier("compare", match);
        return this.modify(modifier);
    }

    /**
     * Add an erase data modifier.
     * Erases the matched data if found.
     * @param {Buffer|String} match - a buffer or string to match with
     * @returns {DataTransform}
     */
    erase(match){
        let modifier = new Modifier("erase", match);
        return this.modify(modifier);
    }

    /**
     * Add a prepend data modifier.
     * Prepends data before the match if found.
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Object} contents 
     * @param {Buffer} [contents.buffer] - a buffer of data
     * @param {String} [contents.file] - a readable file path
     * @param {String} [contents.string] - string data
     * @returns {DataTransform}
     */
    prepend(match, contents){
        let modifier = new Modifier("prepend", match, contents);
        return this.modify(modifier);
    }

    /**
     * Add a replace data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Object} contents 
     * @param {Buffer} [contents.buffer] - a buffer of data
     * @param {String} [contents.file] - a readable file path
     * @param {String} [contents.string] - string data
     * @returns {DataTransform}
     */
    replace(match, contents){
        let modifier = new Modifier("replace", match, contents);
        return this.modify(modifier);
    }

    /**
     * Splits data in a stream using delimiters
     * @param {Buffer|Object|String} match - a buffer or string to match with,
     *                                       or a set of start/end delimeters
     * @returns {DataTransform}
     */
    split(match){
        let modifier = new Modifier("split", match);
        return this.modify(modifier);
    }

    /**
     * Convert a string to an array of char codes.
     * IE would turn "buffer" into [98, 117, 102, 102, 101, 114]
     * @param {String} str 
     */
    getStringAsCharChode(str){
        return str.split('').map((c) => {
            return c.charCodeAt(0); 
        });
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
     * If concat is true, all chunks will be concatenated
     * before they are processed. Otherwise, chunks are 
     * processed as they are received.
     * @param {Buffer|String|Any} chunk 
     * @param {String} encoding 
     * @param {Function} callback 
     * @async
     */
    async _transform(chunk, encoding, callback){
        // new chunk of data
        this.chunk_count++;
        this.logger.debug(`read chunk ${this.chunk_count} with length ${chunk.length}`);
        this.logger.debug("printing original chunk:\n" + chunk.toString());

        if(this.concat){
            let length = this.data.length + chunk.length;
            this.data = Buffer.concat([this.data, chunk], length);
            callback();
        }
        else {
            // if there was leftover data, prepend it to this chunk
            if(this.leftover_data){
                this.logger.debug(`prepended leftover data`);
                let length = this.leftover_data.length + chunk.length;
                chunk = Buffer.concat([this.leftover_data, chunk], length);
                this.leftover_data = null;
            }
            chunk = await this.processChunk(chunk);
            this.logger.debug("printing modified chunk:\n" + chunk.toString());
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
            this.logger.debug("printing modified chunk:\n" + this.data.toString());
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
     * @param {Object} [modifier.contents]
     * @param {Buffer} [modifier.contents.buffer]
     * @param {String} [modifier.contents.string]
     * @param {String} [modifier.contents.file]
     * @async
     * @returns {Buffer|String|Any} modified chunk 
     */
    async modifyChunk(chunk, modifier){
        // no modification
        if(typeof modifier.contents === "undefined" || modifier.contents === null || !Object.keys(modifier.contents).length){
            return chunk;
        }
        // string modification
        else if(typeof modifier.contents.string === "string"){
            let buffer = Buffer.from(modifier.contents.string);
            let length = chunk.length + buffer.length;
            return Buffer.concat([chunk, buffer], length);
        }
        // buffer modification
        else if (typeof modifier.contents.buffer === "Buffer"){
            let length = chunk.length + modifier.contents.buffer.length;
            return Buffer.concat([chunk, modifier.contents.buffer], length);
        }
        // file modification
        else if(typeof modifier.contents.file === "string"){
            try {
                Fs.accessSync(modifier.contents.file);
                return this.appendFromFile(chunk, modifier.contents.file);
            }
            catch (error) {
                this.logger.error("Modifying chunk failed - cannot open file");
            }
        }
    }

    /**
     * Process a chunk.
     * @param {Buffer|String|Any} chunk 
     * @async
     * @returns {Buffer|String|Any} chunk 
     */
    async processChunk(chunk){
        if(!this.modifiers.length){
            return chunk;
        }

        let new_chunk = Buffer.from([]);
        this.end_of_last_match = 0;
        this.logger.debug("processing chunk");
        // loop through every value in the chunk
        for(let i = 0; i < chunk.length; i++){
            let chunk_remaining = chunk.length - 1 - i;
            // loop through every modifier to test if the current
            // chunk value is the start of a modifier.match
            for(let k = 0; k < this.modifiers.length; k++){
                let modifier = this.modifiers[k];
                // see how far we are able to look ahead
                // when testing this match
                // if the length of the match is longer than 
                // the number of values left in the chunk,
                // than only look as far as the end of the chunk
                let seek_length = modifier.match.length > chunk_remaining 
                    ? (chunk_remaining + 1) 
                    : modifier.match.length;
                let found = true;
                let x = 0;
                // loop through the match from start 
                // and from the chunk from i
                for(x; x < seek_length; x++){
                    if(modifier.match[x] !== chunk[i + x]){
                        if(x > 0){
                            this.logger.debug(`matched ${x}/${seek_length} with [${modifier.match.toString()}]`);
                        }
                        found = false;
                        break;
                    }
                }
                // the match failed completely, just move on
                if(!found){
                    continue;
                }
                // full match found
                if(x === modifier.match.length){
                    this.logger.info(`found match [${modifier.match.toString()}]`)

                    // if in compare mode, emit found
                    // and move on to the next modifier 
                    if(modifier.action === "compare"){
                        this.emit('compare', {modifier, index: i});
                        continue;
                    }

                    // copy from the original chunk start->end
                    // start: the position in the chunk at the 
                    //        end of the last found match, or 0
                    //  end:  the beginning of this found match (i)
                    let start = this.end_of_last_match;
                    let end = i;

                    // the modifier action will affect the end of the slice
                    // append: move to the end of the match
                    if(modifier.action === "append"){
                        end += modifier.match.length;
                    }
                    let slice = chunk.slice(start, end);
                    let length = new_chunk.length + slice.length;
                    new_chunk = Buffer.concat([new_chunk, slice], length);
                    this.logger.debug(`appended from chunk ${start}->${end}`);

                    // write the modifier data
                    new_chunk = await this.modifyChunk(new_chunk, modifier);

                    // if in prepend, write the match as well
                    if(modifier.action === "prepend"){
                        let slice = Buffer.from(modifier.match);
                        let length = new_chunk.length + slice.length;
                        new_chunk = Buffer.concat([new_chunk, slice], length);
                    }

                    // save the index at the end of the found match
                    this.end_of_last_match = i + modifier.match.length;

                    // push i passed the end of this match,
                    // otherwise we'll just read most of it again
                    i = this.end_of_last_match - 1;
                }
                // partial match found at end of the chunk
                // we couldnt search through the whole match
                // because there wasnt enough data left
                else if(chunk_remaining < modifier.match.length){
                    this.logger.debug(`unfinished match at EOF ${x}/${seek_length}`);
                    // save this data 
                    // we'll prepend it to the next chunk should one arrive
                    this.leftover_data = chunk.slice(i, chunk.length);
                    
                    // copy data from the end of the last found 
                    // match to the previous character
                    let slice = chunk.slice(this.end_of_last_match, i);
                    let length = new_chunk.length + slice.length;
                    new_chunk = Buffer.concat([new_chunk, slice], length);
                    this.logger.debug(`appended from chunk ${this.end_of_last_match}->${i}`);
                    break;
                }
            }

            // if there may be a match lurking at the end of this 
            if(this.leftover_data){
                break;
            }
        
            // if at the end of the chunk, 
            if(!chunk_remaining){
                let slice = chunk.slice(this.end_of_last_match, chunk.length);
                let length = new_chunk.length + slice.length;
                new_chunk = Buffer.concat([new_chunk, slice], length);
                this.logger.debug(`appended from chunk ${this.end_of_last_match}->${i}`);
            }
        }

        return new_chunk;
    }
}

module.exports = DataTransform;