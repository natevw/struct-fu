// NOTE: this is to workaround https://github.com/tessel/beta/issues/427

function _fixString(str) {
    // Tessel strings are modern UTF-8 buffers, convert to oldschool UTF-16 codes…
    if (str._fixed) return str;
    var arr = [],
        codepoint, bytesLeft;
    for (var i = 0, len = str.length; i < len; ++i) {
        // NOTE: type check is so we can unit test with Arrays/Buffers instead
        var c = (typeof str === 'string') ? str.charCodeAt(i) : str[i];
        
        var bitsRight = 0;
        while (c & (0x80 >>> bitsRight)) ++bitsRight;
        if (bitsRight !== 1) {
            codepoint = 0;
            bytesLeft = bitsRight || 1;
        } else if (!bytesLeft) console.warn("Bad UTF-8 sequence at", i, "in", JSON.stringify(str), '0x'+c.toString(16), Error().stack);
        c &= ~(0xFF80 >>> bitsRight);
        codepoint = (codepoint << 6) | c;
        --bytesLeft;
        if (!bytesLeft) {
            if (codepoint < 0x010000) arr.push(codepoint);
            else {
                codepoint -= 0x010000;
                arr.push(0xD800 + (codepoint >>> 10));
                arr.push(0xDC00 + (codepoint & 0x03FF));
            }
        }
    }
    arr._fixed = true;
    arr.charCodeAt = function (i) { return arr[i]; }
    return arr;
}

exports.fixString = _fixString;
