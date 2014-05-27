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
console.log("\nAll tests passed!");