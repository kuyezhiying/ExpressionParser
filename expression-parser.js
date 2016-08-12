/**
 * [Expression Parser]: to parse a input string and validate whether it is a valid expression
 * Allowed Operators in Expression: ==, ||, &&, or, and, OR, AND 
 * Besides, (+) between string and negative number (-) is allowed.
 * ==============================================================================================================================================
 * [Meaning of Status]:
 * B: Boolean            ————  includes true, false, TRUE, FALSE
 * C: Comma              ————  ,
 * F: Function           ————  function name is consisted of [a-zA-Z_], parameters can be Boolean, Number, Path, String, Variable, and Function
 * L: Left parenthesis   ————  (
 * N: Number             ————  (-)[0-9]*
 * O: Operator           ————  includes ==, ||, &&, or, and, OR, AND
 * P: Path               ————  starts with './', without parenthesises and comma
 * R: Right parenthesis  ————  )
 * V: Variable           ————  starts with '$', contains characters, letters, underlines
 * W: Whitespace         ————  \r, \t, \n, space
 * +: Positive sign      ————  occurs between digits or strings
 * -: Negative sign      ————  occurs between digits or in front of a digit
 * ==============================================================================================================================================
 * [Automata]
 * |S0|: initial state     ||E||: final state (when come across unexpected characters or at the end of inputs)     Others: accepted states
 * 
 *                   [false|FALSE|true|TRUE]
 * |S0|------------------------------------------> |B| ------------------------> |C|,|O|,|R|
 *           |                                         |else--------------------------------------------------------------、
 *           |                 ,                                                                                          |
 *           |-----------------------------------> |C| ------------------------> |B|,|F|,|L|,|N|,|P|,|S|,|V|,|-|          |
 *           |                                         |else--------------------------------------------------------------|
 *           |             [_a-zA-Z]                                                                                      |
 *           |-----------------------------------> |F| (CALL=1)----------------> |L|                                      |
 *           |                                         |else--------------------------------------------------------------|
 *           |                                                                                                            |
 *           |                 (                             ·---if(CALL==0)---> |B|,|F|,|L|,|N|,|S|,|-|                  |
 *           |-----------------------------------> |L| ------|                                                            |
 *           |                                         |     ·---if(CALL==1)---> |B|,|F|,|L|,|N|,|P|,|R|,|S|,|V|,|-|      |
 *           |                                         |else--------------------------------------------------------------|
 *           |               [0-9]                                                                                        |
 *           |-----------------------------------> |N| ------------------------> |C|,|O|,|R|                              |
 *           |                                         |else--------------------------------------------------------------|
 *           |  [==,||,&&, and , or , AND , OR ]                                                                          |
 *           |-----------------------------------> |O| ------------------------> |B|,|F|,|L|,|N|,|S|,|+|,|-|              |
 *           |                                         |else--------------------------------------------------------------|
 *           |                 ./                                                                                         |
 *           |-----------------------------------> |P| ------------------------> |C|,|R|                                  |
 *           |                                         |else--------------------------------------------------------------|
 *           |                 )                                                                                          |
 *           |-----------------------------------> |R| ------------------------> |C|,|F|,|L|,|O|,|R|,|+|,|-|              |
 *           |                                         |else--------------------------------------------------------------|
 *           |              /^'.*'$/                                                                                      |
 *           |-----------------------------------> |S| ------------------------> |C|,|O|,|R|,|+|                          |
 *           |                                         |else--------------------------------------------------------------|
 *           |                 $                                                                                          |
 *           |-----------------------------------> |V| ------------------------> |C|,|R|                                  |
 *           |                                         |else--------------------------------------------------------------|
 *           |                [ ]                                                                                         | 
 *           |-----------------------------------> |W| ------------------------> |S0|                                     |
 *           |                                                                                                            |
 *           |                 +                                                                                          |
 *           |-----------------------------------> |+| ------------------------> |N|,|L|,|S|,|-|                          |
 *           |                                         |else--------------------------------------------------------------|
 *           |                 -                                                                                          |
 *           |-----------------------------------> |-| ------------------------> |N|,|-|                                  |
 *           |                                         |else--------------------------------------------------------------|
 *           |                else                                                                                        |
 *           ·----------------------------------->||E||<------------------------------------------------------------------'
 *
 * ==============================================================================================================================================
 * Atuthor: Chao Huang (t-chhu@microsoft.com)
 * Date: 2016-07-28
 * ==============================================================================================================================================
 */

var Parser = function () {
    var TBOOL = 0;
    var TPATH = 1;
    var TNUMBER = 2;
    var TSTRING = 3;
    var TVARIABLE = 4;
    var TFUNCTION = 5;

    function Token(type_, index_, prio_, value_) {
        this.type_ = type_;
        this.index_ = index_ || 0;
        this.prio_ = prio_ || 0;
        this.value_ = (value_ !== undefined && value_ !== null) ? value_ : 0;
        this.toString = function () {
            switch (this.type_) {
                case TNUMBER:
                    return this.value_;
                case TBOOL:
                case TSTRING:
                case TVARIABLE:
                    return this.index_;
                case TFUNCTION:
                    return "FUNCTION";
                default:
                    return "Invalid Token";
            }
        };
    }

    function Parser() {
        this.success = false;
        this.errormsg = "";
        this.expression = "";

        this.pos = 0;

        this.tokenfunction = '';
        this.tokenvariable = '';
        this.tokenstring = '';
        this.tokennumber = 0;
        this.tokenprior = 0;
        this.tokenindex = 0;
        this.tokenpath = '';
        this.tokenbool = false;
        this.tmpprior = 0;
    }

    Parser.isValidExpression = function (expr) {
        return new Parser().isValidExpression(expr);
    };

    var OPERATOR = 1 << 0;
    var VARIABLE = 1 << 1;
    var FUNCTION = 1 << 2;
    var FUNCALL = 1 << 3;
    var NUMBER = 1 << 4;
    var STRING = 1 << 5;
    var LPAREN = 1 << 6;
    var RPAREN = 1 << 7;
    var COMMA = 1 << 8;
    var SIGN = 1 << 9;
    var BOOL = 1 << 10;
    var PATH = 1 << 11;

    Parser.prototype = {
        isValidExpression: function (expr) {
            this.errormsg = "";
            this.success = true;
            var operstack = [];
            var tokenstack = [];
            this.tmpprior = 0;
            var expected = (FUNCTION | NUMBER | STRING | LPAREN | SIGN | BOOL | VARIABLE);
            var operatorsnum = 0;
            this.expression = expr;
            this.pos = 0;

            while (this.pos < this.expression.length) {
                if (this.isOperator()) {
                    if ((expected & OPERATOR) === 0) {
                        this.error_parsing(this.pos, "unexpected operator");
                    }
                    operatorsnum += 2;
                    expected = (FUNCTION | NUMBER | STRING | LPAREN | SIGN | BOOL);
                }
                else if (this.isSign()) {
                    if ((expected & SIGN) === 0) {
                        this.error_parsing(this.pos, "unexpected sign")
                    }
                    if (this.isNegativeSign()) {
                        this.tokenprior = 2;
                        this.tokenindex = "-";
                        operatorsnum++;
                        expected = (NUMBER | LPAREN);
                    }
                    else { //PositiveSign
                        this.tokenprior = 1;
                        this.tokenindex = "+";
                        operatorsnum += 2;
                        expected = (NUMBER | STRING | LPAREN | SIGN);
                    }
                }
                else if (this.isNumber()) {
                    if ((expected & NUMBER) === 0) {
                        this.error_parsing(this.pos, "unexpected number");
                    }
                    var token = new Token(TNUMBER, 0, 0, this.tokennumber);
                    tokenstack.push(token);
                    expected = (OPERATOR | RPAREN | COMMA);
                }
                else if (this.isString()) {
                    if ((expected & STRING) === 0) {
                        this.error_parsing(this.pos, "unexpected string");
                    }
                    var token = new Token(TSTRING, 0, 0, this.tokenstring);
                    tokenstack.push(token);
                    expected = (OPERATOR | RPAREN | SIGN | COMMA);
                }
                else if (this.isBoolean()) {
                    if ((expected & BOOL) === 0) {
                        this.error_parsing(this.pos, "unexpected boolean");
                    }
                    var token = new Token(TBOOL, 0, 0, this.tokenbool);
                    tokenstack.push(token);
                    expected = (OPERATOR | RPAREN | COMMA);
                }
                else if (this.isFunction()) {
                    if ((expected & FUNCTION) === 0) {
                        this.error_parsing(this.pos, "unexpected function");
                    }
                    var token = new Token(TFUNCTION, 0, 0, this.tokenfunction);
                    tokenstack.push(token);
                    expected = (LPAREN | FUNCALL);
                }
                else if (this.isLeftParenth()) {
                    if ((expected & LPAREN) === 0) {
                        this.error_parsing(this.pos, "unexpected \"(\"");
                    }
                    if (expected & FUNCALL) {
                        expected = (NUMBER | STRING | LPAREN | RPAREN | FUNCTION | SIGN | BOOL | VARIABLE | PATH);
                    }
                    else {
                        expected = (NUMBER | STRING | LPAREN | FUNCTION | SIGN | BOOL);
                    }
                }
                else if (this.isRightParenth()) {
                    if ((expected & RPAREN) === 0) {
                        this.error_parsing(this.pos, "unexpected \")\"");
                    }
                    expected = (OPERATOR | LPAREN | RPAREN | COMMA | FUNCALL | SIGN);
                }
                else if (this.isComma()) {
                    if ((expected & COMMA) === 0) {
                        this.error_parsing(this.pos, "unexpected \",\"");
                    }
                    expected = (NUMBER | STRING | LPAREN | FUNCTION | SIGN | BOOL | VARIABLE | PATH);
                }
                else if (this.isVar()) {
                    if ((expected & VARIABLE) === 0) {
                        this.error_parsing(this.pos, "unexpected variable");
                    }
                    var vartoken = new Token(TVARIABLE, this.tokenindex, 0, 0);
                    tokenstack.push(vartoken);
                    expected = (COMMA | RPAREN);
                }
                else if (this.isPath()) {
                    if ((expected & PATH) === 0) {
                        this.error_parsing(this.pos, "unexpected variable");
                    }
                    var vartoken = new Token(TPATH, this.tokenindex, 0, 0);
                    tokenstack.push(vartoken);
                    expected = (COMMA | RPAREN);
                }
                else if (this.isWhite()) {
                }
                else {
                    if (this.errormsg === "") {
                        this.error_parsing(this.pos, "unknown character");
                    }
                    else {
                        this.error_parsing(this.pos, this.errormsg);
                    }
                    break;
                }
            }
            if (this.tmpprior < 0 || this.tmpprior >= 10) {
                this.error_parsing(this.pos, "unmatched \"()\".");
            }
            if (this.errormsg) {
                return false;
            }
            else {
                return true;
            }
        },

        error_parsing: function (column, msg) {
            this.success = false;
            this.errormsg = "parse error at [column " + (column) + "]: " + msg;
        },

        isOperator: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 43) { // [+]
                this.pos++;
                this.tokenprior = 0;
                this.tokenindex = "+";
            }
            else if (code === 61) { // [=]
                if (this.expression.charCodeAt(this.pos + 1) === 61) {
                    this.pos += 2;
                    this.tokenprior = 0;
                    this.tokenindex = "==";
                }
                else {
                    return false;
                }
            }
            else if (code === 124) { // [|]
                if (this.expression.charCodeAt(this.pos + 1) === 124) {
                    this.pos += 2;
                    this.tokenprior = 0;
                    this.tokenindex = "||";
                }
                else {
                    return false;
                }
            }
            else if (code === 38) { // [&]
                if (this.expression.charCodeAt(this.pos + 1) === 38) {
                    this.pos += 2;
                    this.tokenprior = 0;
                    this.tokenindex = "&&";
                }
                else {
                    return false;
                }
            }
            else if (code === 32) { // [ ]
                if (this.pos + 4 < this.expression.length &&
                    this.expression.substring(this.pos, this.pos + 4) === ' or ') {
                    this.pos += 4;
                    this.tokenprior = 0;
                    this.tokenindex = "or";
                }
                else if (this.pos + 4 < this.expression.length &&
                    this.expression.substring(this.pos, this.pos + 4) === ' OR ') {
                    this.pos += 4;
                    this.tokenprior = 0;
                    this.tokenindex = "OR";
                }
                else if (this.pos + 5 < this.expression.length &&
                    this.expression.substring(this.pos, this.pos + 5) === ' and ') {
                    this.pos += 5;
                    this.tokenprior = 0;
                    this.tokenindex = "and";
                }
                else if (this.pos + 5 < this.expression.length &&
                    this.expression.substring(this.pos, this.pos + 5) === ' AND ') {
                    this.pos += 5;
                    this.tokenprior = 0;
                    this.tokenindex = "AND";
                }
                else {
                    return false;
                }
            }
            else {
                return false;
            }
            return true;
        },

        isNumber: function () {
            var r = false;
            var str = "";
            while (this.pos < this.expression.length) {
                var code = this.expression.charCodeAt(this.pos);
                if (code >= 48 && code <= 57) { // [0-9]
                    str += this.expression.charAt(this.pos);
                    this.pos++;
                    this.tokennumber = parseInt(str);
                    r = true;
                }
                else {
                    break;
                }
            }
            return r;
        },

        unescape: function (str, pos) {
            var buffer = [];
            var escaping = false;
            for (var i = 0; i < str.length; i++) {
                var c = str.charAt(i);
                if (escaping) {
                    switch (c) {
                        case "'":
                            buffer.push("'");
                            break;
                        case '\\':
                            buffer.push('\\');
                            break;
                        case '/':
                            buffer.push('/');
                            break;
                        case 'b':
                            buffer.push('\b');
                            break;
                        case 'f':
                            buffer.push('\f');
                            break;
                        case 'n':
                            buffer.push('\n');
                            break;
                        case 'r':
                            buffer.push('\r');
                            break;
                        case 't':
                            buffer.push('\t');
                            break;
                        case 'u':
                            // interpret the following 4 characters as the hex of the unicode code point
                            var codePoint = parseInt(str.substring(i + 1, i + 5), 16);
                            buffer.push(String.fromCharCode(codePoint));
                            i += 4;
                            break;
                        default:
                            throw this.error_parsing(pos + i, "Illegal escape sequence: '\\" + c + "'");
                    }
                    escaping = false;
                }
                else {
                    if (c == '\\') {
                        escaping = true;
                    }
                    else {
                        buffer.push(c);
                    }
                }
            }
            return buffer.join('');
        },

        isString: function () {
            var r = false;
            var str = "";
            var startpos = this.pos;
            if (this.pos < this.expression.length && this.expression.charAt(this.pos) == "'") {
                this.pos++;
                while (this.pos < this.expression.length) {
                    var code = this.expression.charAt(this.pos);
                    if (code != "'" || str.slice(-1) == "\\") {
                        str += this.expression.charAt(this.pos);
                        this.pos++;
                    }
                    else {
                        this.pos++;
                        this.tokenstring= this.unescape(str, startpos);
                        r = true;
                        break;
                    }
                }
            }
            return r;
        },

        isBoolean: function () {
            var r = false;
            var code = this.expression.charCodeAt(this.pos);
            if (code === 84 && this.pos + 4 < this.expression.length &&
                this.expression.substring(this.pos, this.pos + 4) === 'TRUE') {
                this.pos += 4;
                this.tokenbool = "TRUE";
                r = true;
            }
            else if (code === 116 && this.pos + 4 < this.expression.length &&
                this.expression.substring(this.pos, this.pos + 4) === 'true') {
                this.pos += 4;
                this.tokenbool = "true";
                r = true;
            }
            else if (code === 70 && this.pos + 5 < this.expression.length &&
                this.expression.substring(this.pos, this.pos + 5) === 'FALSE') {
                this.pos += 5;
                this.toketokenboolnindex = "FALSE";
                r = true;
            }
            else if (code === 102 && this.pos + 5 < this.expression.length &&
                this.expression.substring(this.pos, this.pos + 5) === 'false') {
                this.pos += 5;
                this.tokenbool = "false";
                r = true;
            }
            return r;
        },

        isFunction: function () {
            var str = "";
            while (this.pos < this.expression.length) {
                var code = this.expression.charCodeAt(this.pos);
                if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
                    (code >= 48 && code <= 57) || code === 95) { // [a-zA-Z0-9_]
                    str += this.expression.charAt(this.pos);
                    this.pos++;
                }
                else {
                    break;
                }
            }
            if (str.length > 0 && str.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                this.tokenfunction = str;
                return true;
            }
            else {
                return false;
            }
        },

        isVar: function () {
            var str = "";
            var code = this.expression.charCodeAt(this.pos);
            if (code === 36) { // [$]
                this.pos++;
                str += '$';
                while (this.pos < this.expression.length) {
                    code = this.expression.charCodeAt(this.pos);
                    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
                        str += this.expression.charAt(this.pos);
                        this.pos++;
                    }
                    else {
                        break;
                    }
                }
            }
            if (str.length > 1) {
                this.tokenvariable = str;
                return true;
            }
            return false;
        },

        isPath: function () {
            var str = "";
            var code = this.expression.charCodeAt(this.pos);
            if (code === 46) { // [.]
                this.pos++;
                str += '.';
                if (this.expression.charCodeAt(this.pos) === 47) { // [/]
                    this.pos++;
                    str += '/';
                    while (this.pos < this.expression.length) {
                        code = this.expression.charCodeAt(this.pos);
                        if (code != 40 && code != 41 && code != 44) { // [(),]
                            str += this.expression.charAt(this.pos);
                            this.pos++;
                        }
                        else {
                            break;
                        }
                    }
                }
            }
            if (str.length > 1 && str.match(/^\.(\/[^/()]+)+$/)) {
                this.tokenpath = str;
                return true;
            }
            return false;
        },

        isSign: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 45 || code === 43) { // -
                this.pos++;
                return true;
            }
            return false;
        },

        isPositiveSign: function () {
            var code = this.expression.charCodeAt(this.pos - 1);
            if (code === 43) { // [+]
                return true;
            }
            return false;
        },

        isNegativeSign: function () {
            var code = this.expression.charCodeAt(this.pos - 1);
            if (code === 45) { // [-]
                return true;
            }
            return false;
        },

        isLeftParenth: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 40) { // [(]
                this.pos++;
                this.tmpprior += 10;
                return true;
            }
            return false;
        },

        isRightParenth: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 41) { // [)]
                this.pos++;
                this.tmpprior -= 10;
                return true;
            }
            return false;
        },

        isComma: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 44) { // [,]
                this.pos++;
                this.tokenprio = -1;
                this.tokenindex = ",";
                return true;
            }
            return false;
        },

        isWhite: function () {
            var code = this.expression.charCodeAt(this.pos);
            if (code === 32 || code === 9 || code === 10 || code === 13) {
                this.pos++;
                return true;
            }
            return false;
        }

    };

    return Parser;

}();
