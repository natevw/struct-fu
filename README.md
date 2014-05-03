# struct-fu

[Yet another] buffer layout helper, sort of like `typedef struct foo` for JavaScript.


## Installation

`npm install hedder`

## Example


```
var _ = require('struct-fu');

var entry = _.struct([
    _.char('filename',8),
    _.char('extension',3),
    _.struct('flags', [
        _.bool('readonly'),
        _.bool('hidden'),
        _.bool('system'),
        _.bool('volume'),
        _.bool('directory',
        _.bool('archive')
    ]),
    _.byte('reserved', 10),
    _.struct('time', [
        _.ubit('hour',5),
        _.ubit('minutes',6),
        _.ubit('seconds:5')
    ]),
    _.struct('date', [
        _.ubit('year',7),
        _.ubit('month',4),
        _.ubit('day',5)
    ]),
    _.uint16le('cluster'),
    _.uint32le('filesize')
]);


_.uint8(20)(Buffer(20));

var blank = new Buffer(entry.size);
blank.fill(0);
var fields = entry(blank)
```

## Concepts

- No hidden/implicit padding or alignment (WYSIWYG)
- Defaults to network byte order (Big Endian); or use `le` suffix (Little Endian)
- For `byte` and `char` types, `count` param is buffer/string length respectively. For `bit` types, count is bitfield width. For all other types (including `bool` and `struct` itself), `count` makes an array of that type.
- Pass a buffer to a type to get a value/object/array back, otherwise pass a value/object/array to get a buffer. [**TBD**: buffer field is probably brokt in this regard?]

## License

© 2014 Nathan Vander Wilt

Reuse under your choice of:

* [BSD-2-Clause](http://opensource.org/licenses/BSD-2-Clause)
* [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0.html)