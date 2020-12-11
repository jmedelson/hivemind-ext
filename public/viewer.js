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
        // twitch.rig.log('Setting auth headers');
        requests[req].headers = { 'Authorization': 'Bearer ' + token }
    });
}

twitch.onContext(function(context) {
    // twitch.rig.log("CONTEXT",context);
    // let displayResolution = context['displayResolution'].split("x")
    // let videoX = parseInt(displayResolution[0])
    // let videoY = parseInt(displayResolution[1])
    let videoX = document.body.offsetWidth
    let videoY = document.body.offsetHeight
    if(videoX != lastsizex || videoY != lastsizey){
        lastsizex = videoX;
        lastsizey = videoY;
        let defaultX = 1280;
        let scaleX = videoX/defaultX
        let defaultY = 720;
        let scaleY = videoY/defaultY
        // console.log("ScaleX:", scaleX)
        let propertyX = "scaleX("+ scaleX +")"
        let propertyY = "scaleY("+ scaleY +")"
        let scale = "scale(" + scaleX +", "+scaleY+ ")"
        document.getElementById("main").style.transform = scale
    }
    // let videoY = parseInt(displayResolution[1])
    // let scaleX = videoX/defaultX
    // console.log("ScaleX:", scaleX)
    // let propertyX = "scale("+ scaleX +")"
    // $("#main").css("transform", "propertyX")
    // console.log("propertyX:", propertyX)

    // let scaleY = videoY/defaultY
    // console.log("ScaleY:", scaleY)
    // let propertyY = "scale("+ scaleY +")"
    // $("#main").css({"transform": "propertyY"})
    // document.getElementById("main").style.transform = propertyX
    // console.log("propertyY:", propertyY)
});

twitch.onAuthorized(function(auth) {
    // save our credentials
    token = auth.token;
    tuid = auth.userId;
    channelId = auth.channelId
    // twitch.rig.log("ON AUTHORIZED")
    // twitch.rig.log("channel ID:", auth.channelId)
    setAuth(token);
    $.ajax(requests.get);
});
function updateBlock(res) {
    // twitch.rig.log("UPDATE BLOCK", res)
    // console.log("UPDATE BLOCK",res)
    let data = JSON.parse(res)
    // console.log("MMM", data.message)
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
//   twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function logSuccess(hex, status) {
  // we could also use the output to update the block synchronously here,
  // but we want all views to get the same broadcast response at the same time.
//   twitch.rig.log('EBS request returned '+hex+' ('+status+')');
}

function sceneSelect(scene){
    // console.log("changing scene to: ",scene)
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
        questionsSeen +=1 // if they had the chance to vote add 1
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
        // $("#score-box-text").text(questionsCorrect+'/'+questionsSeen+' Correct')
    }
    twitchscene = scene
}
function updateQuestion(question){
    // console.log("changing question to: ",question)
    globalQuestion = question;
    $("#poll-question").text(question)
}
function updateAnswer(answer){
    globalAnswer = answer
    // $("#agree-answer").text(answer)
    $("#result").removeClass("winner loser neutral")
}
function updateCorrect(correct){
    if(correct=="unset"){
        correctResponse = null
    }else{
        correctResponse = correct
        // console.log("correctResponse = ", correct)
        // console.log("Response = ", response)
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
        // console.log("results: ",response, correctResponse,response==correctResponse)
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
        // console.log("KEYCODE",keycode)
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
        // twitch.rig.log(message)
        // console.log(message)
        requests.vote['data'] = JSON.stringify(message)
        $.ajax(requests.vote);
    })
    $("#btn-disagree").click(function(){
        response = false;
        $("#btn-agree").animate({opacity:0.2},1000,function(){})
        $("#btn-disagree").removeClass("button-animations")
        $("#btn-agree").removeClass("button-animations")
        // $("#result").fadeIn()
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
    // twitch.listen('broadcast', function (target, contentType, data) {
    //     twitch.rig.log('Received broadcast twitch pubsub');
    //     twitch.rig.log("target",target);
    //     twitch.rig.log("contentType",contentType);
    //     twitch.rig.log("data",data);
    //     parsed = JSON.parse(data)
    //     console.log(parsed['data'])
    //     if(parsed['data']['identifier'] == 'scene'){
    //         sceneSelect(parsed['data']['payload'])
    //     }else if(parsed['data']['identifier'] == 'question'){
    //         updateQuestion(parsed['data']['payload'])
    //     }else if(parsed['data']['identifier'] == 'answer'){
    //         updateAnswer(parsed['data']['payload'])
    //     }else if(parsed['data']['identifier'] == 'correct'){
    //         updateCorrect(parsed['data']['payload'])
    //     }
    // });
    twitch.listen('global', function (target, contentType, data) {
        parsed = JSON.parse(data)
        // console.log(parsed['data'])
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
                // console.log("Limit reached received//Limit Enabled:", limitEnabled)
                // console.log("Limit reached received//submittedAnswer", submittedAnswer)
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
