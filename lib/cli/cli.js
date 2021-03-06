
var program = require('commander');
var pjson = require('../../package.json');

var error = function(err, fatal){
    fatal = !!fatal;
    console.log(err.message.red);
    if (program.verbose > 0){
        console.log(err.stack);
    }
    if (fatal){
        process.exit(err.code);
    }
    return true;
};

var out = function(){

    var args = Array.prototype.slice.call(arguments, 0);

    var verbosity = args[0];
    var consoleArgs = args.slice(1);
    var verboseSetting = program.verbose || 0;

    if (verboseSetting >= verbosity){
        console.log.apply(console, consoleArgs);
    }

    return true;
};

var increaseVerbosity = function (v, total) {
    return total + 1;
};

program
    .version(pjson.version)
    .option('-v, --verbose', 'A value that can be increased', increaseVerbosity, 0)
    .option('-f, --force', 'Force stash build, don\'t check git status')
    .option('-k, --jirakey [key]', 'Specify Jira Task key to post comments to')
    .parse(process.argv);


module.exports = {
    program: program,
    error: error,
    out : out
};