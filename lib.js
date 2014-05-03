var _ = {};

function old_field(name, count) {
    var size = this.valueOf();
    if (count == null) count = 1;
    return function (struct) {
        return {key:name, value:[struct._size,size*count]};
    };
};

function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (ext) {
        Object.keys(ext).forEach(function (key) {
            obj[key] = ext[key];
        });
    });
    return obj;
}

function _normalizeFieldSig(read, type, dump, size) {
    return extend(function (src, off, dst) {
        off || (off = 0);
        if (Buffer.isBuffer(src)) {
            dst || (dst = new type());
            read(src, off, dst);
        } else {
            dst || (dst = new Buffer(size));
            dump(src, dst, off);
        }
        return dst;
    }, {size:size});
}

function field(name, count) {
    var ctx = this;
    return (count) ? _normalizeFieldSig(function (buf, off, arr) {
            // read array
            for (var i = 0; i < count; i += 1) {
                arr[i] = ctx.read(buf, off);
                off += ctx.size;
            }
        }, Array, function (arr, buf, off) {
            // dump array
            arr.forEach(function () {
                ctx.dump(obj[name], buf, off);
                off += ctx.size;
            });
        }, ctx.size*count) : _normalizeFieldSig(function (buf, off, obj) {
            // read value
            obj[name] = ctx.read(buff, off);
        }, Object, function (obj, buf, off) {
            // dump value
            ctx.dump(obj[name], buf, off);
        }, ctx.size);
    };
}


_.struct = function (name, fields, count) {
    return field.call({
        read: function (buf, off) {
            var obj = new Object();
            fields.forEach(function (field) {
                field(buff, off, obj);
                off += field.size;
            });
            return obj;
        },
        dump: function (val, buf, off) {
            fields.forEach(function (field) {
                field(val, off, buf);
                off += field.size;
            });
        },
        size: fields.reduce(function (sum,field) {
            return sum + field.size;
        }, 0),
    }, name, count);
};

_.byte = function (name, count) {
    return _normalizeFieldSig(function _read(buf, off, obj) {
        obj[name] = buff.slice(off, count);
    }, Object, function _dump(obj, buf, off) {
        obj[name].copy(buf, off, 0, count);
    }, count);
};

_.char = function (name, count) {
    return _normalizeFieldSig(function _read(buf, off, obj) {
        obj[name] = buff.slice(off, count).toString();
    }, Object, function _dump(obj, buf, off) {
        buf.write(obj[name], off, count);
    }, count);
};


function standardField(sig, size) {
    var read = 'read'+sig,
        dump = 'write'+sig;
    size || (size = +sig.match(/\d+/)[0] >> 3);
    return field.bind({
        read: function (buf, off) {
            return buf[read](off);
        },
        dump: function (buf, off, val) {
            buf[dump](val, off);
        },
        size: size
    })
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

/*
_.bool = field.bind({
    size: [1]
});
_.ubit = field.bind({
    size: [1]
});
_.sbit = field.bind({
    size: [1]
});

//_.padTo?
*/


module.exports = _;