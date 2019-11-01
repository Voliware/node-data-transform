const Stream = require('stream');
const Assert = require('assert');
const Fs = require('fs')
const Path = require('path');
const {DataTransform} = require('../index');

const test_file = Path.join(__dirname, "/test.html");
const result_file = Path.join(__dirname, "/result.html");
const append_file = Path.join(__dirname, "/append.html");
const prepend_file = Path.join(__dirname, "/prepend.html");
const replace_file = Path.join(__dirname, "/replace.html");

/**
 * Test function for basic tests
 * @param {DataTransform} datatransform 
 * @param {String} expectation 
 * @param {String} readable_data
 * @returns {Promise} 
 */
function run(datatransform, expectation, readable_data){
    let readable = new Stream.Readable();
    readable._read = () => {};
    let data = Buffer.from([]);
    let writable = new Stream.Writable();
    writable._write = (chunk, enc, next) => { 
        data = Buffer.concat([data, chunk])
        next();
    }

    readable.push(readable_data);
    readable.push(null);

    return new Promise((resolve, reject) => {
        readable
            .pipe(datatransform)
            .pipe(writable)
            .on('finish', () => {
                if(data.compare(Buffer.from(expectation)) === 0){
                    resolve();
                }
                else {
                    reject();
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

// it('compares data', function() {
//     let datatransform = new DataTransform().compare("data");
//     return run(datatransform, "", "data")
// });

it('appends data after a match', function() {
    let datatransform = new DataTransform().append("append", "data");
    return run(datatransform, "appenddata", "append")
});

it('prepends data before a match', function() {
    let datatransform = new DataTransform().prepend("prepend", "data");
    return run(datatransform, "dataprepend", "prepend")
});

it('replaces data at a match', function() {
    let datatransform = new DataTransform().replace("replace", "data");
    return run(datatransform, "data", "replace")
});

it('erases data at a match', function() {
    let datatransform = new DataTransform().erase("erase");
    return run(datatransform, "", "erase")
});

it('append, erase, prepend, and replace text in a file', function() {
    let expectation = `<div><!-- append:append --><div id="append"></div><div id="prepend"></div><!-- prepend:prepend --></div><div>Anything at all..<!--compare:compare--></div>`;
    let readable = Fs.createReadStream(test_file);
    let writable = Fs.createWriteStream(result_file);
    let datatransform = new DataTransform()
        .replace(' ', '')
        .replace(Buffer.from([0x0d, 0x0a]), '')
        .append('<!-- append:append -->', append_file)
        .compare('<!-- compare:compare -->')
        .erase('<!-- erase:erase -->')
        .prepend('<!-- prepend:prepend -->', prepend_file)
        .replace('<!-- replace:replace -->', replace_file);

    return new Promise((resolve, reject) => {
        readable
            .pipe(datatransform)
            .pipe(writable)
            .on('finish', () => {
                Fs.readFile(result_file, (err, data) => {
                    if(err){
                        reject(err);
                    }
                    else if(data.compare(Buffer.from(expectation)) === 0){
                        resolve();
                    }
                    else {
                        reject();
                    }
                });
            })
            .on('error', (error) => {
                reject(error);
            });
    })
});

