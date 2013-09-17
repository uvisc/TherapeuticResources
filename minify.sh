#!/bin/sh

echo "minifying client js..."
uglify components/jquery/jquery.min.js components/underscore/underscore-min.js components/backbone/backbone-min.js components/markdown/lib/markdown.js components/joboo/js/common.js -o components/joboo/js/client.min.js

echo "minifying admin js..."
uglify components/jquery/jquery.min.js components/underscore/underscore-min.js components/backbone/backbone-min.js components/markdown/lib/markdown.js components/joboo/js/common.js components/joboo/js/admin.js -o components/joboo/js/admin.min.js

echo "done."