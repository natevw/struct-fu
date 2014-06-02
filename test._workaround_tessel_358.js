if (!Buffer.prototype.write) throw Error("This is intended to be tested against node.js itself!");

var s = "\ud83c\udf91",
    b = Buffer(3);
if (b.write(s,'utf8') !== 3 || Buffer._charsWritten !== 1) throw Error("node.js no longer uses CESU-8 behavior!");

var s = "\ud83c\udf91",
    b = Buffer(3);
if (b.write(s,'utf16le') !== 2 || Buffer._charsWritten !== 1) throw Error("node.js no longer splits surrogate pairs!");

var origWrite = Buffer.prototype.write;
require("./_workaround_tessel_358.js");
Buffer.prototype._write = Buffer.prototype.write;
Buffer.prototype.write = origWrite;

function assertSame(b, c, enc) {
    var s = String.fromCharCode(c),
        l0 = b.fill(0) || b.write(s, enc),
        b0 = (l0) ? b[0] : null,
        c0 = Buffer._charsWritten,
        l1 = b.fill(0) || b._write(s, enc),
        b1 = (l1) ? b[0] : null,
        c1 = Buffer._charsWritten;
    if (l0 !== l1 || b0 !== b1 || c0 !== c1) throw Error(["Not same!",c,enc,"\nnode:", l0, b0, c0, "\nnate:", l1, b1, c1].join(' '));
}

function testAll(b) {
    console.log("Testing against", b.length, "byte buffer.");
    for (var i = 0; i < 0xFFFF; ++i) {
        assertSame(b, i, 'ascii');
        assertSame(b, i, 'utf8');
        assertSame(b, i, 'ucs2');
    }
}

testAll(Buffer(1));
testAll(Buffer(2));
testAll(Buffer(3));
console.log("ALL THE SAME!");
