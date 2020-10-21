# node-data-transform
Transforms data in a stream. Supports append, prepend, replace, erase, and compare. In the future it will support split.

#### Install

`npm install @voliware/node-data-transform`

## Why do I need it?
If you have any stream in Node.js - a file, a TCP stream, a native Node request or response object - and you need to append data, prepend data, erase data, compare data, or replace data in the stream, you need this.

## What is it?
An enhanced `Transform` object, which is a native Nodejs stream object. Transforms are passed to the `pipe()` function when dealing with readable streams. When data flows through the readable stream, it also flows through the transform. The transform can actually change the data as it goes down the pipe. `DataTransform` is able to process the chunks perfectly, whether you receive massive chunks at a time, or literally one byte at a time. 

## How do I use it?
Create one or many `DataTransform` objects that do as many of the following actions
1. `append(match, content)`
2. `prepend(match, content)`
3. `replace(match, content)`
4. `erase(match)`
5. `compare(match)`

Here, `match` means what are we looking for in the stream, and `content` is what we will append, prepend, or replace it with. For `erase` and `compare`, we don't need any content. `erase` simply removes the data while `compare` emits an event.

## Example
In this example, we will create just one `DataTransform` that will **erase** data, **append** some data with a file, **prepend** some data with a file, and **replace** some data with text. Note that the matches are named the same as the functions for clarity.

#### Input HTML file
```html
<div>
    <!-- append -->
    <!-- prepend -->
</div>
<div>
    <!-- replace -->
    <!-- erase -->
</div>
```

#### Setup
```js
let readable = Fs.createReadStream("base.html");
let writable = Fs.createWriteStream("index.html");
let datatransform = new DataTransform()
    .erase('<!-- erase -->')                             // erase <!-- erase --> 
    .append('<!-- append -->', {file: "append.html"})    // append with contents of a file
    .prepend('<!-- prepend -->', {file: "prepend.html"}) // prepend with contents of a file
    .replace('<!-- replace -->', {string: "Replaced!"}); // replace with text
```

The result will be
```html
<div>
    <!-- append --><div id="append"></div>
    <div id="prepend"></div><!-- prepend -->
</div>
<div>
    Replaced!
    
</div>
```

## What can I use it for?
A minifier
```js
let datatransform = new DataTransform()
    .erase(' ')                                     // erase spaces
    .erase(Buffer.from([0x0d, 0x0a]))               // erase new lines 
```

An HTML injector
```js
let datatransform = new DataTransform()
    .append('<!-- templates -->', {file: "templates.html"}) // append with contents of a file
```

Search and replace in a file
```js
let datatransform = new DataTransform()
    .replace('youre', {string: "you're"})                      // search and replace 
```

## Options
There are two options when creating a `DataTransform`.
1. `concat` 
    - If true [default], all chunks are concatenated before processing. This is usually what you want.
    - If false, chunks are processed and sent downstream as they arrive.
2. `modifiers` 
    - Instead of using the API you can pass along an array of modifiers to the constructor.
    - Each modifier object has the properties of 
        - `action` - "append", "prepend", "compare", "replace", or "erase"
        - `match` - the string or buffer to match against
        - `content` - the string or buffer or filepath to append, prepend, or replace with

### Example 1
Append " Senior" each time we find "Joe". 

Prepend "Mr. " each time we find "Joe".

Replace "dog" with "cat".

Erase all "bad words"!

```js
let datatransform = new DataTransform({
    concat: false,
    modifiers: [
        new Modifier("append", "Joe", {string: " Senior"}),
        new Modifier("prepend", "Joe", {string: " Mr."}),
        new Modifier("replace", "dog", {string: "cat"}),
        new Modifier("erase", {string: "bad words"})
    ]
});
```

### Example 2
Even better, you can use an array to, for example, append many files or strings after one match.

```js
let datatransform = new DataTransform({
    concat: false,
    modifiers: [
        new Modifier("append", "<!--templates-->", [
            {file: './src/html/template1.html'},
            {file: './src/html/template2.html'},
            {string: '<template id="abc">ABC</template>'}
        ])
    ]
});
```
