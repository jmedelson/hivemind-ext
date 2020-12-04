var token = "";
var tuid = "";
var ebs = "";
var twitchscene = "";
var globalQuestion = ""
var globalAnswer = ""
var response = null;
var correctResponse = null;
var questionsSeen = 0;
var questionsCorrect = 0;
var channelId = '';
var submittedAnswer = false
// because who wants to type this every time?
var twitch = window.Twitch.ext;

// create the request options for our Twitch API calls
var requests = {
    set: createRequest('POST', 'cycle'),
    get: createRequest("GET", 'get'),
    submit: createRequest("POST", 'submit'),
    vote: createRequest("POST", 'vote'),
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
    channelId = auth.channelId
    twitch.rig.log("ON AUTHORIZED")
    twitch.rig.log("channel ID:", auth.channelId)
    setAuth(token);
    $.ajax(requests.get);
});

function updateBlock(res) {
    twitch.rig.log("UPDATE BLOCK", res)
    console.log("UPDATE BLOCK",res)
    let data = JSON.parse(res)
    console.log("MMM", data.message)
    if(data.id == 'data'){
        updateQuestion(data.message.question)
        updateAnswer(data.message.answer)
        updateCorrect(data.message.correct)
        sceneSelect(data.message.scene)
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
    // console.log("changing scene to: ",scene)
    if(scene == 'wait'){
        $("#wait-scene").show()
        $("#polling").hide()
        $("#agree-scene").hide()
    }
    if(scene == 'poll'){
        submittedAnswer == false
        $('#input-div').show()
        $("#submitted-div").hide()
        $("#wait-scene").hide()
        $("#polling").show()
        $("#agree-scene").hide()
    }
    if(scene == 'agree'){
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").hide()
        $("#button-row").show()
        $("#agree-scene").show()
        questionsSeen +=1 // if they had the chance to vote add 1
    }
    if(scene == 'result'){
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").show()
        $("#button-row").hide()
        $("#agree-scene").show()
        $("#score-box").text(questionsCorrect+'/'+questionsSeen+' Correct')
    }
    twitchscene = scene
    twitch.rig.log("Scene changed to: ", scene)
}
function updateQuestion(question){
    // console.log("changing question to: ",question)
    globalQuestion = question;
    $("#poll-question").text(question)
}
function updateAnswer(answer){
    globalAnswer = answer
    correctResponse = null
    response = null
    $("#agree-answer").text(answer)
    $("#result").removeClass("winner loser neutral")
}
function updateCorrect(correct){
    if(correct=="unset"){
        correctResponse = null
    }else{
        sceneSelect("result")
        correctResponse = correct
        console.log("correctResponse = ", correct)
        console.log("Response = ", response)
        let message = globalAnswer.split(":")[1]
        message = message.trim()
        let outcome
        if(correct){
            outcome = "correct!"
        }else{
            outcome = "incorrect!"
        }
        message = message + " was " + outcome
        $("#result").text(message)
        if(response==null){
            $("#result").addClass("neutral")
        }else if(response==correctResponse){
            questionsCorrect +=1
            $("#result").addClass("winner")
        }else{
            $("#result").addClass("loser")
        }
    }
    
}
function sendAnswer(){    
    if(submittedAnswer == true){
        return
    }else{
        submittedAnswer == false
    }
    let poll = $("#poll-input").val()
    $("#submitted-text").text('Submitted: '+ poll)
    poll = poll.toLowerCase();
    poll = poll.trim()
    const punctuation = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g;
    poll = poll.replace(punctuation,'')
    if(poll.length<1){
        return;
    }
    $("#input-div").fadeOut().promise().done(function(){
        $("#submitted-div").fadeIn()
    })
    let message = {
        "flag":"poll-ans",
        "payload": poll
    }
    requests.submit['data'] = JSON.stringify(message)
    $.ajax(requests.submit);
}
$(function() {
    $("#poll-submit").click(function(){
        sendAnswer()  
    });
    $("#poll-input").keypress(function(event){
        var keycode = (event.keyCode ? event.keyCode : event.which);
        console.log("KEYCODE",keycode)
        if(keycode == '13'){
            sendAnswer()  
        }
    });
    $("#btn-agree").click(function(){
        response = true;
        $("#result").text("You Agreed")
        $("#button-row").fadeOut().promise().done(function(){
            $("#result").fadeIn()
        })
        let message = {
            "flag":"vote",
            "payload": true,
            "channel": channelId,
            "question": globalQuestion,
            "answer": globalAnswer
        }
        // twitch.rig.log(message)
        // console.log(message)
        requests.vote['data'] = JSON.stringify(message)
        $.ajax(requests.vote);
    })
    $("#btn-disagree").click(function(){
        response = false;
        $("#result").text("You Disagreed")
        $("#button-row").fadeOut().promise().done(function(){
            $("#result").fadeIn()
        })
        let message = {
            "flag":"vote",
            "payload": false,
            "channel": channelId,
            "question": globalQuestion,
            "answer": globalAnswer
        }
        // twitch.rig.log(message)
        // console.log(message)
        requests.vote['data'] = JSON.stringify(message)
        $.ajax(requests.vote);
    })
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
        }else if(parsed['data']['identifier'] == 'question'){
            updateQuestion(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'answer'){
            updateAnswer(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'correct'){
            updateCorrect(parsed['data']['payload'])
        }
    });

});
