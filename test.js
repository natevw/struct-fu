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
    _.byte('reserved', 10),
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


function assert(b) { if (!b) throw Error("Assertion failed!"); }

assert(obj1.filename === obj0.filename);
assert(obj1.extension === obj0.extension.slice(0,3));
assert(obj1.flags.reserved === (obj0.flags.reserved & 0x03));
assert(obj1.flags.reserved === (obj0.flags.reserved & 0x03));
assert(obj1.flags.archive === true);
assert(obj1.flags.system === false);
assert(Buffer.isBuffer(obj1.reserved));
assert(obj1.reserved[0] === 0);
assert(obj1.time.hour === 0);
assert(obj1.cluster === 0);
assert(obj1.filesize === 0);
