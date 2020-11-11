var token = "";
var tuid = "";
var ebs = "";

// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'cycle'),
    get: createRequest("GET", 'get')
};

function createRequest(type, method) {

    return {
        type: type,
        url:  'https://c6qsh7k1l1.execute-api.us-east-2.amazonaws.com/default/hiveMind',
        success: updateBlock,
        error: logError
    }
}

function setAuth(token) {
    Object.keys(requests).forEach((req) => {
        twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    twitch.rig.log("CONTEXT",context);
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    twitch.rig.log("ON AUTHORIZED")
    setAuth(token);
    $.ajax(requests.get);
});

function updateBlock(res) {
    twitch.rig.log("UPDATE BLOCK", res)
    console.log("UPDATE BLOCK",res)
    let data = JSON.parse(res)
    console.log(data.id, data.message)
    if(data.id == 'scene'){
        sceneSelect(data.message)
    }
}

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function logSuccess(hex, status) {
  // we could also use the output to update the block synchronously here,
  // but we want all views to get the same broadcast response at the same time.
//   twitch.rig.log('EBS request returned '+hex+' ('+status+')');
}

function sceneSelect(scene){
    if(scene == 'wait'){
        $("#wait-scene").show()
        $("#polling").hide()
        $("#agree-scene").hide()
    }
    if(scene == 'poll'){
        $("#polling").show()
        $("#wait-scene").hide()
        $("#agree-scene").hide()
    }
    if(scene == 'agree'){
        $("#agree-scene").show()
        $("#wait-scene").hide()
        $("#polling").hide()
    }
    twitch.rig.log("Scene changed to: ", scene)
}

$(function() {

    // when we click the cycle button
    $('#cycle').click(function() {
        if(!token) { return twitch.rig.log('Not authorized'); }
        twitch.rig.log('Requesting a color cycle');
        $.ajax(requests.set);
    });

    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, data) {
        twitch.rig.log('Received broadcast twitch pubsub');
        twitch.rig.log("target",target);
        twitch.rig.log("contentType",contentType);
        twitch.rig.log("data",data);
        parsed = JSON.parse(data)
        console.log(parsed['data'])
        if(parsed['data']['identifier'] == 'scene'){
            sceneSelect(parsed['data']['payload'])
        }
    });

});
