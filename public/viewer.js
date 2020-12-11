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
var lastsizex = 0;
var lastsizey = 0;
var limitEnabled = false;
var responseLimit = 0

var twitch = window.Twitch.ext;

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
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    let videoX = document.body.offsetWidth
    let videoY = document.body.offsetHeight
    if(videoX != lastsizex || videoY != lastsizey){
        lastsizex = videoX;
        lastsizey = videoY;
        let defaultX = 1280;
        let scaleX = videoX/defaultX
        let defaultY = 720;
        let scaleY = videoY/defaultY
        let propertyX = "scaleX("+ scaleX +")"
        let propertyY = "scaleY("+ scaleY +")"
        let scale = "scale(" + scaleX +", "+scaleY+ ")"
        document.getElementById("main").style.transform = scale
    }
});

twitch.onAuthorized(function(auth) {
    token = auth.token;
    tuid = auth.userId;
    channelId = auth.channelId
    setAuth(token);
    $.ajax(requests.get);
});
function updateBlock(res) {
    let data = JSON.parse(res)
    if(data.id == 'data'){
        responseLimit = data.message.limit;
        limitEnabled = data.message.displayLimit
        updateQuestion(data.message.question)
        updateAnswer(data.message.answer)
        updateCorrect(data.message.correct)
        sceneSelect(data.message.scene)
    }
}

function logError(_, error, status) {
}

function logSuccess(hex, status) {
}

function sceneSelect(scene){
    $("#scroll-bar").show()
    $("#triangle").show()
    if(scene == 'hide'){
        $("#main").hide()
    }
    if(scene == 'wait'){
        $("#main").show()
        $("#wait-scene").show()
        $("#polling").hide()
        $("#agree-scene").hide()
    }
    if(scene == 'poll'){
        $("#main").show()
        submittedAnswer = false
        $("#poll-input").val("")
        $('#input-div').show()
        $("#submitted-div").hide()
        $("#wait-scene").hide()
        $("#polling").show()
        $("#agree-scene").hide()
        $("#btn-disagree").addClass("button-animations")
        $("#btn-agree").addClass("button-animations")
        $("#btn-disagree").css("opacity","100%")
        $("#btn-agree").css("opacity","100%")
        $("#slash").show()
        correctResponse = null
        response = null
    }
    if(scene == 'agree'){
        $("#main").show()
        $("#result").removeClass("winner loser neutral")
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").hide()
        $("#button-row").show()
        $("#agree-scene").show()
        questionsSeen +=1 
        $("#btn-disagree").addClass("button-animations")
        $("#btn-agree").addClass("button-animations")
        $("#btn-disagree").css("opacity","100%")
        $("#btn-agree").css("opacity","100%")
        $("#slash").show()
    }
    if(scene == 'result'){
        $("#main").show()
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").show()
        $("#button-row").hide()
        $("#slash").hide()
        $("#agree-scene").show()
    }
    twitchscene = scene
}
function updateQuestion(question){
    globalQuestion = question;
    $("#poll-question").text(question)
}
function updateAnswer(answer){
    globalAnswer = answer
    $("#result").removeClass("winner loser neutral")
}
function updateCorrect(correct){
    if(correct=="unset"){
        correctResponse = null
    }else{
        correctResponse = correct
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
        sceneSelect("result")
    }
    
}
function sendAnswer(){    
    if(submittedAnswer == true){
        return
    }
    submittedAnswer = true
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
        "payload": poll,
        "question": globalQuestion,
        "limit": responseLimit
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
        if(keycode == '13'){
            sendAnswer()  
        }
    });
    $("#btn-agree").click(function(){
        response = true;
        $("#btn-disagree").animate({opacity:0.2},1000,function(){})
        $("#btn-disagree").removeClass("button-animations")
        $("#btn-agree").removeClass("button-animations")
        let message = {
            "flag":"vote",
            "payload": true,
            "channel": channelId,
            "question": globalQuestion,
            "answer": globalAnswer
        }
        requests.vote['data'] = JSON.stringify(message)
        $.ajax(requests.vote);
    })
    $("#btn-disagree").click(function(){
        response = false;
        $("#btn-agree").animate({opacity:0.2},1000,function(){})
        $("#btn-disagree").removeClass("button-animations")
        $("#btn-agree").removeClass("button-animations")
        let message = {
            "flag":"vote",
            "payload": false,
            "channel": channelId,
            "question": globalQuestion,
            "answer": globalAnswer
        }
        requests.vote['data'] = JSON.stringify(message)
        $.ajax(requests.vote);
    })
    twitch.listen('global', function (target, contentType, data) {
        parsed = JSON.parse(data)
        if(parsed['data']['identifier'] == 'scene'){
            sceneSelect(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'question'){
            updateQuestion(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'answer'){
            updateAnswer(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'correct'){
            updateCorrect(parsed['data']['payload'])
        }else if(parsed['data']['identifier'] == 'limit'){
            responseLimit = parsed['data']['payload']
        }else if(parsed['data']['identifier'] == 'displayLimit'){
            limitEnabled = parsed['data']['payload']
        }else if(parsed['data']['identifier'] == 'limitReached'){
            if(limitEnabled){
                if(!submittedAnswer){
                    $("#submitted-text").text("Poll Response Limit Hit")
                    $("#input-div").fadeOut().promise().done(function(){
                        $("#submitted-div").fadeIn()
                    })
                }
            }
        }
    });

});
