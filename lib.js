var _ = {};

function arrayizeField(f, count) {
    return (count) ? {
        valueFromBytes: function (buf) {
            var arr = new Array(count),
                off = 0;
            for (var idx = 0, len = arr.length; idx < len; idx += 1) {
                var bytes = buf.slice(off, off += f.size),
                    value = f.valueFromBytes(bytes);
                arr[idx] = value;
            }
            return arr;
        },
        bytesFromValue: function (arr, buf) {
            buf || (buf = new Buffer(this.size));
            var off = 0;
            for (var idx = 0, len = arr.length; idx < len; idx += 1) {
                var value = arr[idx],
                    bytes = buf.slice(off, off += f.size);
                f.bytesFromValue(value, bytes);
            }
            return buf;
        },
        size: f.size * count,
        name: f.name
    } : f;
}

_.struct = function (name, fields, count) {
    if (typeof name !== 'string') {
        count = fields;
        fields = name;
        name = null;
    }
    return arrayizeField({
        valueFromBytes: function (buf) {
            var obj = new Object(),
                off = 0;
            fields.forEach(function (f) {
                var bytes = buf.slice(off, off += f.size),
                    value = f.valueFromBytes(bytes);
                obj[f.name] = value;
            });
            return obj;
        },
        bytesFromValue: function (obj, buf) {
            buf || (buf = new Buffer(this.size));
            var off = 0;
            fields.forEach(function (f) {
                var value = obj[f.name],
                    bytes = buf.slice(off, off += f.size);
                f.bytesFromValue(value, bytes);
            });
            return buf;
        },
        size: fields.reduce(function (sum,field) {
            return sum + field.size;
        }, 0),
        name: name
    }, count);
};

_.byte = function (name, size, count) {
    if (typeof name !== 'string') {
        count = size;
        size = name;
        name = null;
    }
    return arrayizeField({
        valueFromBytes: function (buf) {
            return buf;
        },
        bytesFromValue: function (val, buf) {
            buf || (buf = new Buffer(this.size));
            val.copy(buf, 0, 0, this.size)
            return buf;
        },
        size: size,
        name: name
    }, count);
};

_.char = function (name, size, count) {
    if (typeof name !== 'string') {
        count = size;
        size = name;
        name = null;
    }
    return arrayizeField({
        valueFromBytes: function (buf) {
            return buf.toString();
        },
        bytesFromValue: function (str, buf) {
            buf || (buf = new Buffer(this.size));
            buf.write(str, 0, this.size);
            return buf;
        },
        size: size,
        name: name
    }, count);
};

function standardField(sig, size) {
    var read = 'read'+sig,
        dump = 'write'+sig;
    size || (size = +sig.match(/\d+/)[0] >> 3);
    return function (name, count) {
        if (typeof name !== 'string') {
            count = name;
            name = null;
        }
        return arrayizeField({
            valueFromBytes: function (buf) {
                return buf[read](0);
            },
            bytesFromValue: function (str, buf) {
                buf || (buf = new Buffer(this.size));
                buf[dump](val, 0);
                return buf;
            },
            size: size,
            name: name
        }, count);
    };
}

_.float32 = standardField('FloatBE',4);
_.float64 = standardField('DoubleBE',8);
_.float32le = standardField('FloatLE',4);
_.float64le = standardField('DoubleLE',8);

_.uint8 = standardField('UInt8');
_.uint16 = standardField('UInt16BE');
_.uint32 = standardField('UInt32BE');
_.uint16le = standardField('UInt16LE');
_.uint32le = standardField('UInt32LE');

_.int8 = standardField('Int8');
_.int16 = standardField('Int16BE');
_.int32 = standardField('Int32BE');
_.int16le = standardField('Int16LE');
_.int32le = standardField('Int32LE');

// TODO: bitfields need real implementation
_.bool = standardField('Int8');
_.ubit = standardField('Int8');
_.sbit = standardField('Int8');

//_.padTo?

module.exports = _;






function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (ext) {
        Object.keys(ext).forEach(function (key) {
            obj[key] = ext[key];
        });
    });
    return obj;
}
