var _ = {};


if (Buffer([255]).readUInt32BE(0, true) !== 0xff000000 || Buffer(0).readUInt32BE(9999, true) !== 0) {
    throw Error("Runtime incompatibility! Bitfield logic assumes 0-padded reads off end of buffer.");
}

function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (ext) {
        Object.keys(ext).forEach(function (key) {
            obj[key] = ext[key];
        });
    });
    return obj;
}

function addField(ctr, f) {
    if ('width' in f) {
        ctr.bits = (ctr.bits || 0) + f.width;
        while (ctr.bits > 7) {
            ctr.bytes += 1;
            ctr.bits -= 8;
        }
    } else if (!ctr.bits) {
        ctr.bytes += f.size;
    } else {
        throw Error("Improperly aligned bitfield before field: "+f.name);
    }
    return ctr;
}

function arrayizeField(f, count) {
    return (count) ? extend({
        name: f.name,
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var arr = new Array(count);
            for (var idx = 0, len = arr.length; idx < len; idx += 1) {
                arr[idx] = f.valueFromBytes(buf, off);
            }
            return arr;
        },
        bytesFromValue: function (arr, buf, off) {
            arr || (arr = new Array(count));
            buf || (buf = new Buffer(this.size));
            off || (off = {bytes:0, bits:0});
            for (var idx = 0, len = arr.length; idx < len; idx += 1) {
                f.bytesFromValue(arr[idx], buf, off);
            }
            return buf;
        }
    }, ('width' in f) ? {width: f.width * count} : {size: f.size * count}) : f;
}

_.struct = function (name, fields, count) {
    if (typeof name !== 'string') {
        count = fields;
        fields = name;
        name = null;
    }
    
    var fieldsSum = fields.reduce(addField, {bytes:0, bits:0});
    if (fieldsSum.bits) throw Error("Improperly aligned bitfield at end of struct: "+name);
    
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var obj = new Object();
            fields.forEach(function (f) {
                var value = f.valueFromBytes(buf, off);
                if (f.name) obj[f.name] = value;
                else if (typeof value === 'object') extend(obj, value);
            });
            return obj;
        },
        bytesFromValue: function (obj, buf, off) {
            obj || (obj = {});
            buf || (buf = new Buffer(this.size));
            off || (off = {bytes:0, bits:0});
            fields.forEach(function (f) {
                var value = (f.name) ? obj[f.name] : obj;
                f.bytesFromValue(value, buf, off);
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
function bitfield(name, width, count) {
    width || (width = 1);
    // NOTE: width limitation is so all values will align *within* a 4-byte word
    if (width > 24) throw Error("Bitfields support a maximum width of 24 bits.");
    var impl = this,
        mask = FULL >>> (32 - width);
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var end = off.bits + width,
                word = buf.readUInt32BE(off.bytes, true),
                over = word >>> (32 - end);
            addField(off, this);
            return impl.b2v(over & mask);
        },
        bytesFromValue: function (val, buf, off) {
            val = impl.v2b(val || 0);
            off || (off = {bytes:0, bits:0});
            var end = off.bits + width,
                word = buf.readUInt32BE(off.bytes, true),
                zero = mask << (32 - end),
                over = (val & mask) << (32 - end);
            word &= ~zero;
            word |= over;
            buf.writeUInt32BE(word, off.bytes, true);
            addField(off, this);
            return buf;
        },
        width: width,
        name: name
    }, count);
};

_.bool = function (name, count) {
    return bitfield.call({
        b2v: function (b) { return Boolean(b); },
        v2b: function (v) { return (v) ? FULL : 0; }
    }, name, 1, count);

};
_.ubit = bitfield.bind({
    b2v: function (b) { return b; },
    v2b: function (v) { return v; }
});
_.sbit = bitfield.bind({        // TODO: handle sign bit…
    b2v: function (b) { return b; },
    v2b: function (v) { return v; }
});


function bytefield(name, size, count) {
    if (typeof name !== 'string') {
        count = size;
        size = name;
        name = null;
    }
    var impl = this;
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var val = buf.slice(off.bytes, off.bytes+this.size);
            addField(off, this);
            return impl.b2v(val);
        },
        bytesFromValue: function (val, buf, off) {
            off || (off = {bytes:0});
            buf || (buf = new Buffer(this.size));
            var blk = buf.slice(off.bytes, off.bytes+this.size),
                len = impl.vTb(val, blk);
            if (len < blk.length) blk.fill(0, len);
            addField(off, this);
            return buf;
        },
        size: size * (impl.size || 1),
        name: name
    }, count);
}


_.byte = bytefield.bind({
    b2v: function (b) { return b; },
    vTb: function (v,b) { if (!v) return 0; v.copy(b); return v.length; }
});

_.char = bytefield.bind({
    b2v: function (b) {
        var v = b.toString('utf8'),
            z = v.indexOf('\0');
        return (~z) ? v.slice(0, z) : v;
    },
    vTb: function (v,b) {
        v || (v = '');
        return b.write(v, 'utf8');
    }
});

_.char16 = bytefield.bind({
    size: 2,
    b2v: function (b) {
        var v = b.toString('utf16le'),
            z = v.indexOf('\0');
        return (~z) ? v.slice(0, z) : v;
    },
    vTb: function (v,b) {
        v || (v = '');
        return b.write(v, 'utf16le');
    }
});


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
            valueFromBytes: function (buf, off) {
                off || (off = {bytes:0});
                var val = buf[read](off.bytes);
                addField(off, this);
                return val;
            },
            bytesFromValue: function (val, buf, off) {
                val || (val = 0);
                buf || (buf = new Buffer(this.size));
                off || (off = {bytes:0});
                buf[dump](val, off.bytes);
                addField(off, this);
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
