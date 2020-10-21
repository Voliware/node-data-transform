const {Readable, Writable} = require('stream');
const Fs = require('fs')
const Path = require('path');
const Assert = require('assert');
const {DataTransform} = require('../index');

const test_file = Path.join(__dirname, "/test.html");
const result_file = Path.join(__dirname, "/result.html");
const append_file = Path.join(__dirname, "/append.html");
const prepend_file = Path.join(__dirname, "/prepend.html");
const replace_file = Path.join(__dirname, "/replace.html");

/**
 * Test function for basic tests
 * @param {DataTransform} datatransform 
 * @param {String} readable_data
 * @param {String} expectation 
 * @returns {Promise} 
 */
function run(datatransform, readable_data, expectation){
    let readable = new Readable();
    readable._read = () => {};
    let data = Buffer.from([]);
    let writable = new Writable();
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
                if(expectation){
                    if(data.compare(Buffer.from(expectation)) === 0){
                        resolve();
                    }
                    else {
                        reject(new Error("Data does not match expectation"));
                    }
                }
                else {
                    resolve();
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

it('compares data', async function() {
    let datatransform = new DataTransform();
    datatransform.compare("data to com");
    let passed = false;
    datatransform.on('compare', (data) => {
        passed = true;
    });
    await run(datatransform, "some data to compare");
    Assert.strictEqual(passed, true);
});

// it('splits data between a start and end delimiters', async function() {
//     let datatransform = new DataTransform();
//     datatransform.split({
//         start: "<S>",
//         end: "<E>"
//     });
//     return run(datatransform, "<S>data1<E>garbage<S>data2<E>", "data1data2");
// });

it('appends data after a match', function() {
    let datatransform = new DataTransform();
    datatransform.append("append", {string: "data"});
    return run(datatransform, "append", "appenddata");
});

it('prepends data before a match', function() {
    let datatransform = new DataTransform();
    datatransform.prepend("prepend", {string: "data"});
    return run(datatransform, "prepend", "dataprepend");
});

it('replaces data at a match', function() {
    let datatransform = new DataTransform();
    datatransform.replace("replace", {string: "data"});
    return run(datatransform, "replace", "data");
});

it('erases data at a match', function() {
    let datatransform = new DataTransform();
    datatransform.erase("erase");
    return run(datatransform, "erase", "");
});

it('append, erase, prepend, and replace text in a file', function() {
    let expectation = `<div><!-- append --><div id="append"></div><div id="prepend"></div><!-- prepend --></div><div>Anything at all..<!--compare--></div>`;
    // The highwatermark of 1 proves the transform can work 
    // when reading chunks that are just 1 character in length
    let readable = Fs.createReadStream(test_file, {highWaterMark:1});
    let writable = Fs.createWriteStream(result_file);
    let datatransform = new DataTransform({concat: false})
        .erase(' ')
        .erase(Buffer.from([0x0d, 0x0a]))
        .erase('<!-- erase -->')
        .append('<!-- append -->', {file: append_file})
        .compare('<!-- compare -->')
        .prepend('<!-- prepend -->', {file: prepend_file})
        .replace('<!-- replace -->', {file: replace_file});

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