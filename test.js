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


var obj0 = {filename:"autoexec", extension:"batch"},
    _buf = entry.bytesFromValue(obj0),
    obj1 = entry.valueFromBytes(_buf);
console.log(obj0, obj1);