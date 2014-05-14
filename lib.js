var _ = {};


if (Buffer([255]).readUInt32BE(0, true) !== 0xff000000 || Buffer(0).readUInt32BE(9999, true) !== 0) {
    throw Error("Runtime incompatibility! Bitfield logic assumes 0-padded reads off end of buffer.");
}

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
            arr || (arr = new Array(count));
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


function addBits(ctr, n) {
    ctr.bits += n;
    while (ctr.bits > 7) {
        ctr.bytes += 1;
        ctr.bits -= 8;
    }
}

_.struct = function (name, fields, count) {
    if (typeof name !== 'string') {
        count = fields;
        fields = name;
        name = null;
    }
    
    var fieldsSum = fields.reduce(function (sum,f) {
        if ('width' in f) {
            addBits(sum, f.width);
        } else if (!sum.bits) {
            sum.bytes += f.size;
        } else {
            throw Error("Improperly aligned bitfield before field: "+f.name);
        }
        return sum;
    }, {bytes:0, bits:0});
    if (fieldsSum.bits) throw Error("Improperly aligned bitfield at end of struct: "+name);
    
    return arrayizeField({
        valueFromBytes: function (buf) {
            var obj = new Object(),
                off = {bytes:0, bits:0};
            fields.forEach(function (f) {
                var value;
                if ('width' in f) {
                    var bytes = new Buffer(4);
                    buf.copy(bytes, 0, off.bytes);
                    value = f._valueFromBits(bytes, off.bits);
                    addBits(off, f.width);
                } else {
                    var bytes = buf.slice(off.bytes, off.bytes += f.size);
                    value = f.valueFromBytes(bytes);
                }
                obj[f.name] = value;
            });
            return obj;
        },
        bytesFromValue: function (obj, buf) {
            obj || (obj = {});
            buf || (buf = new Buffer(this.size));
            var off = {bytes:0, bits:0};
            fields.forEach(function (f) {
                var value = obj[f.name];
                if ('width' in f) {
                    var bytes = buf.slice(off.bytes, off.bytes+4);
                    f._bitsFromValue(value, bytes, off.bits);
                    addBits(off, f.width);
                } else {
                    var bytes = buf.slice(off.bytes, off.bytes += f.size);
                    f.bytesFromValue(value, bytes);
                }
            });
            return buf;
        },
        size: fieldsSum.bytes,
        name: name
    }, count);
};

// NOTE: bitfields must be embedded in a struct, and don't arrayize!
//       (this limitation is same as C itself, and keeps things sane…)

var FULL = 0xFFFFFFFF;
function bitfield(name, width) {
    width || (width = 1);
    // NOTE: width limitation is so all values will align *within* a 4-byte word
    if (width > 24) throw Error("Bitfields support a maximum width of 24 bits.");
    var impl = this,
        mask = FULL >>> (32 - width);
    return {
        _valueFromBits: function (buf, bit) {
            var end = bit + width,
                word = buf.readUInt32BE(0, true),
                over = word >>> (32 - end);
            return impl.b2v(over & mask);
        },
        _bitsFromValue: function (val, buf, bit) {
            val || (val = 0);
            val = impl.v2b(val);
            var end = bit + width,
                word = buf.readUInt32BE(0,true),
                zero = mask << (32 - end),
                over = (val & mask) << (32 - end);
            word &= ~zero;
            word |= over;
            buf.writeUInt32BE(word, 0, true);
        },
        width: width,
        name: name
    };
};

_.bool = bitfield.bind({
    b2v: function (b) { return Boolean(b); },
    v2b: function (v) { return (v) ? FULL : 0; }
});
_.ubit = bitfield.bind({
    b2v: function (b) { return b; },
    v2b: function (v) { return v; }
});
_.sbit = bitfield.bind({        // TODO: handle sign bit…
    b2v: function (b) { return b; },
    v2b: function (v) { return v; }
});

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
            if (!val) {
                val = new Buffer(this.size);
                val.fill(0);
            }
            buf || (buf = new Buffer(this.size));
            val.copy(buf, 0, 0, this.size);
            if (val.length < this.size) buf.fill(0, val.length);
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
            var val = buf.toString(),
                nul = val.indexOf('\0');
            return (~nul) ? val.slice(0, nul) : val;
        },
        bytesFromValue: function (str, buf) {
            str || (str = '');
            buf || (buf = new Buffer(this.size));
            var off = buf.write(str, 0, this.size);
            if (off < this.size) buf.fill(0, off);
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
            bytesFromValue: function (val, buf) {
                val || (val = 0);
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

//_.padTo?

module.exports = _;
