// NOTE: was a workaround for https://github.com/tessel/beta/issues/358
//       …and now worksaround https://github.com/tessel/beta/issues/426

var workaroundTessel426 = ("\ud83c\udf91".length !== 2),
    fixString = require("./8to16.js").fixString;

Buffer.prototype.write = function (str, off, len, enc) {
    var buf = this;
    if (typeof off === 'string') {
        enc = off;
        off = void 0;
    } else if (typeof len === 'string') {
        enc = len;
        len = void 0;
    }
    off || (off = 0);
    var _maxLen = buf.length - off;
    len = (typeof len === 'number') ? Math.min(len, _maxLen) : _maxLen;
    enc || (enc = 'utf8');
    
    if (workaroundTessel426) str = fixString(str);
    
    var b = off,
        s = 0, sl = str.length; 
    if (enc === 'ascii') while (b < len && s < sl) buf[b++] = (str.charCodeAt(s++) & 0xFF) || 0x20;
    else if (enc === 'utf8') while (b < len && s < sl) {
        // [OLD INACCURATE] NOTE: node.js follows CESU-8 (and splits surrogate pairs) rather than UTF-8 proper
        var c = str.charCodeAt(s);
        if (c < 0x80) {
            buf[b++] = c;
        } else if (c < 0x800) {
            if (b+1 < len) {
                buf[b++] = 0xc0 | (c >>> 6);
                buf[b++] = 0x80 | (c & 0x3F);
            } else break;
        } else if (c < 0x10000) {
            if (b+2 < len) {
                buf[b++] = 0xe0 | (c >>> 12);
                buf[b++] = 0x80 | ((c >>> 6) & 0x3F);
                buf[b++] = 0x80 | (c & 0x3F);
            } else break;
        } else if (c < 0x110000) {            // NOTE: this one is only used by `toString` workaround…
            if (b+3 < len) {
                buf[b++] = 0xf0 | (c >>> 18);
                buf[b++] = 0x80 | ((c >>> 12) & 0x3F);
                buf[b++] = 0x80 | ((c >>> 6) & 0x3F);
                buf[b++] = 0x80 | (c & 0x3F);
            } else break;
        } else throw Error(["IT BROKT",c.toString(16), JSON.stringify(str), s].join(' '));
        s += 1;
    } else if (enc === 'utf16le' || enc === 'ucs2') while (b+1 < len && s < sl) {
        // NOTE: node.js does split surrogate pairs
        buf.writeUInt16LE(str.charCodeAt(s++), b);
        b += 2;
    }
    Buffer._charsWritten = s;
    return b - off;
};

var _toString = Buffer.prototype.toString;
if (1 || workaroundTessel426) Buffer.prototype.toString = function (enc) {
    if (enc === 'utf16le' || enc === 'ucs2') {
        var buf = this, arr = [], tmp;
        for (var i = 0, len = buf.length >>> 1; i < len; ++i) {
            var unichar = buf.readUInt16LE(i << 1);
            if (0xD800 <= unichar && unichar < 0xE000) {
                if (unichar < 0xDC00) tmp = unichar - 0xD800;
                else arr.push(0x010000 + (tmp << 10) + (unichar - 0xDC00));
            } else arr.push(unichar);
        }
        buf = Buffer(buf.length << 1);
        tmp = buf.write({
            _fixed: true,
            length: arr.length,
            charCodeAt: function (i) { return arr[i]; }
        });
        return buf.slice(0, tmp).toString();
    } else return _toString.apply(this, arguments);
};
