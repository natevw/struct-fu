var fixString = require("./8to16.js").fixString;


// see https://www.npmjs.org/package/utf8
var utf8 = require('utf8');
function Buffer_utf8(str) {
    var str = utf8.encode(str);
    return new Buffer(str, 'binary');
}

// from http://stackoverflow.com/a/3759300/179583
String.fromCodePoint= function() {
    var chars= Array.prototype.slice.call(arguments);
    for (var i= chars.length; i-->0;) {
        var n = chars[i]-0x10000;
        if (n>=0)
            chars.splice(i, 1, 0xD800+(n>>10), 0xDC00+(n&0x3FF));
    }
    return String.fromCharCode.apply(null, chars);
};


var str0 = new Buffer([0xf0, 0x9f, 0x8e, 0x91, 0x42, 0x43, 0xf0, 0x9f, 0x8e, 0x91]),
    str1 = Buffer_utf8("\ud83c\udf91"+"BC"+"\ud83c\udf91"),
    test1 = fixString(str1);
if (str0.length !== str1.length) throw Error("Modern UTF-8 library not as expected, length differs!");
for (var i = 0, len = str0.length; i < len; ++i) {
    if (str0[i] !== str1[i]) throw Error("Modern UTF-8 library not as expected!");
}

if (test1.length !== 6) throw Error("Incorrect length from fixString");
if (test1.charCodeAt(2) !== 0x42) throw Error("Incorrect single-byte content from fixString");
if (test1.charCodeAt(4) !== 0xd83c) throw Error("Incorrect single-byte content from fixString");
if (test1.charCodeAt(5) !== 0xdf91) throw Error("Incorrect single-byte content from fixString");

for (var i = 0; i < 0x1FFFFF; ++i) {
    var s0 = String.fromCodePoint(i),
        sX = Buffer_utf8(s0),
        s1 = fixString(sX);
    if (s0.length !== s1.length) throw Error("Length mismatch at codepoint 0x"+i.toString(16));
    if (s0.charCodeAt(0) !== s1.charCodeAt(0)) throw Error("Content mismatch at codepoint 0x"+i.toString(16));
    
}
console.log("Every code point matched, huzzah!");
