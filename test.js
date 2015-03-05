var _ = require("./lib");

var entry = _.struct([
    _.char('filename',8),
    _.char('extension',3),
    _.struct('flags', [
        _.bool('readonly'),
        _.bool('hidden'),
        _.bool('system'),
        _.bool('volume'),
        _.bool('directory'),
        _.bool('archive'),
        _.ubit('reserved', 2)
    ].reverse()),
    _.byte('reserved', 4, 2),
    _.struct([
        _.char('reserved1'),
        _.ubit('reserved2', 8)
    ]),
    _.struct('time', [
        _.ubit('hour',5),
        _.ubit('minutes',6),
        _.ubit('seconds',5)
    ]),
    _.struct('date', [
        _.ubit('year',7),
        _.ubit('month',4),
        _.ubit('day',5)
    ]),
    _.uint16le('cluster'),
    _.uint32le('filesize')
]);

var obj0 = {filename:"autoexec", extension:"batch", flags:{reserved:0x82,archive:true}},
    _buf = entry.bytesFromValue(obj0),
    obj1 = entry.valueFromBytes(_buf);
console.log('',obj0, "\n==>\n", obj1);
//console.log(_buf);

console.log("\nRunning tests.");
function assert(b,msg) { if (!b) throw Error("Assertion failure. "+msg); else console.log(msg); }

console.log("  = API check =  ");
assert('fields' in entry, "Entry has fields property.");
assert('reserved' in entry.fields, "Entry fields contain 'reserved' bytefield.");
assert('reserved1' in entry.fields, "Entry fields contain hoisted 'reserved1' bytefield.");
assert('reserved2' in entry.fields, "Entry fields contain hoisted 'reserved2' bytefield.");
assert('time' in entry.fields, "Entry fields contain 'time' struct.");
assert(entry.fields.time.offset === 22, "Offset is correct for 'time' struct.");
assert('field' in entry.fields.reserved, "Reserved array allows access to underlying field");
assert(!('offset' in entry.fields.reserved.field), "Reserved array's underlying field does not have an offset…");
assert(entry.fields.reserved.offset === 12, "…but reserved array field itself does, and said offset is correct.");
assert(entry.fields.reserved2.offset.bytes === 21, "Hoisted field 'reserved2' has correct offset.");

console.log("  = Write check =  ");
var _bufKnown = new Buffer("6175746f65786563626174a00000000000000000000000000000000000000000", 'hex');
assert(_bufKnown.length === 32, "Runtime parsed known buffer as 'hex'.");
assert(_bufKnown[0] === 0x61 && _bufKnown[7] === 0x63 && _bufKnown[31] === 0, "Known buffer parse passes spot check.");
assert(_buf.length === _bufKnown.length, "Buffer size matches");
for (var i = 0, len = _buf.length; i < len; ++i) assert(_buf[i] === _bufKnown[i], "Buffer contents match at "+i);

console.log("  = Read checks =  ");
assert(obj1.filename === obj0.filename, "Filename field matches");
assert(obj1.extension === obj0.extension.slice(0,3), "(Truncated) extension matches");
assert(obj1.flags.reserved === (obj0.flags.reserved & 0x03), "(Expected bits) of reserved flags match");
assert(obj1.flags.archive === true, "Archive bit set");
assert(obj1.flags.system === false, "System bit not set");
assert(Array.isArray(obj1.reserved), "Reserved array is an array");
assert(Buffer.isBuffer(obj1.reserved[0]), "Reserved array contains a buffer");
assert(obj1.reserved[1][0] === 0, "Reserved array buffer passes content sniff test");
assert(obj1.time.hour === 0, "Hour value as expected");
assert(obj1.cluster === 0, "Cluster value as expected");
assert(obj1.filesize === 0, "Filesize value as expected");

console.log("  = Unicode check = ");
var str = "\ud83c\udf91",
    ucs = _.char16le(4),
    b16 = ucs.bytesFromValue(str);
assert(b16[0] === 0x3c, "UTF-16 byte 0 as expected");
assert(b16[1] === 0xd8, "UTF-16 byte 1 as expected");
assert(b16[2] === 0x91, "UTF-16 byte 2 as expected");
assert(b16[3] === 0xdf, "UTF-16 byte 3 as expected");
assert(ucs.valueFromBytes(b16) === str, "UTF-16 converted back correctly.");
var utf = _.char(4),
    b_8 = utf.bytesFromValue(str);
//console.log(b_8);
assert(b_8[0] === 0xF0, "UTF-8 byte 0 as expected");
assert(b_8[1] === 0x9F, "UTF-8 byte 1 as expected");
assert(b_8[2] === 0x8E, "UTF-8 byte 2 as expected");
assert(b_8[3] === 0x91, "UTF-8 byte 3 as expected");
assert(utf.valueFromBytes(b_8) === str, "UTF-8 converted back correctly.");

console.log("  = Bitfield check = ");
var bitle = _.struct([
    _.ubitLE('n', 8)
]), bufle = bitle.bytesFromValue({n:0x02});
assert(bufle.length === 1, "ubitLE buffer has correct size.");
assert(bufle[0] === 0x40, "ubitLE buffer has correct value.");
assert(bitle.valueFromBytes(bufle).n === 0x02, "ubitLE conversion back has original value.");

var bitzz = _.struct([
    _.bool('a'),
    _.ubit('b', 3),
    _.ubitLE('c', 3),
    _.sbit('d', 9)
]), bufzz = bitzz.bytesFromValue({a:true, b:1, c:1, d:-2}), backzz = bitzz.valueFromBytes(bufzz);
assert(bufzz.length === 2, "Bitfield buffer has correct size.");
//console.log((0x100+bufzz[0]).toString(2).slice(1), (0x100+bufzz[1]).toString(2).slice(1));
assert((bufzz[0] & 0x80) >>> 7 === 1, "Bitfield bool stored correctly.");
assert((bufzz[0] & 0x70) >>> 4 === 1, "Bitfield ubit stored correctly.");
assert((bufzz[0] & 0x0E) >>> 1 === 4, "Bitfield ubitLE stored correctly.");
assert((bufzz[0] & 0x01) >>> 0 === 1, "Bitfield sbit sign stored correctly.");
assert((bufzz[1] & 0xFF) >>> 0 === 2, "Bitfield sbit value stored correctly.");
assert(backzz.a === true, "Bitfield bool read back correctly.");
assert(backzz.b === 1, "Bitfield ubit read back correctly.");
assert(backzz.c === 1, "Bitfield ubitLE read back correctly.");
assert(backzz.d === -2, "Bitfield sbit read back correctly.");

console.log (" = Padding check = ");

var things = _.struct([
    _.bool('thing1'),
    _.padTo(7),
    _.uint8('thing2')
]);
assert(things.size === 8, "Padded structure has correct size.");
assert(things.fields.thing2.offset === 7, "Field after padding is at correct offset.");
var thingOut = things.bytesFromValue({thing2:0x99}, Buffer([0,1,2,3,4,5,6,7,8]), {bytes:1});
for (var i = 0; i < 8; ++i) assert(thingOut[i] === i, "Padded output has original value at index "+i);
assert(thingOut[i] === 0x99, "Padded output has correct value at index "+i);

var threw = false;
try {
    _.struct([
        _.int32('thing1'),
        _.int32('thing2'),
        _.padTo(7)
    ]);
} catch (e) {
  threw = e;
} finally {
    console.log("THREW", threw);
    assert(threw, "Invalid padding detected.");
}

console.log (" = Repetition checks = ");

assert(_.byte(0,0).size === 0, "Size of zero-length and zero-count field is zero.");
assert(_.byte(0,9).size === 0, "Size of zero-length and multi-count field is still zero.");
assert(_.byte(9,0).size === 0, "Size of zero-count of a field with length is still zero.");

var multiStruct = _.struct([_.uint8('n')], 2),
    msBuf = new Buffer(multiStruct.size),
    msArr = [];
msBuf.fill(0xFF);
msArr.push({n:0x42});
multiStruct.bytesFromValue(msArr, msBuf);
assert(msBuf[0] === 0x42, "First value set.");
assert(msBuf[1] === 0xFF, "Next value left.");
msArr.length = 2;
multiStruct.bytesFromValue(msArr, msBuf);
assert(msBuf[0] === 0x42, "First value still set.");
assert(msBuf[1] === 0x00, "Next value is cleared.");
msArr[1] = msArr[0];
multiStruct.bytesFromValue(msArr, msBuf);
assert(msBuf[1] === msArr[0].n, "Values as expected.");

var afterMulti = _.struct([_.uint8('nn', 2), _.uint8('n')]),
    amBuf = new Buffer(afterMulti.size);
amBuf.fill(0x01);
afterMulti.bytesFromValue({nn:[0x00], n:0x02}, amBuf);
assert(amBuf[0] === 0, "Array value correct.");
assert(amBuf[2] === 2, "After array in expected position.");
assert(amBuf[1] === 1, "Array missing correctly.");

console.log (" = New pack/unpack API = ");

var newAPI = _.struct([_.uint8('nn', 2), _.uint8('n')], 2),
    newBuf = newAPI.pack([{nn:[0xF0], n:0xF2}, {nn:[0xF1], n:0xF3}]),
    newArr = newAPI.unpack(newBuf);
assert(Buffer.isBuffer(newBuf), "New API still returns buffer");
assert(newBuf.length === 6, "New API buffer is correct length");
assert(Array.isArray(newArr), "New API unpacks expected object type");
assert(newArr.length === 2, "New API unpacked array is correct length");
assert(newArr[1].nn[0] === 0xF1, "…and contains expected value.");

console.log("\nAll tests passed!");
