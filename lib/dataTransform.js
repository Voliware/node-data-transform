const {Transform} = require('stream');
const Fs = require('fs');
const Logger = require('@voliware/logger');

/**
 * Data Transform.
 * A transform that modifies the stream data.
 * @extends {Transform}
 */
class DataTransform extends Transform {

    /**
     * Constructor
     * @param {Object} [options] 
     * @param {Object[]} [options.modifiers] 
     * @returns {DataTransform}
     */
    constructor(options = {}) {
        super(options);
        this.chunk_count = 0;
        this.leftover_data = null;
        this.modifiers = options.modifiers || [];
        this.end_of_last_match = 0;
        this.logger = new Logger("DATA", {level: "error"});
        return this;
    }

    /**
     * Add a data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Buffer|String} contents - a buffer or a file path to add to the stream
     * @param {String} [action="replace"] what to do when a match is found
     * @returns {InjectTransform}
     */
    modify(match, contents, action = "replace"){
        // convert strings to buffers
        if(typeof match === "string" || typeof match === "number"){
            let _match = `${match}`;
            match = this.getStringAsCharChode(_match);
            match.toString = () => { return _match; }
        }
        // add a toString() function to buffers
        // in order to log them nicely
        else {
            match.toString = () => {
                let str = "";
                for(let i = 0; i < match.length; i++){
                    str += str.charCodeAt(match[i]);
                }
                return str;
            }
        }
        this.modifiers.push({match, contents, action});
        return this;
    }

    /**
     * Add an append data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Buffer|String} contents - a buffer or a file path to add to the stream
     * @returns {InjectTransform}
     */
    append(match, contents){
        return this.modify(match, contents, "append");
    }

    /**
     * Add a compare data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @returns {InjectTransform}
     */
    compare(match){
        return this.modify(match, Buffer.from([]), "compare");
    }

    /**
     * Add an erase data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @returns {InjectTransform}
     */
    erase(match){
        return this.modify(match, Buffer.from([]), "erase");
    }

    /**
     * Add a prepend data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Buffer|String} contents - a buffer or a file path to add to the stream
     * @returns {InjectTransform}
     */
    prepend(match, contents){
        return this.modify(match, contents, "prepend");
    }

    /**
     * Add a replace data modifier
     * @param {Buffer|String} match - a buffer or string to match with
     * @param {Buffer|String} contents - a buffer or a file path to add to the stream
     * @returns {InjectTransform}
     */
    replace(match, contents){
        return this.modify(match, contents, "replace");
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
                buffer = Buffer.concat([buffer, chunk]);
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
     * @param {Buffer|String|Any} chunk 
     * @param {String} encoding 
     * @param {Function} callback 
     * @async
     */
    async _transform(chunk, encoding, callback){
        // new chunk of data
        this.chunk_count++;
        this.logger.debug(`read chunk ${this.chunk_count} with length ${chunk.length}`);

        // if there was leftover data, prepend it to this chunk
        if(this.leftover_data){
            this.logger.debug(`prepended leftover data`);
            chunk = Buffer.concat([this.leftover_data, chunk]);
            this.leftover_data = null;
        }

        this.logger.debug("printing original chunk:\n" + chunk.toString());

        // pause the reader and process the chunk
        chunk = await this.processChunk(chunk);

        this.logger.debug("printing modified chunk:\n" + chunk.toString());

        this.last_chunk = chunk;
        callback(null, chunk);
    }

    /**
     * Modify a chunk with a modifier
     * @param {Buffer|String|Any} chunk 
     * @param {object} modifier 
     * @async
     * @returns {Buffer|String|Any} modified chunk 
     */
    async modifyChunk(chunk, modifier){
        if(typeof modifier.contents === "string"){
            try {
                Fs.accessSync(modifier.contents);
                return this.appendFromFile(chunk, modifier.contents);
            }
            catch (error) {
                let buffer = Buffer.from(modifier.contents);
                return Buffer.concat([chunk, buffer]);
            }
        }
        else {
            return Buffer.concat([chunk, modifier.contents]);
        }
    }

    /**
     * Process a chunk.
     * @param {Buffer|String|Any} chunk 
     * @async
     * @returns {Buffer|String|Any} chunk 
     */
    async processChunk(chunk){
        let new_chunk = Buffer.from([]);
        this.end_of_last_match = 0;
        this.logger.debug("processing chunk");
        // loop through every value in the chunk
        for(let i = 0; i < chunk.length; i++){
            let chunk_remaining = chunk.length - 1 - i;
            // loop through every modifier to test if the current
            // chunk value is the start of an modifier.match
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
                            this.logger.debug(`matched ${x}/${seek_length} with ${modifier.match.toString()}`);
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
                    this.logger.info(`found match ${modifier.match.toString()}`)

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
                    new_chunk = Buffer.concat([new_chunk, slice]);
                    this.logger.debug(`appended from chunk ${start}->${end}`);

                    // write the modifier data
                    new_chunk = await this.modifyChunk(new_chunk, modifier);

                    // if in prepend, write the match as well
                    if(modifier.action === "prepend"){
                        let slice = chunk.slice(i, i + modifier.match.length);
                        new_chunk = Buffer.concat([new_chunk, slice]);
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
                    new_chunk = Buffer.concat([new_chunk, slice]);
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
                new_chunk = Buffer.concat([new_chunk, slice]);
                this.logger.debug(`appended from chunk ${this.end_of_last_match}->${i}`);
            }
        }

        return new_chunk;
    }
}

module.exports = DataTransform;