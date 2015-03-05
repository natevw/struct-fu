var _ = {};

if (Buffer([255]).readUInt32BE(0, true) !== 0xff000000) {
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
    var f2 = (typeof count === 'number') ? extend({
        name: f.name,
        field: f,
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
            while (idx++ < count) addField(off, f);
            return buf;
        }
    }, ('width' in f) ? {width: f.width * count} : {size: f.size * count}) : f;
    f2.pack = f2.bytesFromValue;
    f2.unpack = f2.valueFromBytes;
    return f2;
}

_.struct = function (name, fields, count) {
    if (typeof name !== 'string') {
        count = fields;
        fields = name;
        name = null;
    }
    
    var _size = {bytes:0, bits:0},
        _padsById = Object.create(null),
        fieldsObj = fields.reduce(function (obj, f, i) {
            if ('_padTo' in f) {
                // HACK: we really should just make local copy of *all* fields
                f._id || (f._id = 'id'+Math.random().toFixed(20).slice(2));      // WORKAROUND: https://github.com/tessel/runtime/issues/716
                var _f = _padsById[f._id] = (_size.bits) ? {
                    width: 8*(f._padTo - _size.bytes) - _size.bits
                } : {
                    size: f._padTo - _size.bytes
                };
                if (_f.width < 0 || _f.size < 0) {
                    var xtraMsg = (_size.bits) ? (" and "+_size.bits+" bits") : '';
                    throw Error("Invalid .padTo("+f._padTo+") field, struct is already "+_size.bytes+" byte(s)"+xtraMsg+"!");
                }
                f = _f;
            }
            else if (f._hoistFields) Object.keys(f._hoistFields).forEach(function (name) {
                var _f = Object.create(f._hoistFields[name]);
                if ('width' in _f) _f.offset = {bytes:_f.offset.bytes+_size.bytes, bits:_f.offset.bits};
                else _f.offset += _size.bytes;
                obj[name] = _f;
            });
            else if (f.name) {
                f = Object.create(f);           // local overrides
                f.offset = ('width' in f) ? {bytes:_size.bytes,bits:_size.bits} : _size.bytes,
                obj[f.name] = f;
            }
            addField(_size, f);
            return obj;
        }, {});
    if (_size.bits) throw Error("Improperly aligned bitfield at end of struct: "+name);
    
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var obj = new Object();
            fields.forEach(function (f) {
                if ('_padTo' in f) return addField(off, _padsById[f._id]);
                
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
                if ('_padTo' in f) return addField(off, _padsById[f._id]);
                
                var value = (f.name) ? obj[f.name] : obj;
                f.bytesFromValue(value, buf, off);
            });
            return buf;
        },
        _hoistFields: (!name) ? fieldsObj : null,
        fields: fieldsObj,
        size: _size.bytes,
        name: name
    }, count);
};

_.padTo = function (off) {
    return {_padTo:off};
};


// NOTE: bitfields must be embedded in a struct (C/C++ share this limitation)

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
            var end = (off.bits || 0) + width,
                word = buf.readUInt32BE(off.bytes, true) || 0,
                over = word >>> (32 - end);
            addField(off, this);
            return impl.b2v.call(this, over & mask);
        },
        bytesFromValue: function (val, buf, off) {
            val = impl.v2b.call(this, val || 0);
            off || (off = {bytes:0, bits:0});
            var end = (off.bits || 0) + width,
                word = buf.readUInt32BE(off.bytes, true) || 0,
                zero = mask << (32 - end),
                over = (val & mask) << (32 - end);
            word &= ~zero;
            word |= over;
            word >>>= 0;      // WORKAROUND: https://github.com/tessel/runtime/issues/644
            buf.writeUInt32BE(word, off.bytes, true);
            addField(off, this);
            return buf;
        },
        width: width,
        name: name
    }, count);
}

function swapBits(n, w) {
    var o = 0;
    while (w--) {
        o <<= 1;
        o |= n & 1;
        n >>>= 1;
    }
    return o;
}


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
_.ubitLE = bitfield.bind({
    b2v: function (b) { return swapBits(b, this.width); },
    v2b: function (v) { return swapBits(v, this.width); }
});
_.sbit = bitfield.bind({        // TODO: handle sign bit…
    b2v: function (b) {
        var m = 1 << (this.width-1),
            s = b & m;
        return (s) ? -(b &= ~m) : b;
    },
    v2b: function (v) {
        var m = 1 << (this.width-1),
            s = (v < 0);
        return (s) ? (-v | m) : v;
    }
});


function bytefield(name, size, count) {
    if (typeof name !== 'string') {
        count = size;
        size = name;
        name = null;
    }
    size = (typeof size === 'number') ? size : 1;
    var impl = this;
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var val = buf.slice(off.bytes, off.bytes+this.size);
            addField(off, this);
            return impl.b2v.call(this, val);
        },
        bytesFromValue: function (val, buf, off) {
            off || (off = {bytes:0});
            buf || (buf = new Buffer(this.size));
            var blk = buf.slice(off.bytes, off.bytes+this.size),
                len = impl.vTb.call(this, val, blk);
            if (len < blk.length) blk.fill(0, len);
            addField(off, this);
            return buf;
        },
        size: size,
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

_.char16le = bytefield.bind({
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

module.exports = _;
