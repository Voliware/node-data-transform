# node-data-transform
Transforms data in a stream. Supports append, prepend, replace, erase, and compare

## Why do I need it?
If you have any stream in Node.js - a file, a TCP stream, a native Node request or response object - and you need to append data, prepend data, erase data, or replace data in the stream, you need this.

## What is it?
A `Transform` object, which is a native Nodejs stream object. Transforms are passed to the `pipe()` function when dealing with readable streams. When data flows through the readable stream, it also flows through the transform. The transform can actually change the data as it goes down the pipe.

## How do I use it?
Create one or many `DataTransform` objects that do as many of the following actions
1. `append(match, content)`
2. `prepend(match, content)`
3. `replace(match, content)`
4. `erase(match)`

Here, `match` means what are we looking for in the stream, and `content` is what we will append, prepend, or replace it with.

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
    .erase('<!-- erase -->')                     // erase <!-- erase --> 
    .append('<!-- append -->', "append.html")    // append with contents of a file
    .prepend('<!-- prepend -->', "prepend.html") // prepend with contents of a file
    .replace('<!-- replace -->', "Replaced!");   // replace with text
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
    .append('<!-- templates -->', "templates.html") // append with contents of a file
```

Search and replace in a file
```js
let datatransform = new DataTransform()
    .replace('youre', 'you're)                      // search and replace 
```
