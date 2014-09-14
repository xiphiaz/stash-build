var q = require('q');
var git    = require('gitty');
var repo = git('.');


var checkGit = function(){

    var deferred = q.defer();


    repo.status(function(err, status){

        deferred.notify("Checking git status");

        if (err){
            deferred.reject(err);
            return false;
        }

        if (status.staged.length > 0){
            deferred.reject("Git error: There are staged changes");
        }else if (status.unstaged.length > 0){
            deferred.reject("Git error: There are unstaged changes");
        }else{
            deferred.resolve(status);
        }

    });


    return deferred.promise;

};


var getCommit = function(){

    return checkGit().then(function(){


        var deferred = q.defer();

        repo.log(function(err, commits){

            deferred.notify("Finding latest commit");

            if (err){
                deferred.reject(err);
                return false;
            }

            if (commits.length === 0){
                deferred.reject(new Error("Could not find commits"));
                return false;
            }
            
            deferred.resolve(commits[0].commit);

        });


        return deferred.promise;

    });

};


module.exports = {
    getCommit: getCommit
};