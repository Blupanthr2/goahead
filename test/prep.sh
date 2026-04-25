#!/bin/bash
#
#   prep.sh - TestMe setup script to start web
#
BIN=$(cd "$(dirname "${BIN}")" && pwd)/$(basename "${BIN}")

if [ "$TESTME_OS" = "windows" ] ; then
    EXE=".exe"
    echo "Running prep-test.bat"
    (cd .. ; test/utils/prep-test.bat)
else
    EXE=""
    (cd .. ; test/utils/prep-test.sh)
fi

mkdir -p cgi-bin web/tmp
cp ../certs/self.key  ../certs/self.crt .
cp ../build/bin/cgitest* cgi-bin
# cgitest links against libgoahead; its rpath is @loader_path so the lib must sit beside it
if [ -f ../build/bin/libgoahead.dylib ] ; then
    cp ../build/bin/libgoahead.dylib cgi-bin/
elif [ -f ../build/bin/libgoahead.so ] ; then
    cp ../build/bin/libgoahead.so cgi-bin/
fi
