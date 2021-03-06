var request = require('request');
var q = require('q');
var cli = require('../cli/cli');



var getJiraIssueKey = function(key){
    return key.substr(key.lastIndexOf('/')+1); //strip everything before the last /, it should be the jira key
};

var getJiraIssueCommentLink = function(atlassianDetails, issueKey, commentId){

    return atlassianDetails.jiraUrl+"/browse/"+issueKey+"?focusedCommentId="+commentId+"&page=com.atlassian.jira.plugin.system.issuetabpanels:comment-tabpanel#comment-"+commentId;
};

var atlassianRequest = function(atlassianUrl, credentials, method, url, json){

    cli.out(2, "Initialising Atlassian request".cyan);

    var deferred = q.defer();

    var config = {
        uri: atlassianUrl+url,
        method: method,
        headers: {
            'Accept': 'application/json'
        }
    };

    if (!!json){
        config.json = json;
    }

    if (credentials.allowUnsafeCertificate){
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    request(config, function (error, response) {

        if (!error && String(response.statusCode).substr(0,1) === '2') { //no error and status code starts with 2
            cli.out(2, 'Atlassian Response success'.green);
            deferred.resolve(response);
        }else{
            cli.out(2, "Atlassian Response error".red);
            cli.out(3, error, response);

            deferred.reject({error:error, response:response});
        }
    }).auth(credentials.username, credentials.password, true);

    return deferred.promise;
};

var stashRequest = function(stashDetails, method, url, json){

    return atlassianRequest(stashDetails.stashUrl, stashDetails, method, url, json);
};

var jiraRequest = function(jiraDetails, method, url, json){

    return atlassianRequest(jiraDetails.jiraUrl, jiraDetails, method, url, json);
};

var validateJiraIssueKey = function(jiraDetails, issueKey){
    return jiraRequest(jiraDetails, 'HEAD', '/rest/api/2/issue/'+issueKey);
};

var checkCredentials = function(stashDetails){
    cli.out(1, "Checking credentials with Stash".cyan);
    return stashRequest(stashDetails, 'GET', '/rest/api/1.0/users/'+stashDetails.username);
};

var postBuildStatus = function(stashDetails, buildResult, commentLink){

    var stashBuildObj = {
        state: "INPROGRESS", //INPROGRESS|SUCCESSFUL|FAILED
        key: buildResult.buildConf.key,
        name: buildResult.buildConf.name,
        url: commentLink,
        description: buildResult.buildConf.process
    };

    if (buildResult.state ==='rejected'){
        stashBuildObj.state = 'FAILED';
    }

    if (buildResult.state ==='fulfilled'){
        stashBuildObj.state = 'SUCCESSFUL';
    }

    var commitHash = buildResult.commitObj.commit.commit;

    cli.out(1, "Posting build result to stash".cyan);

    return stashRequest(stashDetails, 'POST', '/rest/build-status/1.0/commits/'+commitHash, stashBuildObj);
};


var postBuildResults = function(stashDetails, results, commentLink){ //post build to stash

    var postPromises = [];

    cli.out(0, 'Posting build results to Stash...'.cyan);

    results.forEach(function(result){
        cli.out(2, 'Added post promise'.cyan);
        postPromises.push(postBuildStatus(stashDetails, result, commentLink));

    });

    return q.allSettled(postPromises);

};

var buildLogMessage = function(buildResults, commitDetails){

    var message = "h3. Build created\n";
    message += "*Commit*: "+commitDetails.commit+"\n";
    message += "*Author*: "+commitDetails.author+"\n";
    message += "*Message*: "+commitDetails.message+"\n";

    buildResults.forEach(function(buildResult){

        message += "\th4. Build Output ("+buildResult.buildConf.name+"): \n";
        message += "\t*Result*: ";

        var output = "";
        if (buildResult.state === "rejected"){
            message += "{color:red}*Failed*{color} (x)\n";
            output = buildResult.reason;
        }else{
            message += "{color:green}*Passed*{color} (/)\n";
            output = buildResult.value;
        }

        message += "\t*Name*: "+buildResult.buildConf.name+"\n";
        message += "\t*Key*: "+buildResult.buildConf.key+"\n";
        message += "\t*Process*: "+buildResult.buildConf.process+"\n";
        message += "\t*Output*: {code}"+output+"{code}\n";
    });

    cli.out(2, "Created log message".cyan, message);

    return message;

};

var logBuildStatus = function(jiraDetails, buildResults, commitDetails){

    var jiraCommentObj = {
        body: buildLogMessage(buildResults, commitDetails.commit),
        visibility: {
            type : "role",
            value : "Developers"
        }
    };

    var jiraIssueKey;
    if (cli.program.jirakey){
        jiraIssueKey = cli.program.jirakey;
    }else{
        jiraIssueKey = commitDetails.branch;
        jiraIssueKey = getJiraIssueKey(jiraIssueKey);
    }

    cli.out(0, "Posting build log to JIRA...".cyan);
    cli.out(2, "Jira comment config".cyan, jiraCommentObj);

    return validateJiraIssueKey(jiraDetails, jiraIssueKey)
        .fail(function(err){
            cli.out(2, err);
            cli.error(new Error("Invalid JIRA issue key - "+jiraIssueKey), 1);
        })
        .then(function(){
            return jiraRequest(jiraDetails, 'POST', '/rest/api/2/issue/'+jiraIssueKey+'/comment?expand', jiraCommentObj);
        })
    ;

};

var logBuildResults = function(stashDetails, results){ //log build in jira

    var commitDetails = results[0].commitObj;

    return logBuildStatus(stashDetails, results, commitDetails);

};





module.exports = {
    checkCredentials: checkCredentials,
    postBuildStatus: postBuildStatus,
    postBuildResults: postBuildResults,
    logBuildResults: logBuildResults,
    getJiraIssueCommentLink: getJiraIssueCommentLink,
    getJiraIssueKey: getJiraIssueKey
};