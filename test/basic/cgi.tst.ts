/*
    cgi.tst - CGI tests
 */

import { Http, Config, Path } from 'ejscript'
import { tget, thas, tskip, ttrue } from 'testme'

const HTTP = tget('TM_HTTP') || "127.0.0.1:8080"
let http: Http = new Http

if (thas('ME_GOAHEAD_CGI')) {
    /* Suport routines */

    function contains(pat: string): void {
        ttrue(http.response.contains(pat))
    }

    function keyword(pat: string): string {
        pat.replace(/\//, "\\/").replace(/\[/, "\\[")
        let reg = RegExp(".*" + pat + "=([^<]*).*", "s")
        return http.response.replace(reg, "$1")
    }

    function match(key: string, value: string): void {
        if (keyword(key) != value) {
            console.log(http.response)
            console.log("\nKey \"" + key + "\"")
            console.log("Expected: " + value)
            // console.log("Actual  : " + keyword(value))
        }
        ttrue(keyword(key) == value)
    }


    /* Tests */

    async function forms() {
        //  Test various forms to invoke cgi programs
        http.get(HTTP + "/cgi-bin/cgitest")
        await http.wait()
        ttrue(http.status == 200)
        contains("cgitest: Output")
        http.close()

        if (Config.OS == "windows") {
            http.get(HTTP + "/cgi-bin/cgitest.exe")
            await http.wait()
            ttrue(http.status == 200)
            contains("cgitest: Output")
            http.close()
        }
    }

    async function extraPath() {
        http.get(HTTP + "/cgi-bin/cgitest")
        await http.wait()
        ttrue(http.status == 200)
        match("PATH_INFO", "")
        match("PATH_TRANSLATED", "")
        http.close()

        http.get(HTTP + "/cgi-bin/cgitest/extra/path")
        await http.wait()
        match("PATH_INFO", "/extra/path")
        let scriptFilename = keyword("SCRIPT_FILENAME")
        let path = new Path(scriptFilename).dirname.join("extra/path")
        let translated = new Path(keyword("PATH_TRANSLATED"))
        //  Compare path strings with separators normalized. On Windows, goahead emits PATH_TRANSLATED
        //  with mixed separators (getcwd is "\\" but the URL-derived suffix is "/"); Path.dirname.join
        //  normalizes to "\\". Collapse both to "/" so the comparison tests logical equality.
        ttrue(path.toString().replace(/\\/g, "/") == translated.toString().replace(/\\/g, "/"))
        http.close()
    }

    async function query() {
        http.get(HTTP + "/cgi-bin/cgitest/extra/path?a=b&c=d&e=f")
        await http.wait()
        match("SCRIPT_NAME", "/cgi-bin/cgitest")
        match("PATH_INFO", "/extra/path")
        contains("QVAR a=b")
        contains("QVAR c=d")
        http.close()

        http.get(HTTP + "/cgi-bin/cgitest?a+b+c")
        await http.wait()
        match("QUERY_STRING", "a+b+c")
        contains("QVAR a b c")
        http.close()

        //
        //  Query string vars should not be turned into variables for GETs
        //  Extra path only supported for cgi programs with extensions.
        //
        http.get(HTTP + "/cgi-bin/cgitest/extra/path?var1=a+a&var2=b%20b&var3=c")
        await http.wait()
        match("SCRIPT_NAME", "/cgi-bin/cgitest")
        match("QUERY_STRING", "var1=a+a&var2=b%20b&var3=c")
        match("QVAR var1", "a a")
        match("QVAR var2", "b b")
        match("QVAR var3", "c")
        http.close()

        //
        //  Post data should be turned into variables
        //
        http.form(HTTP + "/cgi-bin/cgitest/extra/path?var1=a+a&var2=b%20b&var3=c",
            { name: "Peter", address: "777 Mulberry Lane" })
        await http.wait()
        match("QUERY_STRING", "var1=a+a&var2=b%20b&var3=c")
        match("QVAR var1", "a a")
        match("QVAR var2", "b b")
        match("QVAR var3", "c")
        match("PVAR name", "Peter")
        match("PVAR address", "777 Mulberry Lane")
        http.close()
    }

    async function encoding() {
        //  Modern HTTP clients (curl, Bun) pre-normalize URL dot-segments before transmit,
        //  so "/extra long/a/../path/a/.." arrives at the server as "/extra long/path/"
        //  with a trailing slash. Expectations below reflect what actually reaches the server.
        http.get(HTTP + "/cgi-bin/cgitest/extra%20long/a/../path/a/..?var%201=value%201")
        await http.wait()
        match("QUERY_STRING", "var%201=value%201")
        match("SCRIPT_NAME", "/cgi-bin/cgitest")
        match("QVAR var 1", "value 1")
        match("PATH_INFO", "/extra long/path/")

        let scriptFilename = keyword("SCRIPT_FILENAME")
        let path = new Path(scriptFilename).dirname.join("extra long/path/")
        let translated = new Path(keyword("PATH_TRANSLATED"))
        //  Normalize separators for cross-platform comparison; see extraPath() for rationale.
        ttrue(path.toString().replace(/\\/g, "/") == translated.toString().replace(/\\/g, "/"))
        http.close()
    }

    async function status() {
        let http = new Http
        http.setHeader("SWITCHES", "-s%20711")
        http.get(HTTP + "/cgi-bin/cgitest?pat=111")
        await http.wait()
        ttrue(http.status == 711)
        http.close()
    }

    async function location() {
        let http = new Http
        http.setHeader("SWITCHES", "-l%20/index.html")
        http.followRedirects = false
        http.get(HTTP + "/cgi-bin/cgitest")
        await http.wait()
        ttrue(http.status == 302)
        http.close()
    }

    async function quoting() {
        http.get(HTTP + "/cgi-bin/cgitest?a+b+c")
        await http.wait()
        match("QUERY_STRING", "a+b+c")
        match("QVAR a b c", "")
        http.close()

        http.get(HTTP + "/cgi-bin/cgitest?a=1&b=2&c=3")
        await http.wait()
        match("QUERY_STRING", "a=1&b=2&c=3")
        match("QVAR a", "1")
        match("QVAR b", "2")
        match("QVAR c", "3")
        http.close()

        http.get(HTTP + "/cgi-bin/cgitest?a%20a=1%201+b%20b=2%202")
        await http.wait()
        match("QUERY_STRING", "a%20a=1%201+b%20b=2%202")
        match("QVAR a a", "1 1 b b=2 2")
        http.close()

        http.get(HTTP + "/cgi-bin/cgitest?a%20a=1%201&b%20b=2%202")
        await http.wait()
        match("QUERY_STRING", "a%20a=1%201&b%20b=2%202")
        match("QVAR a a", "1 1")
        match("QVAR b b", "2 2")
        http.close()
    }

    async function post() {
        //  Simple post
        http.post(HTTP + '/cgi-bin/cgitest', 'Some data')
        await http.wait()
        ttrue(http.status == 200)
        match('CONTENT_LENGTH', '9')
        http.close()

        //  Simple form
        http.form(HTTP + '/cgi-bin/cgitest', {name: 'John', address: '700 Park Ave'})
        await http.wait()
        ttrue(http.status == 200)
        match('PVAR name', 'John')
        match('PVAR address', '700 Park Ave')
        http.close()
    }

    /*
        Test httpoxy mitigation (CVE-2016-5385 family) and restored blacklist behaviour.

        The cgitest program prints every env variable in the "All Defined Environment
        Variables" section as <P>NAME=VALUE</P>. We assert absence by checking that the
        literal string "HTTP_PROXY=" does not appear anywhere in the response body.

        Server-side PATH/IFS/BASH_ENV/LD_PRELOAD filtering is exercised via the
        /blacklist-test route registered in src/test.c — see blacklistHandler(),
        which calls websSetVar() for each name then forwards to /cgi-bin/cgitest.

        CRLF injection in the Proxy header value is out of scope: the underlying HTTP
        client normalises or rejects embedded CRLF before the bytes reach the server.
     */
    async function httpoxyAndBlacklist() {
        let h: Http

        //  Proxy header with a value must not produce HTTP_PROXY in the CGI env
        h = new Http
        h.setHeader("Proxy", "http://attacker.example:1337")
        h.get(HTTP + "/cgi-bin/cgitest")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(!h.response.contains("HTTP_PROXY="))
        h.close()

        //  Proxy header with empty value must not produce HTTP_PROXY in the CGI env
        h = new Http
        h.setHeader("Proxy", "")
        h.get(HTTP + "/cgi-bin/cgitest")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(!h.response.contains("HTTP_PROXY="))
        h.close()

        //  Proxy header with a long value must not produce HTTP_PROXY in the CGI env
        //  Use 200 chars — enough to exercise the path without hitting server header limits.
        h = new Http
        h.setHeader("Proxy", "http://attacker.example:1337/" + "A".repeat(200))
        h.get(HTTP + "/cgi-bin/cgitest")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(!h.response.contains("HTTP_PROXY="))
        h.close()

        //  Legitimate HTTP_USER_AGENT must still propagate to the CGI env
        h = new Http
        h.setHeader("User-Agent", "gomock/1.0")
        h.get(HTTP + "/cgi-bin/cgitest")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(h.response.contains("HTTP_USER_AGENT=gomock/1.0"))
        h.close()

        //  Legitimate HTTP_ACCEPT must still propagate to the CGI env
        h = new Http
        h.setHeader("Accept", "text/html")
        h.get(HTTP + "/cgi-bin/cgitest")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(h.response.contains("HTTP_ACCEPT=text/html"))
        h.close()

        //  Query-string vars must be prefixed with CGI_ (ME_GOAHEAD_CGI_VAR_PREFIX) in the CGI env.
        //  POST body data is delivered via stdin and parsed by the CGI program itself, so it does
        //  not appear in the env — only query-string keys go through addFormVars(arg=1).
        h = new Http
        h.get(HTTP + "/cgi-bin/cgitest?name=joe")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(h.response.contains("CGI_name=joe"))
        h.close()

        //  Server-side blacklist: the /blacklist-test handler in src/test.c sets PATH, IFS,
        //  BASH_ENV, LD_PRELOAD, and a non-blacklisted BLACKLIST_SENTINEL via websSetVar(),
        //  then forwards to /cgi-bin/cgitest. The CGI env build must drop the blacklisted
        //  names while the sentinel propagates — proving inBlackList() runs end-to-end.
        h = new Http
        h.get(HTTP + "/blacklist-test/anything")
        await h.wait()
        ttrue(h.status == 200)
        ttrue(!h.response.contains("PATH=/evil:/bin"))
        ttrue(!h.response.contains("IFS=X"))
        ttrue(!h.response.contains("BASH_ENV=/tmp/evil"))
        ttrue(!h.response.contains("LD_PRELOAD=/tmp/evil.so"))
        ttrue(h.response.contains("BLACKLIST_SENTINEL=ok"))
        h.close()
    }

    await forms()
    await extraPath()
    await query()
    await encoding()
    await status()
    await location()
    await quoting()
    await post()
    await httpoxyAndBlacklist()

} else {
    tskip("CGI not enabled")
}
