var token = "";
var tuid = "";
var ebs = "";
var twitchscene = "";
var globalQuestion = ""
var globalAnswer = ""
var channelId = '';
var limitEnabled = false;
var responseLimit = 0
var submittedAnswer = false
var response = null;
var correctResponse = null;
var choicenum = 2;
var choice1 = "unloaded";
var choice2 = "unloaded";
var choice3 = "unloaded";
var choice4 = "unloaded";


var twitch = window.Twitch.ext;

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
    (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
    m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-57639561-8', {
    cookieFlags: 'max-age=7200;secure;samesite=none'
});
ga("set","anonymizeIP",true);
$(document).ready(function() {
    ga('send', 'pageview');
});

var requests = {
    set: createRequest('POST'),
    get: createRequest("GET"),
    submit: createRequest("POST"),
    vote: createRequest("POST"),
};

function createRequest(type) {

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

})

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
        choicenum = data.message.choicenum;
        console.log("choicenum",choicenum)
        choice1 = data.message.choice1;
        choice2 = data.message.choice2;
        choice3 = data.message.choice3;
        choice4 = data.message.choice4;
        $('#op1').text(choice1)
        $('#op2').text(choice2)
        $('#op3').text(choice3)
        $('#op4').text(choice4)
        sceneSelect(data.message.scene)
    }
}
function logError(_, error, status) {
}

function logSuccess(hex, status) {
}

function sceneSelect(scene){
    // $("#scroll-bar").show()
    // $("#triangle").show()
    if(scene == 'hide'){
        $("#main").hide()
    }
    if(scene == 'wait'){
        $("#main").show()
        $("#wait-scene").show()
        $("#polling").hide()
        $("#agree-scene").hide()
        $("#choice-scene").hide()
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
        $("#choice-scene").hide()
        correctResponse = null
        response = null
    }
    if(scene == 'agree'){
        $("#main").show()
        $("#result").removeClass("winner loser neutral")
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").hide()
        $("#button-holder").show()
        $("#agree-scene").show()
        // questionsSeen +=1 
        $("#btn-disagree").addClass("button-animations")
        $("#btn-agree").addClass("button-animations")
        $("#btn-disagree").css("opacity","100%")
        $("#btn-agree").css("opacity","100%")
        $("#slash").show()
        $("#agree-answer").show()
        $("#choice-scene").hide()
        correctResponse = null
        response = null
    }
    if(scene == 'result'){
        $("#main").show()
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").show()
        $("#button-holder").hide()
        $("#slash").hide()
        $("#agree-scene").show()
        $("#agree-answer").hide()
        $("#choice-scene").hide()
    }
    if(scene == 'choice'){
        $('#op1').text(choice1)
        $('#op2').text(choice2)
        $('#op3').text(choice3)
        $('#op4').text(choice4)
        $("#main").show()
        $("#wait-scene").hide()
        $("#polling").hide()
        $("#result").hide()
        $("#agree-scene").hide()
        let targets = ["#op1","#op2","#op3","#op4"]
        for(item of targets){
            $(item).show()
            $(item).addClass("button-animations")
            $(item).removeClass("button-selected")
        }
        $(".choicebutton-row").show()
        if(choicenum == 4){
            $("#choicebutton-row2").show()
            $("#choice-spacer").hide()
        }else{
            $("#choice-spacer").show()
            $("#choicebutton-row2").hide()
        }
        $("#choice-scene").show()
    }
    twitchscene = scene
}
function updateChoice(data){
    choicenum = data.choicenum;
    console.log("choicenum",choicenum)
    choice1 = data.choice1;
    choice2 = data.choice2;
    choice3 = data.choice3;
    choice4 = data.choice4;
    $('#op1').text(choice1)
    $('#op2').text(choice2)
    $('#op3').text(choice3)
    $('#op4').text(choice4)
    if(twitchscene == 'choice'){
        sceneSelect('choice')
    }
}
function updateQuestion(question){
    globalQuestion = question;
    $("#poll-question").text(question)
    submittedAnswer = false
    $("#poll-input").val("")
    $('#input-div').show()
    $("#submitted-div").hide()
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
        let message = globalAnswer
        // message = message.trim()
        let outcome
        if(correct){
            outcome = "True!"
        }else{
            outcome = "False!"
        }
        message = message + " was " + outcome
        $("#result").text(message)
        if(response==null){
            $("#result").addClass("neutral")
        }else if(response==correctResponse){
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
    let poll = $("#poll-input").val()
    $("#submitted-text").text('Submitted: '+ poll)
    poll = poll.toLowerCase();
    poll = poll.trim()
    const punctuation = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/g;
    poll = poll.replace(punctuation,'')
    if(poll.length<1){
        return;
    }
    submittedAnswer = true
    $("#input-div").fadeOut().promise().done(function(){
        $("#submitted-div").fadeIn()
    })
    let message = {
        "flag":"poll-ans",
        "payload": poll,
        "question": globalQuestion,
        "limit": responseLimit,
        "channel": channelId
    }
    requests.submit['data'] = JSON.stringify(message)
    $.ajax(requests.submit);
    ga('send', 'event', 'Submit', 'mobile', poll);
}

$(function() {
    $(".option-button").click(function(event){
        if(response == null){
            response = true;
            let targets = ["#op1","#op2","#op3","#op4"]
            console.log("EVENTS____", event.target.id)
            let selected = "#" + event.target.id
            $(selected).removeClass("button-animations")
            $(selected).addClass("button-selected")
            const index = targets.indexOf(selected);
            targets.splice(index, 1);
            for(item of targets){
                $(item).animate({opacity:0.2},1000,function(){})
                $(item).removeClass("button-animations")
            }
            let message = {
                "flag":"choice-ans",
                "payload": selected.slice(-1),
                "question": globalQuestion,
                "answer": globalAnswer,
                "channel": channelId
            }
            requests.submit['data'] = JSON.stringify(message)
            $.ajax(requests.submit);
            ga('send', 'event', 'Choice', 'mobile', selected.slice(-1));
        }
    });
    $( "#poll-input" ).focus(function() {
        $("#logo").hide();
    });
    $( "#poll-input" ).focusout(function() {
        $("#logo").show();
    });
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
        if(response == null){
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
            ga('send', 'event', 'Click', 'mobile', 'AGREE');
        }
    })
    $("#btn-disagree").click(function(){
        if(response == null){
            console.log("clicked")
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
            ga('send', 'event', 'Click', 'mobile', 'DISAGREE');
        }
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
        }else if(parsed['data']['identifier'] == 'choice-set'){
            updateChoice(parsed['data'])
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
})